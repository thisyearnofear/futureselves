# Future Selves Demo Runbook

## Goal
Show three things in under 5 minutes:

1. The ritual is real
2. The product is premium-ready
3. The voices feel emotionally distinct

> **Submission context (QVAC "Unleash Edge AI"):** Use the **QVAC submission variant** below instead of the standard 4-minute live sequence. The standard sequence still works for general demo-day pitches. Full plan: `docs/edge-ai-qvac.md`.

---

## QVAC submission variant (60–90 seconds, on-camera)

Use this when recording or presenting for the QVAC "Unleash Edge AI" submission. The whole thing is screen-record + voiceover; no live staging.

### Pre-recording setup

- Build the app with the QVAC integration (Phase 2 minimum).
- **Primary device: a mid-range Android** (not the latest iPhone). A 2-year-old Android that still runs the local loop is the visual that wins. iPhone is fine for parallel testing but is not the headliner.
- On the device: Settings → toggle on **"Demo mode"** (or set the persona to "Maya / Founder" with 21-day streak so the cast is rich).
- Have a second device or simulator visible in a small picture-in-picture for the cloud-path comparison — *or* use a pre-rendered cloud-path animation.
- Have a Network Kill Switch control ready (an in-app toggle bound to `expo-network`).
- **The memory-readout dev overlay is on by default** during the entire recording. *bytes uploaded: 0 · inference: on-device · last model · cache hit*.
- Pre-warm the QVAC TTS model once before recording so cold-start latency doesn't show.
- **Do not hide the cold start.** If a 25-second warm-up happens at any point in the take, the splash-screen progress UI must be visible. The speaker acknowledges it: *"the first transmission takes ~25 seconds while the model warms up."* Hiding it is worse than showing it.

### Operator flow (record in one take)

| Time | On screen | What to say |
|---|---|---|
| 0:00–0:08 | Title card: *The Future of Private Memories* | "People tell their future self things they would never type into a chatbot." |
| 0:08–0:18 | Onboarding question: "What are you afraid won't happen?" | "Things they're avoiding. Things they haven't said out loud." |
| 0:18–0:30 | Side-by-side diagram: **cloud path** (phone → API → cloud → API → phone) | "Today, every confession leaves the phone. It goes to a third-party LLM to write the reply and a third-party voice lab to speak it." |
| 0:30–0:42 | Side-by-side diagram: **QVAC on-device path** (phone with chip, no arrows leaving) | "We rebuilt it on the QVAC SDK. The narrative model runs on this device. The voice runs on this device." |
| 0:42–0:58 | User submits a one-word check-in (`threshold`). On-device transmission arrives. | "A daily transmission from a future self — generated entirely on the phone." |
| 0:58–1:10 | **Network-kill moment.** Toggle Wi-Fi off, cellular off. Submit another check-in (`repair`). Transmission still arrives. | "And it still works when the network is gone." |
| 1:10–1:20 | Closing card: *Future Selves — Built with QVAC* | "The future of private memories is local." |

### What to emphasize in the edit

- The **moment of the network kill** is the single most important visual. Hold on it for 2–3 seconds after the transmission arrives.
- Use QVAC's pillar language at least once in voiceover: *Sovereign Mind* or *unstoppable intelligence*.
- Show a small dev-overlay chip ("on-device · 0 KB uploaded") during the second transmission.

### What to avoid (hard rules for the QVAC variant)

- **No `The Shadow`. No `the_flatlined`.** The lead cast member is `Future Self` or `Future Best Friend` — full stop. Grim cast members read as a wellness app, not a privacy thesis. (The standard 4-minute live sequence can still use `The Shadow`; this hard rule applies only to the 60–90s QVAC submission video.)
- **No cloud-error visuals in the same take as the network kill.** Judges will read it as a stunt, not a feature.
- **No narration of provider fallback, prompt architecture, or rate limiting.** This is a privacy pitch, not an engineering talk.
- **No "we use Anthropic for the cold start" hybrid framing.** The story is fully local. The submission video shows fully local. No half-measures.
- **No pre-warmed model that disguises the cold start.** If a 25-second warm-up happens at any point in the take, the splash-screen progress UI must be visible.

### The unforgeable network-kill test

The single most important visual in the entire video. It must be on screen for at least 2–3 seconds after the transmission arrives, and it must include **all three** of the following:

1. **OS-level airplane mode engaged.** Not just a software toggle. Airplane mode is the only thing judges will accept.
2. **A visible `fetch('https://example.com')` in the dev console returning `TypeError: Network request failed`.** This is the receipts.
3. **A new transmission arriving after the kill.** This is the proof.

If any one of the three is missing, re-record. The unforgeable version is the version that wins.

### If the kill switch is unavailable on a particular platform

Record the cloud-side data flow with a network inspector (Charles / Proxyman) showing the upload. Then engage airplane mode and record the second transmission. The narrative is the same: *no traffic, voice still arrives.*

---

## Recommended demo sequence

### Demo order
Use this exact order:

1. Future Mentor
2. Future Partner
3. The Shadow

Why this order works:

- `Future Mentor` = trust, clarity, psychological legitimacy
- `Future Partner` = tenderness, intimacy, emotional depth
- `The Shadow` = surprise, range, memorability

If you want a slightly stranger version, swap `The Shadow` for `Alternate Self`.

