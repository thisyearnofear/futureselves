# Remote APIs — full inventory

**Purpose:** Single source of truth for every remote API this project can touch. Audited from source: `grep -rE 'fetch.*https?://|api\.' packages/backend/convex apps/default`. The QVAC submission build is verifiable against this list — anything not listed here is not called.

The intent of the **submission build** (`EXPO_PUBLIC_AI_PROVIDER=local`, EAS profile `submission`) is that **no AI inference, image generation, voice synthesis, or speech recognition makes a network call**. Convex is retained as a thin auth + sync layer. Every other remote API is either gated off at the client by `isLocalMode()` or unreachable because no API key is provided in the submission build's env.

---

## Quick verdict per API

| Remote API | Purpose | Called from | Submission build status |
|---|---|---|---|
| **Anthropic Claude** | Cloud LLM (transmission text) | `convex/ai.ts:103` | **Disabled.** Client guards `getAIProvider() === "local"` short-circuit before any Convex AI action fires. Also, `ANTHROPIC_API_KEY` is unset in `.env.production`. |
| **Featherless AI** | Cloud LLM fallback | `convex/ai.ts:211,219` | **Disabled.** Same gate as Anthropic; key unset. |
| **Venice AI** | Cloud LLM fallback | `convex/ai.ts:231` | **Disabled.** Same gate as Anthropic; key unset. |
| **ElevenLabs** | Cloud TTS | `convex/game.transmission.ts:235`, `convex/voicemail.native.ts:153`, `convex/generate_sample.ts:19` | **Disabled.** TTS in local mode is on-device via QVAC `chatterbox`. Client guards prevent `voicemail.native.generateNativeVoicemail` from firing. `ELEVENLABS_API_KEY` unset. |
| **Replicate** | Avatar image generation | `convex/face.ts:375,423,471` | **Disabled.** `face.generateAvatar` is gated by `!localMode` in `futureself-home.tsx`. Unlock UI still renders; the image call is skipped. `REPLICATE_API_TOKEN` unset. |
| **Melius MCP** | Agentic orchestration ("Last Voicemail" premium tier) | `convex/melius.ts:27` → `convex/voicemail.ts` | **Disabled.** Premium voicemail is intentionally cloud-only. The free-tier voicemail (`voicemail.native.ts`) is gated off in local mode. `MELIUS_API_KEY` unset. |
| **Convex** (`*.convex.cloud`, `*.convex.site`) | Auth + cross-device sync | All `useQuery` / `useMutation` / `useAction` hooks | **Enabled** — required for auth heartbeat and game-state persistence. **Carries zero AI input/output.** Onboarding text fields, check-in words/notes, and transmission output are stored in Convex as game state (encrypted at rest by Convex's storage layer); the *inference path* never leaves the device. |
| **Google / GitHub / Apple OAuth** | Optional sign-in providers | `convex/auth.ts:1-9` | **Optional.** Anonymous + Password providers are also wired; the demo persona uses Anonymous, so no third-party identity provider is contacted. Only fires if the user explicitly chooses a social login. |
| **QVAC model registry** | First-cold-start model download (LLAMA 3.2 1B, Chatterbox, Whisper) | Inside `@qvac/sdk` `loadModel()` calls in `apps/default/lib/qvac.ts` | **Enabled on first launch only.** After the ~1.1 GB cold-start download, model weights are cached on-device (`expo-secure-store` metadata, disk bytes). All subsequent launches and all inference are fully offline. The cold start is announced to the user via the splash-screen progress UI; it is not hidden. |

> **Football Path note:** The Football Path (Tether Developers Cup, QVAC track) adds **no new remote APIs** to this table. It reuses the same Convex sync layer (row above) and the same QVAC on-device models (LLM for ambition extraction / transmission generation / trajectory interpretation, TTS for voice playback, STT for spoken ambition declaration). The drill measurement layer (accelerometer for juggling, tap for reaction time, timer for sprint) is native sensors / pure software — not AI — so it does not introduce any AI network calls.

---

## Per-API details

### 1. Anthropic Claude (cloud LLM)

- **Endpoint:** `https://api.anthropic.com/v1/messages`
- **Call site:** `packages/backend/convex/ai.ts:103`
- **Env var:** `ANTHROPIC_API_KEY` (unset in submission build)
- **When called (cloud mode):** every check-in fires `api.game.generateDailyTransmission` which calls `getAIProvider().generate()` → Anthropic.
- **When called (local mode):** never. The client in `apps/default/components/futureself-home.tsx:625` checks `if (isLocalMode())` and routes through `lib/local-llm.ts` (on-device QVAC) instead.
- **Data shipped (cloud mode only):** persona context (`afraidWontHappen`, `avoiding`, `draining`, `miraculousYear`, recent check-ins, recent choices) + the prompt.

### 2. Featherless AI / Venice AI (cloud LLM fallbacks)

- **Endpoints:** `https://api.featherless.ai/v1`, `https://api.venice.ai/api/v1`
- **Call sites:** `convex/ai.ts:211, 219, 231`
- **Env vars:** `FEATHERLESS_API_KEY`, `VENICE_API_KEY` (both unset in submission build)
- **When called:** only as fallback if the primary Anthropic call returns HTTP 429 (rate limit).
- **Submission status:** never reached because Anthropic itself is never called in local mode.

### 3. ElevenLabs (cloud TTS)

- **Endpoint:** `https://api.elevenlabs.io/v1/text-to-speech/{voiceId}`
- **Call sites:**
  - `convex/game.transmission.ts:235` — synthesises transmission audio in cloud mode
  - `convex/voicemail.native.ts:153` — synthesises free-tier voicemail audio
  - `convex/generate_sample.ts:19` — pre-generates the web demo's sample transmissions
- **Env var:** `ELEVENLABS_API_KEY` (unset in submission build)
- **When called (local mode):** never. TTS uses QVAC `chatterbox` (ONNX) on-device via `apps/default/lib/qvac.ts:useLocalTTS`. The voicemail action is also gated client-side in `futureself-home.tsx` so it doesn't fire even if the key were present.

### 4. Replicate (avatar image generation)

- **Endpoint:** `https://api.replicate.com/v1/predictions`
- **Call sites:** `convex/face.ts:375, 423, 471`
- **Env var:** `REPLICATE_API_TOKEN` (unset in submission build)
- **When called (cloud mode):** on voice unlock and on first mount, `api.face.generateAvatar` is fired with the cast member ID; Replicate generates a stylised portrait.
- **When called (local mode):** never. Gated by `!localMode` in `apps/default/components/futureself-home.tsx:380, 395`. The voice-unlock UI still renders (cast member appears as a stylised tile with the QVAC default art); no image is generated. On-device image generation via QVAC is on the roadmap.

### 5. Melius MCP (agentic orchestration)

- **Endpoint:** `https://api.melius.com/mcp`
- **Call sites:** `convex/melius.ts:27` (base URL); `convex/voicemail.ts` (premium "The Last Voicemail" flow orchestrating intake → agent → critique → voice/image/video)
- **Env var:** `MELIUS_API_KEY` (unset in submission build)
- **When called (cloud mode + premium):** when a user with `tier === "premium"` triggers a custom voicemail with a "situation" text. Orchestrates the multi-step LLM + image + video pipeline.
- **When called (local mode):** never. Premium tier is intentionally cloud-only and is documented as such in `docs/edge-ai-qvac.md` §9.

### 6. Convex (`*.convex.cloud`, `*.convex.site`)

- **Endpoints:** `https://futureselves.convex.cloud`, `https://*.convex.site`
- **Call sites:** every React hook in `apps/default` using `useQuery`, `useMutation`, `useAction`
- **Env var:** `EXPO_PUBLIC_CONVEX_URL` (set in submission build — Convex is the only required external dependency)
- **Purpose:** authentication heartbeat, persona/game-state persistence, cross-device sync, scheduled cron jobs (game-loop maintenance).
- **What's shipped over the wire:** game state — persona metadata, streak count, divergence score, completed check-ins. **What is NOT shipped:** the AI model's inputs or outputs in local mode are generated and consumed entirely on the device; they are also stored in Convex as part of the persona's history (so the user can sync across devices), but they are never sent to a third-party AI provider.
- **Honesty note:** "zero bytes leave the device" in the submission pitch refers to the *AI inference path*. Convex sync traffic exists because the product is a multi-device journal. This is documented in `docs/privacy-posture.md` § "What might leave your device, and why." A future P2P sync mode would remove even this dependency.
- **Football Path addition:** The Football Path (Tether Developers Cup, QVAC track) adds three new tables — `ambitions`, `drillSessions`, `trajectories` — and new API functions in `packages/backend/convex/football.ts`: `getActiveAmbition`, `saveAmbition`, `startDrillSession`, `completeDrillSession`, `getDrillHistory`, `getTrajectories`, `recomputeTrajectory`, `updateTrajectoryNarrative`. All of these are synced through the same Convex layer described above, with **zero AI input/output over the wire** — the LLM extraction, transmission generation, and trajectory interpretation all run on-device via the QVAC SDK, and only the resulting structured game state is persisted to Convex.
- **Football Path measurement data:** The drill measurement data (accelerometer readings for juggling, reaction times for the tap test, sprint times for the timer) is stored in Convex as game state alongside the rest of the persona's history. The **AI interpretation** of that measurement data (trajectory narrative generation) runs entirely on-device via the QVAC LLM — the raw sensor/tap/timer values are never sent to any third-party AI provider.

### 7. OAuth providers (Google / GitHub / Apple)

- **Endpoints:** Provider OAuth endpoints (`accounts.google.com`, `github.com`, `appleid.apple.com`), reached only if the user picks a social login
- **Call site:** `packages/backend/convex/auth.ts:1-9` (providers registered)
- **Env vars:** `GOOGLE_CLIENT_ID/SECRET`, `GITHUB_ID/SECRET`, `APPLE_ID/SECRET` (optional)
- **When called:** only if the user actively chooses social sign-in. The submission demo uses **Anonymous** auth (`@convex-dev/auth/providers/Anonymous`), which does not contact any third-party identity provider.

### 8. QVAC model registry (cold-start download)

- **Endpoint:** Resolved inside `@qvac/sdk`. Pulls weights for the three configured models on first launch.
- **Call site:** `apps/default/lib/qvac.ts` — `useQVACModel().load(...)`, triggered by `apps/default/hooks/use-qvac-prewarm.ts` on app start.
- **Env vars (model selection):** `EXPO_PUBLIC_QVAC_DEFAULT_LLM`, `EXPO_PUBLIC_QVAC_DEFAULT_TTS`, `EXPO_PUBLIC_QVAC_DEFAULT_STT` (set on the submission profile to `LLAMA_3_2_1B_INST_Q4_0`, `chatterbox`, `WHISPER_EN_BASE_Q8_0`)
- **When called:** **once per device,** on first launch. Subsequent launches resolve cached models from `expo-secure-store` + disk and skip the download.
- **Approx footprint:** 1.1 GB total across the three models.
- **Submission posture:** This is the *only* network access required for the AI path. After cold start, the entire ritual loop runs with Wi-Fi + cellular disabled. The cold-start window is announced via splash-screen progress UI, not hidden.

---

## What we explicitly do NOT use

These would be common in a typical AI product and are deliberately absent from this codebase. Verified by `grep`:

- No analytics SDK (no PostHog, Amplitude, Mixpanel, Google Analytics)
- No error reporting SDK (no Sentry, Bugsnag, Datadog)
- No marketing telemetry
- No third-party crash reporting
- No remote configuration service
- No A/B testing service

The only telemetry that exists is local-only: optional crash and error logs stored on-device (per `docs/privacy-posture.md`).

---

## How to verify this list against a running build

**Canonical submission APK:** https://expo.dev/artifacts/eas/OUI85axlwSS8GQBL8zFend5zJtrfDNwuFkY9tRssrLA.apk (EAS build record: https://expo.dev/accounts/papajams.eth/projects/future-selves/builds/830cec5b-3565-43cf-ae4d-d8c8c6f791f6, source commit `1cadaf9`).

After installing the submission APK on a device:

1. Engage OS-level Airplane mode.
2. Open the app. Cold-start downloads do not happen (models cached from previous launch). Splash progresses to ready state.
3. Run a full ritual cycle: onboarding (or "Try Maya's example") → spoken check-in → transmission generated and spoken → choice recorded → unlock UI updates if reached.
4. Disable airplane mode and watch the network panel from your device, or from a `tcpdump` on the local Wi-Fi network:

```bash
sudo tcpdump -i en0 host <phone-ip> and not port 5353 and not port 137 and not port 138
```

Expected traffic: occasional `*.convex.cloud` packets (auth heartbeat, state sync). **No** traffic to `api.elevenlabs.io`, `api.anthropic.com`, `api.replicate.com`, `api.featherless.ai`, `api.venice.ai`, `api.melius.com`, or any OAuth provider.

---

## Cross-references

- `docs/privacy-posture.md` — public-facing privacy statement
- `docs/edge-ai-qvac.md` — canonical QVAC integration plan
- `apps/default/README.md` § "Local-mode cloud-call enforcement" — code-level details of the gates
- `.env.example` — every env var the project understands
- `apps/default/lib/ai.ts` — `getAIProvider()` / `isLocalMode()` / `isLocalLLMMode()` runtime split

*Last audited from source: 2026-07-01.*
