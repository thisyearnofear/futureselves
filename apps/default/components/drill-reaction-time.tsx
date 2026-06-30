/**
 * drill-reaction-time.tsx
 *
 * Reaction time measurement drill. Pure software — no sensors, no AI.
 *
 * Flow:
 * 1. User taps "Start" → screen shows "Wait for the ball..."
 * 2. After a random delay (1.5-4s), a football appears on screen
 * 3. User taps as fast as possible → we measure the delay in ms
 * 4. If they tap too early (before the ball), it's a false start
 * 5. After 5 rounds, we take the average (excluding false starts)
 *
 * The result is stored as the average reaction time in milliseconds.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  FadeIn,
  FadeInUp,
  useSharedValue,
  withTiming,
  useAnimatedStyle,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";
import { formatResult, getProComparison } from "@/lib/drill-utils";

type Phase = "idle" | "waiting" | "show" | "result" | "falseStart" | "done";

const ROUNDS = 5;
const MIN_DELAY = 1500;
const MAX_DELAY = 4000;

interface ReactionTimeDrillProps {
  onComplete: (resultMs: number, rawData: Array<{ timestamp: number; value: number }>) => void;
  onCancel: () => void;
}

export function ReactionTimeDrill({ onComplete, onCancel }: ReactionTimeDrillProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [round, setRound] = useState(0);
  const [results, setResults] = useState<number[]>([]);
  const [lastResult, setLastResult] = useState<number | null>(null);
  const [avgResult, setAvgResult] = useState<number | null>(null);

  const showTimeRef = useRef<number>(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rawDataRef = useRef<Array<{ timestamp: number; value: number }>>([]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, []);

  const ballScale = useSharedValue(0);
  const ballStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ballScale.value }],
    opacity: ballScale.value,
  }));

  const clearTimer = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  const startRound = useCallback(() => {
    setPhase("waiting");
    setLastResult(null);
    const delay = MIN_DELAY + Math.random() * (MAX_DELAY - MIN_DELAY);
    timeoutRef.current = setTimeout(() => {
      showTimeRef.current = Date.now();
      ballScale.value = 0;
      ballScale.value = withTiming(1, { duration: 100 });
      setPhase("show");
      if (Platform.OS !== "web") {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    }, delay);
  }, [ballScale]);

  const handleScreenTap = useCallback(() => {
    if (phase === "waiting") {
      // False start — tapped before the ball appeared
      clearTimer();
      setPhase("falseStart");
      if (Platform.OS !== "web") {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } else if (phase === "show") {
      // Valid tap — measure reaction time
      const reactionMs = Date.now() - showTimeRef.current;
      const newResults = [...results, reactionMs];
      setResults(newResults);
      setLastResult(reactionMs);
      rawDataRef.current.push({ timestamp: Date.now(), value: reactionMs });
      ballScale.value = withTiming(0, { duration: 150 });
      if (Platform.OS !== "web") {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

      if (newResults.length >= ROUNDS) {
        const avg = Math.round(
          newResults.reduce((a, b) => a + b, 0) / newResults.length,
        );
        setAvgResult(avg);
        setPhase("done");
      } else {
        setRound(newResults.length);
        setPhase("result");
      }
    }
  }, [phase, results, ballScale]);

  const handleStart = useCallback(() => {
    setResults([]);
    setRound(0);
    setAvgResult(null);
    setLastResult(null);
    rawDataRef.current = [];
    startRound();
  }, [startRound]);

  const handleNextRound = useCallback(() => {
    startRound();
  }, [startRound]);

  const handleFinish = useCallback(() => {
    if (avgResult !== null) {
      onComplete(avgResult, rawDataRef.current);
    }
  }, [avgResult, onComplete]);

  const handleRetryFalseStart = useCallback(() => {
    startRound();
  }, [startRound]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={onCancel} style={styles.closeButton}>
          <Ionicons name="close" size={24} color="#6B7290" />
        </Pressable>
        <Text style={styles.title}>Reaction Time</Text>
        <View style={styles.roundIndicator}>
          <Text style={styles.roundText}>
            {Math.min(results.length + (phase === "waiting" || phase === "show" ? 1 : 0), ROUNDS)}/{ROUNDS}
          </Text>
        </View>
      </View>

      {/* Main interaction area */}
      <Pressable
        style={styles.interactionArea}
        onPress={handleScreenTap}
        disabled={phase === "idle" || phase === "result" || phase === "falseStart" || phase === "done"}
      >
        {phase === "idle" && (
          <Animated.View entering={FadeIn} style={styles.centerContent}>
            <Ionicons name="flash-outline" size={48} color="#F7D38B" />
            <Text style={styles.instructionTitle}>Tap when the ball appears</Text>
            <Text style={styles.instructionSub}>
              {ROUNDS} rounds. We'll average your reaction time.
            </Text>
            <Pressable style={styles.startButton} onPress={handleStart}>
              <Text style={styles.startButtonText}>Start</Text>
            </Pressable>
          </Animated.View>
        )}

        {phase === "waiting" && (
          <View style={styles.centerContent}>
            <Text style={styles.waitingText}>Wait for the ball...</Text>
            <Text style={styles.waitingSub}>Don't tap yet!</Text>
          </View>
        )}

        {phase === "show" && (
          <Animated.View style={[styles.ballContainer, ballStyle]}>
            <Ionicons name="football" size={80} color="#F7D38B" />
          </Animated.View>
        )}

        {phase === "result" && (
          <Animated.View entering={FadeInUp} style={styles.centerContent}>
            <Text style={styles.resultValue}>{formatResult("reaction_time", lastResult!)}</Text>
            <Text style={styles.resultLabel}>Round {results.length} of {ROUNDS}</Text>
            <Pressable style={styles.nextButton} onPress={handleNextRound}>
              <Text style={styles.nextButtonText}>Next round</Text>
            </Pressable>
          </Animated.View>
        )}

        {phase === "falseStart" && (
          <Animated.View entering={FadeIn} style={styles.centerContent}>
            <Ionicons name="warning-outline" size={40} color="#FF9A9A" />
            <Text style={styles.falseStartText}>Too early!</Text>
            <Text style={styles.falseStartSub}>Wait for the ball to appear.</Text>
            <Pressable style={styles.retryButton} onPress={handleRetryFalseStart}>
              <Text style={styles.retryButtonText}>Try again</Text>
            </Pressable>
          </Animated.View>
        )}

        {phase === "done" && avgResult !== null && (() => {
          const comparison = getProComparison("reaction_time", avgResult);
          return (
            <Animated.View entering={FadeInUp} style={styles.centerContent}>
              <Text style={styles.doneLabel}>Average reaction time</Text>
              <Text style={styles.doneValue}>{formatResult("reaction_time", avgResult)}</Text>
              {comparison && (
                <View style={styles.comparisonBox}>
                  <Text style={styles.comparisonMain}>{comparison.diffLabel}</Text>
                  <Text style={styles.comparisonSub}>{comparison.percentileLabel}</Text>
                </View>
              )}
              <View style={styles.resultsList}>
                {results.map((r, i) => (
                  <View key={i} style={styles.resultPill}>
                    <Text style={styles.resultPillText}>{formatResult("reaction_time", r)}</Text>
                  </View>
                ))}
              </View>
              <View style={styles.doneButtons}>
                <Pressable
                  style={({ pressed }) => [styles.challengeButton, pressed && { transform: [{ scale: 0.97 }] }]}
                  onPress={async () => {
                    if (Platform.OS === "web") return;
                    try {
                      const { Share: RNShare } = await import("react-native");
                      const link = `futureself://challenge?drill=reaction_time&target=${Math.round(avgResult)}&from=Me`;
                      await RNShare.share({
                        message: `I scored ${formatResult("reaction_time", avgResult)} on reaction time. ${comparison?.diffLabel ?? ""}. Think you can beat me? ${link} #FootballPath`,
                        title: "Football Path Challenge",
                      });
                    } catch { /* cancelled */ }
                  }}
                >
                  <Ionicons name="flash-outline" size={16} color="#F7D38B" />
                  <Text style={styles.challengeButtonText}>Challenge</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.shareButton, pressed && { transform: [{ scale: 0.97 }] }]}
                  onPress={async () => {
                    if (Platform.OS === "web") return;
                    try {
                      const { Share: RNShare } = await import("react-native");
                      await RNShare.share({
                        message: `My reaction time: ${formatResult("reaction_time", avgResult)}. ${comparison?.diffLabel ?? ""} #FootballPath`,
                        title: "My Football Path Result",
                      });
                    } catch { /* cancelled */ }
                  }}
                >
                  <Ionicons name="share-outline" size={18} color="#080A17" />
                  <Text style={styles.shareButtonText}>Share</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.finishButton, pressed && { transform: [{ scale: 0.97 }] }]}
                  onPress={handleFinish}
                >
                  <Text style={styles.finishButtonText}>Save</Text>
                </Pressable>
              </View>
            </Animated.View>
          );
        })()}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  closeButton: { padding: 8 },
  title: { color: "#F8F0DE", fontSize: 18, fontWeight: "700" },
  roundIndicator: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(247,211,139,0.1)",
  },
  roundText: { color: "#F7D38B", fontSize: 13, fontWeight: "700" },
  interactionArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    margin: 20,
    borderRadius: 36,
    backgroundColor: "rgba(14,17,34,0.6)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  centerContent: { alignItems: "center", gap: 12 },
  instructionTitle: { color: "#F8F0DE", fontSize: 20, fontWeight: "700", textAlign: "center" },
  instructionSub: { color: "#BFC6DE", fontSize: 14, textAlign: "center" },
  startButton: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 24,
    backgroundColor: "#F7D38B",
    marginTop: 8,
  },
  startButtonText: { color: "#080A17", fontSize: 16, fontWeight: "800" },
  waitingText: { color: "#6B7290", fontSize: 20, fontWeight: "600" },
  waitingSub: { color: "#6B7290", fontSize: 14 },
  ballContainer: { alignItems: "center", justifyContent: "center" },
  resultValue: { color: "#F7D38B", fontSize: 48, fontWeight: "900" },
  resultLabel: { color: "#BFC6DE", fontSize: 14 },
  nextButton: {
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 22,
    backgroundColor: "rgba(247,211,139,0.15)",
    borderWidth: 1,
    borderColor: "rgba(247,211,139,0.3)",
    marginTop: 8,
  },
  nextButtonText: { color: "#F7D38B", fontSize: 15, fontWeight: "700" },
  falseStartText: { color: "#FF9A9A", fontSize: 22, fontWeight: "700" },
  falseStartSub: { color: "#BFC6DE", fontSize: 14 },
  retryButton: {
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 22,
    backgroundColor: "rgba(255,154,154,0.15)",
    borderWidth: 1,
    borderColor: "rgba(255,154,154,0.3)",
    marginTop: 8,
  },
  retryButtonText: { color: "#FF9A9A", fontSize: 15, fontWeight: "700" },
  doneLabel: { color: "#BFC6DE", fontSize: 14, fontWeight: "600" },
  doneValue: { color: "#F7D38B", fontSize: 56, fontWeight: "900" },
  resultsList: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center", maxWidth: 280 },
  resultPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  resultPillText: { color: "#BFC6DE", fontSize: 13, fontWeight: "600" },
  comparisonBox: {
    gap: 4,
    padding: 14,
    borderRadius: 16,
    backgroundColor: "rgba(247,211,139,0.08)",
    borderWidth: 1,
    borderColor: "rgba(247,211,139,0.15)",
    marginTop: 8,
    alignItems: "center",
  },
  comparisonMain: {
    color: "#F7D38B",
    fontSize: 14,
    fontWeight: "700",
  },
  comparisonSub: {
    color: "#6B7290",
    fontSize: 12,
    fontWeight: "600",
  },
  doneButtons: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
  challengeButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 24,
    backgroundColor: "rgba(247,211,139,0.12)",
    borderWidth: 1,
    borderColor: "rgba(247,211,139,0.3)",
  },
  challengeButtonText: { color: "#F7D38B", fontSize: 13, fontWeight: "700" },
  shareButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 24,
    backgroundColor: "rgba(247,211,139,0.15)",
    borderWidth: 1,
    borderColor: "rgba(247,211,139,0.3)",
  },
  shareButtonText: { color: "#F7D38B", fontSize: 14, fontWeight: "700" },
  finishButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 14,
    borderRadius: 24,
    backgroundColor: "#F7D38B",
  },
  finishButtonText: { color: "#080A17", fontSize: 16, fontWeight: "800" },
});
