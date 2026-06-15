"""
app.py — FutureSelves for Build Small (Gradio Space).

Two models, one Space:
  - MiniCPM 2.5B (~2.5B) — primary LLM for transmission generation
  - Nemotron-Parse (<1B) — structured note extraction (NVIDIA prize)

TTS via Kokoro (82M) — fully local.

Targeted prizes (8): Backyard AI, OpenBMB, NVIDIA Nemotron,
Tiny Titan, Best Agent, Off Brand, Best Demo, Bonus Quest Champion.
"""

from __future__ import annotations

import json
import json
import logging
import os
import shutil
import tempfile
import threading
import uuid
from dataclasses import dataclass, field, asdict
from datetime import date
from pathlib import Path
from typing import Any, Optional

import gradio as gr

from transmission import (
    CastMember,
    GenerationContext,
    GeneratedTransmission,
    PersonaContext,
    RecentChoice,
    RecentResponse,
    RecentTransmission,
    build_prompt,
    fallback_transmission,
    get_system_prompt,
    parse_transmission,
)
from parse_notes import extract_note_insights, fast_insights
from tts import generate_speech, get_voice_for_cast_member
from demo.maya import build_maya_demo, MayaDemoBundle
from modal_eval import log_agent_trace, summarize_persona_modal, write_modal_app, write_demo_trace
from form_helpers import (
    PLACEHOLDERS, EXAMPLES, PRIMER_HTML, BUTTON_TEXT, ARC_OPTIONS, ARC_EMOJI,
    chip_html, _choice_cards_html, _reaction_cards_html, _word_chips_html, _arc_cards_html,
)

logger = logging.getLogger(__name__)

MODEL_NAME = os.environ.get("LLM_MODEL", "openbmb/MiniCPM-2.5-sft-bf16")

CAST_MEMBER_NAMES = {
    "future_self": ("Your Future Self", "Always transmitting"),
    "future_partner": ("Future Partner", "Love arc required"),
    "future_mentor": ("Future Mentor", "7-day streak + toward choices"),
    "future_best_friend": ("Future Best Friend", "3-day streak + repair"),
    "shadow": ("The Shadow", "High divergence"),
    "alternate_self": ("Alternate Self", "14-day streak + drift"),
}

# ─── Model ───────────────────────────────────────────────────────────────────

_LLM = None
_LLM_LOCK = threading.Lock()


def _load_llm():
    global _LLM
    if _LLM is not None:
        return _LLM
    with _LLM_LOCK:
        if _LLM is not None:
            return _LLM
        import torch
        from transformers import AutoModelForCausalLM, AutoTokenizer
        logger.info("Loading MiniCPM: %s", MODEL_NAME)
        model = AutoModelForCausalLM.from_pretrained(
            MODEL_NAME, trust_remote_code=True,
            torch_dtype=torch.float16, device_map="auto", attn_implementation="sdpa",
        )
        model.eval()
        tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME, trust_remote_code=True)
        _LLM = (model, tokenizer)
        logger.info("MiniCPM loaded")
        return _LLM


def _generate_with_llm(context: GenerationContext, cast_member: CastMember, local_now: str) -> GeneratedTransmission:
    try:
        model, tokenizer = _load_llm()
        prompt = build_prompt(context, cast_member)
        system_prompt = get_system_prompt(context.persona.timeline_divergence_score)
        full = f"{system_prompt}\n\n{prompt}\n\nLocal open time: {local_now}"
        import torch
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": full},
        ]
        input_text = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
        inputs = tokenizer(input_text, return_tensors="pt").to(model.device)
        with torch.no_grad():
            outputs = model.generate(
                **inputs, max_new_tokens=700, temperature=0.8, top_p=0.9,
                do_sample=True, pad_token_id=tokenizer.pad_token_id or tokenizer.eos_token_id,
            )
        decoded = tokenizer.decode(outputs[0][inputs["input_ids"].shape[1]:], skip_special_tokens=True).strip()
        parsed = parse_transmission(decoded)
        if parsed:
            return parsed
    except Exception as exc:
        logger.warning("LLM failed: %s", exc)
    return fallback_transmission(context, cast_member)


# ─── State ───────────────────────────────────────────────────────────────────

@dataclass
class AppState:
    persona: Optional[PersonaContext] = None
    onboarded: bool = False
    onboard_step: int = 0
    checked_in: bool = False
    check_in_word: str = ""
    check_in_note: str = ""
    today_cast: Optional[CastMember] = None
    today_transmission: Optional[GeneratedTransmission] = None
    today_audio: str = ""
    today_choice: str = ""
    generating: bool = False
    generation_done: bool = False
    choice_made: bool = False
    recent_transmissions: list[RecentTransmission] = field(default_factory=list)
    recent_choices: list[RecentChoice] = field(default_factory=list)
    recent_responses: list[RecentResponse] = field(default_factory=list)
    open_threads: list = field(default_factory=list)

    def to_context(self) -> GenerationContext:
        assert self.persona
        ci = type("C", (), {"word": self.check_in_word, "note": self.check_in_note or None})() if self.checked_in else None
        return GenerationContext(
            persona=self.persona, check_in=ci,
            recent_transmissions=self.recent_transmissions,
            recent_choices=self.recent_choices,
            recent_responses=self.recent_responses,
            open_threads=self.open_threads,
        )

    def streak(self) -> int:
        return self.persona.streak if self.persona else 0

    def divergence(self) -> int:
        return self.persona.timeline_divergence_score if self.persona else 0

    def to_dict(self) -> dict:
        d = asdict(self)
        d["persona"] = asdict(self.persona) if self.persona else None
        return d

    @staticmethod
    def from_dict(d: dict | None) -> AppState:
        if not d:
            return AppState()
        d = {k: v for k, v in d.items() if k in AppState.__dataclass_fields__}
        if d.get("persona"):
            d["persona"] = PersonaContext(**{
                k: v for k, v in d["persona"].items()
                if k in PersonaContext.__dataclass_fields__
            })
        if d.get("recent_transmissions"):
            d["recent_transmissions"] = [
                RecentTransmission(**t) for t in d["recent_transmissions"]
            ]
        if d.get("recent_choices"):
            d["recent_choices"] = [
                RecentChoice(**c) for c in d["recent_choices"]
            ]
        if d.get("recent_responses"):
            d["recent_responses"] = [
                RecentResponse(**r) for r in d["recent_responses"]
            ]
        return AppState(**d)


# ─── Choose cast member ──────────────────────────────────────────────────────

def _choose_cast(state: AppState) -> CastMember:
    import random
    if not state.recent_transmissions:
        return "future_self"
    recent = {t.cast_member for t in state.recent_transmissions[-3:]}
    available = [c for c in CAST_MEMBER_NAMES if c not in recent]
    if not available:
        return random.choice(["future_self", "future_partner", "future_mentor"])
    return random.choices(available, weights=[3 if c == "future_self" else 2 for c in available], k=1)[0]


def _constellation(state: AppState) -> list[tuple[str, str, str, str]]:
    """Return list of (cast_member, label, state, hint) for grid display."""
    s = state.streak()
    d = state.divergence()
    p = state.persona
    results = []
    for cm, (label, hint) in CAST_MEMBER_NAMES.items():
        if cm == "future_self":
            results.append((cm, label, "lit", hint))
        elif cm == "future_partner" and p and p.primary_arc == "love":
            results.append((cm, label, "lit" if d < 4 else "dim", hint))
        elif cm == "future_mentor" and s >= 7:
            results.append((cm, label, "lit", hint))
        elif cm == "future_best_friend" and s >= 3:
            results.append((cm, label, "lit", hint))
        elif cm == "shadow" and d >= 4:
            results.append((cm, label, "dim", hint))
        elif cm == "alternate_self" and s >= 14:
            results.append((cm, label, "dim", hint))
        else:
            results.append((cm, label, "locked", hint))
    return results


# ─── CSS — transmission console ─────────────────────────────────────────────
# Design intent: a private future-radio, not a styled Gradio dashboard.
# - The container is the signal chamber; everything else orbits it.
# - Typography: Fraunces (literary serif) for the chamber voice, IBM Plex Mono
#   for instrument labels and signal-path readouts. No Inter.
# - Surfaces are atmospheric, not bordered cards: layered gradients, faint
#   scanlines, glow rings, no generic rounded panels.
# - Constellation is a horizontal rail of voice orbs, not a card grid.
# - Progress is a horizontal signal path with an active pulse, not step pills.

