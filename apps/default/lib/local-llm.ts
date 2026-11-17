/**
 * local-llm.ts — Client-side LLM orchestrator for QVAC on-device build.
 *
 * When `EXPO_PUBLIC_AI_PROVIDER === "local"`, the app calls this module
 * instead of the Convex cloud pipeline for transmission text generation.
 *
 * Prompt construction, parsing, and the scripted fallback live in
 * `lib/transmission-prompt.ts`, shared with `lib/firebase-ai.ts`.
 * The prompt is kept intentionally in sync with
 * `packages/backend/convex/game.transmission.ts:buildPrompt`.
 *
 * See `docs/edge-ai-qvac.md` §3.5, §7 Phase 3, and §4.
 */

import { Platform } from "react-native";
import { isAuditEnabled, logLLMCompletion } from "@/lib/audit-log";
import {
  buildLocalPrompt,
  getSystemPrompt,
  localFallbackTransmission,
  parseLocalTransmission,
  type LocalTransmissionResult,
  type TransmissionLLMOptions,
} from "@/lib/transmission-prompt";

export type { LocalTransmissionResult };

export interface LocalLLMOptions extends TransmissionLLMOptions {
  modelId: string;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Generate a transmission locally using the on-device QVAC LLM.
 * Returns parsed `LocalTransmissionResult` on success, or the built-in
 * fallback if the LLM call fails or JSON is unparseable.
 *
 * When `timelineDivergenceScore >= FINETUNE_THRESHOLD`, uses a variant
 * system prompt that simulates a LoRA-fine-tuned model (Track C).
 *
 * @throws on web — the web build must use the cloud pipeline.
 */
export async function generateLocalTransmission(
  options: LocalLLMOptions,
): Promise<LocalTransmissionResult> {
  if (Platform.OS === "web") {
    throw new Error("generateLocalTransmission is native-only.");
  }
  const { modelId, context, castMember, localNow } = options;
  const prompt = buildLocalPrompt(context, castMember);
  const systemPrompt = getSystemPrompt(
    context.persona.timelineDivergenceScore,
    context.recentTransmissions.length === 0,
  );
  const promptChars = systemPrompt.length + prompt.length + (`\n\nLocal open time: ${localNow}`).length;
  const streamed = isAuditEnabled();
  const t0 = Date.now();
  let ttftMs: number | null = null;

  try {
    const { completion } = await import("@qvac/sdk");
    const run = completion({
      modelId,
      history: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `${prompt}\n\nLocal open time: ${localNow}` },
      ],
      stream: streamed,
      generationParams: { predict: 700, temp: 0.8 },
    });

    if (streamed && (run as any).chunks) {
      try {
        const iter = (run as any).chunks[Symbol.asyncIterator]?.();
        if (iter) {
          await iter.next();
          ttftMs = Date.now() - t0;
          while (!(await iter.next()).done) {
            /* drain */
          }
        }
      } catch {
        ttftMs = null;
      }
    }

    const final = await run.final;
    const text = final.contentText ?? "";
    void logLLMCompletion({
      modelId,
      promptChars,
      completionChars: text.length,
      durationMs: Date.now() - t0,
      ttftMs,
      streamed,
      promptTokens: (final as any)?.usage?.promptTokens,
      completionTokens: (final as any)?.usage?.completionTokens,
    });
    const parsed = parseLocalTransmission(text);
    if (parsed) return parsed;
    console.warn("[LocalLLM] JSON parse failed, using fallback");
    return localFallbackTransmission(context, castMember);
  } catch (error) {
    void logLLMCompletion({
      modelId,
      promptChars,
      completionChars: 0,
      durationMs: Date.now() - t0,
      ttftMs,
      streamed,
      error: error instanceof Error ? error.message : String(error),
    });
    console.warn("[LocalLLM] LLM call failed, using fallback:", error);
    return localFallbackTransmission(context, castMember);
  }
}
