# Future Selves — Privacy Posture

**Status:** Public-facing statement (v2, August 2026)
**Purpose:** This is the single, public, human-readable answer to *"what happens to my data when I use Future Selves?"* It is referenced from the marketing site and the app store listings. Keep it short. Keep it honest.

> **v1 (June 2026) is superseded.** The earlier version claimed the app ran "entirely on your device" with "nothing sent to a third party." That was accurate for the QVAC on-device submission build but is no longer true for the public release, which uses cloud AI providers and syncs your data to a backend. This version reflects the actual architecture.

---

## The short version

> **Your future self knows your deepest choices. We want you to know exactly where they go.**
>
> Future Selves is a daily ritual: you give one word, a named voice sends a short transmission back, and you make one small choice. The content of your ritual — your onboarding answers, check-ins, transmissions, and choices — is stored in our backend so your future voices can reference what happened yesterday.
>
> The AI that writes your transmissions runs on cloud servers by default. An on-device mode exists (powered by the QVAC SDK) that keeps all AI inference on your phone, and still works with no network connection. But your ritual data still syncs to our backend in both modes.
>
> We do not sell your data. We do not train AI models on your data. This page explains precisely what is stored, what is sent to third parties, and why.

---

## What data we collect and where it goes

| Data | Where it lives | Who processes it | Why |
|---|---|---|---|
| Onboarding answers (name, city, current chapter, primary arc, miraculous year, what you're avoiding, what you're afraid won't happen, what's draining you) | Convex (our backend) | Convex + the active AI provider | To personalize your transmissions and maintain narrative continuity |
| Daily check-in words and notes | Convex | Convex + the active AI provider | The word seeds today's transmission; the note adds context |
| Transmission text (what the AI writes back to you) | Convex | Convex + the active AI provider | This is the product — your future voice's reply |
| Transmission audio (text-to-speech) | Convex storage | Convex + ElevenLabs (cloud mode) or on-device TTS (local mode) | So you can hear the voice and replay it |
| Your choices (toward / steady / release / repair) | Convex | Convex | Choices drive the divergence system and unlock new voices |
| Your reaction to transmissions (did it / not quite / keep close / landed) | Convex | Convex + the active AI provider | So tomorrow's transmission can reference whether you followed through |
| Streak, divergence score, unlock progress | Convex | Convex | Game state — the consequence engine |
| Account email (if you signed in with email/password) | Convex | Convex | Authentication |
| Purchase status | RevenueCat | RevenueCat | To manage your subscription (Awakened tier) |
| Device identifiers for notifications | Apple/Google push services | Apple/Google | To send daily reminders if you enable them |

### The active AI provider

By default, your transmission prompt (which contains your onboarding answers, today's check-in word, recent transmissions, and recent choices) is sent to a cloud AI provider — Anthropic (Claude), Featherless, or Venice AI — to generate the transmission text. The provider is selected automatically based on availability and rate limits. The prompt is sent via our backend; the provider does not receive your identity, only the prompt content.

In **on-device mode** (`EXPO_PUBLIC_AI_PROVIDER=local`), the LLM, TTS, and STT all run locally on your device via the QVAC SDK. No prompt content leaves the device for AI inference. Your ritual data still syncs to Convex for state management and cross-session continuity.

---

## What stays on your device (in on-device mode)

When on-device mode is active:

| Data | Where it lives |
|---|---|
| The AI model that writes your transmissions | On-device (QVAC SDK, local inference) |
| The voice that speaks your transmissions | On-device (Supertonic TTS, ONNX) |
| Speech-to-text for the check-in | On-device (Parakeet STT) |
| The prompt sent to the model | Stays on-device — never sent to a cloud LLM |
| The model's output (transmission text) | Generated on-device, then synced to Convex for storage |

The on-device model cache is encrypted with a key held in your device's secure enclave.

---

## What we do not do

- **We do not sell your data.** Not to advertisers, not to data brokers, not to anyone.
- **We do not train AI models on your data.** Your transmissions, check-ins, and onboarding answers are never used as training data.
- **We do not use your ritual content for advertising.**
- **We do not share your transmissions with other users.** Sharing is opt-in and manual — you choose to share a specific moment via the share button.
- **We do not collect biometric data.** (The Football Path uses the accelerometer for juggle counting, but that data stays on-device.)

---

## Your choices

- **On-device mode:** If you want all AI inference to stay on your device, set `EXPO_PUBLIC_AI_PROVIDER=local` before building. This keeps prompts and model I/O on-device. Your ritual state still syncs to Convex.
- **Notifications:** Daily reminders are opt-in. You can enable or disable them in Settings, and choose the time.
- **Sharing:** Sharing a transmission is a manual action. Nothing is shared automatically.
- **Account deletion:** You can sign out from Settings. To request full data deletion, contact us via GitHub or email.

---

## The marketing site (web demo)

The web version of Future Selves is a **demo**, not the product.

- It uses a single hard-coded sample persona. There is no real onboarding.
- Transmissions shown on the site are pre-generated samples.
- The only call to action is: **install the real app on iOS or Android.**

---

## Third-party services

| Service | What they receive | Privacy policy |
|---|---|---|
| Convex | All ritual data (onboarding, check-ins, transmissions, choices, game state) | https://convex.dev/legal/privacy |
| Anthropic | Your transmission prompt (in cloud mode) | https://www.anthropic.com/privacy |
| Featherless | Your transmission prompt (in cloud mode, fallback) | https://featherless.ai/privacy |
| Venice AI | Your transmission prompt (in cloud mode, fallback) | https://venice.ai/privacy |
| ElevenLabs | Your transmission text (in cloud mode, for TTS) | https://elevenlabs.io/privacy |
| RevenueCat | Your purchase status and entitlement | https://www.revenuecat.com/privacy |
| Apple / Google | Push notification tokens (if you enable reminders) | https://apple.com/legal/privacy / https://policies.google.com/privacy |
| Replicate | Avatar generation prompts (in cloud mode) | https://replicate.com/privacy |

---

## Open-source and verifiable

- The product code is open source at [github.com/thisyearnofear/futureselves](https://github.com/thisyearnofear/futureselves). You can audit exactly what data is sent where.
- The QVAC SDK is open source at [github.com/tetherto/qvac](https://github.com/tetherto/qvac).
- The local AI models (LLM, TTS, STT) are pulled from the QVAC model registry. Their hashes are pinned in our build.

---

## Contact

If you have a privacy question that this page does not answer, open an issue on GitHub or email us. We will answer in public.

---

*This document is a public statement of intent. It is not legal advice. We will update it as the product evolves.*