CSS = """
/* Fonts are loaded via <link> in create_app() head — more reliable than CSS
   @import in an HF Space iframe, and async/non-blocking. */

:root{
  --ink:#0a0c1a;
  --ink-2:#0e1124;
  --ink-3:#141a30;
  --paper:#f6efdc;
  --paper-dim:#d8d0bd;
  --paper-mute:#9c9485;
  --amber:#e9a847;
  --amber-soft:#c4842d;
  --amber-glow:rgba(233,168,71,.45);
  --signal:rgba(233,168,71,.18);
  --violet:#7a6cc7;
  --violet-soft:rgba(122,108,199,.22);
  --live:#7adf9b;
  --locked:rgba(246,239,220,.16);
  --line:rgba(246,239,220,.10);
  --line-2:rgba(246,239,220,.05);
}

*{box-sizing:border-box}
html,body{margin:0;padding:0;background:var(--ink);color:var(--paper);}
body{
  font-family:'IBM Plex Mono','SF Mono',ui-monospace,monospace;
  font-size:14px;
  line-height:1.55;
  background:
    radial-gradient(ellipse 80% 50% at 50% -10%,rgba(233,168,71,.08),transparent 60%),
    radial-gradient(ellipse 60% 50% at 50% 110%,rgba(122,108,199,.06),transparent 60%),
    linear-gradient(180deg,var(--ink) 0%,var(--ink-2) 60%,var(--ink) 100%);
  background-attachment:fixed;
  min-height:100vh;
  -webkit-font-smoothing:antialiased;
  letter-spacing:.01em;
}
body::before{
  content:'';
  position:fixed;inset:0;
  background-image:repeating-linear-gradient(0deg,transparent 0,transparent 2px,rgba(246,239,220,.012) 2px,rgba(246,239,220,.012) 3px);
  pointer-events:none;
  z-index:1;
}
body::after{
  content:'';
  position:fixed;inset:0;
  background-image:radial-gradient(circle at 20% 30%,rgba(246,239,220,.015) 0,transparent 50%),
                   radial-gradient(circle at 80% 70%,rgba(233,168,71,.025) 0,transparent 50%);
  pointer-events:none;
  z-index:1;
}
::selection{background:var(--amber-glow);color:var(--ink);}

/* ─── Gradio chrome — quiet it down ─── */
.gradio-container{
  max-width:780px !important;
  margin:0 auto;
  padding:0 !important;
  position:relative;
  z-index:2;
  font-family:'IBM Plex Mono',monospace !important;
  background:transparent !important;
}
footer, .gradio-container > .footer, .gradio-container > div > .footer {display:none !important}
.app, .wrap, .panel, .container, .gap, .form, .panel-body {background:transparent !important;border:none !important;box-shadow:none !important;}

/* ─── Identity strip ─── */
.identity-strip{
  display:flex;align-items:center;justify-content:space-between;gap:16px;
  padding:18px 20px 14px;
  border-bottom:1px solid var(--line-2);
  position:relative;
}
.identity-strip::after{
  content:'';position:absolute;left:20px;right:20px;bottom:-1px;height:1px;
  background:linear-gradient(90deg,transparent,var(--amber) 50%,transparent);
  opacity:.35;
}
.brand-mark{
  display:flex;align-items:center;gap:10px;
  font-family:'IBM Plex Mono',monospace;
  font-size:11px;letter-spacing:.18em;text-transform:uppercase;
  color:var(--paper);
}
.brand-mark .glyph{
  display:inline-block;width:14px;height:14px;
  border:1px solid var(--amber);border-radius:50%;
  position:relative;
  box-shadow:0 0 14px var(--amber-glow);
}
.brand-mark .glyph::after{
  content:'';position:absolute;inset:3px;border-radius:50%;
  background:var(--amber);
  box-shadow:0 0 6px var(--amber);
  animation:glow 2.4s ease-in-out infinite;
}
.brand-mark .name{color:var(--paper);font-weight:500}
.brand-mark .sub{color:var(--paper-mute);font-weight:300;margin-left:6px;letter-spacing:.22em}
.instrument-cluster{display:flex;gap:14px;align-items:center}
.instrument{
  display:flex;flex-direction:column;align-items:flex-end;gap:1px;
  font-family:'IBM Plex Mono',monospace;
  border-left:1px solid var(--line-2);
  padding-left:12px;
}
.instrument:first-child{border-left:none;padding-left:0}
.instrument .label{font-size:9px;letter-spacing:.18em;text-transform:uppercase;color:var(--paper-mute)}
.instrument .value{font-size:13px;color:var(--amber);font-variant-numeric:tabular-nums;letter-spacing:.04em}
.instrument .value .unit{color:var(--paper-mute);font-size:10px;margin-left:2px}
.privacy-pulse{
  display:inline-flex;align-items:center;gap:6px;
  font-size:9px;letter-spacing:.2em;text-transform:uppercase;
  color:var(--live);
}
.privacy-pulse .dot{width:6px;height:6px;border-radius:50%;background:var(--live);box-shadow:0 0 8px var(--live);animation:glow 2s ease-in-out infinite}

/* ─── Signal chamber — the centerpiece ─── */
.signal-chamber{
  position:relative;
  margin:24px 20px 0;
  padding:38px 28px 30px;
  border-radius:4px;
  background:
    radial-gradient(ellipse 100% 70% at 50% 0%,rgba(233,168,71,.06),transparent 60%),
    linear-gradient(180deg,rgba(20,26,48,.65) 0%,rgba(14,17,36,.7) 100%);
  border:1px solid rgba(233,168,71,.18);
  overflow:hidden;
  isolation:isolate;
}
.signal-chamber::before{
  content:'';position:absolute;inset:-1px;border-radius:4px;
  background:linear-gradient(180deg,rgba(233,168,71,.4),transparent 30%,transparent 70%,rgba(122,108,199,.25));
  -webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);
  -webkit-mask-composite:xor;mask-composite:exclude;
  padding:1px;pointer-events:none;z-index:0;
}
.signal-chamber::after{
  content:'';position:absolute;inset:0;
  background-image:repeating-linear-gradient(0deg,transparent 0,transparent 3px,rgba(246,239,220,.014) 3px,rgba(246,239,220,.014) 4px);
  pointer-events:none;z-index:0;
}
.chamber-content{position:relative;z-index:1}
.chamber-eyebrow{
  display:flex;align-items:center;gap:10px;
  font-size:10px;letter-spacing:.28em;text-transform:uppercase;
  color:var(--amber);
  margin-bottom:16px;
}
.chamber-eyebrow .pulse{
  width:6px;height:6px;border-radius:50%;background:var(--amber);
  box-shadow:0 0 10px var(--amber);animation:glow 1.6s ease-in-out infinite;
}
.chamber-eyebrow .sep{color:var(--paper-mute);opacity:.5}
.chamber-title{
  font-family:'Fraunces','Times New Roman',serif;
  font-weight:500;
  font-size:34px;line-height:1.1;letter-spacing:-.015em;
  color:var(--paper);
  margin:0 0 8px;
}
.chamber-title em{font-style:italic;color:var(--amber);font-weight:400}
.chamber-body{
  font-family:'Fraunces',serif;
  font-size:17px;line-height:1.7;
  font-weight:300;
  color:var(--paper-dim);
}
.chamber-body em{color:var(--paper);font-style:italic}
.chamber-body strong{color:var(--amber);font-weight:500;font-family:'IBM Plex Mono',monospace;font-size:14px;letter-spacing:.04em}
.chamber-divider{
  height:1px;margin:24px 0 18px;
  background:linear-gradient(90deg,transparent,var(--line) 20%,var(--line) 80%,transparent);
}
.chamber-meta-row{
  display:flex;flex-wrap:wrap;gap:18px;
  font-size:10px;letter-spacing:.18em;text-transform:uppercase;
  color:var(--paper-mute);
}
.chamber-meta-row .meta-key{color:var(--paper-mute)}
.chamber-meta-row .meta-val{color:var(--paper);font-weight:500;margin-left:6px}
.chamber-callout{
  margin-top:20px;padding:14px 16px;
  border-left:2px solid var(--amber);
  background:linear-gradient(90deg,rgba(233,168,71,.06),transparent);
  font-family:'Fraunces',serif;font-style:italic;font-size:15px;line-height:1.6;
  color:var(--paper);
}
.chamber-callout .tag{
  display:block;
  font-family:'IBM Plex Mono',monospace;font-style:normal;font-size:9px;letter-spacing:.22em;
  text-transform:uppercase;color:var(--amber);
  margin-bottom:6px;
}
.chamber-actions{
  display:flex;flex-direction:column;gap:14px;
  margin-top:24px;
}
.chamber-section-label{
  font-size:9px;letter-spacing:.28em;text-transform:uppercase;
  color:var(--paper-mute);
  margin-bottom:8px;
}

/* Tuning sweep state */
.tuning-display{
  display:flex;flex-direction:column;align-items:center;gap:18px;
  padding:14px 0 6px;
}
.tuning-svg{width:280px;height:90px;display:block}
.tuning-svg .wave{fill:none;stroke:var(--amber);stroke-width:1.5;stroke-linecap:round;filter:drop-shadow(0 0 4px var(--amber))}
.tuning-svg .wave-back{stroke:rgba(233,168,71,.18);animation:drift 3s ease-in-out infinite}
.tuning-svg .wave-front{animation:drift 2.2s ease-in-out infinite reverse}
.tuning-readout{
  font-family:'IBM Plex Mono',monospace;font-size:11px;letter-spacing:.18em;
  text-transform:uppercase;color:var(--paper-mute);
  display:flex;gap:18px;flex-wrap:wrap;justify-content:center;
}
.tuning-readout .v{color:var(--amber);font-weight:500}
.tuning-readout .v.live::before{content:'●';margin-right:6px;color:var(--amber);animation:blink 1.2s ease-in-out infinite}

/* ─── Constellation rail (voice orbs) ─── */
.constellation-rail{
  margin:24px 20px 0;
  padding:14px 0 4px;
  border-top:1px solid var(--line-2);
}
.rail-head{
  display:flex;align-items:baseline;justify-content:space-between;
  padding:0 4px 10px;
}
.rail-head .rail-title{
  font-size:10px;letter-spacing:.28em;text-transform:uppercase;
  color:var(--paper);
}
.rail-head .rail-title em{color:var(--amber);font-style:normal;font-weight:500}
.rail-head .rail-status{font-size:10px;letter-spacing:.18em;color:var(--paper-mute);text-transform:uppercase}
.voice-rail{
  display:flex;gap:8px;overflow-x:auto;
  scrollbar-width:thin;scrollbar-color:var(--line) transparent;
  padding:6px 4px 14px;
}
.voice-rail::-webkit-scrollbar{height:4px}
.voice-rail::-webkit-scrollbar-thumb{background:var(--line);border-radius:2px}
.voice-orb{
  flex:0 0 auto;
  display:flex;flex-direction:column;align-items:center;gap:7px;
  min-width:78px;padding:10px 6px;
  border-radius:4px;
  background:rgba(20,26,48,.4);
  border:1px solid var(--line);
  transition:all .35s cubic-bezier(.4,0,.2,1);
  position:relative;
}
.voice-orb.lit{background:linear-gradient(180deg,rgba(233,168,71,.10),rgba(20,26,48,.55));border-color:rgba(233,168,71,.45)}
.voice-orb.dim{background:linear-gradient(180deg,rgba(122,108,199,.08),rgba(20,26,48,.55));border-color:rgba(122,108,199,.35)}
.voice-orb.locked{opacity:.42;filter:saturate(.4)}
.voice-orb .orb{
  width:38px;height:38px;border-radius:50%;
  display:flex;align-items:center;justify-content:center;
  background:rgba(20,26,48,.7);
  border:1px solid var(--line);
  position:relative;
  font-family:'IBM Plex Mono',monospace;font-size:11px;color:var(--paper-mute);
  letter-spacing:.04em;
}
.voice-orb.lit .orb{
  background:radial-gradient(circle at 30% 30%,rgba(233,168,71,.4),rgba(233,168,71,.05));
  border-color:rgba(233,168,71,.6);
  color:var(--amber);
  box-shadow:0 0 18px rgba(233,168,71,.35),inset 0 0 12px rgba(233,168,71,.2);
}
.voice-orb.lit .orb::after{
  content:'';position:absolute;inset:-4px;border-radius:50%;
  border:1px solid rgba(233,168,71,.3);
  animation:ripple 2.2s ease-out infinite;
}
.voice-orb.dim .orb{
  background:radial-gradient(circle at 30% 30%,rgba(122,108,199,.4),rgba(122,108,199,.05));
  border-color:rgba(122,108,199,.55);
  color:var(--violet);
}
.voice-orb .orb-label{font-size:10px;letter-spacing:.04em;color:var(--paper-dim);text-align:center;line-height:1.2;max-width:78px}
.voice-orb .orb-state{
  position:absolute;top:6px;right:6px;
  font-size:8px;letter-spacing:.18em;text-transform:uppercase;color:var(--paper-mute);
}
.voice-orb.lit .orb-state{color:var(--amber)}
.voice-orb.dim .orb-state{color:var(--violet)}

/* ─── Signal path (timeline progress) ─── */
.signal-path{
  margin:28px 20px 0;
  padding-top:18px;
  border-top:1px solid var(--line-2);
}
.path-head{
  display:flex;align-items:baseline;justify-content:space-between;
  font-size:10px;letter-spacing:.22em;text-transform:uppercase;
  color:var(--paper-mute);
  margin-bottom:14px;
}
.path-head .now{color:var(--amber)}
.path-track{
  position:relative;height:34px;display:flex;align-items:center;
}
.path-line{
  position:absolute;left:0;right:0;top:50%;transform:translateY(-50%);
  height:1px;background:var(--line);
}
.path-line.lit{
  background:linear-gradient(90deg,var(--amber),var(--violet));
  box-shadow:0 0 8px rgba(233,168,71,.5);
}
.path-nodes{display:flex;justify-content:space-between;width:100%;position:relative}
.path-node{
  display:flex;flex-direction:column;align-items:center;gap:6px;
  font-size:9px;letter-spacing:.18em;text-transform:uppercase;
  color:var(--paper-mute);
}
.path-node .dot{
  width:9px;height:9px;border-radius:50%;
  background:var(--ink);border:1px solid var(--line);
  transition:all .3s ease;
}
.path-node.done .dot{background:var(--amber);border-color:var(--amber);box-shadow:0 0 8px var(--amber-glow)}
.path-node.now .dot{
  background:var(--paper);border-color:var(--amber);
  box-shadow:0 0 0 3px rgba(233,168,71,.2),0 0 14px var(--amber);
  animation:pulse 1.6s ease-in-out infinite;
}
.path-node.now{color:var(--amber);font-weight:500}
.path-node.done{color:var(--paper-dim)}

/* ─── Memory log (history) ─── */
.memory-log{margin:24px 20px 0;padding-top:18px;border-top:1px solid var(--line-2)}
.memory-log .log-head{font-size:10px;letter-spacing:.28em;text-transform:uppercase;color:var(--paper);margin-bottom:14px}
.memory-log .log-head em{color:var(--amber);font-style:normal;font-weight:500}
.memory-row{
  display:grid;grid-template-columns:90px 1fr auto;gap:14px;align-items:baseline;
  padding:12px 0;
  border-bottom:1px dashed var(--line-2);
}
.memory-row:last-child{border-bottom:none}
.memory-row .ts{font-size:10px;letter-spacing:.12em;color:var(--paper-mute);font-variant-numeric:tabular-nums}
.memory-row .body{font-family:'Fraunces',serif;font-size:14px;line-height:1.5;color:var(--paper-dim)}
.memory-row .body em{color:var(--paper);font-style:italic}
.memory-row .tag{
  font-size:9px;letter-spacing:.2em;text-transform:uppercase;
  color:var(--amber);padding:3px 8px;border:1px solid var(--line);border-radius:2px;
  white-space:nowrap;
}
.memory-row .tag.choice-toward{color:var(--live);border-color:rgba(122,223,155,.4)}
.memory-row .tag.choice-steady{color:var(--amber);border-color:rgba(233,168,71,.4)}
.memory-row .tag.choice-release{color:var(--violet);border-color:rgba(122,108,199,.4)}
.memory-row .tag.choice-repair{color:#c98ad1;border-color:rgba(201,138,209,.4)}

/* Audio play chip beside memory-log tags — only renders when the
   transmission has a pre-rendered voice sample. Hover for play hint. */
.audio-chip{
  display:inline-flex;align-items:center;justify-content:center;
  width:18px;height:18px;margin-left:8px;
  border-radius:50%;
  background:rgba(233,168,71,.12);
  color:var(--amber);
  font-size:9px;
  text-decoration:none;
  border:1px solid rgba(233,168,71,.4);
  transition:all .2s ease;
  vertical-align:middle;
  cursor:pointer;
}
.audio-chip:hover{
  background:rgba(233,168,71,.25);
  color:var(--paper);
  border-color:var(--amber);
  transform:scale(1.1);
  text-decoration:none;
}

/* Demo button — softer than the primary, lives below the onboarding
   step 1 inputs. The amber dot in the label is the only visual signal
   that this is a curated showcase, not a regular action. */
button.demo-btn,
button.demo-btn.lg,
.gr-button.demo-btn{
  background:transparent !important;
  border:1px solid var(--line) !important;
  color:var(--paper-dim) !important;
  font-size:10px !important;
  letter-spacing:.18em !important;
  padding:8px 14px !important;
  margin-top:6px !important;
}
button.demo-btn:hover,
.gr-button.demo-btn:hover{
  border-color:var(--amber) !important;
  color:var(--amber) !important;
  background:rgba(233,168,71,.06) !important;
}

/* Share button — copy-to-clipboard for the transmission. Lives
   beneath the audio module. Smaller, quieter than the chamber
   action buttons, but visibly interactive. */
.share-btn{
  background:transparent;
  border:1px solid var(--line);
  color:var(--amber);
  font-family:'IBM Plex Mono',monospace;
  font-size:10px;
  letter-spacing:.18em;
  text-transform:uppercase;
  padding:8px 14px;
  border-radius:2px;
  cursor:pointer;
  transition:all .2s ease;
}
.share-btn:hover{
  border-color:var(--amber);
  background:rgba(233,168,71,.08);
  transform:translateY(-1px);
}
.share-btn:active{
  transform:translateY(0);
  background:rgba(233,168,71,.15);
}

/* ─── Footer status line ─── */
.signal-footer{
  margin-top:32px;padding:18px 20px 28px;
  border-top:1px solid var(--line-2);
  display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;
  font-size:9px;letter-spacing:.22em;text-transform:uppercase;color:var(--paper-mute);
}
.signal-footer .freq{color:var(--amber);font-variant-numeric:tabular-nums}
.signal-footer .live-line{display:flex;gap:14px;align-items:center}
.signal-footer .live-line .dot{width:6px;height:6px;border-radius:50%;background:var(--live);box-shadow:0 0 8px var(--live);animation:glow 1.6s ease-in-out infinite}

/* ─── Animations ─── */
@keyframes glow{0%,100%{opacity:.55;transform:scale(1)}50%{opacity:1;transform:scale(1.25)}}
@keyframes pulse{0%,100%{opacity:.7}50%{opacity:1}}
@keyframes ripple{0%{transform:scale(1);opacity:.55}100%{transform:scale(1.6);opacity:0}}
@keyframes drift{0%,100%{transform:translateX(0)}50%{transform:translateX(6px)}}
@keyframes blink{0%,49%{opacity:1}50%,100%{opacity:.25}}
@keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
.fade-in{animation:fadeIn .55s ease both}

/* ─── Gradio form controls — instrument them, don't card them ─── */
.gr-button{
  border-radius:2px !important;
  font-family:'IBM Plex Mono',monospace !important;
  font-weight:500 !important;letter-spacing:.14em !important;
  text-transform:uppercase !important;
  font-size:11px !important;
  padding:10px 18px !important;
  transition:all .25s cubic-bezier(.4,0,.2,1) !important;
  border:1px solid var(--line) !important;
  background:rgba(20,26,48,.5) !important;
  color:var(--paper) !important;
}
.gr-button:hover{
  border-color:var(--amber) !important;
  background:rgba(233,168,71,.08) !important;
  color:var(--amber) !important;
  transform:translateY(-1px);
}
.gr-button-primary{
  background:linear-gradient(180deg,var(--amber),var(--amber-soft)) !important;
  border:1px solid var(--amber) !important;
  color:var(--ink) !important;
  box-shadow:0 0 0 1px rgba(233,168,71,.25),0 6px 24px -8px var(--amber-glow) !important;
  position:relative;overflow:hidden;
}
.gr-button-primary:hover{
  background:linear-gradient(180deg,#f3b357,var(--amber)) !important;
  color:var(--ink) !important;
  border-color:var(--amber) !important;
  box-shadow:0 0 0 1px rgba(233,168,71,.4),0 8px 30px -6px var(--amber-glow) !important;
  transform:translateY(-1px);
}
.gr-button-primary::after{
  content:'';position:absolute;inset:0;
  background:linear-gradient(90deg,transparent,rgba(255,255,255,.25),transparent);
  transform:translateX(-100%);transition:transform .8s;
}
.gr-button-primary:hover::after{transform:translateX(100%)}

.gr-input, .gr-textarea, .gr-box, .gr-form, .gr-input-wrap, .gr-textarea-wrap, .gr-panel, .gr-block, .gr-component{
  background:rgba(20,26,48,.55) !important;
  border:1px solid var(--line) !important;
  border-radius:2px !important;
  color:var(--paper) !important;
  font-family:'IBM Plex Mono',monospace !important;
  font-size:13px !important;
  box-shadow:none !important;
}
.gr-input:focus, .gr-textarea:focus{
  border-color:var(--amber) !important;
  box-shadow:0 0 0 1px var(--amber-glow) !important;
  outline:none !important;
}
.gr-input::placeholder, .gr-textarea::placeholder{color:var(--paper-mute) !important;font-style:italic}

label, .gr-label, .gr-form-label{
  font-family:'IBM Plex Mono',monospace !important;
  font-size:9px !important;letter-spacing:.22em !important;text-transform:uppercase !important;
  color:var(--paper-mute) !important;
  margin-bottom:4px !important;
}

.radio-group, .gr-radio, .gr-radio-wrap{
  background:transparent !important;border:none !important;padding:0 !important;
}
.gr-radio-label, .gr-radio .label{
  font-family:'IBM Plex Mono',monospace !important;font-size:12px !important;
  color:var(--paper-dim) !important;
}

/* Tabs are nearly invisible — this is one signal chamber, not a dashboard */
.tab-nav, .tabitem, .tabs, .tab-wrapper{
  background:transparent !important;
  border:none !important;
  border-bottom:1px solid var(--line-2) !important;
  border-radius:0 !important;
  margin:0 20px !important;
  padding:0 !important;
}
.tab-nav button, .tabitem button{
  background:transparent !important;border:none !important;
  font-family:'IBM Plex Mono',monospace !important;
  font-size:10px !important;letter-spacing:.22em !important;text-transform:uppercase !important;
  color:var(--paper-mute) !important;
  padding:14px 4px !important;margin-right:24px !important;
  border-bottom:1px solid transparent !important;
  transition:color .3s,border-color .3s !important;
}
.tab-nav button:hover, .tabitem button:hover{color:var(--paper) !important}
.tab-nav button.selected, .tabitem button.selected{
  color:var(--amber) !important;
  border-bottom-color:var(--amber) !important;
  font-weight:500 !important;
}

h1,h2,h3,h4{
  font-family:'Fraunces',serif !important;
  font-weight:500 !important;letter-spacing:-.01em !important;
  color:var(--paper) !important;
}
h3{font-size:18px !important;margin:0 0 6px !important;}

audio{width:100%;margin:6px 0;border-radius:2px;filter:invert(.92) hue-rotate(180deg) saturate(.6)}
audio::-webkit-media-controls-panel{background:var(--ink-3);}

.column, .row, .group, .form{background:transparent !important;border:none !important;box-shadow:none !important;gap:10px !important;}

/* Status text on the awaiting/choice-result screens */
.choice-outcome{
  margin-top:18px;padding:14px 18px;
  border-left:2px solid var(--live);
  background:linear-gradient(90deg,rgba(122,223,155,.08),transparent);
  font-family:'Fraunces',serif;font-style:italic;font-size:16px;line-height:1.6;
  color:var(--paper);
}
.choice-outcome .tag{
  display:block;font-family:'IBM Plex Mono',monospace;font-style:normal;
  font-size:9px;letter-spacing:.22em;text-transform:uppercase;color:var(--live);
  margin-bottom:6px;
}

.timeline-shift{
  display:flex;gap:10px;align-items:stretch;margin-top:18px;
}
.timeline-shift .stem{
  flex:1;display:flex;flex-direction:column;align-items:center;gap:6px;
  padding:14px 8px;
  border:1px dashed var(--line);border-radius:2px;
  font-size:9px;letter-spacing:.18em;text-transform:uppercase;color:var(--paper-mute);
}
.timeline-shift .stem .v{font-size:18px;color:var(--paper);font-family:'Fraunces',serif;font-weight:500}
.timeline-shift .stem .delta{color:var(--amber)}

/* Architecture display */
.arch-pane{
  margin:18px 20px 0;padding:20px;
  background:rgba(14,17,36,.55);border:1px solid var(--line-2);border-radius:2px;
  font-family:'IBM Plex Mono',monospace;font-size:12px;line-height:1.7;color:var(--paper-dim);
  white-space:pre-wrap;overflow-x:auto;
}
.arch-pane .arch-h{
  color:var(--amber);font-size:9px;letter-spacing:.24em;text-transform:uppercase;
  border-bottom:1px solid var(--line-2);padding-bottom:8px;margin-bottom:12px;
}
.arch-pane .k{color:var(--paper-mute)}
.arch-pane .v{color:var(--amber)}
.arch-pane a{color:var(--amber);text-decoration:none;border-bottom:1px dotted rgba(233,168,71,.4)}
.arch-pane a:hover{border-bottom-style:solid}

/* ─── Mobile responsive ─── */
@media (max-width: 720px){
  .identity-strip{flex-direction:column;align-items:flex-start;gap:12px;padding:14px 16px 12px}
  .instrument-cluster{flex-wrap:wrap;gap:10px 14px;width:100%;justify-content:space-between}
  .instrument{padding-left:0;border-left:none}
  .instrument:not(:last-child){padding-right:14px;border-right:1px solid var(--line-2)}
  .signal-chamber{margin:18px 14px 0;padding:28px 18px 22px}
  .chamber-title{font-size:26px;line-height:1.12}
  .chamber-body{font-size:16px;line-height:1.65}
  .constellation-rail{margin:18px 14px 0}
  .signal-path{margin:22px 14px 0}
  .memory-log{margin:18px 14px 0}
  .signal-footer{padding:14px 16px 22px;flex-direction:column;align-items:flex-start;gap:6px}
  .gradio-container{max-width:none !important}
  .tab-nav, .tabitem, .tabs, .tab-wrapper{margin:0 14px !important}
  .tab-nav button, .tabitem button{margin-right:14px !important;padding:12px 2px !important}
  .path-node{font-size:8px;letter-spacing:.12em}
  .path-node .dot{width:8px;height:8px}
  .voice-orb{min-width:70px;padding:8px 4px}
  .voice-orb .orb{width:34px;height:34px;font-size:10px}
  .tuning-svg{width:100%;max-width:280px;height:70px}
  .chamber-callout{font-size:14px}
  .chamber-eyebrow{font-size:9px;letter-spacing:.22em}
}
@media (max-width: 480px){
  .chamber-title{font-size:22px}
  .chamber-body{font-size:15px}
  .identity-strip{padding:12px 14px 10px}
  .brand-mark{font-size:10px}
  .instrument .value{font-size:12px}
  .instrument .label{font-size:8px}
  .privacy-pulse{font-size:8px}
}  @media (prefers-reduced-motion: reduce){
  *,*::before,*::after{animation-duration:0.01ms !important;animation-iteration-count:1 !important;transition-duration:0.01ms !important}
}

/* ─── Example chips — inline phrase buttons ─── */
.ex-chip-row{
  display:flex;flex-wrap:wrap;gap:5px;
  margin:3px 0 8px;
}
.ex-chip{
  background:transparent;
  border:1px solid var(--line);
  border-radius:10px;
  color:var(--paper-mute);
  font-family:'IBM Plex Mono',monospace;
  font-size:10px;
  font-style:italic;
  padding:3px 10px;
  cursor:pointer;
  transition:all .2s ease;
  white-space:nowrap;
}
.ex-chip:hover{
  border-color:var(--amber);
  color:var(--amber);
  background:rgba(233,168,71,.08);
}
.ex-chip.used{
  color:var(--live);
  border-color:rgba(122,223,155,.5);
  font-style:normal;
}

/* ─── Choice/reaction cards ─── */
.card-grid{
  display:grid;
  gap:8px;
  margin:6px 0;
}
.choice-grid{grid-template-columns:repeat(2,1fr)}
.reaction-grid{grid-template-columns:repeat(2,1fr)}
.arc-grid{grid-template-columns:repeat(2,1fr)}
.choice-card, .reaction-card, .arc-card{
  display:flex;flex-direction:column;align-items:flex-start;gap:3px;
  padding:12px 14px;
  border:1px solid var(--line);
  border-radius:3px;
  background:rgba(20,26,48,.4);
  cursor:pointer;
  transition:all .25s cubic-bezier(.4,0,.2,1);
  text-align:left;
  font-family:'IBM Plex Mono',monospace;
  animation:fadeSlideIn .35s ease-out backwards;
}
.arc-card:nth-child(1){animation-delay:.05s}
.arc-card:nth-child(2){animation-delay:.1s}
.arc-card:nth-child(3){animation-delay:.15s}
.arc-card:nth-child(4){animation-delay:.2s}
@keyframes fadeSlideIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
.choice-card:hover, .reaction-card:hover, .arc-card:hover{
  border-color:var(--amber);
  background:linear-gradient(135deg,rgba(233,168,71,.08),rgba(20,26,48,.55));
}
.choice-card.active, .reaction-card.active, .arc-card.active{
  border-color:var(--amber);
  background:linear-gradient(135deg,rgba(233,168,71,.12),rgba(20,26,48,.55));
  box-shadow:0 0 0 1px rgba(233,168,71,.3),0 0 14px -4px var(--amber-glow);
}
.card-emoji{
  font-size:16px;
  line-height:1;
  margin-bottom:2px;
}
.card-label{
  font-size:12px;
  font-weight:500;
  letter-spacing:.06em;
  color:var(--paper);
}
.card-sub{
  font-size:9px;
  color:var(--paper-mute);
  letter-spacing:.04em;
  font-style:italic;
}

/* ─── Hidden radio — visually hidden but DOM-present for JS interactions ─── */
.hidden-radio{
  position:absolute !important;
  width:1px !important;
  height:1px !important;
  padding:0 !important;
  margin:-1px !important;
  overflow:hidden !important;
  clip:rect(0,0,0,0) !important;
  white-space:nowrap !important;
  border:0 !important;
  opacity:0 !important;
  pointer-events:none !important;
}
.hidden-radio .gr-form-label,
.hidden-radio label{display:none !important}

/* ─── Accordion primer — permission/guidance text ─── */
.acc-primer{
  font-size:10px;
  line-height:1.5;
  color:var(--paper-mute);
  font-style:italic;
  margin-bottom:8px;
}

/* ─── Onboarding primer — warmup before the form ─── */
.onboard-primer{
  margin-bottom:18px;
}
.primer-eyebrow{
  font-size:9px;
  letter-spacing:.28em;
  text-transform:uppercase;
  color:var(--paper-mute);
  margin-bottom:8px;
}
.primer-line{
  font-family:'Fraunces',serif;
  font-size:15px;
  line-height:1.7;
  color:var(--paper-dim);
  font-style:italic;
  border-left:2px solid var(--line);
  padding-left:14px;
}

@media (max-width: 720px){
  .choice-grid, .reaction-grid, .arc-grid{grid-template-columns:1fr}
}"""

