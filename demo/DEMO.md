# FutureSelf Demo Script (30–60s)

> **Submission context (QVAC "Unleash Edge AI"):** Use the **QVAC submission flow** at the bottom of this doc instead of the standard 30–60s flow when recording for that hackathon. Full plan: `docs/edge-ai-qvac.md`.

## QVAC submission flow (60–90s, single take)

This is the script for the QVAC "Unleash Edge AI" submission video. It is the single source of truth for whoever is filming.

### Pre-recording checklist

- [ ] App is built with the QVAC integration (Phase 2 or later, per `docs/edge-ai-qvac.md`).
- [ ] **Primary device is a mid-range Android** (not the latest iPhone).
- [ ] Demo persona seeded (Maya / Founder, 21-day streak, full cast lit).
- [ ] Lead cast member is **`Future Self`** or **`Future Best Friend`** — never `The Shadow`, never `the_flatlined`. Hard rule.
- [ ] Network Kill Switch is wired and tested (`hooks/use-network-kill.ts`).
- [ ] **The network-kill test is unforgeable:** OS-level airplane mode + visible `fetch('https://example.com')` failure in the dev console + a transmission arriving after the kill. All three on screen.
- [ ] **Memory-readout dev overlay is on by default** during the entire recording. *bytes uploaded: 0 · inference: on-device · last model · cache hit.*
- [ ] Splash-screen progress UI is wired and visible if a cold start happens. Do not hide a 25-second warm-up.
- [ ] TTS model pre-warmed once on the demo device.
- [ ] Cloud-path reference (network inspector screenshot, or second-device overlay) ready.
- [ ] Audio output levels checked.
- [ ] **QVAC environment variables set:** `EXPO_PUBLIC_QVAC_DEFAULT_LLM=LLAMA_3_2_1B_INST_Q4_0`, `EXPO_PUBLIC_QVAC_DEFAULT_TTS=chatterbox`. Optional: `EXPO_PUBLIC_QVAC_DEFAULT_STT=parakeet`.
- [ ] `ANTHROPIC_API_KEY` and `ELEVENLABS_API_KEY` either removed from `.env` or clearly noted as "emergency fallback only" in the voiceover.

### Shot list (record in order)

| # | Duration | On screen | Voiceover |
|---|---|---|---|
| 1 | 8s | Title card: **The Future of Private Memories** | "People tell their future self things they would never type into a chatbot." |
| 2 | 10s | Onboarding question: "What are you afraid won't happen?" | "Things they're avoiding. Things they haven't said out loud." |
| 3 | 12s | Side-by-side diagram: **cloud path** (phone → API → cloud → API → phone) | "Today, every confession leaves the phone. It goes to a third-party LLM to write the reply and a third-party voice lab to speak it." |
| 4 | 12s | Side-by-side diagram: **QVAC on-device path** (phone with chip, no arrows leaving) | "We rebuilt it on the QVAC SDK. The narrative model runs on this device. The voice runs on this device." |
| 5 | 16s | User submits `threshold` as a check-in. On-device transmission arrives. | "A daily transmission from a future self — generated entirely on the phone." |
| 6 | 12s | **Network-kill moment.** Toggle Wi-Fi off, cellular off. Submit `repair` as a second check-in. Transmission still arrives. Hold on this beat for 2–3 seconds. | "And it still works when the network is gone." |
| 7 | 10s | Closing card: **Future Selves — Built with QVAC** | "The future of private memories is local." |

### Cutaways and overlays

- During shot 6, show a small dev-overlay chip ("on-device · 0 KB uploaded") in the corner.
- Voiceover must include QVAC pillar language at least once: *Sovereign Mind* or *unstoppable intelligence*.

### Avoid (hard rules for the QVAC submission flow)

- **`The Shadow` and `the_flatlined` are banned from the QVAC submission video.** Lead with `Future Self` or `Future Best Friend`. Grim cast members read as a wellness app, not a privacy thesis.
- Cloud-error visuals (will read as a stunt).
- Any narration of provider fallback, prompt architecture, or rate limiting.
- Any framing that hints at a hybrid cloud path. The story is fully local.
- A pre-warmed model that disguises the cold start. The splash-screen progress UI is part of the demo, not polish.

### If something breaks

- **TTS stutters on a take:** restart the device, wait 30s for the model to settle, re-record. Do not try to edit around it.
- **Network-kill doesn't take:** use airplane mode as a backup. Same narrative.
- **Cast member's voice feels weak:** swap to a different seed persona and re-record shot 5 only. Keep shots 1–4 and 6–7.

### Pre-crafted QVAC personas (subset of the standard list)

Use one of these for the most legible on-device experience. Both have rich `avoiding` / `afraidWontHappen` text — judges can see the privacy stakes on screen.

- **Maya / Founder / 21-day streak / Arc: Money** — strongest for a QVAC pitch because the cast is fully lit (Future Self, Future Best Friend, Future Employee).
- **Alex / Rebuilder / 1-day streak / Arc: Purpose** — best if you want to show the *first-time* experience and prove the first transmission itself is local.

---

## Flow
1. **Title Screen** – Dark background, "FutureSelf" logo, tagline: "Your future is listening."
2. **Onboarding (skip via pre-seeded demo persona)** – Show name "Alex", city "Portland", chapter "Rebuilding after a layoff", pull "Purpose", miracle "I lead a team building tools people love."
3. **Check-in** – Enter word: "publish", note: "Finally hit send on the newsletter."
4. **Transmission** – Tap play, audio plays (Future Self, Ember voice): "Alex, I remember when you hit publish. That first newsletter became the first brick. I'm proud of us."
5. **Choice** – Tap "toward" (move toward the goal).
6. **Constellation** – Show Future Self lit, Future Best Friend dim with "6 more days" progress.
7. **Hook** – Text overlay: "Tomorrow remembers. Your future is listening."

## Pre-crafted Demo Personas
### 1. The Rebuilder (Alex)
- Name: Alex
- City: Portland
- Chapter: Rebuilding after a layoff
- Arc: Purpose
- Miracle: I lead a team building tools people love
- Avoiding: Starting the newsletter I've drafted 3 times
- Afraid won't happen: A creative life where I don't have to hustle
- Streak: 1 day
- Unlocked voices: Future Self (lit)

### 2. The Founder (Maya)
- Name: Maya
- City: Austin
- Chapter: Circling a big risk for my startup
- Arc: Money
- Miracle: We hit $1M ARR and I still sleep at night
- Avoiding: Asking for the enterprise partnership
- Afraid won't happen: Building something that makes me proud and free
- Streak: 21 days
- Unlocked voices: Future Self (lit), Future Best Friend (lit), Future Employee (lit)

### 3. The Seeker (Jordan)
- Name: Jordan
- City: Chicago
- Chapter: Trying to become braver in public
- Arc: Love
- Miracle: The relationship I want feels honest, mutual, safe
- Avoiding: Admitting I want a family
- Afraid won't happen: Being chosen without having to perform for it
- Streak: 7 days
- Unlocked voices: Future Self (lit), Future Best Friend (lit), Future Partner (dim)

## Recording Tips
- Use the seeded "Founder (Maya)" persona for longest progression visibility.
- Ensure ElevenLabs keys are set for audio playback.
- Hold the play button for 2 seconds before tapping to capture the enlarged button.
- End with the constellation view showing multiple lit voices for impact.
