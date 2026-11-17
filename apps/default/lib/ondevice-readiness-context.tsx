import { createContext, useContext } from "react";
import type { ReactNode } from "react";
import type { QVACModelState } from "@/lib/qvac";

/**
 * Provider-agnostic on-device readiness state (was QVACPrewarmState).
 * Shape stays `{llm, tts, stt, isReady}` — `llm` is the generative lane
 * (QVAC Llama in local mode, AICore/Gemini Nano in firebase mode),
 * `tts`/`stt` are the voice lanes (OS-level → always ready in firebase).
 */
export interface OnDeviceReadinessState {
  llm: QVACModelState;
  tts: QVACModelState;
  stt: QVACModelState;
  isReady: boolean;
}

const OnDeviceReadinessContext = createContext<OnDeviceReadinessState | null>(null);

export function useOnDeviceReadinessContext(): OnDeviceReadinessState | null {
  return useContext(OnDeviceReadinessContext);
}

export function OnDeviceReadinessProvider({
  value,
  children,
}: {
  value: OnDeviceReadinessState;
  children: ReactNode;
}) {
  return (
    <OnDeviceReadinessContext.Provider value={value}>
      {children}
    </OnDeviceReadinessContext.Provider>
  );
}