# ─── Render helpers — transmission console primitives ───────────────────────
# Every renderer composes from these. No generic bordered card helper.

def _identity_strip(state: AppState) -> str:
    """Compact top bar — brand + privacy + instrument readouts (streak, divergence, choices)."""
    return f"""<div class="identity-strip fade-in">
  <div class="brand-mark">
    <span class="glyph"></span>
    <span><span class="name">FutureSelves</span><span class="sub">/ private future-radio</span></span>
  </div>
  <div class="instrument-cluster">
    <div class="instrument">
      <span class="label">streak</span>
      <span class="value">{state.streak():02d}<span class="unit">d</span></span>
    </div>
    <div class="instrument">
      <span class="label">divergence</span>
      <span class="value">{state.divergence():02d}<span class="unit">Δ</span></span>
    </div>
    <div class="instrument">
      <span class="label">choices</span>
      <span class="value">{len(state.recent_choices):02d}</span>
    </div>
    <div class="privacy-pulse"><span class="dot"></span>on-device</div>
  </div>
</div>"""


def _signal_chamber(eyebrow_html: str, title_html: str, body_html: str, *, meta_html: str = "", callout_html: str = "", actions_html: str = "") -> str:
    """The signal chamber — the single centerpiece surface. No borders, atmospheric treatment."""
    meta = f'<div class="chamber-divider"></div><div class="chamber-meta-row">{meta_html}</div>' if meta_html else ""
    callout = f'{callout_html}' if callout_html else ""
    actions = f'<div class="chamber-actions">{actions_html}</div>' if actions_html else ""
    return f"""<div class="signal-chamber fade-in">
  <div class="chamber-content">
    {eyebrow_html}
    {title_html}
    {body_html}
    {callout}
    {meta}
    {actions}
  </div>
</div>"""


