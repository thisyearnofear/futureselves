# Field Notes — FutureSelves for Build Small

**Hackathon:** [Gradio + Hugging Face Build Small](https://huggingface.co/build-small-hackathon), June 2026
**Submission:** [papajams-futureselves](https://papajams-futureselves.hf.space) · [source](https://github.com/udingethe/futureselves/tree/main/hf-space)
**Author:** [@udingethe](https://github.com/udingethe)

## What we built

A daily ritual where your future self sends you a voice transmission. One word, one transmission, one choice, one memory. Every signal is generated locally by three small models — no cloud, no API bill, no upload.

```
┌──────────────────────────────────────────────┐
│  nemotron-parse    · <1B   · note extraction │
│  minicpm-2.5       · 2.5B  · transmission    │
│  piper / kokoro    · 15–82M · voice synthesis │
│                                              │
│  total: ~3.1B params. well under the 32B cap.│
└──────────────────────────────────────────────┘
```

The Space is a single-page Gradio app with a custom theme — Fraunces serif for the chamber voice, IBM Plex Mono for instrument labels, an amber/violet palette on near-black, animated tuning-state waves, a horizontal constellation rail of voice orbs, and a signal-path progress bar in place of step pills. It does not look like a Gradio app. That was the goal.

## What worked

**The 32B cap is generous, and the 3.1B we used is plenty.** MiniCPM 2.5 produced transmissions that were emotionally legible on the first try. The voice wasn't always elegant — sometimes the model drifted into generic motivational tone — but the structural output (title, text, action prompt, cliffhanger) was reliable enough to build the rest of the product on. We didn't need a 7B or 13B model. The constraint pushed us toward sharpness.

**The prompt is the product.** All three models combined are ~3.1B params, but the prompt is 1100+ characters of carefully assembled persona context. The agent's emotional precision comes from what's in the prompt, not from the model size. The accountability block (yesterday's choice → yesterday's reaction → yesterday's reply) makes each transmission feel like a continuation of a real conversation, not a fresh horoscope.

**The custom theme did the heavy lifting for Off Brand.** The default Gradio look is fine for utilities. For a *product*, the chrome has to go. Hiding the footer, killing the borders, retiming the typography, adding the constellation rail and signal path — that took 600 lines of CSS but did more for the submission than any model choice.

**Pre-rendered audio saved the demo.** Kokoro 82M, the TTS we initially wired, doesn't run on HF Spaces (Python 3.13 removed `audioop` and the spacy dep chain has no `cp313` wheel). Rather than ship without a voice, we pre-rendered five transmission audio clips with Piper (15MB ONNX voices, 30–38s each) and committed them to `audio/voices/`. HF Spaces serves them at the root URL, and the Space falls back to them when Kokoro is unavailable. The demo never goes silent.

## What didn't

**Cold start is a real cost.** MiniCPM 2.5 takes ~30 seconds to load on the T4 the first time. If a judge clicks the Space and waits 30 seconds for a thinking spinner, they're gone. We addressed this with a **"Try Maya's example"** button on the first screen — one click loads a fully-populated demo persona with 4 days of pre-written transmissions, audio for each, and a transmission waiting for today. The judge sees the product's depth in 5 seconds, not 5 minutes.

**HF Spaces don't auto-warm.** The first request after the Space sleeps hits a cold start. We had to choose: optimize for the demo flow (which the judge will see first) or for live use (which the judge will see second). We chose the demo flow. The cost is a longer wait on the first live generation.

**The agentic claim is structurally true but the trace is partial.** The pipeline is genuinely multi-step: check-in → note extraction (Nemotron-Parse) → prompt assembly → LLM generation → JSON parse → choice recording → reaction logging → memory persistence. But the trace we ship in `traces/agent-trace.jsonl` is the demo precomputed, not the live live. To bridge that, we log the full chain (system prompt, user prompt, raw output, parsed JSON, note insights, duration) for every live generation going forward. The trace file grows with use.

**Custom Gradio CSS is fragile.** We had to use `!important` on nearly every selector to override the Gradio base theme. The `tab-nav` and `form` elements in particular re-style themselves on every Gradio release. Pinning to `gradio==5.50.0` is mandatory — a minor version bump would likely break the theme.

## What I learned

**Small models are a forcing function for product thinking.** When you can't fall back on a 70B model's general capability, you have to design prompts that get the most out of the model you have. We spent more time on the prompt builder than on the model loading code. That's the right ratio.

**The bonus badges reward infrastructure, not heroics.** Off the Grid (no cloud APIs), Off-Brand (custom UI), Sharing is Caring (open trace), Field Notes (blog post) — these are all "show your work" badges. They reward the things that make a hackathon submission *inspectable*, not just impressive. We collected six of them by writing the trace file, the Modal function, this blog post, and the custom CSS. None of those took more than an hour.

**Modal is a real prize tier, not a footnote.** The $20k Modal credits pool is bigger than the Tiny Titan + Off Brand + Best Demo combined. A simple persona summarizer (one Modal function, one T4 GPU) was enough to claim it credibly. The function runs in `traces/modal_app.py` and the summaries ship in `traces/persona-summaries.json`. The integration is real, load-bearing, and inspectable.

**The "Try Maya's example" button is the single most important UI element in the submission.** Judges have 30 seconds. They will not do the 5-step onboarding. They will click the button that says "example." That button is the difference between "I evaluated this product" and "I evaluated this build."

## The honest gap

We are not claiming **🎯 Well-Tuned** or **🦙 Llama Champion**. We use base MiniCPM 2.5 (not a fine-tuned variant) and 🤗 Transformers (not llama.cpp). The README says so explicitly. We would rather miss those badges than claim them falsely.

We are also not claiming **OpenAI Codex Track** despite the build being developed with AI assistance — the commits are human-attributed, and we won't pretend otherwise.

The badges we do claim have artifacts in the repo: the custom UI is in `app.py`, the agent trace is in `traces/agent-trace.jsonl`, the Modal function is in `traces/modal_app.py`, this blog post is `FIELD_NOTES.md`, and the modal eligibility note is in the README. Inspectable, not performative.

## The artifact, end to end

If you want to evaluate the build fairly, here is the order that makes the most sense:

1. Land on the [Live Space](https://papajams-futureselves.hf.space).
2. Click **✦ Try Maya's example** on the first screen.
3. Read Maya's transmission. Click play on the audio.
4. Scroll to the memory log. Click the play chips beside the past 4 transmissions.
5. Click the **Architecture** tab. Read the pipeline. Read Maya's persona summary. Read the links to the agent trace and the Modal function.
6. Open [`traces/agent-trace.jsonl`](traces/agent-trace.jsonl). Read the prompt chain.
7. Open [`traces/modal_app.py`](traces/modal_app.py). Read the Modal function.

The product is 2 minutes. The trace is 10 minutes. The full source is in this repo.

---

*Built June 15, 2026, between sunrise and submission. Final commit: 21:48 UTC.*
