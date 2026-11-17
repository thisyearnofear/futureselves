/**
 * use-speech-recognition.ts
 *
 * Provider-agnostic "press-to-record → transcribe" hook for spoken
 * check-ins. Two backends behind one interface:
 *
 * - **`sttModelId` (QVAC, dormant)** — `expo-audio` recorder → on-device
 *   Parakeet via `useLocalSTT`. Selected when a model id is passed
 *   (local mode).
 * - **`osBackend` (firebase/default)** — OS-level STT at zero marginal
 *   cost, consistent with the submission's AI-Logic posture (platform
 *   capabilities, not AI APIs):
 *   - Web → browser `SpeechRecognition`
 *   - Android → `expo-speech-recognition` (SpeechRecognizer / AICore)
 *
 * ## Usage
 *
 * ```tsx
 * const speech = useSpeechRecognition({
 *   sttModelId: localMode ? QVAC_MODELS.stt : null,
 *   osBackend: firebaseMode,
 *   onResult: (text) => setWord(text),
 * });
 * ```
 */

import { useCallback, useRef, useState } from "react";
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
  /** QVAC Parakeet model id (local mode). If set, selects the QVAC backend. */
  sttModelId: string | null;
  /** Use OS-level speech recognition (firebase mode). Ignored when sttModelId is set. */
  osBackend?: boolean;
  /** Called with the transcribed text after recognition completes. */
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
  /** `true` while STT is processing audio. */
  isTranscribing: boolean;
  /** `true` when the selected backend is usable on this platform. */
  isAvailable: boolean;
  /** The last error, if any. */
  error: string | null;
  /** Duration in seconds of the current recording. */
  durationSeconds: number;
}

// ── QVAC backend (expo-audio → Parakeet) ─────────────────────────────

