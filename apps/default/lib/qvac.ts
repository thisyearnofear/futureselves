/**
 * QVAC on-device AI runtime.
 *
 * This file is the SDK-facing layer of the local-first build. It wraps
 * the `@qvac/sdk` so the rest of the app talks to clean React hooks
 * (`useQVACModel`, `useLocalTTS`, `useLocalSTT`, `useQVACChat`)
 * instead of the SDK's raw lifecycle functions.
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
 * - **All four hooks are wired.** `useQVACModel` (loadModel/unloadModel),
 *   `useLocalTTS` (textToSpeech), `useLocalSTT` (transcribe), and
 *   `useQVACChat` (completion) all call the real SDK. All hooks keep
 *   the platform-guard pattern and the type-only top-level import.
 *
 * See `docs/edge-ai-qvac.md` §3.5, §7, and §12 for the full context.
 * See `docs/privacy-posture.md` for the public-facing privacy story.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import {
  isAuditEnabled,
  logEmbedding,
  logLLMCompletion,
  logModelLoad,
  logModelUnload,
  logSTTTranscribe,
  logTTSSynthesize,
} from "@/lib/audit-log";

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

    const t0 = Date.now();
    try {
      const { loadModel } = await import("@qvac/sdk");
      const id: string = await loadModel({
        ...options,
        onProgress: (progress: ModelProgressUpdate) =>
          setState((s) => ({ ...s, progress })),
      });
      modelIdRef.current = id;
      setState((s) => ({ ...s, status: "ready", modelId: id }));
      void logModelLoad(id, Date.now() - t0, (options as any).modelId ?? (options as any).registryPath);
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      setState({ status: "error", error });
      void logModelLoad("<unknown>", Date.now() - t0, undefined, undefined, error);
    }
  }, []);

  const unload = useCallback(async () => {
    if (Platform.OS === "web") return;
    if (!modelIdRef.current) return;

    const id = modelIdRef.current;
    const t0 = Date.now();
    try {
      const { unloadModel } = await import("@qvac/sdk");
      await unloadModel({ modelId: id });
      void logModelUnload(id, Date.now() - t0);
    } catch (e) {
      void logModelUnload(id, Date.now() - t0, e instanceof Error ? e.message : String(e));
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

      const t0 = Date.now();
      try {
        const { textToSpeech } = await import("@qvac/sdk");
        const result = textToSpeech({
          modelId,
          inputType: "text",
          text,
          stream: false,
        });
        const samples = await result.buffer;
        await result.done;
        const wav = pcmToWav(samples, CHATTERBOX_SAMPLE_RATE);
        void logTTSSynthesize({
          modelId,
          textChars: text.length,
          durationMs: Date.now() - t0,
          audioSamples: samples.length,
          audioBytes: wav.byteLength,
        });
        return wav;
      } catch (e) {
        void logTTSSynthesize({
          modelId,
          textChars: text.length,
          durationMs: Date.now() - t0,
          error: e instanceof Error ? e.message : String(e),
        });
        throw e;
      }
    },
    [modelId],
  );

  return { speak, isReady };
}

/**
 * Local STT hook return value.
 *
 * `transcribe` accepts audio as a `Uint8Array` of raw PCM or WAV bytes
 * and returns the recognized text, or `null` on web / when the local
 * STT is not ready.
 *
 * `transcribeFromUri` accepts a `file://` URI pointing to an audio
 * file and returns the recognized text. This is the preferred path
 * when recording via `expo-audio` (the recorder writes to disk).
 */
export interface UseLocalSTTResult {
  transcribe: (audioBytes: Uint8Array) => Promise<string | null>;
  transcribeFromUri: (fileUri: string) => Promise<string | null>;
  isReady: boolean;
}

/**
 * Local STT hook. Wraps QVAC's `transcribe` function.
 * Requires the Parakeet model to be loaded (via `useQVACModel` with
 * the appropriate model descriptor). Platform-guarded: web returns null.
 *
 * Consumer code:
 *
 * ```ts
 * const { transcribeFromUri, isReady } = useLocalSTT(sttModelId);
 * const text = await transcribeFromUri(recordedFileUri);
 * ```
 */
