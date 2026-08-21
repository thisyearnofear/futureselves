/**
 * signal.tsx — Deep link landing route for shared transmissions, streak
 * milestones, and voice unlocks.
 *
 * URL formats (all params are self-contained — no auth, no DB lookup, no
 * lookup of the sender's account. Mirrors challenge.tsx's stateless
 * pattern so a stranger without an account can open the link safely):
 *
 *   futureself://signal?type=transmission&cast=shadow&from=Alex&streak=12&quote=...
 *   futureself://signal?type=milestone&from=Alex&streak=30
 *   futureself://signal?type=unlock&cast=future_mentor&from=Alex&streak=7
 *
 * Note on link shape: apps/default/lib/futureself.ts's buildSignalLink()
 * generates an https://futureself.app/signal?... universal link, NOT the
 * futureself:// custom scheme challenge.tsx uses. That's deliberate: this
 * route's whole purpose is reaching people who don't have the app
 * installed yet, and a custom-scheme link does nothing on a device without
 * the app — it can't even open a browser fallback. A universal link works
 * for everyone once http(s) Associated Domains / App Links are configured
 * for futureself.app to route /signal at this screen (that web-side
 * routing config is NOT part of this change — see docs/shipaton-2026.md
 * follow-ups). Until that's set up, the https link falls back to the
 * marketing site for a user without the app, same as before, but is ready
 * to deep-link the moment the domain is wired up — no client code changes
 * needed later.
 *
 * Why this exists: the three existing share handlers in futureself-home.tsx
 * (handleShare, handleShareMilestone, handleShareVoiceUnlock) produced
 * plain text pointing at the bare marketing URL (futureself.app) — a
 * stranger who received the share landed on a generic homepage with no
 * context. This route gives them the actual shared moment (the quote, the
 * cast member, the streak) plus a direct path into onboarding, and lets
 * them re-share once they've felt it — the same acquisition shape as the
 * Football Path's challenge.tsx, ported to the flagship ritual.
 */

import { useCallback } from "react";
import { StyleSheet, View, Text, Pressable, Platform } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import { AvatarReveal } from "@/components/avatar-reveal";
import { formatCastMember } from "@/lib/futureself";
import type { CastMember } from "@/lib/futureself";
import { castMemberValues } from "../../../packages/domain/src";

type SignalType = "transmission" | "milestone" | "unlock";

const CAST_MEMBERS: ReadonlySet<string> = new Set(castMemberValues);

function isCastMember(value: string | undefined): value is CastMember {
  return Boolean(value && CAST_MEMBERS.has(value));
}

