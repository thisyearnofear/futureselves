## AI Provider Configuration

Set the following environment variables to configure AI inference providers:

- `ANTHROPIC_API_KEY` - Primary provider (Claude)
- `FEATHERLESS_API_KEY` - Fallback provider (Llama 3.1 70B)
- `VENICE_API_KEY` - Fallback provider (Llama 3.1 70B via Venice AI)
- `MELIUS_API_KEY` - Agentic workflow orchestration (The Last Voicemail)

Providers are tried in order. If one is rate limited (HTTP 429), the system automatically falls back to the next configured provider.

> **Strategic direction (June 2026):** We are pivoting the AI + audio layer onto the [QVAC](https://qvac.tether.io) on-device SDK so transmissions, TTS, and STT run **fully on the device**. The submission path is fully local — no cloud LLM, no ElevenLabs. Cloud providers above become emergency fallbacks for the backend Convex code only, and even there they are not on the public submission path. See `docs/edge-ai-qvac.md` for the full plan and `docs/privacy-posture.md` for the public-facing privacy statement.

## Project Structure

- `apps/default/lib/qvac.ts` - QVAC SDK lifecycle hooks (`useQVACModel`, `useLocalTTS`, `useLocalSTT`, `useQVACChat`), platform-guarded; model load/unload, TTS, and LLM chat wired (Phases D+3), STT remains stub
- `apps/default/lib/ai.ts` - AI provider runtime split (`getAIProvider()`, `isLocalMode()`, `isLocalLLMMode()`); web=cloud, native=local when `EXPO_PUBLIC_AI_PROVIDER=local`
- `apps/default/lib/local-llm.ts` - Client-side LLM orchestrator: builds the transmission prompt locally, calls QVAC `chatCompletion`, parses JSON, falls back to built-in script
- `apps/default/lib/audio-cache.ts` - Persona-scoped TTS audio cache (WAV files on disk, metadata in `expo-secure-store`); evict, getCacheSizeBytes for the readout chip
- `apps/default/hooks/use-network-kill.ts` - Network status hook (`isOffline`, `toggleKillSwitch`) for the demo's network-off proof
- `apps/default/components/memory-readout.tsx` - Privacy readout chip (bytes uploaded, inference location, last model, cache hit)
- `packages/backend/convex/game.ts` - Game actions including transmission generation
- `packages/backend/convex/melius.ts` - Melius MCP client for agentic workflows
- `packages/backend/convex/voicemail.ts` - 'The Last Voicemail' critique-driven pipeline
- `scripts/trim-node-modules.mjs` - Postinstall script that trims unused @qvac runtimes and non-target platform prebuilds
- `docs/edge-ai-qvac.md` - Canonical QVAC edge-AI plan (LLM, TTS, STT, switch points, phases, tracks, public-surface rules)
- `docs/privacy-posture.md` - Public-facing privacy statement (hosted on the marketing site)

## Rate Limiting

The `RateLimiter` class in `ai.ts` implements a token bucket algorithm for per-provider rate limiting.

## QVAC SDK notes

When working on the local-AI pivot, keep these in mind:

- The on-device path lives in the **client** app (`apps/default`), not in Convex. QVAC is an Expo runtime target, so `@qvac/sdk` installs there.
- The **soft-de-risk HTTP server** path (`QVAC_HTTP_URL`) is **internal/dev only** — it is not the submission path and not the public app. Per `docs/edge-ai-qvac.md` §3.5, the public submission is fully local.
- Model lifecycle hooks (load/unload/onProgress) belong in a new `apps/default/lib/qvac.ts` and must expose clean named hooks (`useQVACModel`, `useLocalTTS`, `useLocalSTT`). Do not put them in the Convex runtime.
- Local model cache keys should be namespaced by user persona id and stored in `expo-secure-store` (already a dep). The cache encryption key is held in the device's secure enclave.
- For tests, mock `@qvac/sdk` at the module boundary. Do not hit real on-device inference in unit tests.
- The primary demo device is an **iPhone**. macOS (Apple Silicon) is the dev/test target — the `darwin-arm64` prebuild runs the full SDK natively on your Mac for fast iteration. iOS builds ship via EAS (`eas build --profile development --platform ios`). Android is not required.
- **node_modules trim:** `@qvac/sdk` installs ~4.2 GB of native ML runtimes as direct deps. `scripts/trim-node-modules.mjs` runs on postinstall and keeps only the three runtimes we use (`llm-llamacpp`, `tts-ggml`, `transcription-parakeet`) and only for `darwin-arm64`, `ios-arm64`, and `android-arm64`. It also removes heavy transitive deps (`bare-ffmpeg`, `react-native-bare-kit`, `rocksdb-native`). Reduces node_modules from ~5.6 GB to ~1.3 GB. The trim is fragile — it will break if the SDK internally imports a removed package at runtime.
