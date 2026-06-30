/**
 * challenge.tsx — Deep link route for the challenge-a-friend viral loop.
 *
 * URL format: futureself://challenge?drill=reaction_time&target=340&from=Alex
 *
 * Flow:
 * 1. Friend opens challenge link from a share
 * 2. Sees "Beat Alex's 340ms" banner
 * 3. If they have an ambition → drill starts immediately
 * 4. If no ambition → prompted to declare first (redirect to football tab)
 * 5. After completing the drill → sees comparison vs. challenger
 * 6. Can challenge back → creates a new deep link to share
 *
 * This is the core viral mechanic: every drill completion creates an
 * invitation that brings a new user into the app with context.
 */

import { useCallback, useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  ActivityIndicator,
  Pressable,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery } from "convex/react";
import { Stack, useRouter, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";
import { api } from "@/convex/_generated/api";
import { ReactionTimeDrill } from "@/components/drill-reaction-time";
import { JugglingDrill } from "@/components/drill-juggling";
import { SprintDrill } from "@/components/drill-sprint";
import { useQVACPrewarmContext } from "@/lib/qvac-prewarm-context";
import { interpretTrajectory, type FootballPosition } from "@/lib/football-llm";
import { isLocalMode } from "@/lib/ai";
import {
  type DrillType,
  formatResult,
  getProComparison,
  DRILL_LABELS,
} from "@/lib/drill-utils";

type ChallengePhase = "banner" | "drilling" | "result" | "saving";

interface ChallengeParams {
  drill: string;
  target: string;
  from: string;
}

export default function ChallengeScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ drill?: string; target?: string; from?: string }>();
  const prewarm = useQVACPrewarmContext();
  const ambition = useQuery(api.football.getActiveAmbition, {});

  const startDrillSession = useMutation(api.football.startDrillSession);
  const completeDrillSession = useMutation(api.football.completeDrillSession);
  const recomputeTrajectory = useMutation(api.football.recomputeTrajectory);
  const updateTrajectoryNarrative = useMutation(api.football.updateTrajectoryNarrative);

  const [phase, setPhase] = useState<ChallengePhase>("banner");
  const [isSaving, setIsSaving] = useState(false);
  const [resultValue, setResultValue] = useState<number | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const llmModelId = isLocalMode() ? prewarm?.llm.modelId ?? null : null;

  // Parse and validate params
  const validDrillTypes: DrillType[] = ["reaction_time", "juggling", "sprint"];
  const drillType: DrillType =
    validDrillTypes.includes(params.drill as DrillType)
      ? (params.drill as DrillType)
      : "reaction_time";
  const targetValue = parseFloat(params.target ?? "0") || 0;
  const fromName = params.from || "A friend";

  const handleStartDrill = useCallback(() => {
    if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPhase("drilling");
  }, []);

  const handleComplete = useCallback(
    async (value: number, rawData: Array<{ timestamp: number; value: number }>) => {
      setResultValue(value);
      setIsSaving(true);
      setSaveError(null);
      try {
        if (ambition) {
          const sessionId = await startDrillSession({
            ambitionId: ambition._id as any,
            drillType: drillType as any,
          });
          await completeDrillSession({
            sessionId: sessionId as any,
            resultValue: value,
            rawData,
          });
          await recomputeTrajectory({ drillType: drillType as any });

          if (llmModelId && ambition) {
            try {
              const interpretation = await interpretTrajectory(llmModelId, {
                playerName: "Player",
                targetPosition: (ambition.targetPosition as FootballPosition) ?? "unknown",
                trajectories: [
                  {
                    drillType: drillType as any,
                    sessionCount: 1,
                    trendPercent: 0,
                    latestValue: value,
                    bestValue: value,
                  },
                ],
              });
              await updateTrajectoryNarrative({
                drillType: drillType as any,
                narrative: interpretation.narrative,
                suggestedPosition: interpretation.suggestedPosition as any,
              });
            } catch (e) {
              console.warn("[Challenge] Trajectory interpretation failed:", e);
            }
          }
        }
        setIsSaving(false);
        setPhase("result");
        if (Platform.OS !== "web") {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      } catch (e) {
        setSaveError(e instanceof Error ? e.message : "Could not save result.");
        setIsSaving(false);
        setPhase("result"); // Show result even if save fails
      }
    },
    [ambition, drillType, startDrillSession, completeDrillSession, recomputeTrajectory, updateTrajectoryNarrative, llmModelId],
  );

  const handleCancel = useCallback(() => {
    router.replace("/football" as any);
  }, [router]);

  const handleChallengeBack = useCallback(async () => {
    if (Platform.OS === "web" || resultValue === null) return;
    try {
      const { Share: RNShare } = await import("react-native");
      const link = `futureself://challenge?drill=${drillType}&target=${resultValue}&from=You`;
      const comparison = getProComparison(drillType, resultValue);
      await RNShare.share({
        message: `I beat ${fromName}'s challenge! My ${DRILL_LABELS[drillType]}: ${formatResult(drillType, resultValue)}. ${comparison?.diffLabel ?? ""}. Can you beat me? ${link} #FootballPath`,
        title: "Football Path Challenge",
      });
    } catch { /* cancelled */ }
  }, [drillType, resultValue, fromName]);

  // ─── Loading state ──────────────────────────────────────────────────────

  if (ambition === undefined) {
    return (
      <LinearGradient colors={["#080A17", "#11162B", "#21172D"]} style={styles.background}>
        <StatusBar style="light" />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.centerContainer}>
            <ActivityIndicator color="#F7D38B" size="large" />
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // ─── No ambition → redirect to football tab ─────────────────────────────

  if (!ambition && phase === "banner") {
    return (
      <LinearGradient colors={["#080A17", "#11162B", "#21172D"]} style={styles.background}>
        <StatusBar style="light" />
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.centerContainer}>
            <Ionicons name="football" size={48} color="#F7D38B" />
            <Text style={styles.redirectTitle}>Declare your ambition first</Text>
            <Text style={styles.redirectSub}>
              {fromName} challenged you to beat their {formatResult(drillType, targetValue)} {DRILL_LABELS[drillType].toLowerCase()}. Declare your football dream to start training.
            </Text>
            <Pressable
              style={({ pressed }) => [styles.ctaButton, pressed && { transform: [{ scale: 0.97 }] }]}
              onPress={() => router.replace("/football" as any)}
            >
              <Text style={styles.ctaButtonText}>Start my Football Path</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // ─── Saving state ───────────────────────────────────────────────────────

  if (isSaving) {
    return (
      <LinearGradient colors={["#080A17", "#11162B", "#21172D"]} style={styles.background}>
        <StatusBar style="light" />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.centerContainer}>
            <ActivityIndicator color="#F7D38B" size="large" />
            <Text style={styles.savingText}>Saving your result...</Text>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // ─── Result phase ───────────────────────────────────────────────────────

  if (phase === "result" && resultValue !== null) {
    const comparison = getProComparison(drillType, resultValue, ambition?.targetPosition);
    const isLowerBetter = drillType !== "juggling";
    const beatChallenge = isLowerBetter ? resultValue <= targetValue : resultValue >= targetValue;
    const diff = isLowerBetter ? targetValue - resultValue : resultValue - targetValue;

    return (
      <LinearGradient colors={["#080A17", "#11162B", "#21172D"]} style={styles.background}>
        <StatusBar style="light" />
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.resultContainer}>
            {/* Win/Loss banner */}
            <View style={[styles.resultBanner, { backgroundColor: beatChallenge ? "rgba(169,247,181,0.1)" : "rgba(255,154,154,0.1)" }]}>
              <Ionicons
                name={beatChallenge ? "trophy" : "close-circle"}
                size={32}
                color={beatChallenge ? "#A9F7B5" : "#FF9A9A"}
              />
              <Text style={[styles.resultBannerText, { color: beatChallenge ? "#A9F7B5" : "#FF9A9A" }]}>
                {beatChallenge
                  ? `You beat ${fromName} by ${formatResult(drillType, Math.abs(diff))}!`
                  : `${fromName} beat you by ${formatResult(drillType, Math.abs(diff))}`}
              </Text>
            </View>

            {/* Your result */}
            <Text style={styles.resultLabel}>Your {DRILL_LABELS[drillType]}</Text>
            <Text style={styles.resultValue}>{formatResult(drillType, resultValue)}</Text>

            {/* Comparison table */}
            <View style={styles.comparisonTable}>
              <View style={styles.comparisonRow}>
                <Text style={styles.comparisonName}>{fromName}'s challenge</Text>
                <Text style={styles.comparisonNum}>{formatResult(drillType, targetValue)}</Text>
              </View>
              <View style={styles.comparisonDivider} />
              <View style={styles.comparisonRow}>
                <Text style={styles.comparisonName}>Your result</Text>
                <Text style={[styles.comparisonNum, { color: "#F7D38B" }]}>{formatResult(drillType, resultValue)}</Text>
              </View>
              {comparison && (
                <>
                  <View style={styles.comparisonDivider} />
                  <View style={styles.comparisonRow}>
                    <Text style={styles.comparisonName}>{comparison.proName} (pro)</Text>
                    <Text style={styles.comparisonNum}>{formatResult(drillType, comparison.proValue)}</Text>
                  </View>
                </>
              )}
            </View>

            {saveError && (
              <Text style={styles.errorText}>{saveError}</Text>
            )}

            {/* Actions */}
            <View style={styles.resultActions}>
              <Pressable
                style={({ pressed }) => [styles.challengeBackButton, pressed && { transform: [{ scale: 0.97 }] }]}
                onPress={handleChallengeBack}
              >
                <Ionicons name="share-outline" size={18} color="#080A17" />
                <Text style={styles.challengeBackText}>Challenge back</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.doneButton, pressed && { transform: [{ scale: 0.97 }] }]}
                onPress={() => router.replace("/football" as any)}
              >
                <Text style={styles.doneButtonText}>See my card</Text>
              </Pressable>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // ─── Banner phase (before drill starts) ─────────────────────────────────

  if (phase === "banner") {
    return (
      <LinearGradient colors={["#080A17", "#11162B", "#21172D"]} style={styles.background}>
        <StatusBar style="light" />
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.bannerContainer}>
            <Pressable style={styles.closeButton} onPress={handleCancel}>
              <Ionicons name="close" size={24} color="#6B7290" />
            </Pressable>

            <View style={styles.bannerContent}>
              <View style={styles.challengeBadge}>
                <Ionicons name="flash" size={16} color="#F7D38B" />
                <Text style={styles.challengeBadgeText}>CHALLENGE RECEIVED</Text>
              </View>

              <Text style={styles.bannerTitle}>{fromName} challenged you</Text>

              <View style={styles.targetCard}>
                <Text style={styles.targetLabel}>{DRILL_LABELS[drillType]}</Text>
                <Text style={styles.targetValue}>{formatResult(drillType, targetValue)}</Text>
                <Text style={styles.targetSub}>Beat this score</Text>
              </View>

              <Pressable
                style={({ pressed }) => [styles.startButton, pressed && { transform: [{ scale: 0.97 }] }]}
                onPress={handleStartDrill}
              >
                <Ionicons name="play" size={20} color="#080A17" />
                <Text style={styles.startButtonText}>Accept challenge</Text>
              </Pressable>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // ─── Drilling phase ─────────────────────────────────────────────────────

  return (
    <LinearGradient colors={["#080A17", "#11162B", "#21172D"]} style={styles.background}>
      <StatusBar style="light" />
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safeArea}>
        {/* Challenge banner at top during drill */}
        <View style={styles.drillBanner}>
          <Ionicons name="flash" size={14} color="#F7D38B" />
          <Text style={styles.drillBannerText}>
            Beat {fromName}'s {formatResult(drillType, targetValue)}
          </Text>
        </View>
        {drillType === "reaction_time" && (
          <ReactionTimeDrill onComplete={handleComplete} onCancel={handleCancel} />
        )}
        {drillType === "juggling" && (
          <JugglingDrill onComplete={handleComplete} onCancel={handleCancel} />
        )}
        {drillType === "sprint" && (
          <SprintDrill onComplete={handleComplete} onCancel={handleCancel} />
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1 },
  safeArea: { flex: 1 },
  centerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
  },
  // ─── Banner phase ─────────────────────────────────────────────────────
  bannerContainer: {
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
  bannerContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 24,
    paddingHorizontal: 24,
  },
  challengeBadge: {
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
  challengeBadgeText: {
    color: "#F7D38B",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  bannerTitle: {
    color: "#F8F0DE",
    fontSize: 24,
    fontWeight: "800",
    textAlign: "center",
  },
  targetCard: {
    alignItems: "center",
    gap: 6,
    padding: 28,
    borderRadius: 28,
    backgroundColor: "rgba(14,17,34,0.84)",
    borderWidth: 1,
    borderColor: "rgba(247,211,139,0.2)",
    width: "100%",
  },
  targetLabel: {
    color: "#6B7290",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 1,
  },
  targetValue: {
    color: "#F7D38B",
    fontSize: 56,
    fontWeight: "900",
  },
  targetSub: {
    color: "#BFC6DE",
    fontSize: 14,
    fontWeight: "600",
  },
  startButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 32,
    paddingVertical: 18,
    borderRadius: 28,
    backgroundColor: "#F7D38B",
  },
  startButtonText: {
    color: "#080A17",
    fontSize: 17,
    fontWeight: "800",
  },
  // ─── Drill phase banner ───────────────────────────────────────────────
  drillBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: "rgba(247,211,139,0.08)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(247,211,139,0.15)",
  },
  drillBannerText: {
    color: "#F7D38B",
    fontSize: 13,
    fontWeight: "700",
  },
  // ─── Result phase ─────────────────────────────────────────────────────
  resultContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
    paddingHorizontal: 24,
  },
  resultBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  resultBannerText: {
    fontSize: 16,
    fontWeight: "800",
    flexShrink: 1,
  },
  resultLabel: {
    color: "#6B7290",
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 1,
  },
  resultValue: {
    color: "#F7D38B",
    fontSize: 64,
    fontWeight: "900",
  },
  comparisonTable: {
    width: "100%",
    gap: 12,
    padding: 20,
    borderRadius: 24,
    backgroundColor: "rgba(14,17,34,0.84)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  comparisonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  comparisonName: {
    color: "#BFC6DE",
    fontSize: 14,
    fontWeight: "600",
  },
  comparisonNum: {
    color: "#F8F0DE",
    fontSize: 18,
    fontWeight: "800",
  },
  comparisonDivider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  resultActions: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  challengeBackButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 24,
    backgroundColor: "#F7D38B",
  },
  challengeBackText: {
    color: "#080A17",
    fontSize: 15,
    fontWeight: "800",
  },
  doneButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 16,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  doneButtonText: {
    color: "#BFC6DE",
    fontSize: 15,
    fontWeight: "700",
  },
  // ─── Redirect (no ambition) ───────────────────────────────────────────
  redirectTitle: {
    color: "#F8F0DE",
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center",
  },
  redirectSub: {
    color: "#BFC6DE",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    maxWidth: 280,
  },
  ctaButton: {
    paddingHorizontal: 28,
    paddingVertical: 16,
    borderRadius: 24,
    backgroundColor: "#F7D38B",
    marginTop: 8,
  },
  ctaButtonText: {
    color: "#080A17",
    fontSize: 16,
    fontWeight: "800",
  },
  // ─── Shared ───────────────────────────────────────────────────────────
  savingText: {
    color: "#F8F0DE",
    fontSize: 16,
    fontWeight: "700",
  },
  errorText: {
    color: "#FF9A9A",
    fontSize: 14,
  },
});
