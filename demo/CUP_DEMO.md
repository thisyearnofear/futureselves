# Tether Developers Cup — Football Path Demo (≤ 3 min)

> **This is the recording script for the Tether Developers Cup submission.**
> It supersedes the `DEMO.md` QVAC flow for the Cup deadline. Every shot is on the Football Path —
> a vertical inside the wider Future Selves app — that proves **all AI runs on-device via QVAC**.

## Theme fit

The Cup's theme is football and the global tournament moment. This script:

- Shows an **AI coaching assistant** (LLM-grounded transmissions from your future self)
- Shows a **football analytics** surface (PAC / REA / CTR / OVR from real drills)
- Shows a **fan engagement** mechanic (one-tap virus loop via `futureself://challenge?drill=…`)

…all on the QVAC Local-AI track. Zero cloud AI.

## Pre-recording checklist (Cup-specific)

- [ ] Demo persona seeded by following [DEMO.md](DEMO.md#pre-crafted-demo-personas) — Maya / Founder prefers for longest visible cast.
- [ ] **The Football Path tile on the bottom nav is the entry point.** Lead with it. Don't re-record onboarding.
- [ ] Android **mid-range** device is primary (per Cup rules). iPhone OK as backup, but Android is the headliner.
- [ ] **Airplane mode is the network-kill proof.** Toggle it visible on screen during shot 2.
- [ ] TTS pre-warmed at least once. Cold-start at shot 1 is fine if linear-flavored.
- [ ] **Eng QVAC env vars** match `README.md` Submission Build section.
- [ ] Supertonic3 / Chatterbox voice at low-ish volume so VO is clear above it.
- [ ] A football in frame is required for the juggling shot.
- [ ] Have the **audit log overlay** (`EXPO_PUBLIC_AUDIT_LOG=1`) ready — show 1 s of JSON at the end. Judges love metrics.

## Shot-by-shot (record in order, ~180 s total)

| # | Time | On screen | Voiceover |
|---|---:|---|---|
| 1 | 0:00–0:08 | Title card: **Football Path — Built on QVAC**. Cut to Football tile on the bottom nav. Tap. | *"This is the Football Path. Real physical drills. AI coaching. All on-device."* |
| 2 | 0:08–0:12 | **Swipe down notification shade → Airplane mode ON.** Overlay caption: `airplane mode · 0 cloud calls`. | *"Fully offline. Airplane mode. Nothing leaves this phone."* |
| 3 | 0:12–0:35 | Football Path loads → **Speak your dream.** Tap "Hold to speak." Say: *"I want to be a starting striker in the Premier League."* QVAC Parakeet transcribes → tap "Understand my dream" → preview card shows: `Striker / competitive / "Starting striker at the top level in three years."` → tap "Begin the path." | *"QVAC Parakeet transcribes on-device. QVAC Llama 3.2 extracts the path. Zero API calls."* |
| 4 | 0:35–1:00 | Football home shows. Tap Sprint card → start → 10 m sprint → stop. **5.12 s.** Comparison chip: **"0.92 s off Haaland (pro: 4.20 s)."** Save. | *"First drill. Real sprint. Pure timer, no AI, no cloud."* |
| 5 | 1:00–1:25 | Back on home → tap Juggling. **Cutaway: phone in your pocket, kick a real football 6 times.** Return to phone. Count: 6 juggles. Save. | *"Accelerometer peak detection. The same algorithm counts YOLO juggle videos — except the input is real sensor data."* |
| 6 | 1:25–1:40 | Tap Reaction time. 5 rounds → final avg ~280 ms. Save. Match Day dots all fill. | *"Five rounds, stats averaged. Reaction is the closest thing to pure instinct in the game."* |
| 7 | 1:40–2:00 | Home → tap **Receive transmission**. Breathing orb → transmission lands. Title: *"The gap to Haaland is 0.92 seconds."* Show the **coach persona** chip — `The Tactician` — visible at the top of the player card. | *"Coach persona selected at declaration: The Tactician. Today it's a prompt — tomorrow it's a downloadable LoRA on the same QVAC runtime."* |
| 8 | 2:00–2:20 | Tap Play on the audio player. QVAC voice speaks (read-aloud in your video): *"5.12 seconds for 10 meters. Haaland does it in 3.8. You want to be a striker? Stop talking and run intervals — not once, not today. Six times this week. Same hill. Same conditions. Then we'll talk."* | *"QVAC on-device TTS. Same model that speaks the daily personal ritual speaks the football ritual — fully offline, zero bytes uploaded."* |
| 9 | 2:20–2:45 | Player card appears. **OVR 64 · GOLD tier**. **Bottom strip** shows: `TRAINED BY · THE TACTICIAN` and `0 BYTES UPLOADED`. Tap card → ViewShot captures → share sheet opens with `futureself://challenge?drill=sprint&target=5.12`. | *"FIFA Ultimate Team-style card. Built natively. Instantly shareable. Deep-linked challenge to a friend."* |
| 10 | 2:45–2:55 | Pull 1 s of audit-log JSONL on screen: `{"event":"llm.completion","model":"llama-3.2-1b","durationMs":1840,"ttftMs":312,"bytesUploaded":0,…}`. | *"You can audit every model call. TTFT, tokens, bytes uploaded. Zero."* |
| 11 | 2:55–3:00 | Closing card: **Football Path — QVAC SDK · 0 bytes uploaded · 100 % on-device**. | — |

## Post-recording

1. Upload to YouTube as **unlisted**. Title: `Football Path — Tether Developers Cup Submission`.
2. Add the link to your DoraHacks submission **before** 23:59 GMT-7 on the Cup first cut day.
3. Mention: every replay uses the same phone, the same persona, the same network kill. Judges will replicate.

## What to avoid

- **Do not lead with the personal/diary app.** Theme is soccer. The wellness framing reads as "Tether logo on an unrelated app" — see the rules: *"a Tether logo on an unrelated app does not count."*
- **Do not fake the network kill.** Airplane-mode toggle visible on screen is unforgeable. Use it.
- **Do not time-lapse the cold start.** If models load, show it. The progress UI is part of the demo.
- **Do not autoplay the TTS.** Tap-to-Play keeps pacing, so the demo voiceover stays in control.
- **Do not promise LoRA swap-in yet.** Frame it: *"Today a prompt; tomorrow a hot-swappable local adapter — the SDK is building toward it."*

## Cross-promotion

The wider Future Selves app includes a daily-transmission ritual for personal memories (see [DEMO.md](DEMO.md#qvac-submission-flow-60–90s-single-take) for the QVAC-Unleash-Edge-AI script). For the Cup, lead with the Football Path — it directly answers the theme.

## Files reviewed in this script

- `apps/default/components/football-ambition-declaration.tsx` (speak-your-dream, Parakeet STT, ambition extraction, coach persona picker)
- `apps/default/components/football-home.tsx` (match day progress, transmission player, player card mount)
- `apps/default/components/football-audio-player.tsx` (QVAC TTS player + cache)
- `apps/default/components/drill-sprint.tsx`, `drill-juggling.tsx`, `drill-reaction-time.tsx` (3 measurement drills)
- `apps/default/components/player-card.tsx` (FIFA-style shareable card + QVAC on-device chip strip)
- `apps/default/app/challenge.tsx` (`futureself://challenge?drill=…` virus loop)
- `apps/default/lib/football-llm.ts` (on-device LLM for ambition extraction + transmission + trajectory interpretation, coach persona conditioning)
- `apps/default/lib/audit-log.ts` + `docs/audit-log.md` (telemetry artifact visible in shot 10)

## Reading order if you want to check a fact

1. `AGENTS.md` — overall Football Path architecture.
2. `docs/edge-ai-qvac.md §3.5` — the on-device rule and submission posture.
3. `docs/remote-apis.md` — every remote API the project can touch, what counts as "cloud AI".
4. `README.md §Submission Build` — Android APK / preview profile env.
