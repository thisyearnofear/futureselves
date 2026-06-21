# Building in Public: Future Selves × QVAC

**A hackathon pivot journal — from cloud AI to fully on-device inference.**

*This document tracks the journey of taking an app that once shipped your deepest choices to third-party APIs and rebuilding it so **zero bytes leave your phone**. Written for the QVAC "Unleash Edge AI" hackathon.*

---

## Why we did this

Future Selves is a daily voice ritual where users confess their deepest choices to a "future self." The onboarding asks things like:

> *What are you afraid won't happen?*
> *What are you avoiding?*
> *What is draining you?*

These are not questions you should type into ChatGPT. Yet in the original architecture, every single transmission round-tripped through Anthropic Claude (for the narrative) and ElevenLabs (for the voice). The product *was* the worst-case privacy shape for the data it handled.

**The pivot onto QVAC made the privacy thesis literal.** Now the entire ritual — narrative generation, voice synthesis, and speech recognition — runs on-device via the QVAC SDK. The cloud API keys are gone from the submission build. A judge can put the phone in airplane mode and watch it work.

---

## What we built (in 3 weeks)

### Phase 0: Map the switch points

We audited every file that touched a cloud AI provider:

| File | Before | After |
|---|---|---|
| `packages/backend/convex/ai.ts` | Anthropic / Featherless / Venice fallback chain | Optional fallback; local path bypasses entirely |
| `packages/backend/convex/game.transmission.ts` | `synthesizeTransmissionAudio` → ElevenLabs API | Text ready; TTS runs on client |
| `packages/backend/convex/voicemail.ts` | ElevenLabs TTS via Melius MCP | Marked as cloud-only stretch (Melius stays) |
| `apps/default/lib/qvac.ts` | — | `useQVACModel`, `useLocalTTS`, `useLocalSTT`, `useQVACChat` |
| `apps/default/lib/ai.ts` | `getAIProvider()` → "cloud" only | `"cloud"` / `"local"` / `"stub"` with platform guards |
| `.env.example` | `ANTHROPIC_API_KEY` required | `EXPO_PUBLIC_AI_PROVIDER=local` |

### Phase 1: Hooks layer (`lib/qvac.ts`)

The SDK-facing layer. Four React hooks, each platform-guarded with a lazy `import("@qvac/sdk")` so the web bundle never touches native code:

```typescript
const { load, unload } = useQVACModel();
const { speak, isReady } = useLocalTTS(modelId);
const { transcribeFromUri } = useLocalSTT(sttModelId);
const { complete } = useQVACChat(llmModelId);
```

Each hook follows the same pattern: dynamic import → call SDK → return typed result. No SDK types leak into the app.

### Phase 2: Client-side LLM orchestrator (`lib/local-llm.ts`)

The cloud pipeline built a transmission prompt on the Convex server, sent it to Anthropic, and stored the result. We duplicated the prompt builder on the client side:

```
buildLocalPrompt(context, castMember)
  → builds the same 50-line prompt that game.transmission.ts builds
  → calls QVAC completion({ modelId, history: [...], stream: false })
  → parses JSON → returns { title, text, actionPrompt, cliffhanger }
  → on parse failure, falls back to a built-in script generator
```

The fallback script is the same `fallbackTransmission()` the cloud path uses — so the local path is never worse than the cloud path.


### Phase 3: Network-kill proof (the unforgeable demo)

Per §3.5 of our plan:

> *The network-kill test is unforgeable. The demo video shows OS-level airplane mode engaged, plus a visible `fetch()` returning `TypeError: Network request failed` in the dev console, plus a transmission arriving after the kill.*

We built:

- **`hooks/use-network-kill.ts`** — polls `expo-network`, exposes `isOffline` and a dev `toggleKillSwitch()`
- **`components/memory-readout.tsx`** — privacy chip showing `bytes uploaded: 0 · inference: on-device`
- The LLM, TTS, and STT all load their models from the QVAC registry at app start, so no network is needed at inference time

### Phase 4: Model pre-warming (`hooks/use-qvac-prewarm.ts`)

Cold-start latency was our biggest UX risk. A 25-second download is fine *if it is shown* — fatal if hidden. Three models load in parallel from the QVAC registry:

```typescript
function QVACPrewarmer() {
  const { llm, tts, stt, isReady } = useQVACPrewarm({ personaId });
  return null;
}
```