export function useLocalSTT(modelId?: string): UseLocalSTTResult {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (Platform.OS === "web") {
      setIsReady(false);
      return;
    }
    setIsReady(!!modelId);
  }, [modelId]);

  const transcribeFromUri = useCallback(
    async (fileUri: string): Promise<string | null> => {
      if (Platform.OS === "web") return null;
      if (!modelId) return null;

      const t0 = Date.now();
      try {
        const { transcribe } = await import("@qvac/sdk");
        const result = await transcribe({
          modelId,
          audioChunk: fileUri,
        });
        const text = typeof result === "string" ? result : String(result ?? "");
        void logSTTTranscribe({
          modelId,
          audioUri: fileUri,
          textChars: text.length,
          durationMs: Date.now() - t0,
        });
        return result;
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        void logSTTTranscribe({ modelId, audioUri: fileUri, durationMs: Date.now() - t0, error: msg });
        console.warn("[LocalSTT] Transcription failed:", error);
        return null;
      }
    },
    [modelId],
  );

  const transcribe = useCallback(
    async (audioBytes: Uint8Array): Promise<string | null> => {
      if (Platform.OS === "web") return null;
      if (!modelId) return null;

      const t0 = Date.now();
      try {
        const { transcribe: qvacTranscribe } = await import("@qvac/sdk");
        // Pass raw bytes as a Buffer — SDK 0.14 accepts string | Buffer.
        const result = await qvacTranscribe({
          modelId,
          audioChunk: audioBytes as unknown as Buffer,
        });
        const text = typeof result === "string" ? result : String(result ?? "");
        void logSTTTranscribe({
          modelId,
          audioBytes: audioBytes.byteLength,
          textChars: text.length,
          durationMs: Date.now() - t0,
        });
        return result;
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        void logSTTTranscribe({ modelId, audioBytes: audioBytes.byteLength, durationMs: Date.now() - t0, error: msg });
        console.warn("[LocalSTT] Transcription failed:", error);
        return null;
      }
    },
    [modelId],
  );

  return { transcribe, transcribeFromUri, isReady };
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let result = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i]!;
    const b1 = i + 1 < bytes.length ? bytes[i + 1]! : 0;
    const b2 = i + 2 < bytes.length ? bytes[i + 2]! : 0;
    result += chars[(b0 >> 2) & 0x3f];
    result += chars[((b0 & 0x03) << 4) | ((b1 >> 4) & 0x0f)];
    result += i + 1 < bytes.length ? chars[((b1 & 0x0f) << 2) | ((b2 >> 6) & 0x03)] : "=";
    result += i + 2 < bytes.length ? chars[b2 & 0x3f] : "=";
  }
  return result;
}


// ─── useQVACChat ──────────────────────────────────────────────────────────────

/**
 * Hook return value for `useQVACChat`.
 *
 * `complete` sends a chat completion request to the on-device LLM.
 * On web or when no modelId is provided, it returns `null`.
 */
export interface UseQVACChatResult {
  complete: (params: {
    messages: Array<{ role: string; content: string }>;
    maxTokens?: number;
    temperature?: number;
  }) => Promise<string | null>;
  isReady: boolean;
}

/**
 * On-device LLM chat completion hook. Wired in Phase 3 of
 * `docs/edge-ai-qvac.md`. Requires a loaded LLM model (via
 * `useQVACModel`) and a modelId.
 *
 * Consumer code:
 *
 * ```ts
 * const { complete, isReady } = useQVACChat(llmModelId);
 * const result = await complete({
 *   messages: [{ role: "user", content: "Hello" }],
 * });
 * ```
 */
export function useQVACChat(modelId?: string): UseQVACChatResult {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (Platform.OS === "web") {
      setIsReady(false);
      return;
    }
    setIsReady(!!modelId);
  }, [modelId]);

  const complete = useCallback(
    async (params: {
      messages: Array<{ role: string; content: string }>;
      maxTokens?: number;
      temperature?: number;
    }): Promise<string | null> => {
      if (Platform.OS === "web") return null;
      if (!modelId) return null;

      const promptChars = params.messages.reduce((n, m) => n + m.content.length, 0);
      // Enable streaming when the audit log is on so we can capture a real
      // time-to-first-token. Production path stays on stream:false to keep
      // existing latency characteristics.
      const streamed = isAuditEnabled();
      const t0 = Date.now();
      let ttftMs: number | null = null;

      try {
        const { completion } = await import("@qvac/sdk");
        const run = completion({
          modelId,
          history: params.messages.map((m) => ({
            role: m.role as "user" | "assistant" | "system",
            content: m.content,
          })),
          stream: streamed,
          generationParams: {
            predict: params.maxTokens ?? 700,
            temp: params.temperature ?? 0.8,
          },
        });

        if (streamed && (run as any).chunks) {
          // Race-style: peek the first chunk to time the TTFT, then wait
          // for the full response.
          try {
            const iter = (run as any).chunks[Symbol.asyncIterator]?.();
            if (iter) {
              await iter.next();
              ttftMs = Date.now() - t0;
              // Drain remaining chunks; final is still resolved by the SDK.
              while (!(await iter.next()).done) {
                /* drain */
              }
            }
          } catch {
            // If streaming peek fails, fall back to total-duration only.
            ttftMs = null;
          }
        }

        const final = await run.final;
        const text = final.contentText ?? null;
        const completionChars = (text ?? "").length;

        void logLLMCompletion({
          modelId,
          promptChars,
          completionChars,
          durationMs: Date.now() - t0,
          ttftMs,
          streamed,
          promptTokens: (final as any)?.usage?.promptTokens,
          completionTokens: (final as any)?.usage?.completionTokens,
        });

        return text;
      } catch (e) {
        void logLLMCompletion({
          modelId,
          promptChars,
          completionChars: 0,
          durationMs: Date.now() - t0,
          ttftMs,
          streamed,
          error: e instanceof Error ? e.message : String(e),
        });
        throw e;
      }
    },
    [modelId],
  );

  return { complete, isReady };
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

