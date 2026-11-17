/**
 * AI provider runtime split.
 *
 * Single seam between the cloud LLM + ElevenLabs pipeline,
 * the on-device QVAC pipeline, and the Firebase AI Logic
 * hybrid pipeline (#BuildHybridAI submission build).
 *
 * ## Rules
 * - Do NOT import `@qvac/sdk` here. QVAC calls are in `lib/qvac.ts`
 *   and `lib/local-llm.ts`, both platform-guarded.
 * - Do NOT import `firebase/*` here. AI Logic calls are in
 *   `lib/firebase.ts` and `lib/firebase-ai.ts`, lazy-initialized.
 * - `"firebase"` is honored on every platform (web included) since the
 *   submission build targets Chrome hybrid inference.
 * - Native respects `EXPO_PUBLIC_AI_PROVIDER` env var.
 *
 * See `docs/edge-ai-qvac.md` §3.5, §7 and `docs/privacy-posture.md`,
 * `docs/firebase-hybrid-ai.md`.
 */

import { Platform } from "react-native";

/**
 * Which AI pipeline the running build should use.
 * - `"cloud"`: Anthropic/ElevenLabs via Convex (legacy web + fallback).
 * - `"local"`: on-device QVAC SDK path (the QVAC submission build).
 * - `"firebase"`: Firebase AI Logic hybrid — Nano/Prompt API on-device
 *   where available, Gemini cloud otherwise. The #BuildHybridAI build.
 * - `"stub"`: native fallback, behaves like "cloud" until QVAC wires up.
 */
export type AIProvider = "cloud" | "local" | "firebase" | "stub";

/**
 * Resolve the active provider for the current platform.
 * Result is stable for the process lifetime.
 */
export function getAIProvider(): AIProvider {
  const configured = process.env.EXPO_PUBLIC_AI_PROVIDER;
  // Firebase mode is explicit and cross-platform: web Chrome gets the
  // Nano hybrid, other web browsers get cloud-only through the same SDK.
  if (configured === "firebase") return "firebase";
  if (Platform.OS === "web") return "cloud";
  if (configured === "local") return "local";
  if (configured === "cloud") return "cloud";
  return "stub";
}

/**
 * Whether the current build routes AI inference through Firebase AI Logic.
 */
export function isFirebaseMode(): boolean {
  return getAIProvider() === "firebase";
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