function useQVACSpeechBackend(
  sttModelId: string | null,
  onResult?: (text: string) => void,
  onError?: (error: Error) => void,
): UseSpeechRecognitionResult {
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { transcribeFromUri } = useLocalSTT(sttModelId ?? undefined);

  const isAvailable = Platform.OS !== "web" && sttModelId !== null;

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY, () => {});
  const recorderState = useAudioRecorderState(recorder);
  const durationSeconds = recorderState.durationMillis / 1000;

  const startRecording = useCallback(async () => {
    if (Platform.OS === "web") return;
    setError(null);
    try {
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) throw new Error("Microphone permission denied.");
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
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
      await setAudioModeAsync({ allowsRecording: false });
      const uri = recorder.uri;
      if (!uri) throw new Error("No recording URI available.");
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

// ── OS backend (browser SpeechRecognition / expo-speech-recognition) ──

type WebRecognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult:
    | ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void)
    | null;
  onend: (() => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  start: () => void;
  stop: () => void;
};

function getWebRecognitionCtor(): (new () => WebRecognition) | null {
  if (Platform.OS !== "web" || typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => WebRecognition;
    webkitSpeechRecognition?: new () => WebRecognition;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function getNativeModule() {
  if (Platform.OS === "web") return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("expo-speech-recognition").ExpoSpeechRecognitionModule as {
      start: (o: { lang: string; interimResults: boolean }) => void;
      stop: () => void;
      abort: () => void;
      isRecognitionAvailable: () => boolean;
      requestPermissionsAsync: () => Promise<{ granted: boolean }>;
      addListener: (
        event: string,
        listener: (e: {
          isFinal?: boolean;
          results?: Array<{ transcript: string }>;
          error?: string;
        }) => void,
      ) => { remove: () => void };
    };
  } catch {
    return null;
  }
}

function useOSSpeechBackend(
  enabled: boolean,
  onResult?: (text: string) => void,
  onError?: (error: Error) => void,
): UseSpeechRecognitionResult {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [durationSeconds, setDurationSeconds] = useState(0);
  const webRef = useRef<WebRecognition | null>(null);
  const subsRef = useRef<Array<{ remove: () => void }>>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onResultRef = useRef(onResult);
  const onErrorRef = useRef(onError);
  onResultRef.current = onResult;
  onErrorRef.current = onError;

  const stopTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  };

  const isAvailable =
    enabled &&
    (Platform.OS === "web"
      ? getWebRecognitionCtor() !== null
      : (getNativeModule()?.isRecognitionAvailable() ?? false));

  const startRecording = useCallback(async () => {
    if (!enabled) return;
    setError(null);
    const startTimer = () => {
      setDurationSeconds(0);
      const started = Date.now();
      timerRef.current = setInterval(
        () => setDurationSeconds((Date.now() - started) / 1000),
        250,
      );
    };

    if (Platform.OS === "web") {
      const Ctor = getWebRecognitionCtor();
      if (!Ctor) return;
      try {
        const rec = new Ctor();
        rec.lang = "en-US";
        rec.interimResults = false;
        rec.continuous = false;
        rec.onresult = (e) => {
          const transcript = e.results[0]?.[0]?.transcript;
          if (transcript) onResultRef.current?.(transcript.trim());
        };
        rec.onend = () => {
          setIsRecording(false);
          stopTimer();
        };
        rec.onerror = (e) => {
          setIsRecording(false);
          stopTimer();
          const msg = e.error ?? "Speech recognition failed.";
          setError(msg);
          onErrorRef.current?.(new Error(msg));
        };
        webRef.current = rec;
        rec.start();
        setIsRecording(true);
        startTimer();
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        onErrorRef.current?.(e instanceof Error ? e : new Error(msg));
      }
      return;
    }

    const mod = getNativeModule();
    if (!mod) return;
    try {
      const perms = await mod.requestPermissionsAsync();
      if (!perms.granted) throw new Error("Microphone permission denied.");
      subsRef.current = [
        mod.addListener("result", (e) => {
          if (!e.isFinal) return;
          const transcript = e.results?.[0]?.transcript;
          if (transcript) onResultRef.current?.(transcript.trim());
        }),
        mod.addListener("end", () => {
          setIsRecording(false);
          setIsTranscribing(false);
          stopTimer();
          subsRef.current.forEach((s) => s.remove());
          subsRef.current = [];
        }),
        mod.addListener("error", (e) => {
          setIsRecording(false);
          setIsTranscribing(false);
          stopTimer();
          const msg = e.error ?? "Speech recognition failed.";
          setError(msg);
          onErrorRef.current?.(new Error(msg));
          subsRef.current.forEach((s) => s.remove());
          subsRef.current = [];
        }),
      ];
      mod.start({ lang: "en-US", interimResults: false });
      setIsRecording(true);
      setIsTranscribing(true); // final result arrives after "end" intent
      startTimer();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      onErrorRef.current?.(e instanceof Error ? e : new Error(msg));
    }
  }, [enabled]);

  const stopRecording = useCallback(async () => {
    if (Platform.OS === "web") {
      try {
        webRef.current?.stop();
      } catch {
        // stop() throws if already stopped — harmless
      }
    } else {
      try {
        getNativeModule()?.stop();
      } catch {
        // harmless
      }
    }
    setIsRecording(false);
    stopTimer();
  }, []);

  return {
    startRecording,
    stopRecording,
    isRecording,
    isTranscribing,
    isAvailable,
    error,
    durationSeconds,
  };
}

// ── Public dispatcher ────────────────────────────────────────────────

export function useSpeechRecognition(
  options: UseSpeechRecognitionOptions,
): UseSpeechRecognitionResult {
  const { sttModelId, osBackend = false, onResult, onError } = options;
  // Both backends mount unconditionally (hooks rules); each no-ops when
  // its enablement flag is off.
  const qvac = useQVACSpeechBackend(sttModelId, onResult, onError);
  const os = useOSSpeechBackend(sttModelId == null && osBackend, onResult, onError);
  return sttModelId != null ? qvac : os;
}
