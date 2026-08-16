import { ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "convex/react";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/convex/_generated/api";
import type { GameState } from "@/lib/futureself";
import { getLocalDateKey } from "@/lib/futureself";
import { ConstellationMap } from "@/components/constellation-map";
import { DivergenceGauge } from "@/components/divergence-gauge";
import { AvatarReveal } from "@/components/avatar-reveal";
import { TimelineMorphStrip } from "@/components/timeline-morph-strip";
import { BottomNav } from "@/components/bottom-nav";
import { formatCastMember } from "@/lib/futureself";
import type { CastMember, ConstellationStar } from "@/lib/futureself";
import Animated, { FadeIn, FadeInUp, ZoomIn } from "react-native-reanimated";

const AURA_DESCRIPTIONS: Partial<Record<CastMember, string>> = {
  future_self: "The version of you who made it through.",
  future_partner: "The love that stayed and grew.",
  future_mentor: "The voice of earned wisdom.",
  shadow: "The part you avoid, made visible.",
  alternate_self: "A life that branched differently.",
  the_ghost: "What haunts the line between choices.",
};

export default function ConstellationPage() {
  const dateKey = getLocalDateKey();
  const state = useQuery(api.game.getState, { dateKey }) as GameState | undefined | null;

  if (!state) {
    return (
      <LinearGradient colors={["#080A17", "#11162B", "#21172D"]} style={s.bg}>
        <StatusBar style="light" />
        <SafeAreaView style={s.loading}>
          <Text style={s.loadingText}>Tuning the constellation...</Text>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  const persona = state.persona;
  const divergenceScore = persona?.timelineDivergenceScore ?? 0;
  const litStars = state.constellation.filter((s) => s.state === "lit" || s.state === "dim");
  const lockedStars = state.constellation.filter((s) => s.state === "locked" || s.state === "quiet");
  const nextUnlock = state.constellation.find((s) => s.state === "locked" || s.state === "quiet");

  return (
    <LinearGradient colors={["#080A17", "#11162B", "#21172D"]} style={s.bg}>
      <StatusBar style="light" />
      <SafeAreaView style={s.safeArea}>
        <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
          {/* Hero header */}
          <Animated.View entering={FadeInUp.duration(300)} style={s.header}>
            <View style={s.headerIconWrap}>
              <Ionicons name="star-half" size={24} color="#F7D38B" />
            </View>
            <Text style={s.headerEyebrow}>CONSTELLATION</Text>
            <Text style={s.headerTitle}>
              {litStars.length} voice{litStars.length !== 1 ? "s" : ""} on the line
            </Text>
            <Text style={s.headerCopy}>
              Each voice is a node in your timeline. Your daily choices shape which ones draw close.
            </Text>
          </Animated.View>

          {/* Timeline morph — scrub between unlocked voices to see how the line shifts */}
          {litStars.length > 0 ? (
            <Animated.View entering={FadeInUp.delay(150).duration(400)} style={s.morphCard}>
              <Text style={s.cardTitle}>Your timeline</Text>
              <Text style={s.morphCopy}>
                Tap through your unlocked voices to see how far the line has drifted.
              </Text>
              <TimelineMorphStrip stars={litStars} divergenceScore={divergenceScore} size={160} />
            </Animated.View>
          ) : null}

          {/* Star map */}
          <Animated.View entering={ZoomIn.delay(200).duration(600).springify().damping(14)} style={s.mapCard}>
            <ConstellationMap
              stars={state.constellation}
              divergenceScore={divergenceScore}
              size={320}
              nextUnlockLabel={nextUnlock?.label}
            />
          </Animated.View>

          {/* Divergence gauge */}
          <Animated.View entering={FadeIn.delay(400).duration(400)} style={s.gaugeCard}>
            <Text style={s.cardTitle}>Timeline divergence</Text>
            <DivergenceGauge score={divergenceScore} label={getDivergenceLabel(divergenceScore)} />
          </Animated.View>

          {/* Lit voices grid */}
          {litStars.length > 0 ? (
            <Animated.View entering={FadeInUp.delay(300).duration(400)} style={s.sectionCard}>
              <Text style={s.cardTitle}>Active voices</Text>
              <View style={s.voiceGrid}>
                {litStars.map((star) => (
                  <VoiceCard key={star.castMember} star={star} />
                ))}
              </View>
            </Animated.View>
          ) : null}

          {/* Locked voices */}
          {lockedStars.length > 0 ? (
            <Animated.View entering={FadeInUp.delay(400).duration(400)} style={s.sectionCard}>
              <Text style={s.cardTitle}>Approaching</Text>
              <View style={s.voiceGrid}>
                {lockedStars.map((star) => (
                  <LockedVoiceCard key={star.castMember} star={star} />
                ))}
              </View>
            </Animated.View>
          ) : null}

          {/* Open threads */}
          {state.openThreads.length > 0 ? (
            <Animated.View entering={FadeInUp.delay(500).duration(400)} style={s.sectionCard}>
              <Text style={s.cardTitle}>Open threads</Text>
              {state.openThreads.map((thread) => (
                <View key={thread.id} style={s.threadItem}>
                  <View style={s.threadHeader}>
                    <Ionicons name="git-branch-outline" size={14} color="#F7D38B" />
                    <Text style={s.threadCast}>{formatCastMember(thread.castMember)}</Text>
                  </View>
                  <Text style={s.threadTitle}>{thread.title}</Text>
                  <Text style={s.threadSeed}>{thread.seed}</Text>
                </View>
              ))}
            </Animated.View>
          ) : null}
        </ScrollView>
        <BottomNav />
      </SafeAreaView>
    </LinearGradient>
  );
}

function VoiceCard({ star }: { star: ConstellationStar }) {
  return (
    <View style={s.voiceCard}>
      <AvatarReveal castMember={star.castMember} size={56} />
      <Text style={s.voiceName}>{star.label}</Text>
      <Text style={s.voiceMood}>{star.emotionalRegister}</Text>
      <Text style={s.voiceDesc}>{AURA_DESCRIPTIONS[star.castMember] ?? "A voice from your future."}</Text>
    </View>
  );
}

function LockedVoiceCard({ star }: { star: ConstellationStar }) {
  const isQuiet = star.state === "quiet";
  return (
    <View style={[s.voiceCard, s.voiceCardLocked]}>
      <View style={s.lockedOrb}>
        <Ionicons name={isQuiet ? "moon" : "lock-closed"} size={20} color="rgba(247,211,139,0.4)" />
      </View>
      <Text style={s.voiceNameLocked}>{star.label}</Text>
      <Text style={s.voiceHint}>{star.unlockHint}</Text>
    </View>
  );
}

function getDivergenceLabel(score: number): string {
  if (score >= 5) return "shadow close";
  if (score >= 3) return "flickering";
  if (score >= 1) return "slight drift";
  return "steady";
}

const s = StyleSheet.create({
  bg: { flex: 1 },
  safeArea: { flex: 1 },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    color: "#BFC6DE",
    fontSize: 15,
    fontWeight: "700",
  },
  content: {
    padding: 20,
    paddingBottom: 60,
    gap: 16,
  },
  header: {
    alignItems: "center",
    gap: 8,
    paddingTop: 20,
  },
  headerIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(247,211,139,0.1)",
    borderWidth: 1,
    borderColor: "rgba(247,211,139,0.2)",
  },
  headerEyebrow: {
    color: "#F7D38B",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  headerTitle: {
    color: "#F8F0DE",
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: -0.8,
  },
  headerCopy: {
    color: "#AEB6D4",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    maxWidth: 300,
  },
  mapCard: {
    alignItems: "center",
    padding: 20,
    borderRadius: 30,
    backgroundColor: "rgba(14,17,34,0.6)",
    borderWidth: 1,
    borderColor: "rgba(247,211,139,0.12)",
  },
  morphCard: {
    alignItems: "center",
    gap: 10,
    padding: 20,
    borderRadius: 28,
    backgroundColor: "rgba(14,17,34,0.72)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  morphCopy: {
    color: "#AEB6D4",
    fontSize: 12,
    lineHeight: 17,
    textAlign: "center",
    maxWidth: 260,
    marginBottom: 4,
  },
  gaugeCard: {
    alignItems: "center",
    gap: 12,
    padding: 20,
    borderRadius: 28,
    backgroundColor: "rgba(14,17,34,0.72)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  cardTitle: {
    color: "#F8F0DE",
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  sectionCard: {
    gap: 12,
    padding: 20,
    borderRadius: 28,
    backgroundColor: "rgba(14,17,34,0.72)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  voiceGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  voiceCard: {
    width: "48%",
    flexGrow: 1,
    alignItems: "center",
    gap: 6,
    padding: 14,
    borderRadius: 20,
    backgroundColor: "rgba(247,211,139,0.06)",
    borderWidth: 1,
    borderColor: "rgba(247,211,139,0.12)",
  },
  voiceCardLocked: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderColor: "rgba(255,255,255,0.06)",
  },
  lockedOrb: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(14,17,34,0.6)",
    borderWidth: 1,
    borderColor: "rgba(247,211,139,0.1)",
  },
  voiceName: {
    color: "#F8F0DE",
    fontSize: 13,
    fontWeight: "900",
    textAlign: "center",
  },
  voiceNameLocked: {
    color: "#8F96B4",
    fontSize: 13,
    fontWeight: "900",
    textAlign: "center",
  },
  voiceMood: {
    color: "#F7D38B",
    fontSize: 11,
    fontWeight: "700",
    fontStyle: "italic",
    textAlign: "center",
  },
  voiceDesc: {
    color: "#AEB6D4",
    fontSize: 11,
    lineHeight: 15,
    textAlign: "center",
  },
  voiceHint: {
    color: "#6F7591",
    fontSize: 10,
    lineHeight: 14,
    textAlign: "center",
    fontWeight: "600",
  },
  threadItem: {
    gap: 6,
    padding: 14,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  threadHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  threadCast: {
    color: "#F7D38B",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  threadTitle: {
    color: "#F8F0DE",
    fontSize: 15,
    fontWeight: "900",
  },
  threadSeed: {
    color: "#BFC6DE",
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "600",
  },
});