Model IDs are persisted in `expo-secure-store` so subsequent launches skip the download if the cache is intact.

### Phase 5: Audio cache (`lib/audio-cache.ts`)

Persona-scoped WAV cache. Metadata in `expo-secure-store`, bytes on disk. The `LocalTTSAudioPlayer` checks the cache first, synthesises fresh audio only on miss, and writes back.

### Phase 6: On-device STT (`hooks/use-speech-recognition.ts`)

Spoken check-ins. Combines `expo-audio`'s recorder with QVAC's `transcribe`:

```
User taps mic → record audio (WAV via expo-audio)
User taps stop → transcribe({ audioChunk: { type: "filePath", value: uri } })
Returns transcribed text → first word fills the check-in input
```

---

## The hardest parts

1. **Web vs. native in a monorepo.** Every hook is platform-guarded with `Platform.OS === "web"` returning a no-op. The `@qvac/sdk` import is `import type` at the top level and dynamic `import()` at runtime. The web bundle stays clean.

2. **Duplicating the prompt.** The cloud prompt in `game.transmission.ts` is a 190-line file tuned over months of iteration. The local-llm.ts prompt builder is a 1:1 port — if the cloud prompt changes, the local one must too.

3. **Cold-start UX.** We surfaced model load progress via `QVACModelState` (idle → loading → ready → error) from the prewarm hook. The splash screen transitions only when all three models are ready.

4. **File system API changes.** Expo SDK 55 ships a new `expo-file-system` API. The legacy import (`expo-file-system/legacy`) was the only way to keep `writeAsStringAsync` working without a rewrite of the entire audio cache.

---

## The architecture (one diagram)

```
On-Device Path                Cloud (deprecated)
┌─────────────────────┐       ┌──────────────────┐
│ Native Client       │       │ Web Client       │
│  ├→ Convex (auth)   │       │  └→ Convex Action│
│  └→ QVAC SDK        │       │       └→ Anthropic│
│      ├→ LLM (1B)    │       │       └→ ElevenLabs│
│      ├→ TTS         │       └──────────────────┘
│      └→ STT         │
│  └→ Audio Cache     │
└─────────────────────┘
```

### Phase 7: Late-stage hardening

Things you only catch after the integration is "done":

- **Freeze + setState-in-render bug.** `app/_layout.tsx` was calling the parent `setPrewarmState` during render via `QVACPrewarmUpdater`. Object literal → fresh reference every tick → infinite re-render loop → page froze + React emitted "Cannot update a component while rendering a different component." Moved the publish into a `useEffect` keyed on primitive status strings.
- **Three cloud-call leaks in local mode.** The transmission flow was clean, but three fire-and-forget Convex actions in `futureself-home.tsx` still hit cloud APIs regardless of provider:
  - `voicemail.native.generateNativeVoicemail` → Anthropic + ElevenLabs (Day-1 welcome)
  - `face.generateAvatar` → Replicate (voice-unlock avatars)
  - `synthesis.generateWeeklySynthesis` → Anthropic (weekly synthesis)

  Each is now gated by `isLocalMode()`. The "zero bytes leave the device" thesis now holds end-to-end through a full ritual loop including unlocks and weekly synthesis.
- **UX pass.** Day-1 stats/constellation/divergence are now visible from the first transmission (gate lowered from `>= 5` to `>= 1`). The native local-mode check-in card leads with a large pulsing mic button instead of a text input. Arrival sequence is ~5s instead of ~12s. Play button pulses a gold halo until first tap.
- **Web landing perf.** Killed an `expo-linear-gradient` web-thrash + a rAF + setState typewriter storm that was freezing the marketing page on Vercel.

## What's next

- **Track C:** LoRA fine-tune a cast member variant on-device.
- **The Last Voicemail port:** Melius MCP → QVAC local inference (the current free-tier path is gated off in local mode rather than ported).
- **Video demo:** 90-second cut showing the full offline loop.
- **Installable submission build:** EAS Android APK on the `submission` profile so judges can run the airplane-mode test themselves.

## Links

- **Plan:** `docs/edge-ai-qvac.md`
- **Privacy statement:** `docs/privacy-posture.md`
- **Public demo:** [futureselves.vercel.app](https://futureselves.vercel.app)
- **QVAC SDK:** [github.com/tetherto/qvac](https://github.com/tetherto/qvac)
