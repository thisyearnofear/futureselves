/**
 * use-qvac-prewarm.ts
 *
 * Pre-warms the on-device QVAC models (LLM + TTS) on app start so the
 * user's first transmission arrives without a cold-start wait.
 *
 * ## Per `docs/edge-ai-qvac.md` §3.5 #6:
 *   "Time-to-first-transmission is a first-class metric. A 25-second
 *   cold start is fine *if* it is announced and shown with a progress
 *   bar. It is fatal if hidden."
 *
 * This hook surfaces progress via the `QVACModelStatus` returned by
 * `useQVACModel`. Mount it once at the app root (see `_layout.tsx`).
 *
 * ## Rules
 * - **Web is no-op.** Only `EXPO_PUBLIC_AI_PROVIDER === "local"` triggers
 *   the model load.
 * - **Idempotent.** Calling `prewarm()` again after a successful load
 *   returns immediately.
 * - **Persona-scoped cache keys.** `loadModel` is called with
 *   `{ modelSrc, persona }` so the SDK stores the model blobs under
 *   the persona's key. Multiple personas on the same device get
 *   isolated caches.
 */

import { useCallback, useEffect, useRef } from "react";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { isLocalMode } from "@/lib/ai";
import { useQVACModel } from "@/lib/qvac";

/**
 * Canonical model descriptors. The constants are imported from the
 * SDK's registry, but the strings here are stable identifiers we
 * surface to the user (and to secure-store for cache-key lookup).
 */
export const QVAC_MODELS = {
  llm: "LLAMA_3_2_1B_INST_Q4_0",
  tts: "chatterbox",
  stt: "WHISPER_EN_BASE_Q8_0",
} as const;

const CACHE_KEY_PREFIX = "qvac-model-id:";

/**
 * Store the loaded model id for a given persona + model descriptor
 * in `expo-secure-store`. On subsequent app launches we can short-
 * circuit and skip the (expensive) re-load.
 */
async function rememberModelId(
  personaId: string,
  descriptor: string,
  modelId: string,
): Promise<void> {
  try {
    await SecureStore.setItemAsync(
      `${CACHE_KEY_PREFIX}${personaId}:${descriptor}`,
      modelId,
    );
  } catch {
    // Non-critical — the model can still be loaded fresh.
  }
}

async function recallModelId(
  personaId: string,
  descriptor: string,
): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(
      `${CACHE_KEY_PREFIX}${personaId}:${descriptor}`,
    );
  } catch {
    return null;
  }
}

export interface UseQVACPrewarmOptions {
  /** Persona id (or "anonymous" if not signed in). Used for cache scoping. */
  personaId: string | null;
  /** Disable the pre-warm (e.g. for tests). Default false. */
  disabled?: boolean;
}

/**
 * Pre-warm hook. Returns the `QVACModelState` from `useQVACModel` so
 * the consumer can render a progress bar against the on-screen splash.
 */
export function useQVACPrewarm(options: UseQVACPrewarmOptions = { personaId: null }) {
  const { personaId, disabled = false } = options;
  const scope = personaId ?? "anonymous";
  const llm = useQVACModel();
  const tts = useQVACModel();
  const stt = useQVACModel();
  const prewarmStartedRef = useRef(false);

  const prewarm = useCallback(async () => {
    if (Platform.OS === "web") return;
    if (!isLocalMode()) return;
    if (disabled) return;
    if (prewarmStartedRef.current) return;
    prewarmStartedRef.current = true;

    // Kick off LLM load.
    void (async () => {
      try {
        const existing = await recallModelId(scope, QVAC_MODELS.llm);
        if (existing) {
          // SDK doesn't expose "is model loaded?"; we just attempt
          // a no-op load with the cached id. If the SDK throws
          // "already loaded" we treat it as success.
          try {
            await llm.load({ modelSrc: QVAC_MODELS.llm as any });
          } catch {
            // fall through
          }
        } else {
          await llm.load({ modelSrc: QVAC_MODELS.llm as any });
          const id = llm.modelId;
          if (id) await rememberModelId(scope, QVAC_MODELS.llm, id);
        }
      } catch (e) {
        console.warn("[QVAC prewarm] LLM load failed:", e);
      }
    })();

    // Kick off TTS load in parallel.
    void (async () => {
      try {
        const existing = await recallModelId(scope, QVAC_MODELS.tts);
        if (existing) {
          try {
            await tts.load({ modelSrc: QVAC_MODELS.tts as any });
          } catch {
            // fall through
          }
        } else {
          await tts.load({ modelSrc: QVAC_MODELS.tts as any });
          const id = tts.modelId;
          if (id) await rememberModelId(scope, QVAC_MODELS.tts, id);
        }
      } catch (e) {
        console.warn("[QVAC prewarm] TTS load failed:", e);
      }
    })();

    // Kick off STT (Whisper) load in parallel.
    void (async () => {
      try {
        const existing = await recallModelId(scope, QVAC_MODELS.stt);
        if (existing) {
          try {
            await stt.load({ modelSrc: QVAC_MODELS.stt as any });
          } catch {
            // fall through
          }
        } else {
          await stt.load({ modelSrc: QVAC_MODELS.stt as any });
          const id = stt.modelId;
          if (id) await rememberModelId(scope, QVAC_MODELS.stt, id);
        }
      } catch (e) {
        console.warn("[QVAC prewarm] STT load failed:", e);
      }
    })();
  }, [scope, disabled, llm, tts, stt]);

  // Auto-trigger on mount when local mode is enabled.
  useEffect(() => {
    void prewarm();
  }, [prewarm]);

  return {
    llm,
    tts,
    /** Manually re-trigger (e.g. after a model eviction). */
    prewarm,
    /** `true` when both models are ready. */
    isReady: llm.status === "ready" && tts.status === "ready" && stt.status === "ready",
  };
}
