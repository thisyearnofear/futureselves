/**
 * use-transmission-audio.ts
 *
 * Manages the full TTS audio lifecycle for a transmission:
 * - Pre-generates audio when text arrives (not on play tap)
 * - Uses file-based playback (reads cached WAV from disk)
 * - Auto-retries on failure (max 3 attempts)
 * - Auto-generates when TTS model becomes ready after cold start
 * - Surfaces a clean state machine for the UI
 *
 * State machine: idle → generating → ready → playing ↔ paused
 *                 ↘ error → retrying → generating
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import { isLocalMode } from "@/lib/ai";
import { useLocalTTS } from "@/lib/qvac";
import { getCachedAudio, setCachedAudio } from "@/lib/audio-cache";
import { shouldRetry } from "@/lib/audio-retry-policy";
import type { TransmissionState } from "@/lib/futureself";

export type AudioState =
  | "idle"
  | "generating"
  | "ready"
  | "playing"
  | "paused"
  | "error";

export interface TransmissionAudioController {
  state: AudioState;
  fileUri: string | null;
  error: string | null;
  retryCount: number;
  generate: () => Promise<void>;
  retry: () => Promise<void>;
}

export function useTransmissionAudio(
  transmission: TransmissionState,
  ttsModelId: string | null,
  ttsModelReady: boolean,
): TransmissionAudioController {
  const [state, setState] = useState<AudioState>("idle");
  const [fileUri, setFileUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const generateRef = useRef<Promise<void> | null>(null);

  const { speak, isReady } = useLocalTTS(ttsModelId ?? undefined);

  const generate = useCallback(async () => {
    if (Platform.OS === "web") return;
    if (!isLocalMode()) return;
    if (state === "generating" || state === "ready") return;
    if (generateRef.current) return generateRef.current;

    const personaId = transmission.id;
    const cacheKey = transmission.text;

    // Check cache first
    try {
      const cached = await getCachedAudio(personaId, cacheKey);
      if (cached) {
        setFileUri(`file://${cached.filePath}`);
        setState("ready");
        setError(null);
        return;
      }
    } catch {
      // cache miss, continue to generation
    }

    if (!isReady || !ttsModelId) {
      setState("idle");
      return;
    }

    setState("generating");
    setError(null);

    const promise = (async () => {
      try {
        const bytes = await speak(transmission.text);
        if (!bytes) {
          throw new Error("TTS returned empty audio");
        }
        const entry = await setCachedAudio(personaId, cacheKey, bytes);
        setFileUri(`file://${entry.filePath}`);
        setState("ready");
        setError(null);
        setRetryCount(0);
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
  }, [transmission.id, transmission.text, state, isReady, ttsModelId, speak]);

  const retry = useCallback(async () => {
    if (!shouldRetry(retryCount)) return;
    setRetryCount((c) => c + 1);
    setState("idle");
    // Small delay before retry
    await new Promise((r) => setTimeout(r, 300));
    await generate();
  }, [retryCount, generate]);

  // Pre-generate when text is ready and model is available
  useEffect(() => {
    if (
      (transmission.status === "text_ready" || transmission.status === "ready") &&
      ttsModelReady &&
      state === "idle" &&
      !transmission.audioUrl // Don't pre-generate if cloud audio exists
    ) {
      void generate();
    }
  }, [transmission.status, ttsModelReady, state, transmission.audioUrl, generate]);

  // Auto-retry when model becomes ready after cold start
  useEffect(() => {
    if (
      ttsModelReady &&
      state === "error" &&
      shouldRetry(retryCount) &&
      retryCount === 0
    ) {
      void retry();
    }
  }, [ttsModelReady, state, retryCount, retry]);

  return { state, fileUri, error, retryCount, generate, retry };
}
