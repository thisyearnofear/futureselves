/**
 * QVAC on-device AI runtime.
 *
 * This file is the SDK-facing layer of the local-first build. It wraps
 * the `@qvac/sdk` so the rest of the app talks to clean React hooks
 * (`useQVACModel`, `useLocalTTS`, `useLocalSTT`) instead of the SDK's
 * raw lifecycle functions.
 *
 * ## Rules for this file
 *
 * - **Web is not supported.** Every public export in this file is
 *   platform-guarded: on `Platform.OS === "web"` the hooks return a
 *   no-op result. This is intentional. The web build at
 *   futureselves.vercel.app uses the cloud pipeline; the QVAC SDK is a
 *   native-only module. The seam that gates this is `getAIProvider()`
 *   in `lib/ai.ts` — do not call any of these hooks from a code path
 *   that runs on web.
 * - **The `@qvac/sdk` import is type-only at the top level** so the
 *   web bundle is not asked to resolve native-only modules. Runtime
 *   SDK calls go through a single lazy import inside the hook body,
 *   platform-guarded. This pattern keeps the web Metro bundle clean
 *   even though the SDK is in `dependencies`.
 * - **Phase D is wired.** `useQVACModel` (loadModel/unloadModel) and
 *   `useLocalTTS` (textToSpeech) call the real SDK. `useLocalSTT`
 *   remains a stub for Phase F. All hooks keep the platform-guard
 *   pattern and the type-only top-level import.
 *
 * See `docs/edge-ai-qvac.md` §3.5, §7, and §12 for the full context.
 * See `docs/privacy-posture.md` for the public-facing privacy story.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";

// Type-only import. The `verbatimModuleSyntax` + `isolatedModules`
// settings in tsconfig.base mean `import type` is erased at compile
// time, so this does not contribute to the web bundle at all.
import type {
  LoadModelOptions,
  ModelProgressUpdate,
} from "@qvac/sdk";

/**
 * Lifecycle status of a loaded QVAC model.
 *
 * - `"idle"`: hook has been instantiated but `loadModel` has not been
 *   called.
 * - `"loading"`: `loadModel` is in flight.
 * - `"ready"`: model is loaded and inference calls can be made.
 * - `"error"`: load or inference failed. The `error` field carries
 *   the reason.
 */
export type QVACModelStatus =
  | "idle"
  | "loading"
  | "ready"
  | "error";

/**
 * Progress + status for a QVAC model load.
 *
 * `progress` is `undefined` until the first progress event fires.
 * For models that download in shards, the `downloadKey` and shard
 * metadata from the SDK are exposed via `progress` directly.
 */
export interface QVACModelState {
  status: QVACModelStatus;
  modelId?: string;
  progress?: ModelProgressUpdate;
  error?: string;
}

/**
 * Stable, empty state for the no-op / web path. Returned by all
 * three hooks on web so the consumer can render without a platform
 * check.
 */
const UNSUPPORTED_STATE: QVACModelState = Object.freeze({
  status: "idle",
  error: "QVAC on-device AI is not supported on this platform.",
});

/**
 * Hook return value for `useQVACModel`.
 *
 * `load` and `unload` are stable across renders (useCallback). On
 * web, calling either is a no-op.
 */
export interface UseQVACModelResult extends QVACModelState {
  load: (options: LoadModelOptions) => Promise<void>;
  unload: () => Promise<void>;
}

/**
 * Load and unload a QVAC model with progress reporting.
 *
 * Wired in Phase D of `docs/edge-ai-qvac.md`. The SDK is loaded
 * lazily via dynamic import so the web bundle stays clean.
 */