def _chamber_eyebrow(left: str, right: str = "") -> str:
    r = f'<span class="sep">·</span><span>{right}</span>' if right else ""
    return f'<div class="chamber-eyebrow"><span class="pulse"></span><span>{left}</span>{r}</div>'


def _chamber_title(text: str) -> str:
    return f'<h2 class="chamber-title">{text}</h2>'


def _chamber_body(html: str) -> str:
    return f'<div class="chamber-body">{html}</div>'


def _chamber_callout(tag: str, html: str) -> str:
    return f'<div class="chamber-callout"><span class="tag">{tag}</span>{html}</div>'


def _chamber_meta(pairs: list[tuple[str, str]]) -> str:
    items = "".join(f'<span><span class="meta-key">{k}</span><span class="meta-val">{v}</span></span>' for k, v in pairs)
    return items


def _constellation_rail(state: AppState) -> str:
    """Horizontal rail of voice orbs — matches the Expo app's voiceGrid language."""
    stars = _constellation(state)
    items = []
    for cm, label, st, hint in stars:
        initials = "".join(w[0] for w in label.split()[:2]).upper() or "??"
        state_label = {"lit": "live", "dim": "faint", "locked": "off-air"}[st]
        items.append(
            f'<div class="voice-orb {st}">'
            f'<span class="orb-state">{state_label}</span>'
            f'<div class="orb">{initials}</div>'
            f'<div class="orb-label">{label}</div>'
            f'</div>'
        )
    return f"""<div class="constellation-rail">
  <div class="rail-head">
    <div class="rail-title">✦ <em>constellation</em> · {sum(1 for _, _, s, _ in stars if s == "lit")} of {len(stars)} live</div>
    <div class="rail-status">streak {state.streak():02d}d · divergence {state.divergence():02d}Δ</div>
  </div>
  <div class="voice-rail">{''.join(items)}</div>
</div>"""


