/**
 * football-home.tsx
 *
 * Football Path home section. Shown when the user has an active football
 * ambition. Displays:
 * - The ambition card (position, level, dream)
 * - The "receive transmission" flow (football-path voicemail from future self)
 * - Drill quick-access (reaction time, juggling, sprint)
 * - Trajectory summary (if drills have been completed)
 *
 * All AI runs on-device through QVAC. No cloud.
 */

import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeIn, FadeInUp } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { api } from "@/convex/_generated/api";
import {
  generateFootballTransmission,
  type FootballTransmissionContext,
  type FootballPosition,
} from "@/lib/football-llm";
import { FootballAudioPlayer } from "@/components/football-audio-player";
import { isLocalMode } from "@/lib/ai";

const POSITION_LABELS: Record<string, string> = {
  goalkeeper: "Goalkeeper",
  center_back: "Center Back",
  full_back: "Full Back",
  defensive_mid: "Defensive Mid",
  central_mid: "Central Mid",
  attacking_mid: "Attacking Mid",
  winger: "Winger",
  striker: "Striker",
  unknown: "Footballer",
};

// Local types matching the Convex football API return shapes.
// These will be replaced by generated types once `npx convex dev` is run.
interface DrillSessionItem {
  _id: string;
  _creationTime: number;
  drillType: "reaction_time" | "juggling" | "sprint";
  resultValue?: number;
  startedAt: number;
  completedAt?: number;
  createdAt: number;
}

interface TrajectoryItem {
  _id: string;
  _creationTime: number;
  drillType: "reaction_time" | "juggling" | "sprint";
  sessionCount: number;
  firstValue: number;
  latestValue: number;
  bestValue: number;
  trendPercent: number;
  narrative?: string;
  suggestedPosition?: string;
  updatedAt: number;
}

const DRILL_META = {
  reaction_time: {
    label: "Reaction Time",
    icon: "flash-outline" as const,
    unit: "ms",
    description: "Tap when the ball appears",
  },
  juggling: {
    label: "Juggling",
    icon: "football-outline" as const,
    unit: "touches",
    description: "Count your juggles",
  },
  sprint: {
    label: "Sprint",
    icon: "speedometer-outline" as const,
    unit: "s",
    description: "Time your sprint",
  },
};

interface FootballHomeProps {
  llmModelId: string | null;
  ttsModelId: string | null;
  playerName: string;
  streak: number;
  onOpenDrill: (drillType: "reaction_time" | "juggling" | "sprint") => void;
}

