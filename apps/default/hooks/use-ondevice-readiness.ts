/**
 * use-ondevice-readiness.ts
 *
 * Provider-agnostic replacement for `use-qvac-prewarm.ts`. Surfaces the
 * readiness of the on-device inference lane so cold starts are announced
 * (per `docs/edge-ai-qvac.md` §3.5 #6 — a long cold start is fine if
 * shown, fatal if hidden).
 *
 * Backends by provider mode:
 * - `local` (QVAC, dormant) → delegates to `useQVACPrewarm`.
 * - `firebase` + native → `expo-ai`: `getAvailabilityAsync()` checks
 *   AICore/Gemini Nano on Android / Apple Foundation Models on iOS;
 *   `prepareAsync({allowDownload: true})` auto-triggers the Android
 *   download with progress (Apple manages its own model delivery).
 *   TTS/STT are OS-level → always "ready".
 * - `firebase` + web / other modes → nothing to pre-warm (the AI Logic
 *   JS SDK manages Chrome's Nano internally) → all "ready".
 *
 * Returns the same `{llm, tts, stt, isReady}` shape as `useQVACPrewarm`
 * so `OnDeviceReadinessProvider` / `ColdStartProgress` work unchanged.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import { isFirebaseMode, isLocalMode } from "@/lib/ai";
import type { QVACModelState } from "@/lib/qvac";
import { useQVACPrewarm } from "@/hooks/use-qvac-prewarm";

export interface UseOnDeviceReadinessOptions {
  personaId: string | null;
  disabled?: boolean;
}

const READY: QVACModelState = Object.freeze({ status: "ready" });

/**
 * Native on-device readiness → QVACModelState-compatible lane.
 * `prepareAsync` runs in the foreground (ML Kit requirement) and reports
 * progress as a 0–1 fraction or null. On iOS Apple manages model
 * preparation itself — `getAvailabilityAsync` is the check.
 */
function useExpoAIReadiness(enabled: boolean): QVACModelState {
  const [state, setState] = useState<QVACModelState>({ status: "idle" });
  const startedRef = useRef(false);

  useEffect(() => {
    if (!enabled || startedRef.current) return;
    startedRef.current = true;
    void (async () => {
      try {
        setState({ status: "loading" });
        const { getAvailabilityAsync, prepareAsync } = await import("expo-ai");
        const availability = await getAvailabilityAsync();
        if (availability.status === "available") {
          setState({ status: "ready" });
          return;
        }
        if (availability.status === "unavailable") {
          setState({
            status: "error",
            error: availability.reason ?? "On-device model unavailable",
          });
          return;
        }
        // downloadable | downloading | not-ready → prepare (downloads)
        const prepared = await prepareAsync({
          allowDownload: true,
          onProgress: (progress) => {
            setState((s) => ({
              ...s,
              status: "loading",
              progress:
                progress == null
                  ? undefined
                  : { percentage: Math.round(progress * 100) },
            }));
          },
        });
        setState(
          prepared.status === "available"
            ? { status: "ready" }
            : { status: "error", error: `Model ${prepared.status}` },
        );
      } catch (e) {
        setState({
          status: "error",
          error: e instanceof Error ? e.message : String(e),
        });
      }
    })();
  }, [enabled]);

  return state;
}

export function useOnDeviceReadiness(
  options: UseOnDeviceReadinessOptions = { personaId: null },
) {
  const { personaId, disabled = false } = options;

  // Hooks must be unconditional — the QVAC path is dormant (stubbed).
  const qvac = useQVACPrewarm({ personaId, disabled: disabled || !isLocalMode() });
  const expoAI = useExpoAIReadiness(
    isFirebaseMode() && Platform.OS !== "web" && !disabled,
  );

  if (isLocalMode()) return qvac;
  if (!isFirebaseMode() || Platform.OS === "web") {
    // Web / non-firebase: nothing to pre-warm.
    return { llm: READY, tts: READY, stt: READY, isReady: true, prewarm: async () => {} };
  }
  // Firebase + native: Nano/AFM readiness drives the llm lane;
  // TTS/STT are OS-level capabilities → always ready.
  return {
    llm: expoAI,
    tts: READY,
    stt: READY,
    isReady: expoAI.status === "ready",
    prewarm: async () => {},
  };
}