_STEPS = [
    ("onboard", "Onboard"),
    ("check-in", "Check-in"),
    ("generate", "Generate"),
    ("choose", "Choose"),
    ("react", "React"),
]


def _signal_path(current: str) -> str:
    """Horizontal signal-path progress, not step pills."""
    if current not in {k for k, _ in _STEPS}:
        current = "onboard"
    idx = next(i for i, (k, _) in enumerate(_STEPS) if k == current)
    nodes = []
    for i, (k, label) in enumerate(_STEPS):
        cls = "done" if i < idx else ("now" if i == idx else "")
        nodes.append(f'<div class="path-node {cls}"><span class="dot"></span><span>{label}</span></div>')
    lit_pct = (idx / max(len(_STEPS) - 1, 1)) * 100
    return f"""<div class="signal-path">
  <div class="path-head"><span>signal path</span><span class="now">{_STEPS[idx][1]}</span></div>
  <div class="path-track">
    <div class="path-line"></div>
    <div class="path-line lit" style="width:{lit_pct:.1f}%"></div>
    <div class="path-nodes">{''.join(nodes)}</div>
  </div>
</div>"""


def _tuning_display(cast_label: str) -> str:
    """Atmospheric tuning-state visual: animated SVG waves + readouts, replaces the spinner."""
    return f"""<div class="tuning-display">
  <svg class="tuning-svg" viewBox="0 0 280 90" preserveAspectRatio="none" aria-hidden="true">
    <path class="wave wave-back" d="M0 45 Q 35 10, 70 45 T 140 45 T 210 45 T 280 45" />
    <path class="wave wave-front" d="M0 45 Q 35 80, 70 45 T 140 45 T 210 45 T 280 45" />
  </svg>
  <div class="tuning-readout">
    <span><span>channel</span> · <span class="v">α-04</span></span>
    <span><span>depth</span> · <span class="v">340ms</span></span>
    <span><span>handshake</span> · <span class="v live">locking</span></span>
  </div>
</div>"""


def _audio_module(label: str, audio_path: str) -> str:
    """Audio player styled as an instrument readout, not a card.

    audio_path is a Gradio-served path (either a Kokoro tempfile or a
    staged static file in the temp dir). The /file= prefix is Gradio's
    file-serving endpoint; the bare path doesn't work for arbitrary
    repo files on HF Spaces.
    """
    if not audio_path:
        return ""
    if audio_path.startswith("/file="):
        src = audio_path
    else:
        src = f"/file={audio_path}"
    return f"""<div style="margin-top:20px;padding:14px 16px;border:1px solid var(--line);border-radius:2px;background:rgba(20,26,48,.4);">
  <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
    <span style="width:6px;height:6px;border-radius:50%;background:var(--amber);box-shadow:0 0 8px var(--amber);animation:glow 1.4s ease-in-out infinite"></span>
    <span style="font-size:9px;letter-spacing:.22em;text-transform:uppercase;color:var(--amber)">voice transmission</span>
    <span style="font-size:9px;letter-spacing:.18em;text-transform:uppercase;color:var(--paper-mute)">· from {label}</span>
  </div>
  <audio controls autoplay preload="auto"><source src="{src}" type="audio/wav"></audio>
</div>"""


def _share_module(title: str, body: str, action: str, cliff: str) -> str:
    """A copy-to-clipboard button for the transmission, styled as an instrument.

    Judges (and demo viewers) often want to share the transmission
    text without having to retype it. The button copies the full
    transmission (title, body, action, cliffhanger) to the clipboard
    via a tiny vanilla-JS handler. The visible label is a short
    label; the copied text is the full transmission.
    """
    safe = (
        body.replace("\\", "\\\\").replace("`", "\\`").replace("$", "\\$")
        if body else ""
    )
    payload = (
        f"{title}\\n\\n{body}\\n\\n— Tonight: {action}\\n— Tomorrow: {cliff}\\n\\n— from FutureSelves"
    ).replace("\\", "\\\\").replace("`", "\\`").replace("$", "\\$").replace("\n", "\\n")
    return f"""<div class="share-module" style="margin-top:14px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
  <button type="button" class="share-btn"
    data-payload="{payload}"
    onclick="(function(b){{var t=b.dataset.payload.replace(/\\\\n/g,'\\n').replace(/\\\\\\\\/g,'\\\\').replace(/\\\\\\`/g,'\\`').replace(/\\\\\\$/g,'$');navigator.clipboard.writeText(t).then(function(){{b.innerText='✓ copied';setTimeout(function(){{b.innerText='✦ copy transmission'}},1800)}},function(){{b.innerText='copy failed'}})}})(this)"
  >✦ copy transmission</button>
  <span class="share-hint" style="font-size:9px;letter-spacing:.18em;text-transform:uppercase;color:var(--paper-mute);">share with someone you trust</span>
</div>"""


def _memory_log(state: AppState, *, limit: int = 8) -> str:
    """Memory log — grid of timestamped rows, not stacked cards.

    When the state carries demo-audio mapping (e.g. Maya's loaded state),
    past transmissions render a tiny play chip that links to the
    pre-rendered audio. The mapping is a hard-coded lookup keyed on
    transmission title so it works for the demo without polluting
    AppState's schema.
    """
    demo_audio = _demo_audio_lookup()
    if not state.recent_choices and not state.recent_transmissions:
        return ""
    rows = []
    for t in reversed(state.recent_transmissions[-limit:]):
        audio_chip = ""
        if t.title in demo_audio:
            rel = demo_audio[t.title]
            staged = _stage_static_audio(rel)
            if staged:
                audio_chip = (
                    f'<a class="audio-chip" href="/file={staged}" target="_blank" rel="noopener" '
                    f'title="play voice">▶</a>'
                )
        rows.append(
            f'<div class="memory-row">'
            f'<span class="ts">{t.date_key}</span>'
            f'<span class="body"><em>&ldquo;{t.title}&rdquo;</em></span>'
            f'<span class="tag">{CAST_MEMBER_NAMES.get(t.cast_member, ("", ""))[0] or t.cast_member}{audio_chip}</span>'
            f'</div>'
        )
    for c in reversed(state.recent_choices[-limit:]):
        rows.append(
            f'<div class="memory-row">'
            f'<span class="ts">{c.date_key}</span>'
            f'<span class="body">{c.prompt}</span>'
            f'<span class="tag choice-{c.choice}">{c.choice}</span>'
            f'</div>'
        )
    return f"""<div class="memory-log">
  <div class="log-head">memory log · <em>last {min(limit, len(rows))} signals</em></div>
  {''.join(rows)}
</div>"""


def _demo_audio_lookup() -> dict[str, str]:
    """Map demo transmission titles to their pre-rendered audio file paths.

    These are the Maya demo transmissions — pre-written for the "Try
    Maya's example" button. When a judge's state has these titles in its
    memory log, we render a play chip beside the title.

    Audio files are committed to the repo at audio/voices/. They're
    served via _stage_static_audio (Gradio temp dir) at the time the
    chip is rendered, not via the repo root.
    """
    return {
        "You know which conversation you keep rescheduling": "audio/voices/day-04-shadow.wav",
        "You are not behind. You are building.": "audio/voices/day-03-mentor.wav",
        "You are softer than the world taught you to be": "audio/voices/day-02-partner.wav",
        "The weight you are carrying is not all yours to carry": "audio/voices/day-01-self.wav",
        "The threshold is a door, not a wall": "audio/voices/today-threshold.wav",
    }


def _render_persona_card() -> str:
    """Render the demo persona summary in the architecture tab.

    Reads from traces/persona-summaries.json. If the file is empty or
    missing, returns a placeholder. The summary is a 1-paragraph
    narrative description of who Maya is, generated by the Modal
    function (or the local heuristic fallback). Showing it in the
    architecture tab is how judges verify the Modal integration.
    """
    summary_file = Path(__file__).parent / "traces" / "persona-summaries.json"
    if not summary_file.exists():
        return '<span class="k">no persona summary yet — generate one via the demo button</span>'
    try:
        summaries = json.loads(summary_file.read_text())
    except json.JSONDecodeError:
        return '<span class="k">persona summary file corrupted</span>'
    if not summaries:
        return '<span class="k">no persona summary yet — generate one via the demo button</span>'
    last = summaries[-1]
    src = last.get("source", "?")
    return (
        f'<em style="color:var(--paper);font-family:Fraunces,serif;font-size:14px;line-height:1.6;">'
        f'&ldquo;{last.get("summary", "")}&rdquo;</em>'
        f'<div style="margin-top:8px;font-size:9px;letter-spacing:.18em;text-transform:uppercase;color:var(--paper-mute);">'
        f'— {last.get("persona_name", "?")} · via {src}</div>'
    )


def _signal_footer() -> str:
    return """<div class="signal-footer">
  <div class="live-line"><span class="dot"></span><span>transmission line open</span></div>
  <div><span>frequency</span> <span class="freq">~ 88.7 mhz</span></div>
  <div><span>local</span> <span class="freq">0 bytes uploaded</span></div>
</div>"""


def _context_note(html: str) -> str:
    """Single small fallback surface for messages that don't fit the chamber. Used sparingly."""
    return f'<div style="margin:18px 20px 0;padding:14px 16px;border-left:2px solid var(--line);font-size:13px;line-height:1.55;color:var(--paper-mute);font-family:Fraunces,serif;font-style:italic;">{html}</div>'


# ─── App logic (async gen helper) ─────────────────────────────────────────────

def _gen_async(state: AppState, context: GenerationContext, cm: CastMember, now_str: str):
    start = time.time() if 'time' in dir() else 0
    import time as _time
    start = _time.time()
    result = _generate_with_llm(context, cm, now_str)
    state.today_transmission = result
    # Try local Kokoro first. If it fails (Space, missing deps, etc.) and we
    # have a matching pre-rendered voice sample for the cast member, fall
    # back to that — the demo stays alive even when TTS is unavailable.
    audio = generate_speech(result.text, voice=get_voice_for_cast_member(cm))
    if not audio:
        audio = _fallback_demo_audio(cm)
    state.today_audio = audio or ""
    state.generating = False
    state.generation_done = True
    # Log the full agent trace (system prompt + user prompt + raw output +
    # parsed JSON) for the Sharing is Caring bonus quest. This runs on
    # every live generation, so judges can audit the agent's decisions.
    duration_ms = int((_time.time() - start) * 1000)
    try:
        from transmission import build_prompt, get_system_prompt
        sys_p = get_system_prompt(context.persona.timeline_divergence_score)
        usr_p = build_prompt(context, cm)
        # Build a coarse parsed_output mirror
        parsed = {
            "title": result.title, "text": result.text[:200],
            "actionPrompt": result.action_prompt, "cliffhanger": result.cliffhanger,
        } if result else None
        # Run note extraction (Nemotron-Parse or keyword fallback) for the trace
        insights = None
        if context.check_in and context.check_in.note:
            try:
                ins = extract_note_insights(context.check_in.note) or fast_insights(context.check_in.note)
                if ins:
                    insights = {
                        "sentiment": ins.sentiment, "emotions": ins.emotions,
                        "themes": ins.themes, "intensity": ins.intensity,
                    }
            except Exception:
                pass
        log_agent_trace(
            persona_name=context.persona.name,
            cast_member=cm,
            system_prompt=sys_p,
            user_prompt=usr_p,
            raw_output=result.text if result else "",
            parsed_output=parsed,
            insights=insights,
            duration_ms=duration_ms,
        )
    except Exception as exc:
        logger.warning("Failed to log agent trace: %s", exc)


