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
 * - **The hooks are stubs in this PR.** They declare the public
 *   surface and the platform-guard pattern; the actual SDK calls
 *   will be wired in by Phase D (TTS swap), Phase E (LLM swap), and
 *   Phase F (STT). The stubs return a stable shape so call sites can
 *   be written today and enabled later by flipping
 *   `EXPO_PUBLIC_AI_PROVIDER` to `"local"`.
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
 * Phase C of `docs/edge-ai-qvac.md`. The hook signature is stable;
 * the runtime SDK calls are stubs in this PR and will be enabled when
 * `EXPO_PUBLIC_AI_PROVIDER=local` is set on a native build that has
 * `@qvac/sdk` linked.
 */
export function useQVACModel(): UseQVACModelResult {
  const [state, setState] = useState<QVACModelState>({ status: "idle" });
  // We use a ref to track the modelId across renders so an
  // unmounting consumer can unload without a stale closure.
  const modelIdRef = useRef<string | null>(null);

  // On unmount, attempt to unload any model we still hold. This is
  // a no-op on web and a no-op until Phase D wires loadModel.
  useEffect(() => {
    return () => {
      // Intentional cleanup. Phase D will replace this with a
      // platform-guarded `unloadModel({ modelId })` call.
      modelIdRef.current = null;
    };
  }, []);

  const load = useCallback(async (_options: LoadModelOptions) => {
    if (Platform.OS === "web") {
      setState(UNSUPPORTED_STATE);
      return;
    }

    setState({ status: "loading" });

    // Phase D will replace this stub with the real call:
    //
    //   const response: LoadModelResponse = await loadModel({
    //     ...options,
    //     onProgress: (progress) =>
    //       setState((s) => ({ ...s, progress })),
    //   });
    //   if (!response.success) {
    //     setState({ status: "error", error: response.error ?? "load failed" });
    //     return;
    //   }
    //   modelIdRef.current = response.modelId ?? null;
    //   setState({ status: "ready", modelId: response.modelId });
    //
    // For now, we surface the same shape without doing the work.
    setState({
      status: "error",
      error:
        "QVAC on-device loadModel is not yet wired up. See docs/edge-ai-qvac.md §7 Phase D.",
    });
  }, []);

  const unload = useCallback(async () => {
    if (Platform.OS === "web") return;
    if (!modelIdRef.current) return;

    // Phase D will replace this stub with:
    //   await unloadModel({ modelId: modelIdRef.current });
    modelIdRef.current = null;
    setState({ status: "idle" });
  }, []);

  return { ...state, load, unload };
}


/**
 * Hook return value for `useLocalTTS`.
 *
 * `speak` is a no-op on web. On native, once Phase D wires the SDK,
 * it will return generated audio as a `Uint8Array` (PCM samples per
 * the SDK's `textToSpeech` contract). The on-device TTS engine
 * defaults to `chatterbox` (see `docs/edge-ai-qvac.md` §3.5).
 */
export interface UseLocalTTSResult {
  speak: (text: string) => Promise<Uint8Array | null>;
  isReady: boolean;
}

/**
 * Local TTS hook. Stub in this PR; enabled when the QVAC on-device
 * build is wired up.
 *
 * Consumer code is expected to be small and stable. Example:
 *
 * ```ts
 * const { speak, isReady } = useLocalTTS();
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
    // Phase D will: load the chatterbox TTS model on mount if a
    // modelId is provided, set isReady to true when the model is
    // loaded, and unload on unmount.
    setIsReady(false);
  }, [modelId]);

  const speak = useCallback(
    async (_text: string): Promise<Uint8Array | null> => {
      if (Platform.OS === "web") return null;
      // Phase D will replace this stub with:
      //   const response = await textToSpeech({ modelId, text });
      //   return response.buffer;
      return null;
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
