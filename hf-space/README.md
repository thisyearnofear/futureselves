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
  - bonus-quest-champion
---

# ✦ FutureSelves

**A daily ritual where your future self sends you transmissions.**

A private future-radio, not a dashboard. Check in with one word, receive a voice transmission from across time, make a tiny choice that reshapes who gets to speak tomorrow. The whole ritual lives inside a single signal chamber — no card-grid, no SaaS, no scroll.

All inference runs on-device via three small models — no cloud dependencies, no API bills, no data uploaded.

## How it works

1. **Onboarding** — Tell the system about your current life chapter: what you're avoiding, what you're afraid won't happen, what's draining you, and what would make a miraculous year. *Or skip straight to the demo with **✦ Try Maya's example** — a fully-populated 4-day history from Maya, a 28-year-old founder, with audio for each transmission.*
2. **Daily check-in** — One word + optional note for today. A structured insight extractor (Nemotron-Parse) reads your note for emotional signals.
3. **Transmission** — Your assigned future self (MiniCPM 2.5B, prompted with your full context) generates a personalized narrative message with a specific action prompt and cliffhanger. The transmission is **spoken aloud** via local TTS (Kokoro / Piper).
4. **Your move** — Choose: toward, steady, release, or repair. Each choice shifts your timeline and builds toward unlocking new cast members.
5. **Reaction** — Tell your future self how it landed. The next transmission remembers.

## Models

| Model | Params | Role | Sponsor |
|---|---|---|---|
| MiniCPM 2.5 (openbmb) | ~2.5B | Transmission generation (primary LLM) | OpenBMB |
| Nemotron-Parse (NVIDIA) | <1B | Structured note extraction (emotions, themes, entities) | NVIDIA Nemotron |
| Piper / Kokoro | 15–82M | Text-to-speech (pre-rendered samples + local synthesis) | — |

Each model is well under 32B params. Total: ~3.1B across all three models — qualifies for **Tiny Titan**.

## Prizes targeted (honest list)

| Prize | Why we qualify |
|---|---|
| **Backyard AI (track)** | Practical daily-life app for personal reflection and emotional accountability. The demo persona (Maya) is a real-archetype user with 4 days of history, demonstrating depth. |
| **OpenBMB MiniCPM Build** | MiniCPM 2.5 is the **primary** generation model — not a side experiment. Every transmission in the live demo runs through it. |
| **NVIDIA Nemotron** | Nemotron-Parse extracts structured insights from check-in notes (sentiment, emotions, themes). Falls back to keyword extraction when GPU memory is tight — documented and graceful. |
| **Tiny Titan** | ~3.1B total across all models — deep under the 4B cap. |
| **Best Agent** | Multi-step agentic pipeline: check-in → note extraction → prompt assembly → generation → choice → reaction → memory persistence. Open trace at [`traces/agent-trace.jsonl`](traces/agent-trace.jsonl). |
| **Off Brand** | Custom transmission-console interface (Fraunces + IBM Plex Mono), atmospheric gradients and scanlines, animated tuning-state waves, voice-orb constellation rail, horizontal signal-path progress bar — a private future-radio, not a card-grid dashboard. |
| **Best Use of Modal** | Persona summarizer runs as a Modal serverless GPU function ([`traces/modal_app.py`](traces/modal_app.py)). Generates a 1-paragraph narrative summary from a persona's full history. Eligible for the $20k Modal credits pool. |
| **Bonus Quest Champion** | Six bonus criteria: 🔌 Off the Grid (no cloud APIs), 🎨 Off-Brand (custom UI), 📡 Sharing is Caring (open agent trace), 📓 Field Notes (blog post), + Nemotron sponsor + Modal sponsor. |

> **Note on badges we don't claim:** We do not claim 🎯 Well-Tuned (we use base MiniCPM 2.5, not a fine-tuned variant) or 🦙 Llama Champion (we use 🤗 Transformers, not llama.cpp). We also do not claim OpenAI Codex as a sponsor — the code was written by humans with AI assistance, not by Codex.

## Tech

- **UI:** Gradio 5.50.0 with a custom transmission-console skin (Fraunces serif for the chamber voice, IBM Plex Mono for instrument labels), atmospheric gradients and scanlines, a horizontal voice-orb constellation rail, and a signal-path progress bar in place of step pills
- **LLM:** MiniCPM 2.5 via 🤗 Transformers with SDPA attention, running on a T4 GPU in HF Spaces
- **Extraction:** Nemotron-Parse (NVIDIA) with keyword fallback when GPU is constrained
- **TTS:** Piper 15–60M voices (pre-rendered samples in `audio/voices/`, served as static assets) + Kokoro 82M for live synthesis when available
- **State:** In-memory session state with `gr.BrowserState` persistence across page refreshes
- **Demo persona:** Maya, a 28-year-old founder with 4 days of pre-written transmission history. Pre-rendered audio for each. Click **✦ Try Maya's example** on the first screen to skip onboarding.
- **Agent trace:** Every transmission logs the full chain (system prompt, user prompt, raw LLM output, parsed JSON, note insights, duration) to `traces/agent-trace.jsonl` for the **Sharing is Caring** bonus quest. See [`traces/agent-trace.jsonl`](traces/agent-trace.jsonl).
- **Modal integration:** Persona summarizer runs on Modal's serverless T4 GPU. Function source in [`traces/modal_app.py`](traces/modal_app.py), summaries in [`traces/persona-summaries.json`](traces/persona-summaries.json).

## Running locally

```bash
pip install -r requirements.txt
python app.py
```

## Links

- **[Live Space](https://papajams-futureselves.hf.space)** — deployed on T4 GPU
- [Source (monorepo)](https://github.com/udingethe/futureselves/tree/main/hf-space)
- [Demo walkthrough](FIELD_NOTES.md#the-artifact-end-to-end) — step-by-step guide for judges
- [Agent trace](traces/agent-trace.jsonl) — open record of every transmission
- [Field Notes blog post](FIELD_NOTES.md) — what we built and what we learned
- [Agent trace](traces/agent-trace.jsonl) — open record of every transmission
- [Modal app](traces/modal_app.py) — serverless persona summarizer
