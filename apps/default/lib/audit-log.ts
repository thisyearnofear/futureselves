/**
 * Structured audit logger for QVAC SDK calls.
 *
 * Writes one JSON object per line (JSONL) to
 *   `${FileSystem.cacheDirectory}futureselves-audit/run-<isoTimestamp>.jsonl`
 * and mirrors every event to the console.
 *
 * Required by the QVAC "Unleash Edge AI" hackathon evidence bundle:
 * proves model loads/unloads and inference calls run on-device and
 * captures performance metrics (prompt size, output tokens, TTFT,
 * tokens/sec) for at least one demo run.
 *
 * **Enabled when `EXPO_PUBLIC_AUDIT_LOG=1`.** Otherwise this module is
 * a no-op (every function returns synchronously without disk I/O).
 *
 * Honesty notes about the metrics this captures:
 * - `prompt_chars` / `completion_chars` are exact.
 * - `prompt_tokens_est` / `completion_tokens_est` are approximated as
 *   `chars / 4` (the common rule-of-thumb for English BPE) when the
 *   SDK does not return real token counts. Real counts are used when
 *   the SDK reports them in the `run.final` payload.
 * - `ttft_ms` is only populated when streaming is enabled (the audit
 *   path enables streaming for the LLM call). For non-streaming runs
 *   it is `null`.
 * - `tokens_per_sec` is computed as
 *   `completion_tokens_est / ((duration_ms - (ttft_ms ?? 0)) / 1000)`.
 *   For non-streaming runs the divisor is full duration_ms.
 * - `cache_hit` on load events is `true` when `loadModel` completes
 *   in under 500 ms (a download-and-init takes 5-25 s; a cache hit
 *   resolves in 30-200 ms).
 *
 * The log file is intended as evidence for the hackathon verification
 * panel. To extract it from a device after a demo run, see
 * `docs/audit-log.md` § "Pulling the log off the device".
 */

import { Platform } from "react-native";

const ENABLED = process.env.EXPO_PUBLIC_AUDIT_LOG === "1";

export type AuditEvent =
  | { type: "model.load"; timestamp: string; model_id: string; registry_id?: string; duration_ms: number; cache_hit: boolean; size_bytes?: number; error?: string }
  | { type: "model.unload"; timestamp: string; model_id: string; duration_ms: number; error?: string }
  | { type: "llm.completion"; timestamp: string; model_id: string; prompt_chars: number; prompt_tokens_est: number; completion_chars: number; completion_tokens_est: number; ttft_ms: number | null; duration_ms: number; tokens_per_sec: number; streamed: boolean; error?: string }
  | { type: "tts.synthesize"; timestamp: string; model_id: string; text_chars: number; audio_samples?: number; audio_bytes?: number; duration_ms: number; error?: string }
  | { type: "stt.transcribe"; timestamp: string; model_id: string; audio_bytes?: number; audio_uri?: string; text_chars?: number; duration_ms: number; error?: string }
  | { type: "embedding.embed"; timestamp: string; model_id: string; text_chars: number; embedding_dims?: number; duration_ms: number; error?: string }
  | { type: "session.begin"; timestamp: string; platform: string; ai_provider: string; audit_log_path: string }
  | { type: "session.end"; timestamp: string; reason: string };

let logFileUri: string | null = null;
let initPromise: Promise<void> | null = null;

const TOKEN_APPROX = (chars: number) => Math.max(1, Math.round(chars / 4));

async function ensureInitialized(): Promise<void> {
  if (!ENABLED) return;
  if (logFileUri) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    if (Platform.OS === "web") {
      // Web fallback: log to console only, no disk I/O.
      logFileUri = "web://console-only";
      return;
    }

    try {
      // expo-file-system legacy API is the only one with sync writeAsStringAsync
      // signatures stable across SDK 55.
      const FS = await import("expo-file-system/legacy");
      const cacheDir = (FS as any).cacheDirectory ?? null;
      if (!cacheDir) {
        logFileUri = "memory-only://no-cache-dir";
        return;
      }
      const auditDir = `${cacheDir}futureselves-audit/`;
      try {
        await (FS as any).makeDirectoryAsync(auditDir, { intermediates: true });
      } catch {
        // Directory likely already exists. Continue.
      }
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      logFileUri = `${auditDir}run-${timestamp}.jsonl`;

      const sessionEvent: AuditEvent = {
        type: "session.begin",
        timestamp: new Date().toISOString(),
        platform: `${Platform.OS}-${Platform.Version}`,
        ai_provider: process.env.EXPO_PUBLIC_AI_PROVIDER ?? "stub",
        audit_log_path: logFileUri,
      };
      await (FS as any).writeAsStringAsync(logFileUri, JSON.stringify(sessionEvent) + "\n");
      // Log the path prominently so the demo recording captures it.
      console.log("[AuditLog] writing to:", logFileUri);
    } catch (e) {
      console.warn("[AuditLog] init failed:", e);
      logFileUri = "init-failed://" + String(e);
    }
  })();

  return initPromise;
}

