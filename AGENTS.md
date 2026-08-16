## AI Provider Configuration

Set the following environment variables to configure AI inference providers:

- `ANTHROPIC_API_KEY` - Primary provider (Claude)
- `FEATHERLESS_API_KEY` - Fallback provider (Llama 3.1 70B)
- `VENICE_API_KEY` - Fallback provider (Llama 3.1 70B via Venice AI)
- `MELIUS_API_KEY` - Agentic workflow orchestration (The Last Voicemail)

Providers are tried in order. If one is rate limited (HTTP 429), the system automatically falls back to the next configured provider.

> **Strategic direction (August 2026):** The QVAC on-device pivot (Tether Developers Cup) and the Build Small hackathon (`hf-space/`) are both **complete, submitted, and no longer the active focus**. The QVAC local-AI mode still exists and works — it's a real product feature (offline ritual loop) — but the "zero third-party network calls" constraint documented below and in `docs/remote-apis.md` was specific to that submission and is no longer a hard rule for new work. **The active focus is RevenueCat Shipaton 2026** (Aug 1 – Sep 30, 2026): ship a public first release with RevenueCat-powered in-app purchases. See `docs/shipaton-2026.md` for the submission plan, entitlement model, and remaining store-readiness checklist.

> **Historical note (June 2026):** We piloted pivoting the AI + audio layer onto the [QVAC](https://qvac.tether.io) on-device SDK so transmissions, TTS, and STT could run fully on the device, for the Tether Developers Cup submission. The submission path was fully local — no cloud LLM, no ElevenLabs — with cloud providers as emergency fallbacks only. See `docs/edge-ai-qvac.md` for the full plan and `docs/privacy-posture.md` for the public-facing privacy statement. This work is preserved and still functions (`EXPO_PUBLIC_AI_PROVIDER=local`), but is not the current priority.

## Project Structure

- `apps/default/hooks/use-morph-progress.ts` - Wrapping-progress scrub primitive (adapted from the Luma Dream Machine Canvas2D morph effect) — drives crossfades between N discrete visual states via reanimated shared values
- `apps/default/components/morphing-avatar.tsx` - Crossfades between cast-member portraits using `use-morph-progress`; reuses `avatar-reveal.tsx`'s image-resolution rules
- `apps/default/components/timeline-morph-strip.tsx` - "Your timeline" widget on the constellation page: scrubs across a persona's unlocked voices, auto-positioned by `timelineDivergenceScore`
- `packages/backend/convex/users.ts` - `getCurrentUserId` query; exposes the stable Convex auth user id to the client before a persona necessarily exists (used by `Purchases.logIn`)
- `docs/shipaton-2026.md` - **Active hackathon.** RevenueCat Shipaton 2026 submission plan: entitlement model, paywall, webhook sync, remaining store-readiness checklist
- `apps/default/lib/revenuecat.ts` - RevenueCat SDK lifecycle: `configureRevenueCat`, `useCustomerInfo`, `useIsAwakened` — client-side entitlement state, platform-guarded (no-op on web)
- `packages/backend/convex/revenuecat.ts` - Webhook handler (`http.ts` route) + `syncEntitlementFromClient` mutation; maps the `awakened` RevenueCat entitlement onto `personas.tier`/`premiumSource`
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
- `apps/default/components/bottom-nav.tsx` - Bottom tab navigation (Today / Football / Voices / Archive)
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

## RevenueCat / Monetization (active — Shipaton 2026)

RevenueCat powers in-app purchases for the "Awakened" premium tier. Full plan in `docs/shipaton-2026.md`.

- **Entitlement:** `awakened` (RevenueCat dashboard identifier). Maps to the existing `personas.tier === "premium"` field — no schema rename, just a second way to set it.
- **`premiumSource` field** on `personas`: `"streak" | "purchase" | undefined`. Prevents a lapsed RevenueCat subscription from revoking premium status earned via the Day 30/90 streak milestones (`voicemail.milestones.ts`) — only `premiumSource === "purchase"` downgrades on `EXPIRATION`/`CANCELLATION`.
- **App User ID = Convex auth user id** (`ctx.user._id`). `Purchases.logIn(convexUserId)` is called right after Convex auth resolves, so every RevenueCat webhook's `app_user_id` matches a Convex user directly — no separate identity mapping table.
- **Sync is dual-path:** the Convex webhook (`packages/backend/convex/revenuecat.ts`, routed in `http.ts`) is the source of truth; the client also calls `syncEntitlementFromClient` immediately after a purchase/restore completes, since webhook delivery can lag a few seconds and the UI shouldn't wait on it.
- **Webhook auth:** RevenueCat webhooks are not HMAC-signed by default — only a static `Authorization` header value you set in the RevenueCat dashboard. Verified against `REVENUECAT_WEBHOOK_SECRET` in Convex env vars.
- **Env vars (client):** `EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY`, `EXPO_PUBLIC_REVENUECAT_GOOGLE_API_KEY` — placeholders until a RevenueCat project exists; the SDK no-ops gracefully without them (see `apps/default/lib/revenuecat.ts`).
- **Env vars (Convex):** `REVENUECAT_WEBHOOK_SECRET`.
- **Paywall:** `react-native-purchases-ui`'s prebuilt `RevenueCatUI.Paywall` component, configured remotely in the RevenueCat dashboard (no app-store review needed to iterate on paywall copy/design). Surfaced from the premium voicemail gate (`voicemail-experience.tsx`) and Settings.

## Football Path (Tether Developers Cup — QVAC track, submitted)

The Football Path is a goal-achievement feature built for the Tether Developers Cup hackathon (QVAC track). All AI runs on-device via the QVAC SDK — no cloud AI APIs. The 3-minute Cup submission script lives at `demo/CUP_DEMO.md` — use that, not `demo/DEMO.md`, when recording for the Cup deadline.

### Architecture

- `apps/default/lib/football-llm.ts` - On-device LLM functions (QVAC SDK only): `extractAmbition` (STT text → structured position/level/description), `generateFootballTransmission` (position-grounded voicemail from future self), `interpretTrajectory` (drill trend → narrative + position suggestion)
- `apps/default/lib/drill-utils.ts` - Sensor measurement utilities: `countJugglePeaks` (accelerometer peak detection), `formatResult`, `isImprovement`, drill metadata, pro benchmarks (`getProComparison`), player card stat engine (`calculateCardStats`, `getCardTier`, `CARD_TIER_COLORS`)
- `apps/default/lib/design-tokens.ts` - Shared design system tokens: animation durations, border radii, easing curves, colors. Single source of truth for UI consistency across personal and football surfaces
- `apps/default/components/football-ambition-declaration.tsx` - Speak-your-dream UI: QVAC STT → LLM extraction → preview → save
- `apps/default/components/football-home.tsx` - Ambition card, Match Day progress tracker (daily engagement loop), receive transmission (QVAC LLM + TTS), drill grid with pro comparisons, player card with next-goal indicator
- `apps/default/components/football-audio-player.tsx` - Self-contained TTS player for football transmissions and trajectory narratives (QVAC TTS, file-based playback, audio cache)
- `apps/default/components/player-card.tsx` - FIFA Ultimate Team style player card (shareable via ViewShot + RN Share), next-goal indicator showing points to next tier and weakest stat to train
- `apps/default/components/drill-reaction-time.tsx` - 5-round tap-based reaction time test (pure software, ms precision, false-start detection, pro comparison + challenge + share on result)
- `apps/default/components/drill-juggling.tsx` - Accelerometer-based juggle counter (expo-sensors, real-time peak detection + offline verification, pro comparison + challenge + share on result)
- `apps/default/components/drill-sprint.tsx` - Manual start/stop sprint timer (pure software, distance selection, ms precision, pro comparison + challenge + share on result)
- `apps/default/app/football.tsx` - Football Path route (switches between ambition declaration and home)
- `apps/default/app/football-drill.tsx` - Drill route (hosts all 3 drills, handles completion flow: start session → complete → recompute trajectory → QVAC LLM interpretation → save narrative → post-drill result summary with next-drill cards + challenge)
- `apps/default/app/challenge.tsx` - Deep link route for challenge-a-friend viral loop (`futureself://challenge?drill=X&target=Y&from=Z`). Handles challenge banner → drill → win/loss comparison → challenge back. Redirects to ambition declaration if no ambition exists
- `packages/backend/convex/football.ts` - Convex API: `getActiveAmbition`, `saveAmbition`, `startDrillSession`, `completeDrillSession`, `getDrillHistory`, `getTrajectories`, `recomputeTrajectory`, `updateTrajectoryNarrative`
- Schema tables: `ambitions`, `drillSessions`, `trajectories` (in `schema.ts`)
- Validators: `drillTypeValidator` (reaction_time, juggling, sprint), `positionValidator` (8 football positions + unknown), `coachPersonaValidator` (tactician, enforcer, mentor, broadcaster) (in `validators.ts`)
- **Coach persona** is the on-device LLM voice for football transmissions. The user picks one during ambition declaration (`football-ambition-declaration.tsx`); `COACH_PERSONAS` in `apps/default/lib/football-llm.ts` injects a non-negotiable persona-style block into `buildFootballPrompt`. Today this is a system-prompt injection — when `@qvac/sdk` ships `loadAdapter`, the same `coachPersona` key on `ambitions` becomes the handle for a hot-swappable local LoRA persona, zero code change at the call site.

### Measurement vs AI separation

The QVAC track requires all AI to run on-device through the QVAC SDK. The measurement layer uses native sensors (accelerometer) and pure software (tap/timer) — it is NOT AI. This keeps it outside the QVAC track's on-device-AI-only rule. The interpretation of measurement results runs through QVAC LLM separately.

### User flow

1. User taps Football tab → sees ambition declaration
2. Speaks dream → QVAC STT transcribes → QVAC LLM extracts {position, level, description}
3. Confirms → ambition saved to Convex
4. Football home shows → Match Day progress bar (0/3 drills) → taps "Receive transmission" → QVAC LLM generates voicemail grounded in position + level → QVAC TTS synthesizes voice on-device
5. Taps a drill card → drill screen opens → completes drill
6. Result saved → trajectory recomputed → QVAC LLM interprets → narrative saved
7. Post-drill result summary shows: score, pro comparison, next-drill cards, challenge + see card buttons
8. Returns to football home → Match Day progress updated → player card shows updated stats + next-goal indicator (points to next tier, weakest stat to train)
9. Taps player card → captures as image → share sheet opens with deep link

### Viral loop (challenge a friend)

1. User completes a drill → taps "Challenge" → share sheet opens with `futureself://challenge?drill=X&target=Y&from=Z`
2. Friend opens link → sees challenge banner ("Beat Alex's 340ms")
3. If friend has ambition → drill starts immediately; if not → redirected to declare ambition first (new user acquisition)
4. Friend completes drill → sees win/loss comparison vs. challenger + pro player
5. Friend taps "Challenge back" → creates a new deep link → the loop continues

### Engagement loop (Match Day)

- Football home tracks which of 3 drills were completed today via `startedAt` timestamps
- Progress bar: 0/3 → 1/3 → 2/3 → 3/3
- When all 3 done: "Match complete — come back tomorrow for your next match"
- Gives users a concrete daily goal and reason to return

### Deep linking

- URL scheme: `futureself` (defined in `app.json`)
- Expo Router handles deep links automatically based on file structure
- `futureself://challenge` → `app/challenge.tsx` (challenge a friend viral loop)
- `futureself://football` → `app/football.tsx` (football path)
- `futureself://football-drill?type=X` → `app/football-drill.tsx` (specific drill)

## Build Small (hf-space/) notes — submitted, historical

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
- **node_modules trim:** `@qvac/sdk` installs ~4.2 GB of native ML runtimes as direct deps. `scripts/trim-node-modules.mjs` runs on postinstall and keeps only the three runtimes we use (`llm-llamacpp`, `tts-ggml` for Supertonic3, `transcription-parakeet`) and only for `darwin-arm64`, `ios-arm64`, and `android-arm64`. It also removes heavy transitive deps (`bare-ffmpeg`, `react-native-bare-kit`, `rocksdb-native`). Reduces node_modules from ~5.6 GB to ~1.3 GB. The trim is fragile — it will break if the SDK internally imports a removed package at runtime.
- **QVAC SDK 0.14.0:** We're on the latest release. Key 0.14 features we benefit from: Supertonic3 TTS (31 languages, up from 5 — we switched from Chatterbox to Supertonic3), Whisper STT now GPU-accelerated on iOS, Parakeet STT on Android GPU, thinking tokens kept out of KV cache (better LLM performance), leaner SDK startup. See [release notes](https://docs.qvac.tether.io/reference/release-notes/).

<!-- convex-ai-start -->
This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read `convex/_generated/ai/guidelines.md` first** for important guidelines on how to correctly use Convex APIs and patterns. The file contains rules that override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running `npx convex ai-files install`.
<!-- convex-ai-end -->
