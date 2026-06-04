# Future Selves → QVAC Edge-AI Plan

**Status:** Draft v1 — alignment document (pre-implementation)
**Target hackathon:** [DoraHacks — *QVAC: Unleash Edge AI*](https://dorahacks.io/hackathon/qvac-unleach-edge-ai-i/detail)
**Author role:** Foundation planning (no code changes yet)

---

## 0. Why this doc exists

This is the single source of truth for the team's pivot onto QVAC's local-AI SDK. Every other doc (`README.md`, `AGENTS.md`, app/backend READMEs, `docs/pitch-speaker-notes.md`, `docs/demo-runbook.md`, `demo/DEMO.md`) cross-links back here so we don't drift in five directions.

It is **not** a code spec. Code-level specs will be PRs against this doc.

---

## 1. The pitch (one line)

> **Future Selves is a daily voice ritual where users confess their deepest choices to a "future self." Today, every confession round-trips through ElevenLabs and a third-party LLM. We rebuilt it on the QVAC SDK so the entire transmission — narrative generation, voice synthesis, and now STT — runs locally on the device, proving that the most intimate AI experience you can build is the one whose data never leaves your hardware.**

Positioning tag: **"The Future of Private Memories."**

---

## 2. Why the fit is unusually strong

Most "edge AI" submissions justify privacy as a feature. For Future Selves, privacy *is* the product:

- Onboarding ingests `afraidWontHappen`, `avoiding`, `draining`, `miraculousYear` — things a normal user would never put into ChatGPT.
- "The Last Voicemail" is a critique-driven cinematic voicemail that pulls the entire ritual history into one prompt. It is the worst-case shape of data to ship to a third party.
- The voice unlock system (`cast.ts`, `voicemail.milestones.ts`) treats *personalization gradient* as a feature — which is also a privacy property.

QVAC's own pillars — **Sovereign Mind**, **Physics-First** (latency), **Unstoppable AI**, **Infinite Scale at the edge** — read like a Future Selves brief.

---

## 3. What QVAC actually gives us (verified)

From the [QVAC site](https://qvac.tether.io) and the [tetherto/qvac repo](https://github.com/tetherto/qvac):

| Capability | Local implementation | Maps to Future Selves |
|---|---|---|
| LLM completion | `qvac-fabric-llm.cpp` (LLAMA 3.2 1B/3B Q4) | Replaces cloud LLM in `convex/ai.ts` |
| **TTS** | `lib-infer-onnx-tts` (Chatterbox + Supertonic via ONNX) | Replaces ElevenLabs in `convex/game.transmission.ts` and `convex/voicemail.native.ts` |
| **STT** | `lib-infer-parakeet` (NVIDIA Parakeet) + Whisper | Powers voice check-ins + spoken "situation" for Last Voicemail |
| Translation | Bergamot / NMT | Stretch goal for multilingual transmissions |
| Embeddings / RAG | Built-in | Optional: local retrieval over personal archive |
| LoRA fine-tuning | On mobile | A future self becomes a *fine-tuned* cast member |
| OpenAI-compatible HTTP | Yes | **Zero-code-change** swap of the existing `OpenAICompatibleProvider` chain |
| Runtime targets | Linux, macOS, Windows, Android, iOS, **Node.js, Bare, Expo** | The app is already Expo SDK 55 |

## 3.5. Strategic decisions (locked in, June 2026)

These are not defaults — they are the *only* shape the submission takes. If a future PR contradicts any of these, this section needs to be updated first.

1. **The submission path is fully local.** No hybrid. No "we use Anthropic for the cold-start." A judge should be able to put the device in airplane mode and watch the full ritual loop work, end to end, including a new transmission. The LLM, the TTS, and the STT all run on-device. The cloud LLM and ElevenLabs are removed from the demo video.

2. **The public site (`futureselves.vercel.app`) is a demo surface, not a product.** It uses a single hard-coded sample persona, never asks for an `afraidWontHappen`-class field, shows pre-generated sample transmissions, and the only CTA is *"install the real app."* The privacy story gets *stronger* because the marketing site is honest about what it is. See `docs/privacy-posture.md` for the public-facing copy and `docs/edge-ai-qvac.md` §12 below for the public surface rules.

3. **The QVAC integration is open-sourced as a reusable Expo wrapper.** `lib/qvac.ts` ships with named hooks (`useQVACModel`, `useLocalTTS`, `useLocalSTT`) and a single test seam. The QVAC judging panel is Tether's team; a clean, documented integration is the single best evidence of "Best Use of QVAC SDK."

4. **The lead cast member in the 90-second video is `Future Self` or `Future Best Friend`** — never `The Shadow` or `the_flatlined`. The video's job is to do the emotional work via *voice*, not text. Grim cast members read as a wellness app, not a privacy thesis.

5. **The primary demo device is a mid-range Android.** Not the latest iPhone. A 2-year-old Android that still runs the local loop is the visual that wins the edge-AI track. iPhone support ships in parallel but is not the headliner.

6. **Time-to-first-transmission is a first-class metric.** A 25-second cold start is fine *if* it is announced and shown with a progress bar. It is fatal if hidden. The splash-screen progress UI is built on day one and is on during the demo recording — not a pre-warmed model that disguises the cost.

7. **The network-kill test is unforgeable.** The demo video shows OS-level airplane mode engaged, plus a visible `fetch('https://example.com')` returning `TypeError: Network request failed` in the dev console, *plus* a transmission arriving after the kill. All three are on screen at the same time.

8. **A "memory readout" dev overlay is in scope.** Small chip in the corner: *bytes uploaded: 0 · inference: on-device · last model: chatterbox · cache hit: yes*. Cheap to build, single best visual for a privacy pitch.

---

## 4. Concrete switch points in the codebase

| File | Today | After QVAC |
|---|---|---|
| `packages/backend/convex/game.transmission.ts` | `POST https://api.elevenlabs.io/v1/text-to-speech/...` + Convex `storeAudio` | `loadModel(...)` + local TTS → `expo-secure-store` / filesystem |
| `packages/backend/convex/voicemail.native.ts` | ElevenLabs TTS at the end of the critique loop | Local TTS inside the loop |
| `packages/backend/convex/ai.ts` | `OpenAICompatibleProvider` → Anthropic / Featherless / Venice | Either (a) `loadModel(LLAMA_3_2_1B_INST_Q4_0)` or (b) point the existing provider at a local QVAC OpenAI-compatible HTTP server (zero code change) |
| `packages/backend/convex/rateLimit.ts` | Token bucket per provider | Becomes memory/CPU budget, not API rate |
| `.env.example` | `ANTHROPIC_API_KEY`, `ELEVENLABS_API_KEY` | Becomes optional; the *default* path no longer needs them |
| `apps/default/app/` (client) | Pure consumer of Convex blobs | Optionally pre-warms `@qvac/sdk` model load on app start (uses `expo-splash-screen` progress) |
| `apps/default/lib/` | None | New `lib/qvac.ts` — model load lifecycle, on-device cache keys |
| `apps/default/hooks/` | None | New `hooks/use-network-kill.ts` — proves offline works |

### Soft-de-risk path (ships in a day, no client changes)

Run a local QVAC HTTP server on dev hardware, point the existing `OpenAICompatibleProvider` at it instead of Featherless/Venice. The cloud LLM and TTS disappear from the *submission* video with zero code change. In-app native hooks come on top of that.

---

## 5. Three parallel tracks for the submission

### Track A — "Private Memories" (the headline 90‑second video)
Opens on the onboarding question *"What are you afraid won't happen?"* and ends on a fully synthesized on-device transmission. Side-by-side overlay: **cloud path vs. QVAC on-device path.** A network-kill toggle at the OS level proves no bytes left the phone. Wins the **Best Local AI App** / privacy track.

### Track B — "Last Voicemail, Local Edition" (technical credibility)
Take the existing critique-driven voicemail pipeline in `voicemail.native.ts`, port the LLM and TTS steps to QVAC SDK calls, and add a local Whisper/Parakeet STT pass so the user can *speak* their situation. The entire Last Voicemail loop runs on-device. A "memory readout" panel shows what stayed on device. Wins **Best Use of QVAC SDK**.

### Track C — "Agent as a Future Self" (Agentathon / narrative agent)
Encode a cast member unlocked only after a divergence threshold, whose persona is generated by a small on-device LoRA-fine-tuned variant of the base LLM (QVAC supports LoRA on mobile). The agent doesn't pay you, but it *vouches* for you. Reuses the existing cast/voice unlock system — no schema changes. Wins the **Agentathon** track.

All three tracks share a single backend integration (one PR each, layering up).

---

## 6. Risks and how to pre-empt them

| Risk | Mitigation |
|---|---|
| LLM too large for low-end devices | Use LLAMA 3.2 1B Q4 (~0.7 GB) for the demo; document a 3B path for Pro devices. Source of truth: QVAC registry model list. |
| First-run latency (10–30 s cold start) | Pre-warm on app launch with `expo-splash-screen` progress UI; document a "first transmission takes longer" toast. |
| Chatterbox/Supertonic TTS quality vs. ElevenLabs | Position the swap as *"good-enough voices that are yours forever, even offline"* — not as a quality upgrade. Cast this as a feature. |
| Convex de-risk for the video | The OpenAI-compatible HTTP server is the "looks like a swap, ships in a day" path. Don't gate the video on the in-app native hooks. |
| Hackathon judging vocabulary | Use QVAC's own pillars explicitly: Sovereign Mind, Physics-First, Unstoppable AI, Infinite Scale. |
| Optional: Web build (Expo for Web) | QVAC's Bare runtime and JS SDK target Node.js; verify Web `expo export` bundle can no-op gracefully when QVAC native modules are absent. |

---

## 7. Implementation phases

These phases assume Tracks A + B as the core submission. Track C is a stretch layered on top.

### Phase 0 — Alignment (this document)
- ✅ Canonical plan doc
- ✅ Cross-links from `README.md`, `AGENTS.md`, app/backend READMEs
- ✅ Demo runbook + pitch notes updated
- ⏳ Team review

### Phase 1 — Soft swap (internal/dev only — NOT the public submission path)
- Local QVAC HTTP server on dev hardware
- Point existing `OpenAICompatibleProvider` at it; remove `ANTHROPIC_API_KEY` from the required env
- ElevenLabs remains for now
- **Scope:** This is an internal milestone for engineering velocity. It is **not** the submission path. Per §3.5, the public submission is fully local. The soft-swap exists so the team can demo the LLM step without waiting for the in-app `@qvac/sdk` work to land.

### Phase 2 — On-device TTS
- ✅ `@qvac/sdk` installed in `apps/default`
- ✅ `lib/qvac.ts` written (useQVACModel, useLocalTTS, useLocalSTT)
- ✅ Wire loadModel/unloadModel in useQVACModel (real SDK calls via dynamic import)
- ✅ Wire textToSpeech in useLocalTTS (PCM→WAV conversion, 24kHz mono)
- ⏳ Replace ElevenLabs call in `game.transmission.ts` and `voicemail.native.ts` with a client-side TTS call
- ⏳ Pre-warm model on app start; cache first-cast voices
- **Deliverable:** End-to-end on-device transmission on iOS and Android, with a "voice pre-loading" UX

### Phase 3 — On-device LLM (full offline)
- Wire `ai.ts` to `loadModel(LLAMA_3_2_1B_INST_Q4_0)` for transmissions
- Keep Convex as a thin optional sync layer (cross-device) or remove entirely
- **Deliverable:** Network-kill demo: app still works with Wi-Fi and cellular disabled

### Phase 4 — STT (Track B)
- Add Parakeet/Whisper STT for spoken check-ins and spoken "situation" on Last Voicemail
- **Deliverable:** Spoken situation → local voicemail, fully offline

### Phase 5 — Track C (stretch, Agentathon)
- LoRA fine-tune a small variant on-device for a threshold-unlocked cast member
- New cast slot in `cast.ts` + milestone gate in `voicemail.milestones.ts`
- **Deliverable:** "Agent as a future self" cast member unlock flow

### Phase 6 — Submission polish
- 90-second video for Track A
- Architecture diagram (cloud path vs. QVAC on-device path)
- README + repo banner with the QVAC badge
- Cost comparison: cloud per-transmission vs. zero marginal cost on device

---

## 8. Environment variables after the pivot

```bash
# Still optional, but no longer the default path
ANTHROPIC_API_KEY=
ELEVENLABS_API_KEY=

# Local AI defaults — set in .env or app config
EXPO_PUBLIC_QVAC_DEFAULT_LLM=LLAMA_3_2_1B_INST_Q4_0
EXPO_PUBLIC_QVAC_DEFAULT_TTS=chatterbox
EXPO_PUBLIC_QVAC_DEFAULT_STT=parakeet

# Optional: local QVAC HTTP server (dev / fallback path)
QVAC_HTTP_URL=http://localhost:11434/v1
```

`ANTHROPIC_API_KEY` and `ELEVENLABS_API_KEY` remain in the env for emergency fallback, but the **default submission path uses neither.**

---

## 9. What we are *not* doing in this submission

- Not shipping a crypto wallet. QVAC's "Machine Economy" is a future stretch, not a day-one requirement.
- Not deprecating Convex entirely. It stays as an optional cross-device sync layer.
- Not changing the visual layer (avatars, constellation, transmission player) beyond what is required for the network-kill and offline-state UI.
- Not rewriting the AI provider chain. We add a local path, not a replacement.

---

## 10. Open questions for team review

1. Do we keep the soft-swap HTTP server as a permanent fallback, or only for the submission video?
2. For the demo video, do we use iOS or Android as the primary device? (QVAC Fabric is GPU-agnostic via Vulkan; both should work.)
3. Should the `expo-secure-store` persona context also store the *encryption key* for the on-device model cache, so a stolen phone is a stolen brick?
4. Do we want to ship a "Network Kill Switch" toggle in the UI as a permanent privacy feature, or only as a demo affordance?
5. For Track C (Agentathon), is the cast member "Future You, post-agent-economy" or something more specific?

---

## 11. Cross-references

- Pitch framing: `docs/pitch-speaker-notes.md` (QVAC opener + 90s video script)
- Stage execution: `docs/demo-runbook.md` (QVAC submission variant, network-kill moment)
- Recording plan: `demo/DEMO.md` (60–90s QVAC submission flow)
- Top-level overview: `README.md` (strategic direction callout, tech stack update)
- AI tooling context: `AGENTS.md` (QVAC SDK notes, local-fallback ordering)
- Public-facing privacy statement: `docs/privacy-posture.md`
- Client work tracking: `apps/default/README.md`
- Backend work tracking: `packages/backend/README.md`

---

## 12. Public surface rules (`futureselves.vercel.app`)

The web build is a *demo surface*, not a product. These rules keep the public version honest and prevent the privacy story from being undercut by the marketing site.

### Hard rules

1. **No real onboarding.** The web build uses a single hard-coded sample persona. There is no form asking for `afraidWontHappen`, `avoiding`, `draining`, `miraculousYear`, or any other field whose privacy stakes matter.
2. **No real check-ins.** The web build does not accept user input that goes anywhere. The "transmission" the user sees is pre-generated sample content.
3. **No real account creation.** The web build does not have a sign-up flow. If a user wants the real product, the only CTA is *"Install on iOS / Android."*
4. **The site footer must say, in plain language:** *"This demo runs sample data only. The product you install runs entirely on your device."*
5. **A small "Network: live / Network: local" indicator is on every page.** The web build is `live` (this is the demo); the installed app is `local`. The indicator physically cannot be wrong because they are different builds with different runtime paths.
6. **The architecture diagram from `docs/privacy-posture.md` is on the marketing site.** The cloud path vs. on-device path is a viral asset; ship it.

### Soft rules (recommended)

- Include a 30-second clip of the QVAC submission video on the homepage, autoplay-off, captioned.
- Link to `docs/privacy-posture.md` (hosted as a public page) from the site footer.
- The marketing site should not host a `?try=true` deep link to the on-device app. Discovery is via App Store / Play Store only.

### What we are *not* doing

- We are not adding a "try the real thing in your browser" flow.
- We are not adding an `afraidWontHappen` field anywhere in the cloud build.
- We are not adding any copy that implies the cloud version is the *real* Future Selves.

### Why

The product is "your future self knows your deepest choices, and only you have access." A cloud version that ships onboarding data to a third party answers a different question. The web build is honest about being a preview, the app store builds are honest about being the product, and the privacy story is the same end-to-end.

---

*This document is a living spec. Update as implementation progresses.*
