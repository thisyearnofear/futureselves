# Future Selves — Privacy Posture

**Status:** Public-facing statement (v1, June 2026)
**Purpose:** This is the single, public, human-readable answer to *"what happens to my data when I use Future Selves?"* It is referenced from the marketing site, the app store listings, the README, and the QVAC submission materials. Keep it short. Keep it honest.

---

## The short version

> **Your future self knows your deepest choices. Only you do.**
>
> The real Future Selves app — the one you install on your phone — runs entirely on your device. Your onboarding answers, your check-ins, your transmissions, your voice, and the model that produces them all stay on the device. Nothing about your ritual is sent to a third party.
>
> The demo on this website is not the product. It is a preview of the interface using sample data, so you can feel what the experience is like before installing the app. The app is the real thing.

---

## What stays on your device

| Data | Where it lives | Who can see it |
|---|---|---|
| Onboarding answers (`afraidWontHappen`, `avoiding`, etc.) | On-device encrypted storage (`expo-secure-store`) | Only you |
| Daily check-in words and notes | On-device | Only you |
| The AI model that writes your transmissions | On-device (QVAC SDK, local inference) | Only you |
| The voice that speaks your transmissions | On-device (Chatterbox/Supertonic, ONNX) | Only you |
| Your transmission history and cast unlocks | On-device | Only you |
| Avatars (Tier 1) | Generated on-device from text prompts; no photo involved | Only you |
| Selfies (Tier 2, opt-in) | Processed in memory at generation time, then deleted | Only you, briefly |
| Crash and error logs | Optional, on-device only. No remote telemetry. | Only you |
| Football ambition (spoken text + extracted position/level) | On-device (QVAC STT + LLM) | Only you |
| Football drill measurements (reaction time, juggling count, sprint time) | On-device (sensors) | Only you |
| Football transmission text and audio | On-device (QVAC LLM + TTS) | Only you |
| Trajectory interpretation narratives | On-device (QVAC LLM) | Only you |

The on-device model cache is encrypted with a key held in your device's secure enclave. A stolen phone is a stolen brick for the purposes of this app.

## What does *not* leave your device

- Your onboarding text
- Your check-ins
- Your transmissions (text or audio)
- The AI model's inputs or outputs
- Any biometric data
- Any usage analytics tied to your account
- Your spoken football ambition
- Your drill measurement data
- Your football-path transmissions (text or audio)

## What *might* leave your device, and why

- **Nothing required.** The app works with Wi-Fi and cellular fully disabled.
- **Optional cross-device sync (future):** if you opt in, your encrypted transmission history syncs between your own devices via a peer-to-peer channel. We never see it. This feature does not exist yet; when it does, it will be off by default and clearly labeled.
- **Optional crash reports (future):** if you opt in, anonymized crash data is sent so we can fix bugs. This is off by default. When it ships, it will be a single opt-in toggle with a list of exactly what fields are sent.

We will never sell, rent, share, or train on your ritual data. We will never have access to it to begin with.

---

## The marketing site (this website)

The web version of Future Selves at `futureselves.vercel.app` is a **demo**, not a product.

- It uses a single hard-coded sample persona. There is no real onboarding.
- It never asks for `afraidWontHappen`, `avoiding`, or any field whose privacy stakes matter.
- Transmissions shown on the site are pre-generated samples.
- The only call to action is: **install the real app on iOS or Android.**

We chose this framing because the alternative — "try the real thing in your browser, then move to the device" — would require sending your real onboarding answers to a third-party LLM, which is the exact thing the product exists to avoid. The web demo is honest about what it is.

---

## Architecture: cloud path vs. on-device path

```
┌─────────────────────────────────────────────────────────────────┐
│  CLOUD PATH (the old way)                                       │
│                                                                 │
│   [Your phone] ──► 3rd-party LLM ──► 3rd-party voice lab ──►    │
│                                                                 │
│   Your onboarding answers, check-ins, and transmissions          │
│   leave your device on every single ritual.                     │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  ON-DEVICE PATH (Future Selves, now)                            │
│                                                                 │
│   [Your phone]                                                  │
│      │                                                          │
│      ├── local LLM (QVAC SDK, ~0.7 GB)                          │
│      ├── local TTS (Chatterbox/Supertonic, ONNX)                │
│      └── local STT (Parakeet/Whisper)                           │
│                                                                 │
│   No bytes leave the device. The app works with                 │
│   Wi-Fi and cellular fully disabled.                            │
└─────────────────────────────────────────────────────────────────┘
```

The QVAC SDK is open source and made by Tether. The on-device path is verifiable: you can put the phone in airplane mode and the ritual still works.

---

## Open-source and verifiable

- The product code is open source at [github.com/thisyearnofear/futureselves](https://github.com/thisyearnofear/futureselves).
- The QVAC SDK is open source at [github.com/tetherto/qvac](https://github.com/tetherto/qvac).
- The local AI models (LLM, TTS, STT) are pulled from the QVAC model registry. Their hashes are pinned in our build.

You can audit any of this.

---

## Contact

If you have a privacy question that this page does not answer, open an issue on GitHub or email us. We will answer in public.

---

*This document is a public statement of intent. It is not legal advice. We will update it as the product evolves.*
