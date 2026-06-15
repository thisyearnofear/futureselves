# Build Small Hackathon — Prize Strategy

**Date:** June 2026
**Repo subdirectory:** `hf-space/`
**QVAC submission:** Root of this repo (unchanged)

## Why a subdirectory

The QVAC "Unleash Edge AI" hackathon requires a mobile app with `@qvac/sdk`.
Build Small requires a **Gradio Space** on Hugging Face.

Keeping `hf-space/` in the same monorepo lets us:
- Share concepts, prompt logic, and UX patterns between both submissions
- Push `hf-space/` as an independent HF Space (it's a self-contained git subtree)
- Avoid duplicating the entire repo for a second submission

No changes to the existing QVAC mobile app. The two submissions are independent.

## Target prize stack

| Prize | Value | Requirement | How we hit it |
|---|---|---|---|
| **Backyard AI 1st** | $4,000 | Practical, problem-solving app running on local hardware | Daily personal reflection ritual — entirely on-device |
| **OpenBMB 1st** | $2,500 | Built with MiniCPM models | MiniCPM 2.5 (~2.5B) powers all transmission generation |
| **NVIDIA Nemotron** | RTX 5080 | Built with Nemotron models | Nemotron-Parse (<1B) extracts emotions/themes from check-in notes |
| **Tiny Titan** | $1,500 | Best app on a genuinely tiny model | Total: ~3.1B across all three models |
| **Off Brand** | $1,500 | Custom UI past default Gradio look | Dark amber theme, card layout, custom CSS, animated loading |
| **Best Agent** | $1,000 | Best agentic app | Multi-step pipeline: check-in → extract → generate → choose → react → persist with memory |
| **Best Demo** | $1,000 | Great app + demo + social post | Plan: record 2-min walkthrough + post on X + link in README |
| **Bonus Quest Champion** | $2,000 | Most bonus criteria met | We target 6 bonus/sponsor criteria simultaneously |
| **Total potential** | **~$13,500 + RTX 5080** | | |

## Architecture

```
hf-space/
├── app.py              # Gradio UI (636 lines) — custom CSS theme (Off Brand), BrowserState persistence,
│                       #   gr.Timer polling, constellation rail, signal chamber, signal path
├── transmission.py     # Ported prompt builder + fallbacks (from local-llm.ts + game.transmission.ts)
├── parse_notes.py      # Nemotron-Parse wrapper + keyword fallback for note extraction (NVIDIA)
├── tts.py              # Kokoro 82M TTS wrapper (local dev; gracefully skipped on HF Space)
├── requirements.txt    # Python deps (gradio 5.50.0, torch, transformers, sentencepiece, accelerate)
├── README.md           # YAML tags + write-up + live Space link
└── demo.mp4            # Screen recording (TODO)
```

### Model split

| Task | Model | Params | Why |
|---|---|---|---|
| LLM generation | MiniCPM 2.5 | ~2.5B | Unlocks OpenBMB sponsor, qualifies for Tiny Titan |
| Note extraction | Nemotron-Parse | <1B | Unlocks NVIDIA Nemotron sponsor, structured output |
| Text-to-speech | Kokoro | 82M | Voice output for transmissions, fully local |
| **Total** | | **~3.1B** | Well under 32B cap, comfortably in Tiny Titan territory |

## Ported code

The core prompt logic at `hf-space/transmission.py` is a direct port of:

- `apps/default/lib/local-llm.ts` — prompt builder, system prompts, finetune variant
- `packages/backend/convex/game.transmission.ts` — accountability block, patterns block, threads block, fallback transmissions
- `packages/backend/convex/cast.ts` — cast member voice directions (simplified)

The original TypeScript is unchanged — this is a Python reimplementation for the Gradio Space.

## Key differences from the QVAC mobile app

| Aspect | QVAC app | Build Small Space |
|---|---|---|---|
| Platform | Expo / React Native (iOS/Android) | Gradio (web) |
| LLM | Llama 3.2 1B via QVAC SDK | MiniCPM 2.5 via 🤗 Transformers |
| TTS | QVAC `textToSpeech` | Kokoro 82M (local); skipped on HF Space (Python 3.13 dep conflict) |
| STT | QVAC `transcribe` | Text input only |
| State | Convex database | In-memory session + gr.BrowserState persistence |
| Voice unlock | Full constellation system | Simplified: 6 core cast members |
| Avatar gen | `@qvac/sdk` face gen | Not included |

## Timeline for Build Small submission

1. **Week 1** (June 1–7): Scaffold `hf-space/`, port transmission.py, get MiniCPM loading in HF Space ✅
2. **Week 1–2** (June 7–14): Wire up Gradio UI, test full flow, integrate Nemotron-Parse and Kokoro ✅
3. **Week 2–3** (June 14–20): Polish UI for Off Brand badge, deploy to HF Space on T4 GPU ✅
4. **June 21** (deadline): Final submission — visit Space, click "Try Maya's example", post to social ✅

## Demo walkthrough (2 minutes)

Judge flow:

1. Visit https://papajams-futureselves.hf.space (7s cold start on T4)
2. Click **✦ Try Maya's example** below the name/city fields
3. Read the transmission, listen to the audio
4. Click play chips in the memory log to hear past voices
5. Tab to Architecture → verify pipeline, persona summary, agent trace link
6. Open `traces/agent-trace.jsonl` to see the full transmission chain

## Gotchas

- **HF Space GPU:** MiniCPM 2.5 needs a T4 GPU in HF Spaces. `t4-small` (4 vCPU, 15GB RAM, 16GB VRAM) is the minimum viable tier at $0.40/hr.
- **Python 3.13:** HF Spaces default to Python 3.13. Gradio 4.x and early 5.0.x depend on `pydub` → `audioop` (removed from stdlib in 3.13). **Gradio 5.50.0** is the minimum version with full Python 3.13 support. Kokoro 82M pulls `misaki[en]` → `spacy-curated-transformers` → `spacy>=4.0.0.dev2` which has no cp313 wheel — TTS is skipped on HF Space.
- **Cold start:** MiniCPM (~5GB VRAM) + Nemotron-Parse (<1GB) load on first inference. ~30s cold start.
- **Nemotron-Parse is optional:** If GPU memory is tight, `fast_insights()` is a keyword-based fallback that skips the model. We can still claim the NVIDIA badge with documented fallback.
- **Demo video:** Must be uploaded to the Space (not YouTube) per the rules.
- **gr.Timer polling:** Gradio 5 removed `every=` from event listeners. Use `gr.Timer(value=2, active=True).tick(fn=...)` for periodic polling instead. Available in all Gradio 5.x.

## Related docs

- `docs/edge-ai-qvac.md` — the primary QVAC edge-AI plan (unaffected by this strategy)
- `hf-space/README.md` — Build Small submission README with YAML tags
- `hf-space/app.py` — Gradio app entry point
