# Future Selves Pitch Speaker Notes

> **Submission context (QVAC "Unleash Edge AI"):** Use the **QVAC opener** below when pitching to that audience. The original "Opening" still works for general demo-day pitches. Full plan: `docs/edge-ai-qvac.md`.

## Strategic guardrails (locked in, June 2026)

These rules apply to **every** QVAC pitch, demo, or video. If a future PR contradicts any of these, this section needs to be updated first.

1. **The story is fully local.** No "we use Anthropic for the cold start." No hybrid framing. The pitch claims that the LLM, the TTS, and the STT all run on the device, and the demo has to prove it.
2. **The lead cast member in any video or live demo is `Future Self` or `Future Best Friend`.** Never `The Shadow`. Never `the_flatlined`. The voice does the emotional work; grim cast members read as a wellness app, not a privacy thesis.
3. **The network-kill test is unforgeable.** If pitching live, the demo must show OS-level airplane mode engaged, plus a visible `fetch('https://example.com')` returning `TypeError: Network request failed` in the dev console, *plus* a transmission arriving after the kill. All three on screen at the same time.
4. **The memory-readout chip is on by default during any QVAC demo.** Small overlay: *bytes uploaded: 0 · inference: on-device · last model · cache hit*.
5. **Time-to-first-transmission is acknowledged, not hidden.** A 25-second cold start is fine *if* the speaker says "the first transmission takes ~25 seconds while the model warms up" and the splash-screen progress is visible.
6. **Use QVAC's pillar language at least once.** "Sovereign Mind" or "unstoppable intelligence" lands with the judging panel.
7. **Do not narrate provider fallback, prompt architecture, or rate limiting.** That's engineering trivia; this is a privacy pitch.
8. **The public site is a demo surface.** If asked "can I try it in my browser?", the answer is: "You can feel the interface, but the real product runs on your device. Here's the install link."

---

## QVAC opener (for the "Unleash Edge AI" submission)

> Every day, people confess their deepest choices to Future Selves — what they’re afraid won’t happen, what they keep avoiding, who they’re becoming.  
> Until recently, every one of those confessions was leaving their phone. It went to a third-party LLM to write the reply, and a third-party voice lab to speak it.  
> We rebuilt the entire loop on the QVAC SDK. The narrative model runs on-device. The voice runs on-device. Even the speech-to-text runs on-device.  
> That means the most intimate AI experience you can build is the one whose data never leaves your hardware.  
> The future of private memories is local. This is it.

## 90-second submission video (Track A — "Private Memories")

| Time | Visual | Voiceover |
|---|---|---|
| 0:00–0:08 | Title card: *The Future of Private Memories* | "People tell their future self things they would never type into a chatbot." |
| 0:08–0:18 | Onboarding question: "What are you afraid won't happen?" | "Things they're avoiding. Things they haven't said out loud." |
| 0:18–0:32 | Side-by-side: **Cloud path** (icons: phone → API → cloud → API → phone) | "Today, that goes to a third-party LLM and a third-party voice lab." |
| 0:32–0:46 | Side-by-side: **QVAC on-device path** (icons: phone with chip, no arrows leaving) | "We rebuilt it on the QVAC SDK. The model runs on this device. The voice runs on this device." |
| 0:46–1:02 | User submits a check-in word. Transmission generates on-device. | "A daily transmission from a future self — generated entirely on the phone." |
| 1:02–1:18 | Network-kill toggle flips. Wi-Fi + cellular off. New transmission still arrives. | "And it still works when the network is gone." |
| 1:18–1:30 | Closing card: *Future Selves — Built with QVAC* | "The future of private memories is local." |

Use QVAC's pillar language at least once: *Sovereign Mind* or *unstoppable intelligence*.

---

## Opening
> Future Selves is a daily ritual for hearing from the person you’re becoming.  
> Instead of starting with a blank journal page, you start with one word.  
> That word shapes a transmission from a future voice — and your response changes what comes next.

## While showing the home screen
> The core loop is simple: check in, receive a voice transmission, make one small choice.  
> Underneath that, the product is tracking consequence, divergence, and narrative continuity over time.

## Brief premium framing
> We also wanted the product to feel commercially mature without interrupting the ritual.  
> So the core emotional payoff stays free, and the premium layer is about depth: rarer voices, richer sound worlds, and deeper archive continuity.

---

## Demo voice 1 — Future Mentor

### Before staging it
> First I’ll show the grounded version of the product.

### While selecting / receiving
> I’m giving it a single word — `threshold` — and locking the next transmission to Future Mentor.

### When the ritual animation plays
> Even the arrival moment is designed to feel received, not merely loaded.

### Before playback
> This is the voice of guidance — wise, calm, and slightly ahead of you.

### After playback
> So this is the trust layer.  
> The product feels personal, but also stable and psychologically credible.

---

## Demo voice 2 — Future Partner

### Transition line
> Now I’ll show the same system in a more intimate register.

### While selecting / receiving
> This time the word is `repair`, and I’m staging Future Partner.

### Before playback
> Same product, same ritual structure — but emotionally, this should feel much closer.

### After playback
> This is where the app stops feeling like content and starts feeling relational.  
> It’s not just reflecting you — it’s speaking to you from inside a future bond.

---

## Demo voice 3 — The Shadow

### Transition line
> And now I’ll show the part that makes this more than a comfort product.

### While selecting / receiving
> I’m using the word `honest`, and I’m forcing The Shadow.

### Before playback
> The Shadow is not punitive.  
> It’s the voice of the future you’re avoiding — compassionate, but harder to ignore.

### After playback
> That range is the moat.  
> This isn’t one meditation narrator.  
> It’s a cast of futures with different emotional jobs.

---

## Product/business close
> That’s why the premium strategy is depth, not interruption.  
> We don’t want to block the first payoff.  
> We want the relationship to deepen over time through rarer voices, expanded sound worlds, and a richer archive of memory.

---

## Final close
> Future Selves isn’t trying to replace therapy or journaling.  
> It creates a daily relationship with possibility — and that relationship gets deeper over time.

---

## Short emergency version
If you need a compressed version on stage:

> Future Selves is a daily ritual where one word becomes a transmission from a future voice.  
> The system tracks consequence and continuity over time, so it feels serial instead of disposable.  
> The core ritual stays free, and the premium layer is about depth — rarer voices, sound worlds, and archive memory.  
> What makes it special is range: it can sound wise, intimate, or confronting, depending on which future is speaking.

---

## Stage reminders

### Best live sequence
Say these words and use these voices:

- `threshold` → `Future Mentor`
- `repair` → `Future Partner`
- `honest` → `The Shadow`

### Pacing
- speak slowly before playback
- stop talking while the audio plays
- after playback, interpret the emotional role in one sentence only

### Do not do
- don’t over-explain the debug flow
- don’t narrate technical implementation unless asked
- don’t apologize for latency
- don’t ramble after a strong voice lands

### If audio fails
Say:
> The written transmission still lands, so the ritual never stalls.
