---
title: FutureSelves
emoji: ✨
colorFrom: yellow
colorTo: gray
sdk: gradio
sdk_version: 5.50.0
app_file: app.py
pinned: false
tags:
  - backyard-ai
  - openbmb
  - nvidia-nemotron
  - tiny-titan
  - best-agent
  - off-brand
  - best-demo
  - bonus-quest-champion
---

# ✦ FutureSelves

**A daily ritual where your future self sends you transmissions.**

A private future-radio, not a dashboard. Check in with one word, receive a voice transmission from across time, make a tiny choice that reshapes who gets to speak tomorrow. The whole ritual lives inside a single signal chamber — no card-grid, no SaaS, no scroll.

All inference runs on-device via three small models — no cloud dependencies, no API bills, no data uploaded.

## How it works

1. **Onboarding** — Tell the system about your current life chapter: what you're avoiding, what you're afraid won't happen, what's draining you, and what would make a miraculous year.
2. **Daily check-in** — One word + optional note for today. A structured insight extractor (Nemotron-Parse) reads your note for emotional signals.
3. **Transmission** — Your assigned future self (MiniCPM 2.5B, prompted with your full context) generates a personalized narrative message with a specific action prompt and cliffhanger.
4. **Your move** — Choose: toward, steady, release, or repair. Each choice shifts your timeline and builds toward unlocking new cast members.
5. **Reaction** — Tell your future self how it landed. The next transmission remembers.

## Models

| Model | Params | Role | Sponsor |
|---|---|---|---|
| MiniCPM 2.5 (openbmb) | ~2.5B | Transmission generation (primary LLM) | OpenBMB |
| Nemotron-Parse (NVIDIA) | <1B | Structured note extraction (emotions, themes, entities) | NVIDIA Nemotron |
| Kokoro | 82M | Text-to-speech (fully local) | — |

Each model is well under 32B params. Total: ~3.1B across all three models — qualifies for **Tiny Titan**.

## Prizes targeted

| Prize | Why we qualify |
|---|---|
| **Backyard AI (track)** | Practical daily-life app for personal reflection and emotional accountability |
| **OpenAI Codex Track** | Built and maintained with OpenAI Codex as the coding agent; source repo includes Codex-attributed commits |
| **OpenBMB** | Built with MiniCPM 2.5 as the primary generation model |
| **NVIDIA Nemotron** | Nemotron-Parse for structured insight extraction from user notes |
| **Tiny Titan** | ~3.1B total across all models — genuinely tiny |
| **Best Agent** | Multi-step agentic pipeline: check-in → extract → generate → choice → reaction → persist |
| **Off Brand** | Custom transmission-console interface (Fraunces + IBM Plex Mono), atmospheric signal styling with layered gradients, animated tuning-state waves, voice-orb constellation rail, and a horizontal signal-path progress bar — no card-grid dashboard |
| **Best Demo** | Full demo video + social post (links below) |
| **Bonus Quest Champion** | Targeting 6+ bonus/sponsor criteria simultaneously |

## Tech

- **UI:** Gradio 5 with a custom transmission-console skin (Fraunces serif for the chamber voice, IBM Plex Mono for instrument labels), atmospheric gradients and scanlines, a horizontal voice-orb constellation rail, and a signal-path progress bar in place of step pills
- **LLM:** MiniCPM 2.5 via 🤗 Transformers with torch.compile + SDPA attention
- **Extraction:** Nemotron-Parse (NVIDIA) with keyword fallback when GPU is constrained
- **TTS:** Kokoro 82M — generates WAV output for each transmission
- **State:** In-memory session state (per-user via Gradio Sessions)

## Running locally

```bash
pip install -r requirements.txt
python app.py
```

## Links

- [Demo video]() <!-- TODO: upload after recording -->
- [Social post]() <!-- TODO: post and link -->
- [Source (monorepo)](https://github.com/thisyearnofear/futureselves)
