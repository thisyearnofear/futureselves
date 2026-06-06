import { createContext, useContext } from "react";
import type { ReactNode } from "react";
import type { QVACModelState } from "@/lib/qvac";
import { QVAC_MODELS } from "@/hooks/use-qvac-prewarm";

export interface QVACPrewarmState {
  llm: QVACModelState;
  tts: QVACModelState;
  stt: QVACModelState;
  isReady: boolean;
}

export interface QVACPrewarmValue extends QVACPrewarmState {
  modelDescriptors: typeof QVAC_MODELS;
}

const QVACPrewarmContext = createContext<QVACPrewarmValue | null>(null);

export function useQVACPrewarmContext(): QVACPrewarmValue | null {
  return useContext(QVACPrewarmContext);
}

interface QVACPrewarmProviderProps {
  value: QVACPrewarmState;
  children: ReactNode;
}

export function QVACPrewarmProvider({ value, children }: QVACPrewarmProviderProps) {
  return (
    <QVACPrewarmContext.Provider value={{ ...value, modelDescriptors: QVAC_MODELS }}>
      {children}
    </QVACPrewarmContext.Provider>
  );
}

export { QVACPrewarmContext };
