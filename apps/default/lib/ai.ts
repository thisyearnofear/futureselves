/**
 * AI provider runtime split.
 *
 * Single seam between the cloud LLM + ElevenLabs pipeline
 * and the on-device QVAC pipeline.
 *
 * ## Rules
 * - Do NOT import `@qvac/sdk` here. QVAC calls are in `lib/qvac.ts`
 *   and `lib/local-llm.ts`, both platform-guarded.
 * - Web always returns `"cloud"`.
 * - Native respects `EXPO_PUBLIC_AI_PROVIDER` env var.
 *
 * See `docs/edge-ai-qvac.md` §3.5, §7 and `docs/privacy-posture.md`.
 */

import { Platform } from "react-native";

/**
 * Which AI pipeline the running build should use.
 * - `"cloud"`: Anthropic/ElevenLabs via Convex (web + fallback).
 * - `"local"`: on-device QVAC SDK path (the QVAC submission build).
 * - `"stub"`: native fallback, behaves like "cloud" until QVAC wires up.
 */
export type AIProvider = "cloud" | "local" | "stub";

/**
 * Resolve the active provider for the current platform.
 * Result is stable for the process lifetime.
 */
export function getAIProvider(): AIProvider {
  if (Platform.OS === "web") return "cloud";
  const configured = process.env.EXPO_PUBLIC_AI_PROVIDER;
  if (configured === "local") return "local";
  if (configured === "cloud") return "cloud";
  return "stub";
}

/**
 * Whether the current build should use on-device TTS for transmissions.
 * Convenience check used by the home screen and transmission player.
 */
export function isLocalMode(): boolean {
  return getAIProvider() === "local";
}

/**
 * Whether the current build should use on-device LLM for transmissions.
 * Same as `isLocalMode()` today, but separated so TTS and LLM can be
 * toggled independently in future phases.
 */
export function isLocalLLMMode(): boolean {
  return getAIProvider() === "local";
}
