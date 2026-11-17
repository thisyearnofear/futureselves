# Firebase #BuildHybridAI 2026 — Submission Plan

**Status:** Active focus alongside Shipaton (Shipaton deadline passed Sep 30; this is the current hackathon).
**Deadline:** November 30, 2026, 22:00 UTC.
**Rules:** https://firebasehybridaihackathon.devpost.com/
**Prizes:** $30,000 pool — grand prize plus $3,000 per platform (web, Android, iOS).

## Why Future Selves fits

Two structural wins that outlive the contest:

- **Inference cost is the business model.** A daily-ritual app has per-user
  inference cost that repeats every day, forever. An on-device baseline
  (Gemini Nano via Chrome Prompt API / ML Kit Prompt API) means the free
  tier costs nearly nothing and "Awakened" revenue goes to margin. The
  hybrid split literally writes the pricing tiers: on-device ritual for
  free users, cloud models for premium — `useIsAwakened()` picks the
  `InferenceMode`.
- **It revives the differentiator on maintained infrastructure.** The QVAC
  local mode was the brand claim ("zero bytes leave your hardware",
  `docs/privacy-posture.md`) but on a dead-end SDK. Firebase AI Logic
  restores the same posture on a supported SDK, inside the provider split
  (`lib/ai.ts` + `isLocalMode()`) designed for exactly this. When
  `response.inferenceSource === "on_device"`, the privacy claim is true
  again — and reportable in the UI.

## Rules constraints (confirmed via Devpost FAQ)

- **All AI inference must go through Firebase AI Logic.** Convex stays as
  persistence/auth (not AI inference); Anthropic/ElevenLabs/Replicate paths
  are replaced or gated off in the submission build.
- **Hybrid judged on effectiveness of the on-device/cloud split.**
- **App Check required.** Debug tokens are accepted for submissions.
- **Existing app allowed** with significant updates during the window +
  disclosure of pre-existing code (this doc + submission text).
- Other Firebase products (Remote Config, Firestore, Auth) encouraged,
  optional. App Check is mandatory.
- Third-party APIs/SDKs allowed, but generative-AI inference must be AI
  Logic.
- One platform is enough; multi-platform preferred.

## Target platforms

| Platform | Path | Status |
|---|---|---|
| **Web (Chrome)** | `firebase` JS SDK 12.5+ → `PREFER_ON_DEVICE` hits Chrome's Prompt API (Gemini Nano), cloud fallback automatic. Expo web build exists today. | Primary target — `$3k` platform prize + grand |
| **Android** | `expo-ai` (0.2.x preview) wraps the same ML Kit Prompt API `firebase-ai-ondevice` uses; cloud lane still goes through AI Logic JS SDK. EAS APK. | Stretch — verify `expo-ai` on-device early |
| iOS | `expo-ai` also bridges Apple Foundation Models — the same runtime AI Logic's iOS public-preview hybrid adapter uses; needs Apple-Intelligence hardware to test | Opportunistic — wired via expo-ai, untested |

## Firebase project (provisioned 2026-11-16)

