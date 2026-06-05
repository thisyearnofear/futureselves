import { useCallback, useEffect, useRef, useState } from "react";

export type QVACModelStatus =
  | "idle"
  | "loading"
  | "ready"
  | "error";

export interface QVACModelState {
  status: QVACModelStatus;
  modelId?: string;
  progress?: unknown;
  error?: string;
}

const UNSUPPORTED_STATE: QVACModelState = Object.freeze({
  status: "idle",
  error: "QVAC on-device AI is not supported on this platform.",
});

export interface UseQVACModelResult extends QVACModelState {
  load: (options: Record<string, unknown>) => Promise<void>;
  unload: () => Promise<void>;
}

export function useQVACModel(): UseQVACModelResult {
  const [state] = useState<QVACModelState>(UNSUPPORTED_STATE);

  const load = useCallback(async () => {}, []);
  const unload = useCallback(async () => {}, []);

  return { ...state, load, unload };
}

export interface UseLocalTTSResult {
  speak: (text: string) => Promise<Uint8Array | null>;
  isReady: boolean;
}

export function useLocalTTS(_modelId?: string): UseLocalTTSResult {
  const speak = useCallback(async () => null, []);
  return { speak, isReady: false };
}

export interface UseLocalSTTResult {
  transcribe: (audioBytes: Uint8Array) => Promise<string | null>;
  transcribeFromUri: (fileUri: string) => Promise<string | null>;
  isReady: boolean;
}

export function useLocalSTT(_modelId?: string): UseLocalSTTResult {
  const transcribe = useCallback(async () => null, []);
  const transcribeFromUri = useCallback(async () => null, []);
  return { transcribe, transcribeFromUri, isReady: false };
}

export interface UseQVACChatResult {
  complete: (params: {
    messages: Array<{ role: string; content: string }>;
    maxTokens?: number;
    temperature?: number;
  }) => Promise<string | null>;
  isReady: boolean;
}

export function useQVACChat(_modelId?: string): UseQVACChatResult {
  const complete = useCallback(async () => null, []);
  return { complete, isReady: false };
}
