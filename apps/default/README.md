# `apps/default`

This workspace contains the playable **Future Selves** client.

## What lives here

- Expo app shell and routing
- onboarding flow
- home/progression screen
- transmission player
- local client-side helpers and types

## Run it

From this directory:

```bash
bun run start
```

Common variants:

```bash
bun run ios
bun run android
bun run web
```

## Important files

- `app/` — routes and layout
- `components/` — UI flows and screens
- `lib/futureself.ts` — shared client-facing game types/helpers
- `app.json` — Expo config
- `metro.config.js` — monorepo + env loading

## QVAC integration (in progress)

The app is being extended so transmissions, TTS, and STT run locally via the [QVAC SDK](https://github.com/tetherto/qvac). **The submission path is fully local** — no cloud LLM, no ElevenLabs. New files planned for this work:

- `lib/qvac.ts` — model load/unload lifecycle, on-device cache keys, model selection; exposes clean named hooks (`useQVACModel`, `useLocalTTS`, `useLocalSTT`)
- `hooks/use-network-kill.ts` — proves the app still works when Wi-Fi + cellular are disabled; the demo video uses this
- `hooks/use-qvac-model.ts` — wraps `loadModel` with progress events surfaced to the splash screen
- `components/memory-readout.tsx` — small dev-overlay chip: *bytes uploaded: 0 · inference: on-device · last model · cache hit*. In scope for the demo, not optional.

QVAC is an officially supported Expo runtime target, so it slots into this workspace without a new native module. Defaults (configurable via `EXPO_PUBLIC_QVAC_DEFAULT_*` env vars):

- LLM: `LLAMA_3_2_1B_INST_Q4_0`
- TTS: `chatterbox` (ONNX via `lib-infer-onnx-tts`)
- STT: `parakeet` (NVIDIA Parakeet)

The primary demo device is a **mid-range Android**, not the latest iPhone.

## Public surface vs. product

The web build at `futureselves.vercel.app` is a **demo surface**, not a product. The hard rules for it live in `docs/edge-ai-qvac.md` §12 and the public-facing copy lives in `docs/privacy-posture.md`. To summarize:

- No real onboarding (no `afraidWontHappen` / `avoiding` / `draining` / `miraculousYear` fields anywhere in the cloud build).
- No real check-ins, no real account creation.
- Only CTA on the cloud demo is *"Install on iOS / Android."*
- The site footer must say, in plain language: *"This demo runs sample data only. The product you install runs entirely on your device."*

The privacy story only works if the marketing site is honest about what it is.

See `docs/edge-ai-qvac.md` for the full plan, switch points, and phases.

## Depends on

This app expects the Convex backend to be running from `packages/backend` and the root `.env` to contain `EXPO_PUBLIC_CONVEX_URL`.
