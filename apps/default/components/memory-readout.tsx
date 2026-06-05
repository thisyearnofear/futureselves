/**
 * memory-readout.tsx — Privacy readout chip for the QVAC demo.
 *
 * Small overlay chip (top-right corner) showing:
 *   bytes uploaded: 0 · inference: on-device · last model: chatterbox
 *
 * Per `docs/edge-ai-qvac.md` §3.5 #8: "Cheap to build, single best
 * visual for a privacy pitch."
 *
 * Only rendered when `EXPO_PUBLIC_AI_PROVIDER === "local"` on native.
 * Hidden on web.
 */

import { useEffect, useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import AnimatedReanimated, { FadeIn } from "react-native-reanimated";
import { getAIProvider } from "@/lib/ai";

export interface MemoryReadoutProps {
  /** Bytes uploaded to cloud since app start. For the on-device path, always 0. */
  bytesUploaded?: number;
  /** The last TTS model used (e.g. "chatterbox"). */
  lastTtsModel?: string;
  /** Whether the current audio came from the local cache. */
  cacheHit?: boolean;
  /** Whether the LLM is currently loaded on-device. */
  llmLoaded?: boolean;
}

export function MemoryReadout({
  bytesUploaded = 0,
  lastTtsModel = "chatterbox",
  cacheHit = false,
  llmLoaded = false,
}: MemoryReadoutProps) {
  const provider = getAIProvider();

  // Only show on native + local provider.
  if (Platform.OS === "web" || provider !== "local") return null;

  const inferenceLabel = llmLoaded ? "on-device" : "warming up…";
  const cacheLabel = cacheHit ? "yes" : "no";

  return (
    <AnimatedReanimated.View entering={FadeIn.delay(1200).duration(600)} style={styles.chip}>
      <Text style={styles.line}>
        bytes uploaded: <Text style={styles.value}>{bytesUploaded}</Text>
      </Text>
      <Text style={styles.line}>
        inference: <Text style={styles.value}>{inferenceLabel}</Text>
      </Text>
      <Text style={styles.line}>
        last model: <Text style={styles.value}>{lastTtsModel}</Text>
      </Text>
      <Text style={styles.line}>
        cache hit: <Text style={styles.value}>{cacheLabel}</Text>
      </Text>
    </AnimatedReanimated.View>
  );
}

const styles = StyleSheet.create({
  chip: {
    position: "absolute",
    top: 16,
    right: 16,
    zIndex: 100,
    gap: 2,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "rgba(16,19,32,0.75)",
    borderWidth: 1,
    borderColor: "rgba(247,211,139,0.2)",
  },
  line: {
    color: "#7E86A6",
    fontSize: 9,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
    letterSpacing: 0.3,
  },
  value: {
    color: "#F7D38B",
  },
});