async function append(event: AuditEvent): Promise<void> {
  // Always mirror to console so the metrics are visible in dev logs
  // even if disk I/O fails.
  console.log(`[AuditLog] ${event.type}`, event);

  if (!ENABLED) return;
  await ensureInitialized();
  if (!logFileUri || logFileUri.startsWith("memory-only") || logFileUri.startsWith("init-failed") || logFileUri.startsWith("web://")) {
    return;
  }

  try {
    const FS = await import("expo-file-system/legacy");
    // Read-append-write because there is no atomic append in expo-file-system.
    let existing = "";
    try {
      existing = await (FS as any).readAsStringAsync(logFileUri);
    } catch {
      // File missing — first write of the session.
    }
    await (FS as any).writeAsStringAsync(logFileUri, existing + JSON.stringify(event) + "\n");
  } catch (e) {
    console.warn("[AuditLog] write failed:", e);
  }
}

/**
 * Returns the current log file URI for export via the share sheet, etc.
 */
export function getAuditLogUri(): string | null {
  return logFileUri;
}

/**
 * Returns whether audit logging is enabled. Use to skip expensive
 * instrumentation in hot paths.
 */
export function isAuditEnabled(): boolean {
  return ENABLED;
}

// ─── Per-event helpers ─────────────────────────────────────────────────────

export async function logModelLoad(
  modelId: string,
  durationMs: number,
  registryId?: string,
  sizeBytes?: number,
  error?: string,
): Promise<void> {
  await append({
    type: "model.load",
    timestamp: new Date().toISOString(),
    model_id: modelId,
    registry_id: registryId,
    duration_ms: Math.round(durationMs),
    cache_hit: durationMs < 500,
    size_bytes: sizeBytes,
    error,
  });
}

export async function logModelUnload(modelId: string, durationMs: number, error?: string): Promise<void> {
  await append({
    type: "model.unload",
    timestamp: new Date().toISOString(),
    model_id: modelId,
    duration_ms: Math.round(durationMs),
    error,
  });
}

export async function logLLMCompletion(args: {
  modelId: string;
  promptChars: number;
  completionChars: number;
  durationMs: number;
  ttftMs: number | null;
  streamed: boolean;
  promptTokens?: number;
  completionTokens?: number;
  error?: string;
}): Promise<void> {
  const promptTokens = args.promptTokens ?? TOKEN_APPROX(args.promptChars);
  const completionTokens = args.completionTokens ?? TOKEN_APPROX(args.completionChars);
  const generationMs = args.ttftMs !== null ? args.durationMs - args.ttftMs : args.durationMs;
  const tokensPerSec = generationMs > 0 ? +(completionTokens / (generationMs / 1000)).toFixed(2) : 0;

  await append({
    type: "llm.completion",
    timestamp: new Date().toISOString(),
    model_id: args.modelId,
    prompt_chars: args.promptChars,
    prompt_tokens_est: promptTokens,
    completion_chars: args.completionChars,
    completion_tokens_est: completionTokens,
    ttft_ms: args.ttftMs !== null ? Math.round(args.ttftMs) : null,
    duration_ms: Math.round(args.durationMs),
    tokens_per_sec: tokensPerSec,
    streamed: args.streamed,
    error: args.error,
  });
}

export async function logTTSSynthesize(args: {
  modelId: string;
  textChars: number;
  durationMs: number;
  audioSamples?: number;
  audioBytes?: number;
  error?: string;
}): Promise<void> {
  await append({
    type: "tts.synthesize",
    timestamp: new Date().toISOString(),
    model_id: args.modelId,
    text_chars: args.textChars,
    audio_samples: args.audioSamples,
    audio_bytes: args.audioBytes,
    duration_ms: Math.round(args.durationMs),
    error: args.error,
  });
}

export async function logSTTTranscribe(args: {
  modelId: string;
  audioUri?: string;
  audioBytes?: number;
  textChars?: number;
  durationMs: number;
  error?: string;
}): Promise<void> {
  await append({
    type: "stt.transcribe",
    timestamp: new Date().toISOString(),
    model_id: args.modelId,
    audio_uri: args.audioUri,
    audio_bytes: args.audioBytes,
    text_chars: args.textChars,
    duration_ms: Math.round(args.durationMs),
    error: args.error,
  });
}

export async function logEmbedding(args: {
  modelId: string;
  textChars: number;
  embeddingDims?: number;
  durationMs: number;
  error?: string;
}): Promise<void> {
  await append({
    type: "embedding.embed",
    timestamp: new Date().toISOString(),
    model_id: args.modelId,
    text_chars: args.textChars,
    embedding_dims: args.embeddingDims,
    duration_ms: Math.round(args.durationMs),
    error: args.error,
  });
}
