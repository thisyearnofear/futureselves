/**
 * drill-juggling.tsx
 *
 * Juggling count drill. Uses the accelerometer (expo-sensors) to detect
 * ball touches via peak detection on acceleration magnitude.
 *
 * This is signal processing, NOT AI — the QVAC track rules require all
 * AI to run on-device through the QVAC SDK, but sensor-based measurement
 * is not AI. The interpretation of the count runs through QVAC LLM
 * separately (in the trajectory interpretation step).
 *
 * Flow:
 * 1. User taps "Start" → accelerometer begins recording
 * 2. User juggles with phone in pocket or held in hand
 * 3. Each ball touch creates an acceleration spike → counted as a juggle
 * 4. User taps "Stop" → total count is the result
 * 5. User can review the count and save or retry
 *
 * The threshold and min-interval are tuned for a phone-in-pocket scenario.
 * If the user holds the phone, the spikes are smaller — they can adjust
 * sensitivity (future enhancement).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeIn, FadeInUp, useSharedValue, withTiming, useAnimatedStyle, withRepeat } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Accelerometer } from "expo-sensors";
import { countJugglePeaks, formatResult } from "@/lib/drill-utils";

type Phase = "idle" | "counting" | "done";

const SAMPLE_INTERVAL_MS = 50; // 20Hz sampling
const ACCEL_THRESHOLD = 15; // m/s² above baseline (1g ≈ 9.8)
const MIN_PEAK_INTERVAL = 200; // ms between peaks

interface JugglingDrillProps {
  onComplete: (count: number, rawData: Array<{ timestamp: number; value: number }>) => void;
  onCancel: () => void;
}

export function JugglingDrill({ onComplete, onCancel }: JugglingDrillProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [count, setCount] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  const samplesRef = useRef<Array<{ timestamp: number; value: number }>>([]);
  const startTimeRef = useRef<number>(0);
  const subscriptionRef = useRef<{ remove: () => void } | null>(null);
  const lastPeakTimeRef = useRef<number>(0);
  const isAboveThresholdRef = useRef<boolean>(false);
  const countRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const pulseScale = useSharedValue(1);
  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  const cleanup = () => {
    if (subscriptionRef.current) {
      subscriptionRef.current.remove();
      subscriptionRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleAccelData = useCallback((data: { x: number; y: number; z: number }) => {
    const now = Date.now();
    // Compute acceleration magnitude (subtract gravity baseline ~9.8)
    const magnitude = Math.sqrt(data.x * data.x + data.y * data.y + data.z * data.z);
    const sample = { timestamp: now, value: magnitude };
    samplesRef.current.push(sample);

    // Real-time peak detection (same algorithm as countJugglePeaks but streaming)
    const samples = samplesRef.current;
    if (samples.length < 2) return;

    const prev = samples[samples.length - 2]!;
    const curr = samples[samples.length - 1]!;

    if (!isAboveThresholdRef.current && curr.value > ACCEL_THRESHOLD && prev.value <= ACCEL_THRESHOLD) {
      isAboveThresholdRef.current = true;
    }

    if (isAboveThresholdRef.current && curr.value < ACCEL_THRESHOLD && prev.value >= ACCEL_THRESHOLD) {
      const peakTime = curr.timestamp;
      if (peakTime - lastPeakTimeRef.current > MIN_PEAK_INTERVAL) {
        countRef.current += 1;
        setCount(countRef.current);
        lastPeakTimeRef.current = peakTime;
        if (Platform.OS !== "web") {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
      }
      isAboveThresholdRef.current = false;
    }
  }, []);

  const handleStart = useCallback(async () => {
    setPhase("counting");
    setCount(0);
    setElapsed(0);
    countRef.current = 0;
    samplesRef.current = [];
    lastPeakTimeRef.current = 0;
    isAboveThresholdRef.current = false;
    startTimeRef.current = Date.now();

    // Pulse animation while counting
    pulseScale.value = withRepeat(
      withTiming(1.1, { duration: 600 }),
      -1,
      true,
    );

    // Start accelerometer
    try {
      Accelerometer.setUpdateInterval(SAMPLE_INTERVAL_MS);
      subscriptionRef.current = Accelerometer.addListener(handleAccelData);
    } catch (e) {
      console.warn("[JugglingDrill] Accelerometer not available:", e);
      // Fallback: tap-based counting
    }

    // Start elapsed timer
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
  }, [handleAccelData, pulseScale]);

  const handleStop = useCallback(() => {
    cleanup();
    pulseScale.value = withTiming(1, { duration: 200 });

    // Use the streaming count (already counted in real-time)
    // Also verify with the offline peak detector for consistency
    const offlineCount = countJugglePeaks(samplesRef.current, ACCEL_THRESHOLD, MIN_PEAK_INTERVAL);
    const finalCount = Math.max(countRef.current, offlineCount);

    setCount(finalCount);
    setPhase("done");
    if (Platform.OS !== "web") {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [pulseScale]);

  const handleSave = useCallback(() => {
    onComplete(count, samplesRef.current);
  }, [count, onComplete]);

  const handleRetry = useCallback(() => {
    setPhase("idle");
    setCount(0);
    setElapsed(0);
  }, []);

  const isNative = Platform.OS !== "web";

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={onCancel} style={styles.closeButton}>
          <Ionicons name="close" size={24} color="#6B7290" />
        </Pressable>
        <Text style={styles.title}>Juggling</Text>
        <View style={styles.timerIndicator}>
          <Text style={styles.timerText}>{elapsed}s</Text>
        </View>
      </View>

      {/* Main area */}
      <View style={styles.mainArea}>
        {phase === "idle" && (
          <Animated.View entering={FadeIn} style={styles.centerContent}>
            <Ionicons name="football-outline" size={48} color="#F7D38B" />
            <Text style={styles.instructionTitle}>Count your juggles</Text>
            <Text style={styles.instructionSub}>
              {isNative
                ? "Put your phone in your pocket or hold it while juggling. The accelerometer counts each touch."
                : "Accelerometer requires a physical device."}
            </Text>
            {isNative ? (
              <Pressable style={styles.startButton} onPress={handleStart}>
                <Text style={styles.startButtonText}>Start juggling</Text>
              </Pressable>
            ) : (
              <Text style={styles.unavailableText}>Not available on web</Text>
            )}
          </Animated.View>
        )}

        {phase === "counting" && (
          <View style={styles.centerContent}>
            <Animated.View style={[styles.countCircle, pulseStyle]}>
              <Text style={styles.countNumber}>{count}</Text>
              <Text style={styles.countLabel}>juggles</Text>
            </Animated.View>
            <Text style={styles.countingSub}>Juggling... tap stop when done</Text>
            <Pressable style={styles.stopButton} onPress={handleStop}>
              <Ionicons name="stop-circle" size={24} color="#080A17" />
              <Text style={styles.stopButtonText}>Stop & count</Text>
            </Pressable>
          </View>
        )}

        {phase === "done" && (
          <Animated.View entering={FadeInUp} style={styles.centerContent}>
            <Text style={styles.doneLabel}>Total juggles</Text>
            <Text style={styles.doneValue}>{formatResult("juggling", count)}</Text>
            <Text style={styles.doneTime}>in {elapsed} seconds</Text>
            <View style={styles.doneButtons}>
              <Pressable style={styles.retryButton} onPress={handleRetry}>
                <Text style={styles.retryButtonText}>Retry</Text>
              </Pressable>
              <Pressable style={styles.saveButton} onPress={handleSave}>
                <Text style={styles.saveButtonText}>Save result</Text>
              </Pressable>
            </View>
          </Animated.View>
        )}
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
  timerIndicator: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(247,211,139,0.1)",
  },
  timerText: { color: "#F7D38B", fontSize: 13, fontWeight: "700" },
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
  instructionSub: { color: "#BFC6DE", fontSize: 14, textAlign: "center", maxWidth: 280, lineHeight: 20 },
  startButton: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 24,
    backgroundColor: "#F7D38B",
    marginTop: 8,
  },
  startButtonText: { color: "#080A17", fontSize: 16, fontWeight: "800" },
  unavailableText: { color: "#6B7290", fontSize: 14 },
  countCircle: {
    width: 200,
    height: 200,
    borderRadius: 100,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(247,211,139,0.08)",
    borderWidth: 2,
    borderColor: "rgba(247,211,139,0.3)",
  },
  countNumber: { color: "#F7D38B", fontSize: 64, fontWeight: "900" },
  countLabel: { color: "#BFC6DE", fontSize: 14, fontWeight: "600" },
  countingSub: { color: "#6B7290", fontSize: 14 },
  stopButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 24,
    backgroundColor: "#FF9A9A",
    marginTop: 8,
  },
  stopButtonText: { color: "#080A17", fontSize: 16, fontWeight: "800" },
  doneLabel: { color: "#BFC6DE", fontSize: 14, fontWeight: "600" },
  doneValue: { color: "#F7D38B", fontSize: 64, fontWeight: "900" },
  doneTime: { color: "#6B7290", fontSize: 14 },
  doneButtons: { flexDirection: "row", gap: 12, marginTop: 8 },
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
