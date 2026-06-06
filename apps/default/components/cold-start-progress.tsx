import { Platform, StyleSheet, Text, View } from "react-native";
import AnimatedReanimated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useEffect } from "react";
import { isLocalMode } from "@/lib/ai";
import { useQVACPrewarmContext } from "@/lib/qvac-prewarm-context";

const MODEL_LABELS: Record<string, string> = {
  llm: "Language model",
  tts: "Voice model",
  stt: "Speech recognition",
};

const MODEL_ICONS: Record<string, string> = {
  llm: "🧠",
  tts: "🎙",
  stt: "🎤",
};

function statusLabel(status: string): string {
  switch (status) {
    case "idle": return "pending…";
    case "loading": return "loading…";
    case "ready": return "ready";
    case "error": return "failed";
    default: return status;
  }
}

function statusColor(status: string): string {
  switch (status) {
    case "ready": return "#4ADE80";
    case "loading": return "#F7D38B";
    case "error": return "#FF6B6B";
    default: return "#5A6180";
  }
}

interface ModelRowProps {
  modelKey: string;
  status: string;
  progress?: number;
}

function ModelRow({ modelKey, status, progress }: ModelRowProps) {
  const progressNorm = progress !== undefined ? Math.min(1, Math.max(0, progress)) : 0;
  const barWidth = useSharedValue(status === "loading" ? progressNorm * 100 : status === "ready" ? 100 : 0);

  useEffect(() => {
    barWidth.value = withTiming(
      status === "ready" ? 100 : status === "loading" ? Math.max(progressNorm * 100, 5) : 0,
      { duration: 300 },
    );
  }, [status, progressNorm, barWidth]);

  const barStyle = useAnimatedStyle(() => ({
    width: `${barWidth.value}%`,
  }));

  return (
    <View style={styles.row}>
      <Text style={styles.icon}>{MODEL_ICONS[modelKey] ?? "•"}</Text>
      <View style={styles.rowBody}>
        <View style={styles.rowHeader}>
          <Text style={styles.label}>{MODEL_LABELS[modelKey] ?? modelKey}</Text>
          <Text style={[styles.status, { color: statusColor(status) }]}>
            {statusLabel(status)}
          </Text>
        </View>
        <View style={styles.barBg}>
          <AnimatedReanimated.View style={[styles.barFill, { backgroundColor: statusColor(status) }, barStyle]} />
        </View>
      </View>
    </View>
  );
}

export function ColdStartProgress() {
  const prewarm = useQVACPrewarmContext();

  if (Platform.OS === "web") return null;
  if (!isLocalMode()) return null;
  if (!prewarm) return null;
  if (prewarm.isReady) return null;

  return (
    <AnimatedReanimated.View entering={FadeIn.duration(400)} exiting={FadeOut.duration(300)} style={styles.container}>
      <Text style={styles.title}>Warming up on-device AI…</Text>
      <Text style={styles.subtitle}>First transmission may take ~25 seconds</Text>
      <View style={styles.models}>
        <ModelRow modelKey="llm" status={prewarm.llm.status} progress={prewarm.llm.progress?.percentage != null ? prewarm.llm.progress.percentage / 100 : undefined} />
        <ModelRow modelKey="tts" status={prewarm.tts.status} progress={prewarm.tts.progress?.percentage != null ? prewarm.tts.progress.percentage / 100 : undefined} />
        <ModelRow modelKey="stt" status={prewarm.stt.status} progress={prewarm.stt.progress?.percentage != null ? prewarm.stt.progress.percentage / 100 : undefined} />
      </View>
    </AnimatedReanimated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
    padding: 16,
    borderRadius: 16,
    backgroundColor: "rgba(16,19,32,0.85)",
    borderWidth: 1,
    borderColor: "rgba(247,211,139,0.15)",
    marginBottom: 16,
  },
  title: {
    color: "#F8F0DE",
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  subtitle: {
    color: "#7E86A6",
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 4,
  },
  models: {
    gap: 10,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  icon: {
    fontSize: 16,
    width: 24,
    textAlign: "center",
  },
  rowBody: {
    flex: 1,
    gap: 4,
  },
  rowHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  label: {
    color: "#C8D4E8",
    fontSize: 12,
    fontWeight: "700",
  },
  status: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  barBg: {
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 2,
  },
});
