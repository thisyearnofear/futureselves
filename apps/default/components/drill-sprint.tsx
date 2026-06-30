/**
 * drill-sprint.tsx
 *
 * Sprint timing drill. Pure software — manual start/stop timer with
 * millisecond precision. No sensors, no AI.
 *
 * Flow:
 * 1. User selects a distance (10m, 20m, 30m, 50m)
 * 2. User taps "Start" → timer begins
 * 3. User sprints the distance
 * 4. User taps "Stop" → timer stops, result is the elapsed time in seconds
 * 5. User can save or retry
 *
 * The result is stored as seconds (lower is better).
 * Future enhancement: accelerometer-based auto-start/stop.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeIn, FadeInUp } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";
import { formatResult, getProComparison } from "@/lib/drill-utils";

type Phase = "idle" | "running" | "done";

const DISTANCES = [
  { label: "10m", value: 10 },
  { label: "20m", value: 20 },
  { label: "30m", value: 30 },
  { label: "50m", value: 50 },
];

interface SprintDrillProps {
  onComplete: (seconds: number, rawData: Array<{ timestamp: number; value: number }>) => void;
  onCancel: () => void;
}

export function SprintDrill({ onComplete, onCancel }: SprintDrillProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [distance, setDistance] = useState(20);
  const [elapsedMs, setElapsedMs] = useState(0);

  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const rawDataRef = useRef<Array<{ timestamp: number; value: number }>>([]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  const cleanup = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleStart = useCallback(() => {
    setPhase("running");
    setElapsedMs(0);
    rawDataRef.current = [];
    startTimeRef.current = Date.now();
    if (Platform.OS !== "web") {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    timerRef.current = setInterval(() => {
      const ms = Date.now() - startTimeRef.current;
      setElapsedMs(ms);
    }, 50);
  }, []);

  const handleStop = useCallback(() => {
    cleanup();
    const finalMs = Date.now() - startTimeRef.current;
    const seconds = finalMs / 1000;
    setElapsedMs(finalMs);
    rawDataRef.current.push({ timestamp: Date.now(), value: seconds });
    setPhase("done");
    if (Platform.OS !== "web") {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, []);

  const handleSave = useCallback(() => {
    onComplete(elapsedMs / 1000, rawDataRef.current);
  }, [elapsedMs, onComplete]);

  const handleRetry = useCallback(() => {
    setPhase("idle");
    setElapsedMs(0);
  }, []);

  const formatTime = (ms: number) => {
    const seconds = ms / 1000;
    return `${seconds.toFixed(2)}s`;
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={onCancel} style={styles.closeButton}>
          <Ionicons name="close" size={24} color="#6B7290" />
        </Pressable>
        <Text style={styles.title}>Sprint</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Main area */}
      <View style={styles.mainArea}>
        {phase === "idle" && (
          <Animated.View entering={FadeIn} style={styles.centerContent}>
            <Ionicons name="speedometer-outline" size={48} color="#F7D38B" />
            <Text style={styles.instructionTitle}>Time your sprint</Text>
            <Text style={styles.instructionSub}>Select a distance, then tap start.</Text>

            {/* Distance selector */}
            <View style={styles.distanceRow}>
              {DISTANCES.map((d) => (
                <Pressable
                  key={d.value}
                  style={[
                    styles.distancePill,
                    distance === d.value && styles.distancePillActive,
                  ]}
                  onPress={() => setDistance(d.value)}
                >
                  <Text
                    style={[
                      styles.distancePillText,
                      distance === d.value && styles.distancePillTextActive,
                    ]}
                  >
                    {d.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Pressable style={styles.startButton} onPress={handleStart}>
              <Ionicons name="play" size={20} color="#080A17" />
              <Text style={styles.startButtonText}>Start sprint</Text>
            </Pressable>
          </Animated.View>
        )}

        {phase === "running" && (
          <View style={styles.centerContent}>
            <Text style={styles.runningDistance}>{distance}m sprint</Text>
            <Text style={styles.runningTime}>{formatTime(elapsedMs)}</Text>
            <Text style={styles.runningSub}>Sprint now! Tap stop when you finish.</Text>
            <Pressable style={styles.stopButton} onPress={handleStop}>
              <Ionicons name="stop-circle" size={24} color="#080A17" />
              <Text style={styles.stopButtonText}>Stop</Text>
            </Pressable>
          </View>
        )}

        {phase === "done" && (() => {
          const sprintSeconds = elapsedMs / 1000;
          const comparison = getProComparison("sprint", sprintSeconds);
          return (
            <Animated.View entering={FadeInUp} style={styles.centerContent}>
              <Text style={styles.doneLabel}>{distance}m sprint time</Text>
              <Text style={styles.doneValue}>{formatResult("sprint", sprintSeconds)}</Text>
              <Text style={styles.doneDistance}>{distance} meters</Text>
              {comparison && (
                <View style={styles.comparisonBox}>
                  <Text style={styles.comparisonMain}>{comparison.diffLabel}</Text>
                  <Text style={styles.comparisonSub}>{comparison.percentileLabel}</Text>
                </View>
              )}
              <View style={styles.doneButtons}>
                <Pressable
                  style={({ pressed }) => [styles.retryButton, pressed && { transform: [{ scale: 0.97 }] }]}
                  onPress={handleRetry}
                >
                  <Text style={styles.retryButtonText}>Retry</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.challengeButtonSmall, pressed && { transform: [{ scale: 0.96 }] }]}
                  onPress={async () => {
                    if (Platform.OS === "web") return;
                    try {
                      const { Share: RNShare } = await import("react-native");
                      const link = `futureself://challenge?drill=sprint&target=${sprintSeconds.toFixed(2)}&from=Me`;
                      await RNShare.share({
                        message: `My ${distance}m sprint: ${formatResult("sprint", sprintSeconds)}. ${comparison?.diffLabel ?? ""}. Think you can beat me? ${link} #FootballPath`,
                        title: "Football Path Challenge",
                      });
                    } catch { /* cancelled */ }
                  }}
                >
                  <Ionicons name="flash-outline" size={16} color="#F7D38B" />
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.shareButtonSmall, pressed && { transform: [{ scale: 0.96 }] }]}
                  onPress={async () => {
                    if (Platform.OS === "web") return;
                    try {
                      const { Share: RNShare } = await import("react-native");
                      await RNShare.share({
                        message: `My ${distance}m sprint: ${formatResult("sprint", sprintSeconds)}. ${comparison?.diffLabel ?? ""} #FootballPath`,
                        title: "My Football Path Result",
                      });
                    } catch { /* cancelled */ }
                  }}
                >
                  <Ionicons name="share-outline" size={16} color="#F7D38B" />
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.saveButton, pressed && { transform: [{ scale: 0.97 }] }]}
                  onPress={handleSave}
                >
                  <Text style={styles.saveButtonText}>Save</Text>
                </Pressable>
              </View>
            </Animated.View>
          );
        })()}
      </View>
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
  placeholder: { width: 40 },
  mainArea: {
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
  distanceRow: { flexDirection: "row", gap: 8, marginVertical: 8 },
  distancePill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  distancePillActive: {
    backgroundColor: "rgba(247,211,139,0.15)",
    borderColor: "rgba(247,211,139,0.4)",
  },
  distancePillText: { color: "#BFC6DE", fontSize: 14, fontWeight: "600" },
  distancePillTextActive: { color: "#F7D38B", fontWeight: "800" },
  startButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 24,
    backgroundColor: "#F7D38B",
    marginTop: 8,
  },
  startButtonText: { color: "#080A17", fontSize: 16, fontWeight: "800" },
  runningDistance: { color: "#BFC6DE", fontSize: 16, fontWeight: "600" },
  runningTime: { color: "#F7D38B", fontSize: 64, fontWeight: "900", fontVariant: ["tabular-nums"] },
  runningSub: { color: "#6B7290", fontSize: 14 },
  stopButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 24,
    backgroundColor: "#FF9A9A",
    marginTop: 8,
  },
  stopButtonText: { color: "#080A17", fontSize: 16, fontWeight: "800" },
  doneLabel: { color: "#BFC6DE", fontSize: 14, fontWeight: "600" },
  doneValue: { color: "#F7D38B", fontSize: 56, fontWeight: "900" },
  doneDistance: { color: "#6B7290", fontSize: 14 },
  doneButtons: { flexDirection: "row", gap: 10, marginTop: 8, alignItems: "center" },
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
  comparisonMain: { color: "#F7D38B", fontSize: 14, fontWeight: "700" },
  comparisonSub: { color: "#6B7290", fontSize: 12, fontWeight: "600" },
  shareButtonSmall: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(247,211,139,0.15)",
    borderWidth: 1,
    borderColor: "rgba(247,211,139,0.3)",
  },
  challengeButtonSmall: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(247,211,139,0.12)",
    borderWidth: 1,
    borderColor: "rgba(247,211,139,0.25)",
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  retryButtonText: { color: "#BFC6DE", fontSize: 15, fontWeight: "700" },
  saveButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 22,
    backgroundColor: "#F7D38B",
  },
  saveButtonText: { color: "#080A17", fontSize: 15, fontWeight: "800" },
});
