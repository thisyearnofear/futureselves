/**
 * AI provider runtime split.
 *
 * This file is the single seam between the existing cloud LLM + ElevenLabs
 * pipeline (powers futureselves.vercel.app) and the upcoming on-device
 * QVAC pipeline (the local-first build for the QVAC "Unleash Edge AI"
 * submission).
 *
 * ## Rules for this file
 *
 * - **Do not import `@qvac/sdk` from this file or any other file imported
 *   by the web build.** The web build at futureselves.vercel.app must
 *   keep the cloud pipeline; the QVAC SDK is a native-only module and
 *   pulling it into the web bundle will break the Vercel deploy.
 * - **Web always uses "cloud".** This is enforced unconditionally.
 * - **Native uses the `EXPO_PUBLIC_AI_PROVIDER` env var, defaulting to
 *   "stub".** "local" is the value the QVAC on-device build will set
 *   once the SDK integration lands (Phase C of `docs/edge-ai-qvac.md`).
 *   "stub" means "not wired up yet, the native build behaves like the
 *   cloud build for now" — the safest default.
 *
 * See `docs/edge-ai-qvac.md` §3.5 and §7 for the strategic context and
 * `docs/privacy-posture.md` for the public-facing privacy story.
 */

import { Platform } from "react-native";

/**
 * Which AI provider the running build should use.
 *
 * - `"cloud"`: existing Anthropic + ElevenLabs path via Convex. Used by
 *   the web build at futureselves.vercel.app and by the native build
 *   until the QVAC integration ships.
 * - `"local"`: on-device QVAC SDK path. The QVAC submission build flips
 *   to this once Phase C lands.
 * - `"stub"`: native fallback that behaves like "cloud" — kept as a
 *   distinct value so we can detect "local not yet wired up" without
 *   parsing env vars at every call site.
 */
export type AIProvider = "cloud" | "local" | "stub";

/**
 * Resolve the active provider for the current platform.
 *
 * Call this once at app start (or memoize at module scope if you need
 * it synchronously). The result is stable for the lifetime of the
 * process, so callers do not need to re-invoke.
 */
export function getAIProvider(): AIProvider {
  // Web is unconditionally cloud. The marketing site, the dev server's
  // web target, and any future PWA all stay on the existing pipeline
  // until we explicitly decide otherwise.
  if (Platform.OS === "web") {
    return "cloud";
  }

  // Native: respect the env var. Default to "stub" so a fresh clone
  // without the QVAC SDK installed still builds and runs as if it were
  // the cloud build. Flip to "local" in the QVAC submission build via
  // eas.json / .env.production.
  const configured = process.env.EXPO_PUBLIC_AI_PROVIDER;
  if (configured === "local") return "local";
  if (configured === "cloud") return "cloud";
  return "stub";
}