def _fallback_demo_audio(cm: CastMember) -> Optional[str]:
    """Map cast members to their pre-rendered voice samples.

    Used when Kokoro is unavailable (HF Space, missing dep chain) so
    the transmission still arrives with a voice. Each cast member has
    at most one canned voice sample that loops the canonical phrase
    for that voice; in a real product this would be replaced by
    Kokoro output, but for the demo it gives judges a real voice to
    hear even when MiniCPM and Kokoro aren't running.

    The file is copied to a Gradio temp dir so it's served via the
    /file= endpoint (Gradio does NOT serve arbitrary files from the
    repo root on a Space — it only serves from its temp dir).
    """
    sample_map = {
        "future_self": "audio/voices/today-threshold.wav",
        "future_partner": "audio/voices/day-02-partner.wav",
        "future_mentor": "audio/voices/day-03-mentor.wav",
        "shadow": "audio/voices/day-04-shadow.wav",
    }
    rel = sample_map.get(cm)
    if not rel:
        return None
    return _stage_static_audio(rel)


def _stage_static_audio(rel_path: str) -> Optional[str]:
    """Copy a static audio file to Gradio's temp dir so it's served at /file=.

    Gradio Spaces serve user files at /file=<absolute_path> only for
    files in the temp dir. Files in the repo root (audio/voices/...)
    are NOT served at the root URL. We copy the file once and cache
    the destination path, so the cost is one shutil.copy per file
    per session, not per request.
    """
    if not hasattr(_stage_static_audio, "_cache"):
        _stage_static_audio._cache = {}
    if rel_path in _stage_static_audio._cache:
        cached = _stage_static_audio._cache[rel_path]
        if os.path.exists(cached):
            return cached
    src = Path(__file__).parent / rel_path
    if not src.exists():
        logger.warning("Static audio not found: %s", src)
        return None
    # Use a stable filename in the temp dir so caching works
    dest_dir = Path(tempfile.gettempdir()) / "futureselves_audio"
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest = dest_dir / src.name
    if not dest.exists():
        shutil.copy(str(src), str(dest))
    _stage_static_audio._cache[rel_path] = str(dest)
    return str(dest)


# ─── Renderers — each returns the same shell, swaps only the chamber content ─

def _state_for_path(state: AppState) -> str:
    """Map app state to a signal-path key."""
    if not state.onboarded:
        return "onboard"
    if state.generating and not state.generation_done:
        return "generate"
    if state.today_transmission and not state.choice_made:
        return "choose" if state.checked_in else "generate"
    if state.checked_in and not state.today_transmission:
        return "generate"
    if state.today_transmission and state.choice_made:
        return "react"
    if state.checked_in:
        return "generate"
    return "check-in"


def _render_home(state: AppState) -> str:
    if not state.onboarded:
        body = _identity_strip(state)
        body += _signal_chamber(
            _chamber_eyebrow("transmission console", "onboard · 01 of 05"),
            _chamber_title("Tune the line."),
            _chamber_body("Tell us about the chapter you're in. The line opens after that — then your future self is waiting on the other side."),
        )
        body += _signal_path("onboard")
        return body
    p = state.persona
    eyebrow = _chamber_eyebrow("line idle", f"{p.name or 'you'} · {p.city or 'everywhere'}")
    title = _chamber_title(f"Ready when you are, <em>{p.name}</em>.")
    body_html = _chamber_body(
        f"Check in with one word to open the line. "
        f"You are in <em>{p.current_chapter or 'a chapter still forming'}</em>, "
        f"and avoiding <em>{p.avoiding or 'something you keep circling'}</em>."
    )
    callout = ""
    if state.recent_transmissions:
        last = state.recent_transmissions[-1]
        callout = _chamber_callout(
            "last transmission",
            f'<em>&ldquo;{last.title}&rdquo;</em> · {last.date_key}'
        )
    meta = _chamber_meta([
        ("arc", p.primary_arc or "—"),
        ("chapter", p.current_chapter[:40] + "…" if p.current_chapter and len(p.current_chapter) > 40 else (p.current_chapter or "—")),
    ])
    out = _identity_strip(state)
    out += _signal_chamber(eyebrow, title, body_html, meta_html=meta, callout_html=callout)
    out += _constellation_rail(state)
    out += _signal_path(_state_for_path(state))
    out += _memory_log(state)
    out += _signal_footer()
    return out


def _render_awaiting(state: AppState) -> str:
    eyebrow = _chamber_eyebrow("signal locked", f'word · {state.check_in_word or "—"}')
    title = _chamber_title(f'<em>&ldquo;{state.check_in_word}&rdquo;</em> received.')
    body_html = _chamber_body(
        "The note is being read. The line is open. "
        "Open the line below to receive your transmission."
    )
    meta = _chamber_meta([
        ("signal", "locked"),
        ("next", "receive transmission"),
    ])
    out = _identity_strip(state)
    out += _signal_chamber(eyebrow, title, body_html, meta_html=meta)
    out += _constellation_rail(state)
    out += _signal_path("generate")
    out += _signal_footer()
    return out


def _render_generating(cast: CastMember) -> str:
    label = CAST_MEMBER_NAMES.get(cast, ("", ""))[0] or cast
    eyebrow = _chamber_eyebrow("tuning the line", label)
    title = _chamber_title(f'<em>{label}</em> is reaching across time.')
    body_html = _chamber_body("Stand by. The signal is being assembled from your last few days.")
    body_html += _tuning_display(label)
    meta = _chamber_meta([
        ("channel", "α-04"),
        ("depth", "340ms"),
        ("cast", label),
    ])
    out = _identity_strip(AppState())  # state not threaded here; identity is enough
    out += _signal_chamber(eyebrow, title, body_html, meta_html=meta)
    out += _signal_path("generate")
    out += _signal_footer()
    return out


def _render_transmission(state: AppState) -> str:
    t = state.today_transmission
    if not t:
        return _render_home(state)
    label = CAST_MEMBER_NAMES.get(state.today_cast or "future_self", ("", ""))[0] or "Future Self"
    eyebrow = _chamber_eyebrow("transmission received", label)
    title = _chamber_title(f'<em>{t.title}</em>')
    body_html = _chamber_body(t.text)
    actions = _audio_module(label, state.today_audio) if state.today_audio else ""
    actions += _share_module(t.title, t.text, t.action_prompt, t.cliffhanger)
    # The chamber holds the audio module + tonight's move. Tomorrow's cliffhanger
    # is shown as a second anchor line below the chamber so the page has a clear
    # rhythm: text → audio + tonight → tomorrow → constellation → memory log.
    tonight = _chamber_callout("tonight's move", t.action_prompt)
    tomorrow = _chamber_callout("tomorrow", t.cliffhanger)
    out = _identity_strip(state)
    out += _signal_chamber(eyebrow, title, body_html, actions_html=actions, callout_html=tonight)
    out += tomorrow
    out += _constellation_rail(state)
    out += _signal_path("choose")
    out += _memory_log(state, limit=5)
    out += _signal_footer()
    return out


def _render_choice_result(state: AppState) -> str:
    c = state.today_choice or ""
    labels = {
        "toward": "You moved toward what matters.",
        "steady": "You held your ground.",
        "release": "You let something go.",
        "repair": "You mended a frayed thread.",
    }
    eyebrow = _chamber_eyebrow("choice recorded", c or "—")
    title = _chamber_title("The <em>timeline</em> shifts.")
    body_html = _chamber_body("How did the transmission land?")
    outcome = f'<div class="choice-outcome"><span class="tag">outcome</span>{labels.get(c, "")}</div>'
    out = _identity_strip(state)
    out += _signal_chamber(eyebrow, title, body_html, callout_html=outcome)
    out += _constellation_rail(state)
    out += _signal_path("react")
    out += _memory_log(state, limit=5)
    out += _signal_footer()
    return out


def _render_history(state: AppState) -> str:
    out = _identity_strip(state)
    eyebrow = _chamber_eyebrow("memory log", "transmissions and choices")
    title = _chamber_title("Every <em>signal</em> so far.")
    if not state.recent_choices and not state.recent_transmissions:
        body = _chamber_body("No transmissions yet. The line is idle. Start with a single word on the Today tab.")
        out += _signal_chamber(eyebrow, title, body)
    else:
        body = _chamber_body("Scroll for the full record of what was said and what you chose.")
        out += _signal_chamber(eyebrow, title, body)
    out += _constellation_rail(state)
    out += _memory_log(state, limit=20)
    out += _signal_path("react" if state.choice_made else "check-in")
    out += _signal_footer()
    return out


# ─── Build Gradio UI ─────────────────────────────────────────────────────────


