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
- `lib/ai.ts` — AI provider runtime split (`getAIProvider()`)
- `app.json` — Expo config
- `metro.config.js` — monorepo + env loading

## AI provider runtime split

The web build at `futureselves.vercel.app` and the upcoming on-device QVAC build share one codebase but route to different AI pipelines. The seam is a single function in `lib/ai.ts`:

```ts
import { getAIProvider } from "@/lib/ai";

const provider = getAIProvider();
// → "cloud" on web, unconditionally.
// → "cloud" | "local" | "stub" on native, based on EXPO_PUBLIC_AI_PROVIDER.
```

**Rules for contributors:**

- **Do not import `@qvac/sdk` from this file or any module that is bundled into the web build.** The QVAC SDK is native-only; pulling it into the web bundle will break the Vercel deploy. The `Platform.OS === "web"` guard in `getAIProvider()` exists to keep the two runtimes partitioned, and the import boundary has to honor it.
- **Web is always "cloud"** — `getAIProvider()` enforces this unconditionally, regardless of env vars.
- **Native defaults to "stub"** when `EXPO_PUBLIC_AI_PROVIDER` is unset. "stub" behaves like "cloud" but is a distinct value so the QVAC submission build can flip to "local" with a single env var. See `docs/edge-ai-qvac.md` §3.5 and §7 for the strategic context.
- **The canonical QVAC submission APK is built via the `preview` profile** in `eas.json` (it mirrors the original `submission` profile after that one kept erroring during the deadline crunch). The preview profile pins `EXPO_PUBLIC_AI_PROVIDER=local` + the QVAC model env vars + `EXPO_PUBLIC_AUDIT_LOG=1` + the Convex deployment URL, so the resulting APK is fully self-contained and produces the audit-log evidence artifact automatically on first launch. APK URL in `README.md` § "Submission build".

Valid values for `EXPO_PUBLIC_AI_PROVIDER`:

| Value   | Behavior                                                       |
| ------- | -------------------------------------------------------------- |
| `cloud` | Use the existing Anthropic + ElevenLabs path via Convex.        |
| `local` | Use the on-device QVAC SDK path (model load/unload + TTS wired). |
| `stub`  | Default. Behaves like "cloud" but signals "local not wired up." |

## QVAC integration

The app runs transmissions, TTS, STT, and embeddings locally via the [QVAC SDK](https://github.com/tetherto/qvac). **The submission path is fully local** — no cloud LLM, no ElevenLabs, no Replicate. Files that carry this:

- `lib/qvac.ts` — QVAC SDK lifecycle wrapper with named hooks (`useQVACModel`, `useLocalTTS`, `useLocalSTT`, `useQVACChat`, `useLocalEmbeddings`). Platform-guarded at the function level. Type-only import of `@qvac/sdk` on web (no bundle impact).
- `lib/local-llm.ts` — client-side LLM orchestrator: builds the transmission prompt locally, calls QVAC `completion()`, parses JSON, falls back to a built-in script.
- `lib/audio-cache.ts` — persona-scoped WAV cache (metadata in `expo-secure-store`, bytes on disk).
- `hooks/use-qvac-prewarm.ts` — loads LLM + TTS + STT in parallel on app start, surfaced via the cold-start progress UI.
- `hooks/use-network-kill.ts` — proves the app still works when Wi-Fi + cellular are disabled; the submission video uses this.
- `hooks/use-speech-recognition.ts` — press-to-record STT for spoken check-ins, wired through `useLocalSTT`.
- `hooks/use-related-signals.ts` — local-embedding semantic similarity over past transmissions (the "related signals" surface in the archive).
- `components/memory-readout.tsx` — dev-overlay chip: *bytes uploaded: 0 · inference: on-device · last model · cache hit*. On during demo recording.

### Local-mode cloud-call enforcement

`isLocalMode()` from `lib/ai.ts` is honoured everywhere a Convex action would otherwise reach a third-party API. Three fire-and-forget actions are guarded inside `components/futureself-home.tsx`:

- `voicemail.native.generateNativeVoicemail` (would call Anthropic + ElevenLabs) — Day-1 welcome trigger skips entirely in local mode.
- `face.generateAvatar` (would call Replicate) — voice-unlock avatar generation no-ops in local mode; the unlock UI still renders.
- `synthesis.generateWeeklySynthesis` (would call Anthropic) — weekly synthesis handler early-returns with an Alert explaining the local-only build isn't shipping the 7-day log.

This means a judge can airplane-mode the device and the entire ritual loop (check-in → LLM → TTS → playback → choice → unlock) runs end to end with zero network traffic. The transmission flow itself never had a cloud leak — the guards close the secondary paths.

QVAC is an officially supported Expo runtime target, so it slots into this workspace without a new native module. Defaults (configurable via `EXPO_PUBLIC_QVAC_DEFAULT_*` env vars):

- LLM: `LLAMA_3_2_1B_INST_Q4_0`
- TTS: `chatterbox` (ONNX via `lib-infer-onnx-tts`)
- STT: `parakeet` (NVIDIA Parakeet)

The primary demo device is an **iPhone**. macOS (Apple Silicon) is the dev/test target.

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