export function FootballHome({
  llmModelId,
  ttsModelId,
  playerName,
  streak,
  onOpenDrill,
}: FootballHomeProps) {
  const ambition = useQuery(api.football.getActiveAmbition, {});
  const drillHistory = useQuery(api.football.getDrillHistory, { limit: 20 });
  const trajectories = useQuery(api.football.getTrajectories, {});

  const [isGenerating, setIsGenerating] = useState(false);
  const [transmission, setTransmission] = useState<{
    title: string;
    text: string;
    actionPrompt: string;
    cliffhanger: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const localMode = useMemo(() => isLocalMode(), []);

  const handleReceiveTransmission = useCallback(async () => {
    if (!llmModelId) {
      setError("AI model is still loading. Try again in a moment.");
      return;
    }
    if (!ambition) {
      setError("Declare your ambition first.");
      return;
    }
    setError(null);
    setIsGenerating(true);
    try {
      const ctx: FootballTransmissionContext = {
        playerName,
        targetPosition: ambition.targetPosition as FootballPosition,
        description: ambition.description,
        currentLevel: ambition.currentLevel,
        age: ambition.age,
        recentDrills: ((drillHistory as DrillSessionItem[] | undefined) ?? [])
          .filter((d) => d.resultValue !== undefined)
          .slice(0, 5)
          .map((d) => ({
            drillType: d.drillType as "reaction_time" | "juggling" | "sprint",
            resultValue: d.resultValue!,
            daysAgo: Math.floor((Date.now() - d.startedAt) / (1000 * 60 * 60 * 24)),
          })),
        trajectories: ((trajectories as TrajectoryItem[] | undefined) ?? []).map((t) => ({
          drillType: t.drillType as "reaction_time" | "juggling" | "sprint",
          sessionCount: t.sessionCount,
          trendPercent: t.trendPercent,
          latestValue: t.latestValue,
        })),
        streak,
      };
      const result = await generateFootballTransmission(llmModelId, ctx);
      setTransmission(result);
      if (Platform.OS !== "web") {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not generate transmission.");
    } finally {
      setIsGenerating(false);
    }
  }, [llmModelId, ambition, drillHistory, trajectories, playerName, streak]);

  if (ambition === undefined || drillHistory === undefined) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color="#F7D38B" size="small" />
      </View>
    );
  }

  if (!ambition) {
    // Should not happen — this component is only shown when ambition exists.
    // But handle gracefully.
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>No active ambition.</Text>
      </View>
    );
  }

  const positionLabel = POSITION_LABELS[ambition.targetPosition] ?? "Footballer";
  const completedDrills = ((drillHistory as DrillSessionItem[] | undefined) ?? []).filter(
    (d) => d.resultValue !== undefined,
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Ambition card */}
      <Animated.View entering={FadeIn} style={styles.ambitionCard}>
        <View style={styles.ambitionHeader}>
          <View style={styles.ambitionBadge}>
            <Ionicons name="football-outline" size={14} color="#F7D38B" />
            <Text style={styles.ambitionBadgeText}>FOOTBALL PATH</Text>
          </View>
          <Text style={styles.ambitionPosition}>{positionLabel}</Text>
        </View>
        <Text style={styles.ambitionDescription}>"{ambition.description}"</Text>
        <View style={styles.ambitionMeta}>
          <View style={styles.metaPill}>
            <Text style={styles.metaPillText}>{ambition.currentLevel}</Text>
          </View>
          {streak > 0 && (
            <View style={styles.metaPill}>
              <Ionicons name="flame-outline" size={12} color="#F7D38B" />
              <Text style={styles.metaPillText}>{streak} day streak</Text>
            </View>
          )}
        </View>
      </Animated.View>

      {/* Receive transmission */}
      {!transmission ? (
        <Animated.View entering={FadeInUp.delay(100)}>
          <Pressable
            style={[styles.receiveButton, isGenerating && styles.receiveButtonDisabled]}
            onPress={handleReceiveTransmission}
            disabled={isGenerating}
          >
            {isGenerating ? (
              <>
                <ActivityIndicator color="#080A17" size="small" />
                <Text style={styles.receiveButtonText}>Your future self is speaking...</Text>
              </>
            ) : (
              <>
                <Ionicons name="mail-outline" size={20} color="#080A17" />
                <Text style={styles.receiveButtonText}>Receive transmission</Text>
              </>
            )}
          </Pressable>
        </Animated.View>
      ) : (
        <Animated.View entering={FadeInUp} style={styles.transmissionCard}>
          <Text style={styles.transmissionTitle}>{transmission.title}</Text>
          <Text style={styles.transmissionText}>{transmission.text}</Text>
          {isLocalMode() && ttsModelId && (
            <FootballAudioPlayer
              text={`${transmission.title}. ${transmission.text} ${transmission.actionPrompt} ${transmission.cliffhanger}`}
              cacheKey={`football-transmission-${ambition._id}-${transmission.title.slice(0, 20)}`}
              ttsModelId={ttsModelId}
            />
          )}
          <View style={styles.actionBox}>
            <Text style={styles.actionLabel}>TONIGHT'S DRILL</Text>
            <Text style={styles.actionText}>{transmission.actionPrompt}</Text>
          </View>
          <Text style={styles.cliffhanger}>{transmission.cliffhanger}</Text>
        </Animated.View>
      )}

      {/* Drills */}
      <Animated.View entering={FadeInUp.delay(200)} style={styles.drillsSection}>
        <Text style={styles.sectionTitle}>Measure your path</Text>
        <View style={styles.drillGrid}>
          {(["reaction_time", "juggling", "sprint"] as const).map((drillType) => {
            const meta = DRILL_META[drillType];
            const lastResult = completedDrills.find((d: DrillSessionItem) => d.drillType === drillType);
            const traj = ((trajectories as TrajectoryItem[] | undefined) ?? []).find((t: TrajectoryItem) => t.drillType === drillType);
            return (
              <Pressable
                key={drillType}
                style={styles.drillCard}
                onPress={() => onOpenDrill(drillType)}
              >
                <Ionicons name={meta.icon} size={22} color="#F7D38B" />
                <Text style={styles.drillLabel}>{meta.label}</Text>
                {lastResult ? (
                  <Text style={styles.drillResult}>
                    {lastResult.resultValue}{meta.unit}
                  </Text>
                ) : (
                  <Text style={styles.drillPending}>{meta.description}</Text>
                )}
                {traj && traj.sessionCount > 1 && (
                  <Text
                    style={[
                      styles.drillTrend,
                      { color: traj.trendPercent < 0 && drillType !== "juggling" ? "#A9F7B5" : traj.trendPercent > 0 && drillType === "juggling" ? "#A9F7B5" : "#FF9A9A" },
                    ]}
                  >
                    {traj.trendPercent > 0 ? "↑" : traj.trendPercent < 0 ? "↓" : "→"}
                    {" "}
                    {Math.abs(traj.trendPercent).toFixed(0)}%
                  </Text>
                )}
              </Pressable>
            );
          })}
        </View>
      </Animated.View>

      {/* Trajectory narratives */}
      {((trajectories as TrajectoryItem[] | undefined) ?? []).filter((t) => t.narrative).length > 0 && (
        <Animated.View entering={FadeInUp.delay(300)} style={styles.trajectorySection}>
          <Text style={styles.sectionTitle}>Your future self on your progress</Text>
          {((trajectories as TrajectoryItem[] | undefined) ?? [])
            .filter((t) => t.narrative)
            .map((t) => (
              <View key={t._id} style={styles.trajectoryCard}>
                <Text style={styles.trajectoryDrill}>
                  {DRILL_META[t.drillType as keyof typeof DRILL_META]?.label ?? t.drillType}
                </Text>
                <Text style={styles.trajectoryNarrative}>{t.narrative}</Text>
                {isLocalMode() && ttsModelId && t.narrative && (
                  <FootballAudioPlayer
                    text={t.narrative}
                    cacheKey={`football-trajectory-${t._id}`}
                    ttsModelId={ttsModelId}
                  />
                )}
                {t.suggestedPosition && t.suggestedPosition !== "unknown" && (
                  <Text style={styles.trajectorySuggestion}>
                    Consider: {POSITION_LABELS[t.suggestedPosition] ?? t.suggestedPosition}
                  </Text>
                )}
              </View>
            ))}
        </Animated.View>
      )}

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 48, gap: 16 },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
  },
  loadingText: { color: "#6B7290", fontSize: 14 },
  ambitionCard: {
    gap: 12,
    padding: 22,
    borderRadius: 28,
    backgroundColor: "rgba(14,17,34,0.84)",
    borderWidth: 1,
    borderColor: "rgba(247,211,139,0.2)",
  },
  ambitionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  ambitionBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "rgba(247,211,139,0.1)",
    borderWidth: 1,
    borderColor: "rgba(247,211,139,0.25)",
  },
  ambitionBadgeText: {
    color: "#F7D38B",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  ambitionPosition: {
    color: "#F8F0DE",
    fontSize: 18,
    fontWeight: "700",
  },
  ambitionDescription: {
    color: "#BFC6DE",
    fontSize: 14,
    lineHeight: 22,
    fontStyle: "italic",
  },
  ambitionMeta: {
    flexDirection: "row",
    gap: 8,
  },
  metaPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  metaPillText: {
    color: "#BFC6DE",
    fontSize: 12,
    fontWeight: "600",
  },
  receiveButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 18,
    borderRadius: 28,
    backgroundColor: "#F7D38B",
  },
  receiveButtonDisabled: { opacity: 0.6 },
  receiveButtonText: {
    color: "#080A17",
    fontSize: 16,
    fontWeight: "800",
  },
  transmissionCard: {
    gap: 14,
    padding: 22,
    borderRadius: 28,
    backgroundColor: "rgba(14,17,34,0.84)",
    borderWidth: 1,
    borderColor: "rgba(247,211,139,0.2)",
  },
  transmissionTitle: {
    color: "#F8F0DE",
    fontSize: 18,
    fontWeight: "700",
  },
  transmissionText: {
    color: "#BFC6DE",
    fontSize: 15,
    lineHeight: 24,
  },
  actionBox: {
    gap: 6,
    padding: 16,
    borderRadius: 18,
    backgroundColor: "rgba(247,211,139,0.08)",
    borderWidth: 1,
    borderColor: "rgba(247,211,139,0.15)",
  },
  actionLabel: {
    color: "#F7D38B",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  actionText: {
    color: "#F8F0DE",
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 22,
  },
  cliffhanger: {
    color: "#6B7290",
    fontSize: 13,
    lineHeight: 20,
    fontStyle: "italic",
  },
  drillsSection: { gap: 12 },
  sectionTitle: {
    color: "#F8F0DE",
    fontSize: 16,
    fontWeight: "700",
  },
  drillGrid: {
    flexDirection: "row",
    gap: 10,
  },
  drillCard: {
    flex: 1,
    gap: 8,
    padding: 16,
    borderRadius: 20,
    backgroundColor: "rgba(14,17,34,0.6)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    alignItems: "flex-start",
  },
  drillLabel: {
    color: "#F8F0DE",
    fontSize: 13,
    fontWeight: "700",
  },
  drillResult: {
    color: "#F7D38B",
    fontSize: 18,
    fontWeight: "800",
  },
  drillPending: {
    color: "#6B7290",
    fontSize: 11,
    lineHeight: 16,
  },
  drillTrend: {
    fontSize: 12,
    fontWeight: "700",
  },
  trajectorySection: { gap: 12 },
  trajectoryCard: {
    gap: 8,
    padding: 18,
    borderRadius: 22,
    backgroundColor: "rgba(14,17,34,0.6)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  trajectoryDrill: {
    color: "#F7D38B",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1,
  },
  trajectoryNarrative: {
    color: "#BFC6DE",
    fontSize: 14,
    lineHeight: 22,
    fontStyle: "italic",
  },
  trajectorySuggestion: {
    color: "#A9F7B5",
    fontSize: 13,
    fontWeight: "600",
  },
  errorBox: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: "rgba(255,154,154,0.1)",
    borderWidth: 1,
    borderColor: "rgba(255,154,154,0.2)",
  },
  errorText: {
    color: "#FF9A9A",
    fontSize: 14,
    lineHeight: 20,
  },
});