export function useQVACModel(): UseQVACModelResult {
  const [state, setState] = useState<QVACModelState>({ status: "idle" });
  const modelIdRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (Platform.OS !== "web" && modelIdRef.current) {
        const id = modelIdRef.current;
        modelIdRef.current = null;
        import("@qvac/sdk")
          .then(({ unloadModel }) => unloadModel({ modelId: id }))
          .catch(() => {});
      }
    };
  }, []);

  const load = useCallback(async (options: LoadModelOptions) => {
    if (Platform.OS === "web") {
      setState(UNSUPPORTED_STATE);
      return;
    }

    setState({ status: "loading" });

    try {
      const { loadModel } = await import("@qvac/sdk");
      const id: string = await loadModel({
        ...options,
        onProgress: (progress: ModelProgressUpdate) =>
          setState((s) => ({ ...s, progress })),
      });
      modelIdRef.current = id;
      setState((s) => ({ ...s, status: "ready", modelId: id }));
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      setState({ status: "error", error });
    }
  }, []);

  const unload = useCallback(async () => {
    if (Platform.OS === "web") return;
    if (!modelIdRef.current) return;

    try {
      const { unloadModel } = await import("@qvac/sdk");
      await unloadModel({ modelId: modelIdRef.current });
    } finally {
      modelIdRef.current = null;
      setState({ status: "idle" });
    }
  }, []);

  return { ...state, load, unload };
}


/**
 * Hook return value for `useLocalTTS`.
 *
 * `speak` is a no-op on web. On native, it returns WAV-encoded audio
 * as a `Uint8Array` (16-bit PCM, 24 kHz, mono) suitable for playback
 * via `expo-av` or any WAV-compatible audio player.
 */
export interface UseLocalTTSResult {
  speak: (text: string) => Promise<Uint8Array | null>;
  isReady: boolean;
}

/**
 * Local TTS hook. Wired in Phase D. The consumer controls model
 * lifecycle via `useQVACModel`; this hook sets `isReady = true` when
 * a modelId is provided and calls `textToSpeech()` on `speak()`.
 *
 * Returns WAV-encoded audio as a `Uint8Array` (16-bit PCM, 24 kHz,
 * mono). Consumer code:
 *
 * ```ts
 * const { speak, isReady } = useLocalTTS(modelId);
 * const audio = await speak("hello from the other side");
 * if (audio) await playBytes(audio);
 * ```
 */
export function useLocalTTS(modelId?: string): UseLocalTTSResult {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (Platform.OS === "web") {
      setIsReady(false);
      return;
    }
    setIsReady(!!modelId);
  }, [modelId]);

  const speak = useCallback(
    async (text: string): Promise<Uint8Array | null> => {
      if (Platform.OS === "web") return null;
      if (!modelId) return null;

      const { textToSpeech } = await import("@qvac/sdk");
      const result = textToSpeech({
        modelId,
        inputType: "text",
        text,
        stream: false,
      });
      const samples = await result.buffer;
      await result.done;
      return pcmToWav(samples, CHATTERBOX_SAMPLE_RATE);
    },
    [modelId],
  );

  return { speak, isReady };
}

/**
 * Hook return value for `useLocalSTT`.
 *
 * `transcribe` returns the recognized text, or `null` on web / when
 * the local STT is not ready. Phase F (STT) will wire this up.
 */
export interface UseLocalSTTResult {
  transcribe: (audioBytes: Uint8Array) => Promise<string | null>;
  isReady: boolean;
}

/**
 * Local STT hook. Stub in this PR; enabled when the QVAC on-device
 * build is wired up.
 */
export function useLocalSTT(modelId?: string): UseLocalSTTResult {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (Platform.OS === "web") {
      setIsReady(false);
      return;
    }
    // Phase F will: load the parakeet STT model on mount if a
    // modelId is provided, set isReady to true when the model is
    // loaded, and unload on unmount.
    setIsReady(false);
  }, [modelId]);

  const transcribe = useCallback(
    async (_audioBytes: Uint8Array): Promise<string | null> => {
      if (Platform.OS === "web") return null;
      // Phase F will replace this stub with:
      //   const response = await transcribe({ modelId, audio: audioBytes });
      //   return response.text;
      return null;
    },
    [modelId],
  );

  return { transcribe, isReady };
}

const CHATTERBOX_SAMPLE_RATE = 24000;

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

function pcmToWav(samples: number[], sampleRate: number): Uint8Array {
  const numSamples = samples.length;
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + numSamples * 2, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, "data");
  view.setUint32(40, numSamples * 2, true);

  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]!));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }

  return new Uint8Array(buffer);
}
