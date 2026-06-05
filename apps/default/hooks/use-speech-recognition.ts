/**
 * use-speech-recording.ts
 *
 * Combines `expo-audio` recording with QVAC's on-device STT (Parakeet)
 * to provide a single "press-to-record → transcribe" workflow for
 * spoken check-ins.
 *
 * ## Usage
 *
 * ```tsx
 * const { startRecording, stopRecording, isRecording, isTranscribing, error } =
 *   useSpeechRecognition({ sttModelId, onResult: (text) => setWord(text) });
 *
 * <Pressable onPress={isRecording ? stopRecording : startRecording}>
 *   <MicIcon /> {isRecording ? "Stop" : "Speak"}
 * </Pressable>
 * ```
 *
 * ## Flow
 *
 * 1. User taps the mic button → `startRecording()` (requests mic permission, starts expo-audio recorder)
 * 2. User taps stop → `stopRecording()` → recorder writes WAV to disk
 * 3. The recorded file is fed to `transcribeFromUri` from `useLocalSTT`
 * 4. `onResult` fires with the transcribed text, which the consumer puts into the input field
 *
 * ## Rules
 * - **Web is no-op.** Returns a disabled state on web.
 * - **Native only.** Uses `expo-audio`'s `useAudioRecorder` hook.
 * - The STT model must already be loaded (via `useQVACModel` with the
 *   Parakeet descriptor). Pass `sttModelId` to this hook.
 *
 * See `docs/edge-ai-qvac.md` Phase 4.
 */

import { useCallback, useState } from "react";
import { Platform } from "react-native";
import {
  useAudioRecorder,
  useAudioRecorderState,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  RecordingPresets,
} from "expo-audio";
import { useLocalSTT } from "@/lib/qvac";

export interface UseSpeechRecognitionOptions {
  /** Model ID returned by `loadModel(Parakeet)`. If null, STT is disabled. */
  sttModelId: string | null;
  /** Called with the transcribed text after recording + STT. */
  onResult?: (text: string) => void;
  /** Called if recording or transcription fails. */
  onError?: (error: Error) => void;
}

export interface UseSpeechRecognitionResult {
  /** Start recording from the microphone. Returns immediately. */
  startRecording: () => Promise<void>;
  /** Stop recording and begin transcription. */
  stopRecording: () => Promise<void>;
  /** `true` while the microphone is capturing audio. */
  isRecording: boolean;
  /** `true` while STT is processing the recorded audio. */
  isTranscribing: boolean;
  /** `true` when the feature is available (native + model loaded). */
  isAvailable: boolean;
  /** The last error, if any. */
  error: string | null;
  /** Duration in seconds of the current recording. */
  durationSeconds: number;
}

export function useSpeechRecognition(
  options: UseSpeechRecognitionOptions,
): UseSpeechRecognitionResult {
  const { sttModelId, onResult, onError } = options;
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { transcribeFromUri } = useLocalSTT(sttModelId ?? undefined);

  const isAvailable = Platform.OS !== "web" && sttModelId !== null;

  // expo-audio recorder — only active on native
  const recorder = useAudioRecorder(
    RecordingPresets.HIGH_QUALITY,
    (status) => {
      // Optional: could log or drive a waveform visualizer
    },
  );

  const recorderState = useAudioRecorderState(recorder);
  const durationSeconds = recorderState.durationMillis / 1000;

  const startRecording = useCallback(async () => {
    if (Platform.OS === "web") return;
    setError(null);

    try {
      // Request mic permission
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) {
        throw new Error("Microphone permission denied.");
      }

      // Enable recording mode
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });

      recorder.record();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      onError?.(e instanceof Error ? e : new Error(msg));
    }
  }, [recorder, onError]);

  const stopRecording = useCallback(async () => {
    if (Platform.OS === "web") return;
    setError(null);

    try {
      await recorder.stop();

      // Return to normal audio mode
      await setAudioModeAsync({ allowsRecording: false });

      const uri = recorder.uri;
      if (!uri) {
        throw new Error("No recording URI available.");
      }

      // Run STT on the recorded file
      setIsTranscribing(true);
      try {
        const text = await transcribeFromUri(uri);
        if (text && text.trim().length > 0) {
          onResult?.(text.trim());
        } else {
          setError("Could not understand the audio. Try again.");
        }
      } finally {
        setIsTranscribing(false);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      onError?.(e instanceof Error ? e : new Error(msg));
      setIsTranscribing(false);
    }
  }, [recorder, transcribeFromUri, onResult, onError]);

  return {
    startRecording,
    stopRecording,
    isRecording: recorderState.isRecording,
    isTranscribing,
    isAvailable,
    error,
    durationSeconds,
  };
}