- GCP/Firebase project: `futureselves-hybrid-ai` (project # 351378596053)
- Web app: `1:351378596053:web:021d4f4b80fb01c1db025c` ("Future Selves Web")
- Android app: `1:351378596053:android:4a4fac826d62fd61db025c`
  (`com.futureselves.app`)
- App Check debug token registered on the web app (dev + submission)
- Enabled APIs: firebase, firebaseinstallations, firebaseappcheck,
  generativelanguage, firebasevertexai, iamcredentials
- Setup notes: `addFirebase` + app registration done via REST as
  `firebase-admin@futureselves-hybrid-ai.iam.gserviceaccount.com` (roles:
  firebase.admin, serviceusage.serviceUsageAdmin). The user-token path
  403s on addFirebase — use SA impersonation for future REST setup.
- **Quota form:** Sprint deadlines Nov 18 / Nov 25 for billing-required
  models (Imagen, TTS billing tiers). File by Nov 18 if needed.

## Architecture

`EXPO_PUBLIC_AI_PROVIDER=firebase` activates the mode on every platform
(`lib/ai.ts`). All generation is **client-side through AI Logic**, then
persisted to Convex via auth-checked mutations — the same stub+attach
flow the QVAC path pioneered:

```
handleReceive (futureself-home.tsx)
  → beginTransmissionGenerationLocal (authMutation — stub row, "generating")
  → generateFirebaseTransmission (lib/firebase-ai.ts)
       free web:     PREFER_ON_DEVICE → Nano via Chrome Prompt API /
                     gemini-3.5-flash-lite fallback
       free native:  expo-ai (ML Kit Prompt API / Nano on Android,
                     Apple Foundation Models on iOS) → AI Logic cloud
       premium:      PREFER_IN_CLOUD → gemini-3.8-flash, degrades to
                     on-device on native when cloud is unreachable
       → inferenceSource ∈ {"on_device","in_cloud"} persisted on the row
  → attachLocalTransmission (authMutation — NOW PUBLIC, see bug fix below)
```

`inferenceSource` is persisted on the `transmissions` row and surfaces in
the player as a pill — "On your device" (green) vs "Firebase" (cloud) —
the live proof of the hybrid split for judges and the privacy claim for
users.

Prompt/parse/fallback logic lives in `lib/transmission-prompt.ts`,
extracted unchanged from `local-llm.ts` so QVAC and Firebase paths emit
identical prompts (both kept in sync with
`convex/game.transmission.ts:buildPrompt`).

**Bug fixed during integration:** `attachLocalTransmission` was an
`internalMutation` — not client-callable (internal functions are rejected
at the client boundary). Converted to `authMutation` with an ownership
check (mirrors `cancelLocalTransmission`). This was a latent bug in the
QVAC path; the client call site moved from `internal.game.*` to
`api.game.*`.

### Env vars (root `.env`, loaded via `metro.config.js` → `loadProjectEnv`)

`EXPO_PUBLIC_FIREBASE_API_KEY / _AUTH_DOMAIN / _PROJECT_ID / _APP_ID /
_MESSAGING_SENDER_ID` — client-safe identifiers, protected by App Check.
`EXPO_PUBLIC_FIREBASE_APPCHECK_DEBUG_TOKEN` (dev) /
`EXPO_PUBLIC_FIREBASE_APPCHECK_SITE_KEY` (prod reCAPTCHA v3, not yet
provisioned). `EXPO_PUBLIC_FIREBASE_CLOUD_MODEL_FREE / _PREMIUM` —
optional model overrides.

## Inference audit (all-AI-through-AI-Logic)

| Surface | Was | Firebase-mode path | Status |
|---|---|---|---|
| Daily transmission | Anthropic via Convex / QVAC | AI Logic hybrid (client) | **Done** |
| Weekly synthesis | Anthropic (`synthesis.ts`) | `generateFirebaseSynthesis` (client) → `saveSynthesis` | **Done** |
| Transmission TTS | ElevenLabs (`game.transmission.ts`) / QVAC chatterbox | `lib/firebase-tts.ts`: OS speech synth (free, `speechSynthesis`/expo-speech) → Gemini TTS via AI Logic `speechConfig` + `ResponseModality.AUDIO` (premium). Native premium path caches WAV via `use-transmission-audio` + `audio-cache` — pre-generation, retries, offline replay | **Done** |
| Check-in STT | QVAC parakeet | `hooks/use-speech-recognition.ts` dispatcher: `osBackend` → browser SpeechRecognition (web) / expo-speech-recognition (native SpeechRecognizer) | **Done** |
| Live voice | — | `lib/firebase-live.ts`: Gemini Live API (`gemini-3.1-flash-live-preview`) via `startAudioConversation` — bidirectional voice with the future self, cast voices + live transcriptions | **Done** (web, Awakened) |
| Related-signals | QVAC embeddings | `findRelatedByKeywords` fallback (already non-AI) | Done — no AI needed |
| Avatars | Replicate (`face.ts`) | `lib/firebase-image.ts`: Nano Banana (`gemini-3.1-flash-image`) via `ResponseModality.IMAGE`; prompt via `face.getAvatarPrompt`, bytes → `generateAvatarUploadUrl` → `saveClientAvatar` | **Done** |
| Last Voicemail | Anthropic + Melius + ElevenLabs | **Gated off** in firebase mode (`noServerAI` guard on `generateWelcomeVoicemail`) | Done — gated |
| Football path | QVAC LLM/TTS | Hidden by default (`EXPO_PUBLIC_SHOW_FOOTBALL`) | Done — stays hidden |

**Gating decision:** the welcome voicemail still calls third-party AI
(Anthropic + ElevenLabs) server-side, so it stays disabled in firebase
mode. Avatar generation was migrated instead — Nano Banana through AI
Logic replaced Replicate end-to-end (`face.getAvatarPrompt` keeps the
prompt builder server-side; `face.saveClientAvatar` records the result).
`localMode || firebaseMode` → `noServerAI` still guards the voicemail.

## Android (`expo-ai`) notes

- `expo-ai@0.2.0` installed; `generateOnDeviceText()` in
  `lib/firebase-ai.ts` does dynamic `import("expo-ai")` →
  `getAvailabilityAsync()` → `generateAsync(prompt, {instructions})`.
  Free tier tries it first, premium falls back to it on cloud failure.
- `expo-build-properties` pins `minSdkVersion: 26` (AICore floor).
- `expo-speech` (OS TTS free path) + `expo-speech-recognition`
  (SpeechRecognizer STT) installed; config plugins auto-added.
- Requires a **development build** (native code — not Expo Go) and a
  device with AICore/Gemini Nano ready (Pixel 8+, Galaxy S24+ class).
  Build: `eas build --profile firebase-dev --platform android`, then
  `npx expo start --dev-client`.
- The `firebase-dev` EAS profile inlines the client-safe identifiers.
  The API key and App Check debug token are NOT committed — set them for
  the build via `eas env:create` (`EXPO_PUBLIC_FIREBASE_API_KEY`,
  `EXPO_PUBLIC_FIREBASE_APPCHECK_DEBUG_TOKEN`, `--visibility plaintext`)
  or keep them in the local `.env` (already present for Metro dev).
- On-device inference must run foregrounded (ML Kit requirement).

## Remaining checklist

- [x] Verify `expo export --platform web` bundles firebase/ai cleanly
- [ ] Chrome Prompt API smoke test (Chrome 139+, flag enabled)
- [x] Synthesis → AI Logic client call
- [x] TTS: OS speech-synth free path + Gemini TTS premium path
- [x] STT: OS-level recognition (web SpeechRecognition / Android)
- [x] Avatar migrated to AI Logic image models; voicemail gated off (see decision above)
- [ ] `expo-ai` on Android: EAS dev build, AICore device test
- [x] Gemini Live API voice session (Awakened, web) — `lib/firebase-live.ts`
- [x] Avatar path via AI Logic image models (Nano Banana) — `lib/firebase-image.ts` + `face.saveClientAvatar`
- [ ] reCAPTCHA v3 site key for production App Check (post-submission)
- [ ] Quota form by Nov 18 if Imagen/TTS billing needed
- [ ] Devpost write-up + pre-existing-code disclosure + demo video
- [ ] Deploy web build (vercel.json exists)
- [ ] Server prompt templates for the transmission prompt (protects prompt
  IP + manages model-name churn server-side — optional fast follow)
- [ ] Native `firebase-ai-ondevice` bridge (see honest framing below)

## Android on-device honesty note (for judges)

The JS AI Logic SDK cannot reach Android's on-device lane on React
Native — `firebase-ai-ondevice` is Kotlin-only. Our free-tier Android
path uses `expo-ai`, which calls the **same ML Kit Prompt API / Gemini
Nano runtime** that `firebase-ai-ondevice` wraps, then falls back to AI
Logic cloud through the JS SDK. On-device calls in that lane therefore
run on identical on-device infrastructure but outside the AI Logic
adapter surface (no `inferenceSource`, no App Check attestation on that
call); every cloud call and the entire web hybrid path are real AI
Logic. A thin Expo module bridging `firebase-ai-ondevice` is the
documented fast follow if judges require the on-device call itself to
traverse the Firebase SDK.

## Demo narrative

"Future Selves is a daily ritual: every morning your future self leaves
you a voicemail. Free users' transmissions generate on-device — Nano via
the Prompt API — so a free ritual costs us ~nothing and nothing they
write leaves their phone. Awakened subscribers get the frontier model —
and can *speak back*: a live voice conversation with their future self
over the Gemini Live API. The entitlement IS the inference mode."
Show `inferenceSource` switching on toggle/paywall, then the
"Speak back" live session for the closer.
