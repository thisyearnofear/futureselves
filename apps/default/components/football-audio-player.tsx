/**
 * football-audio-player.tsx
 *
 * Self-contained TTS audio player for the football path.
 *
 * Generates voice audio on-device via QVAC TTS, caches it, and plays
 * it back with a simple play/pause button + progress bar. No ambient
 * bed, no arrival sequence — just clean voicemail playback.
 *
 * All AI runs on-device through QVAC. No cloud.
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
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
  FadeIn,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { isLocalMode } from "@/lib/ai";
import { useLocalTTS } from "@/lib/qvac";
import { getCachedAudio, setCachedAudio } from "@/lib/audio-cache";

type AudioState = "idle" | "generating" | "ready" | "playing" | "paused" | "error";

interface FootballAudioPlayerProps {
  /** The text to synthesize and play. */
  text: string;
  /** Cache key (unique per transmission). */
  cacheKey: string;
  /** TTS model ID from QVAC prewarm. */
  ttsModelId: string | null;
}

export function FootballAudioPlayer({
  text,
  cacheKey,
  ttsModelId,
}: FootballAudioPlayerProps) {
  const [state, setState] = useState<AudioState>("idle");
  const [fileUri, setFileUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const generateRef = useRef<Promise<void> | null>(null);

  const { speak, isReady } = useLocalTTS(ttsModelId ?? undefined);

  const generate = useCallback(async () => {
    if (Platform.OS === "web") return;
    if (!isLocalMode()) return;
    if (state === "generating" || state === "ready") return;
    if (generateRef.current) return generateRef.current;

    // Check cache first
    try {
      const cached = await getCachedAudio("football", cacheKey);
      if (cached) {
        setFileUri(`file://${cached.filePath}`);
        setState("ready");
        setError(null);
        return;
      }
    } catch {
      // cache miss
    }

    if (!isReady || !ttsModelId) {
      setState("idle");
      return;
    }

    setState("generating");
    setError(null);

    const promise = (async () => {
      try {
        const bytes = await speak(text);
        if (!bytes) {
          throw new Error("TTS returned empty audio");
        }
        const entry = await setCachedAudio("football", cacheKey, bytes);
        setFileUri(`file://${entry.filePath}`);
        setState("ready");
        setError(null);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        setState("error");
      } finally {
        generateRef.current = null;
      }
    })();

    generateRef.current = promise;
    return promise;
  }, [text, cacheKey, state, isReady, ttsModelId, speak]);

  // Auto-generate when text is ready and model is available
  useEffect(() => {
    if (text && ttsModelId && isReady && state === "idle") {
      void generate();
    }
  }, [text, ttsModelId, isReady, state, generate]);

  // Breathing orb for generating state
  const orbPulse = useSharedValue(1);
  useEffect(() => {
    if (state === "generating") {
      orbPulse.value = withRepeat(
        withSequence(
          withTiming(0.7, { duration: 800, easing: Easing.inOut(Easing.quad) }),
          withTiming(1, { duration: 800, easing: Easing.inOut(Easing.quad) }),
        ),
        -1,
        false,
      );
    }
  }, [state, orbPulse]);
  const orbStyle = useAnimatedStyle(() => ({
    transform: [{ scale: orbPulse.value }],
  }));

  if (state === "error") {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="volume-mute-outline" size={20} color="#FF9A9A" />
        <Text style={styles.errorText}>Voice synthesis failed</Text>
        <Pressable
          style={styles.retryButton}
          onPress={() => {
            setState("idle");
            setError(null);
            setTimeout(() => void generate(), 100);
          }}
        >
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  if (state === "generating" || (state === "idle" && !fileUri)) {
    return (
      <View style={styles.preparingContainer}>
        <Animated.View style={[styles.preparingOrb, orbStyle]} />
        <Text style={styles.preparingText}>
          {state === "generating" ? "Synthesizing voice on-device..." : "Preparing voice..."}
        </Text>
        <Text style={styles.preparingHint}>No bytes leave your device.</Text>
      </View>
    );
  }

  if (state === "ready" && fileUri) {
    return (
      <NativePlayer fileUri={fileUri} onPlaying={() => setState("playing")} onPaused={() => setState("paused")} />
    );
  }

  // Playing or paused — the NativePlayer handles this
  return null;
}

// ─── Native Player ───────────────────────────────────────────────────────────

function NativePlayer({
  fileUri,
  onPlaying,
  onPaused,
}: {
  fileUri: string;
  onPlaying: () => void;
  onPaused: () => void;
}) {
  const player = useAudioPlayer(fileUri);
  const status = useAudioPlayerStatus(player);
  const [hasEnded, setHasEnded] = useState(false);

  // Waveform animation
  const waveScale = useSharedValue(0.3);
  useEffect(() => {
    if (status.playbackState === "playing") {
      waveScale.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 400, easing: Easing.inOut(Easing.quad) }),
          withTiming(0.5, { duration: 400, easing: Easing.inOut(Easing.quad) }),
        ),
        -1,
        false,
      );
    } else {
      waveScale.value = withTiming(0.3, { duration: 300 });
    }
  }, [status.playbackState, waveScale]);
  const waveStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: waveScale.value }],
  }));

  useEffect(() => {
    if (status.playbackState === "playing") {
      onPlaying();
    } else if (status.playbackState === "paused") {
      onPaused();
    } else if (status.playbackState === "stopped" && status.currentTime > 0 && !hasEnded) {
      setHasEnded(true);
    }
  }, [status.playbackState, status.currentTime, hasEnded, onPlaying, onPaused]);

  const togglePlayback = async () => {
    if (status.playbackState === "playing") {
      player.pause();
    } else {
      if (Platform.OS !== "web") await Haptics.selectionAsync();
      player.play();
    }
  };

  const progress = status.duration > 0 ? status.currentTime / status.duration : 0;
  const isPlaying = status.playbackState === "playing";

  return (
    <Animated.View entering={FadeIn.duration(300)} style={styles.playerContainer}>
      <Pressable style={styles.playButton} onPress={togglePlayback}>
        <Ionicons
          name={isPlaying ? "pause" : "play"}
          size={22}
          color="#080A17"
        />
      </Pressable>
      <View style={styles.progressSection}>
        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>
        <View style={styles.timeRow}>
          <Text style={styles.timeText}>{formatTime(status.currentTime)}</Text>
          <Text style={styles.timeText}>{formatTime(status.duration)}</Text>
        </View>
      </View>
      {/* Waveform indicator */}
      <Animated.View style={[styles.waveform, waveStyle]}>
        <Ionicons name="radio-outline" size={16} color="#F7D38B" />
      </Animated.View>
    </Animated.View>
  );
}