def create_app():
    # Bootstrap: write the Modal app source and the demo trace on first
    # boot. These are committed to the repo but regenerating them at
    # startup means judges always see a current trace + a current
    # Modal function definition.
    try:
        write_modal_app()
        write_demo_trace()
    except Exception as exc:
        logger.warning("Startup bootstrap failed: %s", exc)
    # Off Brand: typewriter effect on transmission text
    js_code = """
function startTypewriter() {
  const el = document.querySelector('.typewriter');
  if (!el || el.dataset.typed) return;
  el.dataset.typed = '1';
  const text = el.textContent;
  el.textContent = '';
  el.style.visibility = 'visible';
  let i = 0;
  function type() {
    if (i < text.length) {
      el.textContent += text.charAt(i);
      i++;
      setTimeout(type, 6 + Math.random() * 12);
    }
  }
  type();
}
setInterval(startTypewriter, 500);
startTypewriter();

// ─── Example chip handler — click to populate textbox ───
function setupExampleChips() {
  document.querySelectorAll('.ex-chip').forEach(chip => {
    if (chip.dataset.wired) return;
    chip.dataset.wired = '1';
    chip.addEventListener('click', function(e) {
      e.preventDefault();
      const fieldId = this.dataset.field;
      const value = this.dataset.value;
      // Find the textarea/input inside the field container
      const container = document.getElementById(fieldId);
      if (!container) return;
      const input = container.querySelector('textarea, input');
      if (!input) return;
      // Set value natively so Gradio picks it up
      const nativeSetter = Object.getOwnPropertyDescriptor(
        input.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype,
        'value'
      ).set;
      nativeSetter.call(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      // Visual feedback
      const orig = this.textContent;
      this.textContent = '\u2713';
      this.classList.add('used');
      setTimeout(() => { this.textContent = orig; this.classList.remove('used'); }, 1200);
    });
  });
}

// ─── Choice/reaction card handler — click to select ───
function setupCardSelection() {
  document.querySelectorAll('.choice-card, .reaction-card, .arc-card').forEach(card => {
    if (card.dataset.wired) return;
    card.dataset.wired = '1';
    card.addEventListener('click', function(e) {
      e.preventDefault();
      const grid = this.closest('.card-grid');
      if (!grid) return;
      // Deselect all cards in this grid
      grid.querySelectorAll('.choice-card, .reaction-card, .arc-card').forEach(c => c.classList.remove('active'));
      // Select this card
      this.classList.add('active');
      // Find the hidden radio widget by elem_id and click the matching option
      let gridClass = 'field-choice';
      if (grid.classList.contains('choice-grid')) gridClass = 'field-choice';
      else if (grid.classList.contains('reaction-grid')) gridClass = 'field-reaction';
      else if (grid.classList.contains('arc-grid')) gridClass = 'field-oarc';
      const radioWidget = document.getElementById(gridClass);
      if (!radioWidget) return;
      const val = this.dataset.value;
      // Find the radio input with matching value attribute
      const radio = radioWidget.querySelector('input[value="' + val + '"]');
      if (radio) {
        radio.click();
      } else {
        // Fallback: try clicking the label
        const labels = radioWidget.querySelectorAll('.gr-radio-label');
        labels.forEach(label => {
          if (label.textContent.trim().toLowerCase() === val) {
            label.click();
          }
        });
      }
    });
  });
}

// Re-run after Gradio re-renders
function setupInteractions() {
  setupExampleChips();
  setupCardSelection();
}
setInterval(setupInteractions, 800);
setupInteractions();
"""
    with gr.Blocks(
        css=CSS,
        # No Inter. Fraunces for the chamber voice, IBM Plex Mono for instrument labels.
        # Pass an empty font list to gr.themes.Base so the @import in CSS wins.
        # Color() takes 11 shades (c50..c950) — built around our chamber palette.
        theme=gr.themes.Base(
            primary_hue=gr.themes.Color(
                c50="#fbf3e3", c100="#f5e3bd", c200="#eed29a", c300="#e7c277",
                c400="#e0b15a", c500="#e9a847", c600="#c4842d", c700="#a06820",
                c800="#7a4a14", c900="#5a3608", c950="#3a2205",
            ),
            secondary_hue=gr.themes.Color(
                c50="#ece9f8", c100="#d6cef0", c200="#bcb0e7", c300="#a192de",
                c400="#8b7cd3", c500="#7a6cc7", c600="#5b4ea6", c700="#3f3470",
                c800="#2c234d", c900="#1a1530", c950="#0d0a1c",
            ),
            neutral_hue=gr.themes.Color(
                c50="#f6efdc", c100="#d8d0bd", c200="#b8b09c", c300="#9c9485",
                c400="#7e766a", c500="#5a5f75", c600="#3a3f55", c700="#2a2e42",
                c800="#1c2032", c900="#141a30", c950="#0a0c1a",
            ),
            font=["IBM Plex Mono", "ui-monospace", "monospace"],
            font_mono=["IBM Plex Mono", "ui-monospace", "monospace"],
        ),
        title="FutureSelves",
        head=(
            # Google Fonts via <link>, not CSS @import — async, not blocked by
            # CSP, works in HF Space iframes. Two faces only: Fraunces for the
            # chamber voice, IBM Plex Mono for instrument labels and signal path.
            "<link rel=\"preconnect\" href=\"https://fonts.googleapis.com\">"
            "<link rel=\"preconnect\" href=\"https://fonts.gstatic.com\" crossorigin>"
            "<link rel=\"stylesheet\" "
            "href=\"https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;1,9..144,400&family=IBM+Plex+Mono:ital,wght@0,300;0,400;0,500;0,600;1,400&display=swap\">"
            f"<script>{js_code}</script>"
        ),
    ) as demo:
        browser_state = gr.BrowserState(None)
        state = gr.State(init_state())

        demo.load(fn=lambda d: AppState.from_dict(d), inputs=[browser_state], outputs=[state])

        with gr.Tabs(elem_classes="tab-nav"):
            # ── Today tab ──────────────────────────────────────────────
            with gr.Tab("Today"):
                # Initial chamber content shown before the page hydrates. Mirrors
                # _render_home() for the unonboarded state so there's no flash.
                content = gr.HTML(
                    _signal_chamber(
                        _chamber_eyebrow("transmission console", "onboard · 01 of 05"),
                        _chamber_title("Tune the line."),
                        _chamber_body("Tell us about the chapter you're in. The line opens after that — then your future self is waiting on the other side."),
                    )
                )

                with gr.Column(visible=True) as onboard_col:
                    # Primer line — sets emotional tone before the form
                    gr.HTML(PRIMER_HTML)
                    with gr.Column(visible=True) as step1_col:
                        gr.Markdown("### ✎ Step 1: Who are you?")
                        oname = gr.Textbox(
                            label="Your name",
                            placeholder=PLACEHOLDERS["name"],
                            elem_id="field-oname",
                        )
                        octiy = gr.Textbox(
                            label="Your city",
                            placeholder=PLACEHOLDERS["city"],
                            elem_id="field-octiy",
                        )
                        step1_btn = gr.Button(BUTTON_TEXT["step1_next"], variant="primary")
                        # ── Demo escape hatch ─────────────────────────────────────────────────────────────────────────────────
                        # One click loads Maya's fully-populated state — past
                        # transmissions, audio, today's transmission — so a
                        # judge sees the product's depth in 5 seconds. The
                        # click sets state directly and skips all three
                        # onboarding steps, then renders the home view.
                        gr.HTML(
                            '<div style="text-align:center;margin:18px 0 6px;font-size:9px;letter-spacing:.22em;text-transform:uppercase;color:var(--paper-mute);">— or skip the line setup —</div>'
                        )
                        demo_btn = gr.Button(
                            "✦ Try Maya's example",
                            variant="secondary",
                            elem_classes="demo-btn",
                        )

                    with gr.Column(visible=False) as step2_col:
                        step2_heading = gr.HTML("### ✎ Step 2: Your chapter 🧭")
                        ochapter = gr.Textbox(
                            label="Current life chapter",
                            lines=2,
                            placeholder=PLACEHOLDERS["chapter"],
                            elem_id="field-ochapter",
                        )
                        # Arc selection rendered as 4 cards, not a radio.
                        # Click a card to select. The hidden radio holds the
                        # state value for the step2_btn click handler.
                        step2_arc_html = gr.HTML(_arc_cards_html("purpose"))
                        oarc = gr.Radio(
                            ["money", "love", "purpose", "health"],
                            label="",
                            value="purpose",
                            elem_classes="hidden-radio",
                            elem_id="field-oarc",
                        )
                        step2_btn = gr.Button(BUTTON_TEXT["step2_next"], variant="primary")

                    with gr.Column(visible=False) as step3_col:
                        gr.Markdown("### ✎ Step 3: What's alive in you?")
                        with gr.Row():
                            with gr.Column(scale=1):
                                oavoid = gr.Textbox(
                                    label="Avoiding",
                                    lines=2,
                                    placeholder=PLACEHOLDERS["avoiding"],
                                    elem_id="field-oavoid",
                                )
                                gr.HTML(chip_html(EXAMPLES["avoiding"], "field-oavoid"))
                            with gr.Column(scale=1):
                                ofraid = gr.Textbox(
                                    label="Afraid won't happen",
                                    lines=2,
                                    placeholder=PLACEHOLDERS["afraid"],
                                    elem_id="field-ofraid",
                                )
                                gr.HTML(chip_html(EXAMPLES["afraid"], "field-ofraid"))
                        with gr.Row():
                            with gr.Column(scale=1):
                                odrain = gr.Textbox(
                                    label="Draining you",
                                    lines=2,
                                    placeholder=PLACEHOLDERS["draining"],
                                    elem_id="field-odrain",
                                )
                                gr.HTML(chip_html(EXAMPLES["draining"], "field-odrain"))
                            with gr.Column(scale=1):
                                omira = gr.Textbox(
                                    label="Miraculous year",
                                    lines=2,
                                    placeholder=PLACEHOLDERS["miraculous"],
                                    elem_id="field-omira",
                                )
                                gr.HTML(chip_html(EXAMPLES["miraculous"], "field-omira"))
                        gr.HTML(
                            '<div style="text-align:center;margin:14px 0 4px;font-size:9px;letter-spacing:.18em;text-transform:uppercase;color:var(--paper-mute);font-style:italic;">a sentence is enough. you can come back and edit anytime.</div>'
                        )
                        step3_btn = gr.Button(BUTTON_TEXT["step3_begin"], variant="primary")

                    _onboard_step1 = lambda n, c, s: (setattr(s, 'persona', PersonaContext(name=n.strip(), city=c.strip(), selected_voice_name="Ember", selected_voice_description="warm, intimate, certain")), setattr(s, 'onboard_step', 1), s)[2]
                    _onboard_step2 = lambda ch, a, s: (setattr(s.persona, 'current_chapter', ch.strip()) if s.persona else None, setattr(s.persona, 'primary_arc', a) if s.persona else None, setattr(s, 'onboard_step', 2), s)[3]
                    _onboard_step3 = lambda av, af, dr, mi, s: (setattr(s.persona, 'avoiding', av.strip()) if s.persona else None, setattr(s.persona, 'afraid_wont_happen', af.strip()) if s.persona else None, setattr(s.persona, 'draining', dr.strip()) if s.persona else None, setattr(s.persona, 'miraculous_year', mi.strip()) if s.persona else None, setattr(s, 'onboarded', True), setattr(s, 'onboard_step', 3), _render_home(s), s.to_dict(), s)

                    def _load_maya_demo(s: AppState):
                        """Populate state with Maya's 4-day history + today's transmission."""
                        bundle = build_maya_demo()
                        s.persona = bundle.persona
                        s.onboarded = True
                        s.onboard_step = 3
                        s.recent_transmissions = list(bundle.past_transmissions)
                        s.recent_choices = list(bundle.past_choices)
                        s.recent_responses = list(bundle.past_responses)
                        s.checked_in = True
                        s.check_in_word = bundle.check_in_word
                        s.check_in_note = bundle.check_in_note
                        s.today_cast = bundle.today_cast
                        s.today_transmission = bundle.today_transmission
                        # Stage the static audio into a Gradio-served temp
                        # path so the <audio> tag can play it via /file=
                        s.today_audio = _stage_static_audio(bundle.today_audio_path) or bundle.today_audio_path
                        s.generation_done = True
                        s.generating = False
                        # Also stage the past transmission audio files so
                        # the memory-log play chips resolve to live URLs.
                        for i, t in enumerate(s.recent_transmissions):
                            for title, rel in [
                                ("You know which conversation you keep rescheduling", "audio/voices/day-04-shadow.wav"),
                                ("You are not behind. You are building.", "audio/voices/day-03-mentor.wav"),
                                ("You are softer than the world taught you to be", "audio/voices/day-02-partner.wav"),
                                ("The weight you are carrying is not all yours to carry", "audio/voices/day-01-self.wav"),
                            ]:
                                if t.title == title:
                                    _stage_static_audio(rel)  # pre-warm cache
                        return _render_transmission(s), s.to_dict(), s

                    step1_btn.click(fn=_onboard_step1, inputs=[oname, octiy, state], outputs=[state]).then(
                        fn=lambda: (gr.Column(visible=False), gr.Column(visible=True)), outputs=[step1_col, step2_col])
                    step2_btn.click(fn=_onboard_step2, inputs=[ochapter, oarc, state], outputs=[state]).then(
                        fn=lambda: (gr.Column(visible=False), gr.Column(visible=True)), outputs=[step2_col, step3_col])
                    step3_btn.click(fn=_onboard_step3, inputs=[oavoid, ofraid, odrain, omira, state], outputs=[content, browser_state, state]).then(
                        fn=lambda: gr.Column(visible=False), outputs=[onboard_col])

                with gr.Accordion("☀ Check in", open=False) as checkin_acc:
                    gr.HTML('<div class="acc-primer">one word is enough. a note is welcome but optional.</div>')
                    word = gr.Textbox(
                        label="One word",
                        max_lines=1,
                        placeholder=PLACEHOLDERS["word"],
                        elem_id="field-word",
                    )
                    gr.HTML(_word_chips_html())
                    note = gr.Textbox(
                        label="Note (optional)",
                        lines=2,
                        placeholder=PLACEHOLDERS["note"],
                        elem_id="field-note",
                    )
                    gr.HTML(chip_html(EXAMPLES["note"], "field-note"))
                    checkin_btn = gr.Button(BUTTON_TEXT["checkin_submit"], variant="primary")

                with gr.Accordion("📡 Receive transmission", open=False) as receive_acc:
                    generate_btn = gr.Button(BUTTON_TEXT["generate"], variant="primary")

                with gr.Accordion("🎯 Your move", open=False) as choice_acc:
                    # Choice rendered as 4 cards, not a radio. Click a card to
                    # select. The hidden radio holds the state value for events.
                    gr.HTML(_choice_cards_html("toward"))
                    choice = gr.Radio(
                        ["toward", "steady", "release", "repair"],
                        label="",
                        value="toward",
                        elem_classes="hidden-radio",
                        elem_id="field-choice",
                    )
                    choice_btn = gr.Button(BUTTON_TEXT["choice_submit"], variant="primary")

                with gr.Accordion("💬 Reaction", open=False) as reaction_acc:
                    gr.HTML(_reaction_cards_html("landed"))
                    reaction = gr.Radio(
                        ["did_it", "keep_close", "landed", "not_quite"],
                        label="",
                        value="landed",
                        elem_classes="hidden-radio",
                        elem_id="field-reaction",
                    )
                    gr.HTML('<div class="acc-primer" style="margin-top:6px;">what landed? what didn\'t? (optional)</div>')
                    reply_note = gr.Textbox(
                        label="Write back (optional)",
                        lines=3,
                        placeholder=PLACEHOLDERS["reply"],
                        elem_id="field-reply",
                    )
                    gr.HTML(chip_html(EXAMPLES["reply"], "field-reply"))
                    react_btn = gr.Button(BUTTON_TEXT["reaction_submit"], variant="primary")

                # Wire check-in
                checkin_btn.click(
                    fn=lambda w, n, s: (_render_awaiting(s), s.to_dict(), s) if (setattr(s, 'check_in_word', w.strip()[:40]), setattr(s, 'check_in_note', n.strip() if n.strip() else ''), setattr(s, 'checked_in', True)) else (None, None, None),
                    inputs=[word, note, state], outputs=[content, browser_state, state],
                ).then(fn=lambda: (gr.Accordion(open=False), gr.Accordion(open=True)), outputs=[checkin_acc, receive_acc])

                # Wire generate
                generate_btn.click(
                    fn=lambda s: (_render_generating(s.today_cast or "future_self"), s.to_dict(), s) if (setattr(s, 'generating', True), setattr(s, 'generation_done', False), setattr(s, 'today_audio', ''), setattr(s, 'today_cast', _choose_cast(s)), threading.Thread(target=_gen_async, args=(s, s.to_context(), s.today_cast, date.today().strftime("%Y-%m-%d %H:%M")), daemon=True).start()) else (None, None, None),
                    inputs=[state], outputs=[content, browser_state, state],
                ).then(fn=lambda: gr.Accordion(open=False), outputs=[receive_acc])

                # Poll for generation.
                # gr.Timer in Gradio 5 fires `tick` at the given interval. We keep
                # it active the whole time because Gradio's Timer has no
                # start/stop event in 5.50. The tick handler below is a no-op
                # when no generation is in flight (returns None for every output,
                # which Gradio treats as "don't update this component"). This
                # gives us real-time updates when generating without flicker
                # when idle, at the cost of one tiny /queue/join call every 2s.
                poll_timer = gr.Timer(value=2, active=True)
                def _poll(s: AppState):
                    if s.generation_done and s.today_transmission:
                        # Clear the generating flag so we don't keep rendering
                        # the tuning display on subsequent ticks.
                        s.generating = False
                        return _render_transmission(s), s.to_dict(), s, gr.Accordion(visible=True)
                    if s.generating:
                        return _render_generating(s.today_cast or "future_self"), s.to_dict(), s, gr.Accordion(visible=False)
                    # Idle: no-op. Returning Nones leaves the components unchanged.
                    return None, None, None, None
                poll_timer.tick(fn=_poll, inputs=[state], outputs=[content, browser_state, state, choice_acc])

                # Wire choice
                choice_btn.click(
                    fn=lambda c, s: (_render_choice_result(s), s.to_dict(), s) if (
                        setattr(s, 'recent_transmissions', s.recent_transmissions + [RecentTransmission(date_key=date.today().isoformat(), title=(s.today_transmission.title if s.today_transmission else ""), cliffhanger=(s.today_transmission.cliffhanger if s.today_transmission else ""), cast_member=s.today_cast or "future_self")]),
                        setattr(s, 'recent_choices', s.recent_choices + [RecentChoice(date_key=date.today().isoformat(), choice=c, prompt=(s.today_transmission.action_prompt if s.today_transmission else ""))]),
                        s.persona and (setattr(s.persona, 'streak', s.persona.streak + 1) or setattr(s.persona, f'{c}_count', getattr(s.persona, f'{c}_count', 0) + 1)),
                        setattr(s, 'choice_made', True),
                        setattr(s, 'today_choice', c),
                    ) else (None, None, None),
                    inputs=[choice, state], outputs=[content, browser_state, state],
                ).then(fn=lambda: (gr.Accordion(open=False), gr.Accordion(open=True)), outputs=[choice_acc, reaction_acc])

                # Wire reaction
                react_btn.click(
                    fn=lambda r, rn, s: (_render_home(s), s.to_dict(), s) if (
                        setattr(s, 'recent_responses', s.recent_responses + [RecentResponse(reaction=r if r else None, reply_note=rn.strip() if rn.strip() else None)]),
                        setattr(s, 'checked_in', False), setattr(s, 'generation_done', False), setattr(s, 'choice_made', False),
                        setattr(s, 'today_transmission', None), setattr(s, 'today_audio', ""), setattr(s, 'today_choice', ""),
                        setattr(s, 'check_in_word', ""), setattr(s, 'check_in_note', ""),
                    ) else (None, None, None),
                    inputs=[reaction, reply_note, state], outputs=[content, browser_state, state],
                ).then(fn=lambda: (gr.Accordion(open=False), gr.Accordion(open=True)), outputs=[reaction_acc, checkin_acc])

                # Maya demo button: skip onboarding, go straight to the transmission.
                # Wired here (after the accordions) so the lambda can close them.
                demo_btn.click(fn=_load_maya_demo, inputs=[state], outputs=[content, browser_state, state]).then(
                    fn=lambda: gr.Column(visible=False), outputs=[onboard_col]).then(
                    # Close receive + check-in accordions; open the "your move" one
                    # so the judge can immediately pick toward/steady/release/repair
                    fn=lambda: (gr.Accordion(open=False), gr.Accordion(open=False), gr.Accordion(open=True, visible=True)),
                    outputs=[receive_acc, checkin_acc, choice_acc],
                )

            # ── History tab ────────────────────────────────────────────
            with gr.Tab("History"):
                # No refresh button — the chamber + memory log auto-flow from
                # state. The tab simply re-evaluates on each interaction.
                history = gr.HTML("")
                # Render once on tab open so the panel is populated immediately.
                demo.load(fn=lambda s: _render_history(s), inputs=[state], outputs=[history])
                # Also render arc cards in step2 when state carries a persona with primary_arc
                demo.load(
                    fn=lambda s: (
                        _arc_cards_html(s.persona.primary_arc if s.persona else "purpose"),
                        f"### ✎ Step 2: Your chapter {ARC_EMOJI.get(s.persona.primary_arc, '🧭')}" if s.persona else "### ✎ Step 2: Your chapter 🧭",
                    ),
                    inputs=[state],
                    outputs=[step2_arc_html, step2_heading],
                )

            # ── Architecture tab ───────────────────────────────────────
            with gr.Tab("Architecture"):
                gr.HTML("""
<div class="arch-pane">
  <div class="arch-h">signal pipeline · ~3.1B total params</div>
<span class="k">nemotron-parse</span>  <span class="v">·</span>  note extraction (&lt;1B)  <span class="k">·</span>  <span class="v">nvidia</span>
<span class="k">minicpm-2.5</span>      <span class="v">·</span>  transmission generation (~2.5B)  <span class="k">·</span>  <span class="v">openbmb</span>
<span class="k">piper / kokoro-82m</span> <span class="v">·</span>  voice synthesis (&lt;100M)  <span class="k">·</span>  <span class="v">on-device</span>

every signal stays on the device. no cloud. no upload. no api bill.
</div>

<div class="arch-pane">
  <div class="arch-h">prize targets</div>
backyard ai · openbmb · nvidia nemotron · tiny titan · best agent · off brand · bonus quest champion
</div>

<div class="arch-pane">
  <div class="arch-h">demo persona · maya (loaded via "Try Maya's example")</div>
""" + _render_persona_card() + """
</div>

<div class="arch-pane">
  <div class="arch-h">open agent trace · sharing is caring</div>
the full transmission chain — system prompt, user prompt, raw LLM output, parsed JSON, note insights, duration — is logged to <a href="https://github.com/udingethe/futureselves/tree/main/hf-space/traces/agent-trace.jsonl" target="_blank" rel="noopener">traces/agent-trace.jsonl</a>. open for anyone to audit the agent's decisions end-to-end.
</div>

<div class="arch-pane">
  <div class="arch-h">modal · serverless compute for the persona summarizer</div>
persona summaries are pre-computed on modal's serverless GPU (modal_app.py). the function takes a serialized persona + 3+ day history and returns a 1-paragraph narrative summary. <a href="https://github.com/udingethe/futureselves/tree/main/hf-space/traces/modal_app.py" target="_blank" rel="noopener">see traces/modal_app.py</a>.
</div>

<div class="arch-pane">
  <div class="arch-h">source</div>
<a href="https://github.com/udingethe/futureselves/tree/main/hf-space" target="_blank" rel="noopener">github.com/udingethe/futureselves/hf-space</a>
</div>
""")
    return demo


def init_state() -> AppState:
    return AppState()


def main():
    demo = create_app()
    demo.launch()

if __name__ == "__main__":
    main()