---

## Pre-demo setup

### Before you get on stage
Make sure:

- you are logged in
- onboarding is already complete
- `DEBUG_MODE` is enabled
- `ELEVENLABS_API_KEY` is present
- you have enough network stability for generation
- audio output is loud and clean

### Best persona setup
For the strongest demo, use a persona with:

- a slightly vulnerable `currentChapter`
- `Love` or `Purpose` as the primary arc
- a believable but emotionally charged miraculous year
- a strong "avoiding" statement

That gives the model more texture to work with.

### Best check-in words
Use emotionally legible one-word inputs. Good options:

- `threshold`
- `honest`
- `repair`
- `becoming`
- `aftermath`
- `brave`

Avoid vague or flat words like:

- `good`
- `fine`
- `normal`

---

## Exact operator flow

### 1. Open with the product frame
What to say:

> “Future Selves is a daily ritual where you hear from a future version of your life. You don’t start with journaling pages — you start with one word, and the system generates a transmission that changes based on who you’re becoming.”

Keep this part under 20 seconds.

### 2. Show the home screen briefly
Point out, quickly:

- the daily signal
- the cast is gathering
- the subtle `+` premium cues
- the archive depth concept lower on the screen

What to say:

> “The core ritual is free and emotionally clean. The product expands through rarer voices and deeper archive continuity, rather than blocking the first payoff.”

Do not linger here too long.

### 3. Stage the first voice: `Future Mentor`
#### Operator actions
- triple-tap `daily signal`
- choose `Stage Demo Voice`
- choose `Future Mentor`
- receive the transmission

#### Best one-word input
Use:
- `threshold`
or
- `purpose`

#### What to say before playback
> “Let’s start with a voice that feels wise, steady, and credible.”

#### What to emphasize after it lands
- the ritual arrival animation
- the tone of the writing
- the calm authority of the voice

#### What to say after playback
> “This is the grounded mode — the voice that helps the ritual feel trustworthy.”

### 4. Stage the second voice: `Future Partner`
#### Operator actions
- triple-tap `daily signal`
- `Stage Demo Voice`
- choose `Future Partner`
- receive again

#### Best one-word input
Use:
- `repair`
or
- `honest`

#### What to say before playback
> “Now the same system can become intimate rather than advisory.”

#### What to emphasize
- emotional warmth
- vulnerability
- that the product can feel relational, not just reflective

#### What to say after playback
> “This is where the app starts to feel less like content and more like a relationship.”

### 5. Stage the third voice: `The Shadow`
#### Operator actions
- triple-tap `daily signal`
- `Stage Demo Voice`
- choose `The Shadow`
- receive again

#### Best one-word input
Use:
- `avoidance` if you want sharpness, or
- `honest` if you want nuance

If you want to stack the deck more, also use the debug option for:
- `Force Shadow Mode`

#### What to say before playback
> “And this is where the system stops being just comforting. It can also confront you.”

#### What to emphasize
- tonal range
- uncanny quality
- that the product is psychologically richer than a wellness app

#### What to say after playback
> “That range is the product moat. It’s not one meditation voice — it’s a cast of futures.”

---

## Best narration script, end to end

### Intro
> “This is a daily ritual for hearing from the person you’re becoming.”

### After first voice
> “So the first layer is trust: it sounds wise, personal, and grounded.”

### After second voice
> “The second layer is intimacy: the same product can feel deeply relational.”

### After third voice
> “And the third layer is confrontation: the system can surface alternate futures and harder truths.”

### Business/product close
> “That’s why the monetization is depth, not interruption — rarer voices, richer sound worlds, and a deeper archive over time.”

---

## Timing guide

### Ideal 4-minute version
- 0:00–0:25 intro + home screen
- 0:25–1:20 `Future Mentor`
- 1:20–2:15 `Future Partner`
- 2:15–3:15 `The Shadow`
- 3:15–4:00 product/business close

### If you only have 2 minutes
Do only:
1. `Future Partner`
2. `The Shadow`

That gives you:
- tenderness
- then surprise

It’s the most dramatic pair.

---

## What to avoid during the demo

### Avoid over-explaining the tech
Do not say too much about:

- prompt architecture
- provider fallback
- TTS settings
- unlock logic

Only talk about tech if asked.

### Avoid too many debug interactions in public
Use debug quickly and confidently.
Don’t let the audience feel like they’re watching setup.

### Avoid flat input words
They make the output feel less magical.

### Avoid showing too many monetization surfaces
Mention premium once, confidently, then move on.

---

## If something goes wrong

### If audio doesn’t render
Say:

> “The written transmission still lands even when audio is unavailable — the ritual never stalls.”

That actually sounds product-mature.

### If generation is slow
Say:

> “You can see the ritualized arrival state here — we designed the moment to feel received, not loaded.”

### If a voice isn’t emotionally strong
Move immediately to the next staged voice.
Don’t defend weak output.

---

## Preferred final demo path
If I were running this live, I’d do:

- `Future Mentor` with `threshold`
- `Future Partner` with `repair`
- `The Shadow` with `honest`

That gives you:
- credibility
- intimacy
- mystery

Which is exactly the emotional arc you want.

---

## Final closing line
End with this:

> “Future Selves isn’t trying to replace journaling or therapy. It creates a daily relationship with possibility — and that relationship gets deeper over time.”