function formatTime(seconds: number): string {
  if (!seconds || seconds < 0) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

const styles = StyleSheet.create({
  preparingContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 20,
    backgroundColor: "rgba(14,17,34,0.6)",
    borderWidth: 1,
    borderColor: "rgba(247,211,139,0.15)",
  },
  preparingOrb: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#F7D38B",
  },
  preparingText: {
    color: "#F8F0DE",
    fontSize: 14,
    fontWeight: "600",
    flex: 1,
  },
  preparingHint: {
    color: "#6B7290",
    fontSize: 12,
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 20,
    backgroundColor: "rgba(255,154,154,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,154,154,0.2)",
  },
  errorText: {
    color: "#FF9A9A",
    fontSize: 14,
    flex: 1,
  },
  retryButton: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: "rgba(255,154,154,0.15)",
  },
  retryText: {
    color: "#FF9A9A",
    fontSize: 13,
    fontWeight: "700",
  },
  playerContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 22,
    backgroundColor: "rgba(247,211,139,0.08)",
    borderWidth: 1,
    borderColor: "rgba(247,211,139,0.2)",
  },
  playButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#F7D38B",
    alignItems: "center",
    justifyContent: "center",
  },
  progressSection: {
    flex: 1,
    gap: 6,
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.1)",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 2,
    backgroundColor: "#F7D38B",
  },
  timeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  timeText: {
    color: "#6B7290",
    fontSize: 11,
    fontWeight: "600",
  },
  waveform: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
});