export default function SignalScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    type?: string;
    cast?: string;
    from?: string;
    streak?: string;
    quote?: string;
  }>();

  const signalType: SignalType =
    params.type === "milestone" || params.type === "unlock" ? params.type : "transmission";
  const castMember: CastMember = isCastMember(params.cast) ? params.cast : "future_self";
  const fromName = params.from?.trim() || "A friend";
  const streak = Math.max(0, parseInt(params.streak ?? "0", 10) || 0);
  const quote = params.quote?.trim();

  const handleStartRitual = useCallback(() => {
    if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.replace("/landing" as any);
  }, [router]);

  const handleShareBack = useCallback(async () => {
    if (Platform.OS === "web") return;
    try {
      const { Share: RNShare } = await import("react-native");
      const link = "futureself.app";
      const message =
        signalType === "milestone"
          ? `${fromName} is on a ${streak}-day streak talking to their future self. I want in. ${link}`
          : signalType === "unlock"
            ? `${fromName} just unlocked ${formatCastMember(castMember)} on Future Selves. I want to hear mine. ${link}`
            : `A voice from ${fromName}'s future self:\n\n"${quote ?? ""}"\n\nI want to hear from mine. ${link}`;
      await RNShare.share({ message, title: "Future Selves" });
    } catch {
      /* cancelled */
    }
  }, [signalType, fromName, streak, castMember, quote]);

  return (
    <LinearGradient colors={["#080A17", "#11162B", "#21172D"]} style={styles.background}>
      <StatusBar style="light" />
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <Pressable style={styles.closeButton} onPress={() => router.replace("/landing" as any)}>
            <Ionicons name="close" size={24} color="#6B7290" />
          </Pressable>

          <View style={styles.content}>
            <View style={styles.badge}>
              <Ionicons name="radio" size={14} color="#F7D38B" />
              <Text style={styles.badgeText}>
                {signalType === "milestone"
                  ? "STREAK SIGNAL"
                  : signalType === "unlock"
                    ? "VOICE UNLOCKED"
                    : "TRANSMISSION RECEIVED"}
              </Text>
            </View>

            <AvatarReveal castMember={castMember} size={120} />

            {signalType === "transmission" ? (
              <>
                <Text style={styles.eyebrow}>{formatCastMember(castMember)} · Day {streak}</Text>
                <View style={styles.quoteCard}>
                  <Text style={styles.openQuote}>&ldquo;</Text>
                  <Text style={styles.quoteText}>
                    {quote || "Your future self has something to say."}
                  </Text>
                  <Text style={styles.closeQuote}>&rdquo;</Text>
                </View>
                <Text style={styles.subhead}>
                  {fromName} received this from their future self today.
                </Text>
              </>
            ) : signalType === "unlock" ? (
              <>
                <Text style={styles.title}>{formatCastMember(castMember)} has arrived</Text>
                <Text style={styles.subhead}>
                  {fromName} kept their ritual going long enough for a new voice to reach them.
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.title}>{streak}-day streak</Text>
                <Text style={styles.subhead}>
                  {fromName} has kept this ritual going for {streak} days straight. The
                  timeline remembers.
                </Text>
              </>
            )}

            <Pressable
              style={({ pressed }) => [styles.ctaButton, pressed && styles.pressed]}
              onPress={handleStartRitual}
            >
              <Ionicons name="mic-outline" size={18} color="#080A17" />
              <Text style={styles.ctaButtonText}>Hear from your own future self</Text>
            </Pressable>

            {Platform.OS !== "web" ? (
              <Pressable
                style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
                onPress={handleShareBack}
              >
                <Ionicons name="share-outline" size={16} color="#8F96B4" />
                <Text style={styles.secondaryButtonText}>Pass it on</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1 },
  safeArea: { flex: 1 },
  container: {
    flex: 1,
    position: "relative",
  },
  closeButton: {
    position: "absolute",
    top: 16,
    right: 20,
    zIndex: 10,
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 18,
    paddingHorizontal: 28,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(247,211,139,0.12)",
    borderWidth: 1,
    borderColor: "rgba(247,211,139,0.25)",
  },
  badgeText: {
    color: "#F7D38B",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  eyebrow: {
    color: "#8F96B4",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  title: {
    color: "#F8F0DE",
    fontSize: 24,
    fontWeight: "900",
    textAlign: "center",
    letterSpacing: -0.4,
  },
  quoteCard: {
    width: "100%",
    padding: 24,
    borderRadius: 24,
    backgroundColor: "rgba(14,17,34,0.84)",
    borderWidth: 1,
    borderColor: "rgba(247,211,139,0.2)",
    gap: 4,
  },
  openQuote: {
    color: "#F7D38B",
    fontSize: 32,
    fontWeight: "900",
    lineHeight: 32,
    marginBottom: -6,
  },
  quoteText: {
    color: "#E8E1D3",
    fontSize: 17,
    lineHeight: 25,
    fontWeight: "700",
  },
  closeQuote: {
    color: "#F7D38B",
    fontSize: 32,
    fontWeight: "900",
    lineHeight: 32,
    textAlign: "right",
    marginTop: -4,
  },
  subhead: {
    color: "#BFC6DE",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    maxWidth: 300,
  },
  ctaButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 28,
    paddingVertical: 17,
    borderRadius: 26,
    backgroundColor: "#F7D38B",
    marginTop: 8,
  },
  ctaButtonText: {
    color: "#080A17",
    fontSize: 16,
    fontWeight: "800",
  },
  secondaryButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
  },
  secondaryButtonText: {
    color: "#8F96B4",
    fontSize: 13,
    fontWeight: "700",
  },
  pressed: {
    transform: [{ scale: 0.97 }],
    opacity: 0.9,
  },
});
