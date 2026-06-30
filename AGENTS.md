## AI Provider Configuration

Set the following environment variables to configure AI inference providers:

- `ANTHROPIC_API_KEY` - Primary provider (Claude)
- `FEATHERLESS_API_KEY` - Fallback provider (Llama 3.1 70B)
- `VENICE_API_KEY` - Fallback provider (Llama 3.1 70B via Venice AI)
- `MELIUS_API_KEY` - Agentic workflow orchestration (The Last Voicemail)

Providers are tried in order. If one is rate limited (HTTP 429), the system automatically falls back to the next configured provider.

> **Strategic direction (June 2026):** We are pivoting the AI + audio layer onto the [QVAC](https://qvac.tether.io) on-device SDK so transmissions, TTS, and STT run **fully on the device**. The submission path is fully local — no cloud LLM, no ElevenLabs. Cloud providers above become emergency fallbacks for the backend Convex code only, and even there they are not on the public submission path. See `docs/edge-ai-qvac.md` for the full plan and `docs/privacy-posture.md` for the public-facing privacy statement.

## Project Structure

- `apps/default/lib/qvac.ts` - QVAC SDK lifecycle hooks (`useQVACModel`, `useLocalTTS`, `useLocalSTT`, `useQVACChat`, `useLocalEmbeddings`, `useLoRAAdapter`), platform-guarded; all hooks wired
- `apps/default/lib/ai.ts` - AI provider runtime split (`getAIProvider()`, `isLocalMode()`, `isLocalLLMMode()`); web=cloud, native=local when `EXPO_PUBLIC_AI_PROVIDER=local`
- `apps/default/lib/local-llm.ts` - Client-side LLM orchestrator: builds the transmission prompt locally, calls QVAC `chatCompletion`, parses JSON, falls back to built-in script
- `apps/default/lib/audio-cache.ts` - Persona-scoped TTS audio cache (WAV files on disk, metadata in `expo-secure-store`); evict, getCacheSizeBytes for the readout chip
- `apps/default/hooks/` - Native hooks: `use-network-kill`, `use-transmission-audio` (TTS pre-generation + retry), `use-related-signals` (embedding-based similarity), `use-speech-recognition` (press-to-record STT), `use-qvac-prewarm`
- `apps/default/components/futureself-home.tsx` - Hosts the local-mode cloud-call enforcement: `voicemail.native.generateNativeVoicemail`, `face.generateAvatar`, and `synthesis.generateWeeklySynthesis` are all guarded by `isLocalMode()` so the submission build makes zero third-party network calls during a ritual loop
- `apps/default/components/` - Client UI (see `apps/default/components/` for the full list; key ones below)
- `apps/default/components/constellation-map.tsx` - Visual star map of voice constellation with animated glows and divergence warping
- `apps/default/components/divergence-gauge.tsx` - Visual arc gauge for the timeline divergence score
- `apps/default/components/ritual-state.tsx` - Game-state visualization: streak risk, choice patterns, consequence chains
- `apps/default/components/bottom-nav.tsx` - Bottom tab navigation (Today / Voices / Archive)
- `packages/backend/convex/game.ts` - Game actions including transmission generation
- `packages/backend/convex/melius.ts` - Melius MCP client for agentic workflows
- `packages/backend/convex/voicemail.ts` - 'The Last Voicemail' critique-driven pipeline
- `scripts/trim-node-modules.mjs` - Postinstall script that trims unused @qvac runtimes and non-target platform prebuilds
- `hf-space/` - Build Small hackathon submission (Gradio Space): MiniCPM 2.5 + Nemotron-Parse + Kokoro TTS — **live at https://papajams-futureselves.hf.space** on T4 GPU
- `docs/edge-ai-qvac.md` - Canonical QVAC edge-AI plan (LLM, TTS, STT, embeddings, switch points, phases, tracks, public-surface rules, UX overhaul)
- `docs/visual-upgrade.md` - Avatar system design (Tier 1 superseded by Phase 6.5; Tier 2 still deferred)
- `docs/privacy-posture.md` - Public-facing privacy statement (hosted on the marketing site)
- `docs/remote-apis.md` - Canonical inventory of every remote API the project can touch (Anthropic, ElevenLabs, Replicate, Melius, Convex, OAuth providers, QVAC registry) with per-API call sites, env vars, and submission-build status
- `docs/audit-log.md` + `docs/sample-audit-log.jsonl` - Structured JSONL audit log of QVAC SDK calls (model loads/unloads, LLM/TTS/STT/embedding metrics inc. TTFT and tokens/sec). Logger at `apps/default/lib/audit-log.ts`. Gated by `EXPO_PUBLIC_AUDIT_LOG=1`. Required artifact for the hackathon evidence bundle.
- `docs/build-small-strategy.md` - Prize strategy for the Build Small hackathon (separate submission via `hf-space/`)

## Football Path (Tether Developers Cup — QVAC track)

The Football Path is a goal-achievement feature built for the Tether Developers Cup hackathon (QVAC track). All AI runs on-device via the QVAC SDK — no cloud AI APIs.

### Architecture

- `apps/default/lib/football-llm.ts` - On-device LLM functions (QVAC SDK only): `extractAmbition` (STT text → structured position/level/description), `generateFootballTransmission` (position-grounded voicemail from future self), `interpretTrajectory` (drill trend → narrative + position suggestion)
- `apps/default/lib/drill-utils.ts` - Sensor measurement utilities: `countJugglePeaks` (accelerometer peak detection), `formatResult`, `isImprovement`, drill metadata
- `apps/default/components/football-ambition-declaration.tsx` - Speak-your-dream UI: QVAC STT → LLM extraction → preview → save
- `apps/default/components/football-home.tsx` - Ambition card, receive transmission (QVAC LLM + TTS), drill grid, trajectory narratives
- `apps/default/components/football-audio-player.tsx` - Self-contained TTS player for football transmissions and trajectory narratives (QVAC TTS, file-based playback, audio cache)
- `apps/default/components/drill-reaction-time.tsx` - 5-round tap-based reaction time test (pure software, ms precision, false-start detection)
- `apps/default/components/drill-juggling.tsx` - Accelerometer-based juggle counter (expo-sensors, real-time peak detection + offline verification)
- `apps/default/components/drill-sprint.tsx` - Manual start/stop sprint timer (pure software, distance selection, ms precision)
- `apps/default/app/football.tsx` - Football Path route (switches between ambition declaration and home)
- `apps/default/app/football-drill.tsx` - Drill route (hosts all 3 drills, handles completion flow: start session → complete → recompute trajectory → QVAC LLM interpretation → save narrative)
- `packages/backend/convex/football.ts` - Convex API: `getActiveAmbition`, `saveAmbition`, `startDrillSession`, `completeDrillSession`, `getDrillHistory`, `getTrajectories`, `recomputeTrajectory`, `updateTrajectoryNarrative`
- Schema tables: `ambitions`, `drillSessions`, `trajectories` (in `schema.ts`)
- Validators: `drillTypeValidator` (reaction_time, juggling, sprint), `positionValidator` (8 football positions + unknown) (in `validators.ts`)

### Measurement vs AI separation

The QVAC track requires all AI to run on-device through the QVAC SDK. The measurement layer uses native sensors (accelerometer) and pure software (tap/timer) — it is NOT AI. This keeps it outside the QVAC track's on-device-AI-only rule. The interpretation of measurement results runs through QVAC LLM separately.

### User flow

1. User taps Football tab → sees ambition declaration
2. Speaks dream → QVAC STT transcribes → QVAC LLM extracts {position, level, description}
3. Confirms → ambition saved to Convex
4. Football home shows → taps "Receive transmission" → QVAC LLM generates voicemail grounded in position + level → QVAC TTS synthesizes voice on-device
5. Taps a drill card → drill screen opens → completes drill
6. Result saved → trajectory recomputed → QVAC LLM interprets → narrative saved
7. Returns to football home → sees updated results + trajectory narrative with TTS playback

## Build Small (hf-space/) notes

- Space uses Gradio 5.50.0 (Python 3.13 compat)
- Kokoro TTS skipped on Space (spacy dep chain has no cp313 wheel); falls back gracefully
- `gr.Timer` polling replaces removed `every=` parameter
- `gr.BrowserState` persists session across page refreshes via `to_dict()`/`from_dict()`
- T4-small GPU at $0.40/hr; sleeps after 10min idle

## Rate Limiting

The `RateLimiter` class in `ai.ts` implements a token bucket algorithm for per-provider rate limiting.

## QVAC SDK notes

When working on the local-AI pivot, keep these in mind:

- The on-device path lives in the **client** app (`apps/default`), not in Convex. QVAC is an Expo runtime target, so `@qvac/sdk` installs there.
- The **soft-de-risk HTTP server** path (`QVAC_HTTP_URL`) is **internal/dev only** — it is not the submission path and not the public app. Per `docs/edge-ai-qvac.md` §3.5, the public submission is fully local.
- Model lifecycle hooks (load/unload/onProgress) belong in a new `apps/default/lib/qvac.ts` and must expose clean named hooks (`useQVACModel`, `useLocalTTS`, `useLocalSTT`). Do not put them in the Convex runtime.
- Local model cache keys should be namespaced by user persona id and stored in `expo-secure-store` (already a dep). The cache encryption key is held in the device's secure enclave.
- For tests, mock `@qvac/sdk` at the module boundary. Do not hit real on-device inference in unit tests.
- The primary demo device is an **iPhone** (dev/test) or a **mid-range Android** (QVAC submission headliner, per `docs/edge-ai-qvac.md` §3.5). macOS (Apple Silicon) is the dev/test target — the `darwin-arm64` prebuild runs the full SDK natively on your Mac for fast iteration. iOS builds ship via EAS (`eas build --profile development --platform ios`). Android is not required for daily development but must be verified for the QVAC submission.
- **node_modules trim:** `@qvac/sdk` installs ~4.2 GB of native ML runtimes as direct deps. `scripts/trim-node-modules.mjs` runs on postinstall and keeps only the three runtimes we use (`llm-llamacpp`, `tts-ggml`, `transcription-parakeet`) and only for `darwin-arm64`, `ios-arm64`, and `android-arm64`. It also removes heavy transitive deps (`bare-ffmpeg`, `react-native-bare-kit`, `rocksdb-native`). Reduces node_modules from ~5.6 GB to ~1.3 GB. The trim is fragile — it will break if the SDK internally imports a removed package at runtime.