// ─── Embeddings (local semantic similarity) ─────────────────────────────────

/**
 * Hook return value for `useLocalEmbeddings`.
 *
 * `embed` generates an embedding vector for a given text using the
 * on-device QVAC model. Returns a Float32Array of the embedding vector.
 * On web or when no modelId is provided, it returns `null`.
 */
export interface UseLocalEmbeddingsResult {
  embed: (text: string) => Promise<Float32Array | null>;
  isReady: boolean;
}

/**
 * On-device embeddings hook. Uses QVAC's built-in embedding model
 * to compute semantic similarity between texts.
 *
 * Used by the memory archive to find "related signals" — transmissions
 * that are semantically similar to the one being viewed.
 *
 * Consumer code:
 *
 * ```ts
 * const { embed, isReady } = useLocalEmbeddings(modelId);
 * const vec = await embed("I'm afraid of being seen");
 * if (vec) {
 *   const sim = cosineSimilarity(vec, otherVec);
 * }
 * ```
 */
export function useLocalEmbeddings(modelId?: string): UseLocalEmbeddingsResult {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (Platform.OS === "web") {
      setIsReady(false);
      return;
    }
    setIsReady(!!modelId);
  }, [modelId]);

  const embed = useCallback(
    async (text: string): Promise<Float32Array | null> => {
      if (Platform.OS === "web") return null;
      if (!modelId) return null;

      const t0 = Date.now();
      try {
        const { embed: qvacEmbed } = await import("@qvac/sdk");
        const result = await qvacEmbed({
          modelId,
          text,
        });
        // QVAC returns { embedding: number[], stats?: ... }
        const embedding = (result as { embedding?: number[] })?.embedding;
        void logEmbedding({
          modelId,
          textChars: text.length,
          embeddingDims: embedding?.length,
          durationMs: Date.now() - t0,
        });
        if (embedding) {
          return new Float32Array(embedding);
        }
        return null;
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        void logEmbedding({ modelId, textChars: text.length, durationMs: Date.now() - t0, error: msg });
        console.warn("[LocalEmbeddings] Embedding failed:", error);
        return null;
      }
    },
    [modelId],
  );

  return { embed, isReady };
}

/**
 * Compute cosine similarity between two embedding vectors.
 * Returns a value between -1 and 1 (1 = identical, 0 = unrelated).
 */
export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

// ─── LoRA Adapter (Track C) ───────────────────────────────────────────────────

/**
 * Hook return value for `useLoRAAdapter`.
 *
 * `attach` loads a LoRA adapter on top of a loaded base model. The adapter
 * modifies the model's behavior without changing the base weights — enabling
 * cast members that are "fine-tuned variants" of the personality LLM.
 *
 * QVAC SDK support for on-device LoRA is tracked upstream. Until the SDK
 * exposes a `loadAdapter` API, this hook is a no-op scaffold that logs the
 * intended behavior.
 *
 * See `docs/edge-ai-qvac.md` Phase 5 / Track C.
 */
export interface UseLoRAAdapterResult {
  attach: (params: {
    baseModelId: string;
    adapterSrc: string;
  }) => Promise<string | null>;
  detach: (adapterId: string) => Promise<void>;
  isAvailable: boolean;
}

/**
 * Load and unload a LoRA adapter on top of a QVAC model.
 *
 * This is a **scaffold** — the underlying SDK call does not exist yet.
 * When the SDK ships `loadAdapter`, replace the `console.warn` body with:
 *
 * ```ts
 * const { loadAdapter } = await import("@qvac/sdk");
 * return loadAdapter({ modelId: baseModelId, adapterSrc });
 * ```
 *
 * Until then, `attach` returns `null` and logs a warning. The consumer
 * should fall back to a prompt-based variant.
 */
export function useLoRAAdapter(): UseLoRAAdapterResult {
  const attach = async (params: {
    baseModelId: string;
    adapterSrc: string;
  }): Promise<string | null> => {
    console.warn(
      "[QVAC LoRA] `loadAdapter` is not yet available in @qvac/sdk. " +
        `Skipping LoRA attach for adapter=${params.adapterSrc} on model=${params.baseModelId}.`,
    );
    return null;
  };

  const detach = async (_adapterId: string) => {
    // No-op until LoRA is supported.
  };

  return { attach, detach, isAvailable: false };
}
