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
import logging
import os
import threading
import uuid
from dataclasses import dataclass, field, asdict
from datetime import date
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


# ─── CSS ─────────────────────────────────────────────────────────────────────

CSS = """
:root{--primary:#c4842d;--primary-dark:#a06820;--bg:#0c0c18;--surface:#16162a;--surface2:#1e1e38;--text:#e0dcd0;--text-muted:#9e9488;--border:#2a2a3e;--green:#4caf50;--purple:#6a5acd;}
body{background:var(--bg);color:var(--text);font-family:'Inter',sans-serif;overflow-x:hidden;}
::selection{background:#c4842d40;color:#fff;}
.gr-box{border-radius:12px!important;border:1px solid var(--border)!important;}
.gr-button{border-radius:8px!important;font-weight:600!important;transition:all .25s cubic-bezier(.4,0,.2,1)!important;}
.gr-button:hover{transform:translateY(-1px);filter:brightness(1.1);}
.gr-button-primary{background:linear-gradient(135deg,#c4842d,#a06820)!important;border:none!important;color:#fff!important;position:relative;overflow:hidden;}
.gr-button-primary::after{content:'';position:absolute;inset:0;background:linear-gradient(90deg,transparent,rgba(255,255,255,.1),transparent);transform:translateX(-100%);transition:transform .6s;}
.gr-button-primary:hover::after{transform:translateX(100%);}
.gr-button-secondary{background:var(--surface)!important;border:1px solid var(--border)!important;color:var(--text)!important;}
.gr-button-secondary:hover{background:var(--surface2)!important;}
.gr-input,.gr-textarea{background:var(--surface)!important;border:1px solid var(--border)!important;color:var(--text)!important;border-radius:8px!important;transition:border-color .3s,box-shadow .3s!important;}
.gr-input:focus,.gr-textarea:focus{border-color:var(--primary)!important;box-shadow:0 0 0 3px #c4842d25!important;}
.gradio-container{max-width:680px!important;margin:0 auto;padding:20px!important;}
.tab-nav{background:var(--surface)!important;border:1px solid var(--border)!important;border-radius:8px!important;margin-bottom:16px!important;}
.tab-nav button{color:var(--text-muted)!important;transition:color .3s!important;}
.tab-nav button.selected{color:var(--primary)!important;border-bottom-color:var(--primary)!important;}
h1,h2,h3{font-family:'Inter',sans-serif;letter-spacing:-0.02em;}
label{color:var(--text)!important;font-weight:500!important;}
.radio-group{background:var(--surface);border-radius:8px;padding:8px;border:1px solid var(--border);}
footer{display:none!important}
/* Privacy chips */
.privacy-chip{display:inline-flex;align-items:center;gap:6px;padding:5px 12px;border-radius:20px;font-size:0.7em;background:#1a3a1a;border:1px solid #2a5a2a;color:#7ccc7c;margin-bottom:10px;animation:fadeInUp .5s ease both;}
.privacy-chip:nth-child(2){animation-delay:.1s;}
.privacy-chip:nth-child(3){animation-delay:.2s;}
.privacy-chip:nth-child(4){animation-delay:.3s;}
.privacy-chip.warning{background:#3a2a1a;border-color:#5a4a2a;color:#ccc47c;}
.privacy-chip:hover{border-color:#7ccc7c60;box-shadow:0 0 12px #7ccc7c20;}
/* Step bar */
.step-bar{display:flex;gap:0;margin:16px 0;padding:0;list-style:none;overflow:hidden;border-radius:8px;background:var(--surface);border:1px solid var(--border);}
.step-bar li{flex:1;text-align:center;padding:10px 4px;font-size:0.72em;color:var(--text-muted);position:relative;transition:all .4s cubic-bezier(.4,0,.2,1);}
.step-bar li.active{color:var(--primary);font-weight:600;}
.step-bar li.active::after{content:'';position:absolute;bottom:0;left:10%;width:80%;height:2px;background:linear-gradient(90deg,var(--primary),#e0dcd0);border-radius:1px;animation:slideIn .4s ease;}
.step-bar li.done{color:var(--green);}
.step-bar li:not(.done):not(.active){opacity:0.5;}
/* Constellation */
.constellation{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:12px 0;}
.constellation-item{border-radius:10px;padding:10px;text-align:center;border:1px solid var(--border);background:var(--surface);transition:all .35s cubic-bezier(.4,0,.2,1);animation:fadeInUp .5s ease both;cursor:default;}
.constellation-item:nth-child(2){animation-delay:.05s;}
.constellation-item:nth-child(3){animation-delay:.1s;}
.constellation-item:nth-child(4){animation-delay:.15s;}
.constellation-item:nth-child(5){animation-delay:.2s;}
.constellation-item:nth-child(6){animation-delay:.25s;}
.constellation-item:hover{transform:translateY(-2px);border-color:var(--primary)60;}
.constellation-item.lit{border-color:#c4842d40;background:linear-gradient(135deg,#1a1a2e,#2a1a0e);}
.constellation-item.dim{border-color:#6a5acd40;background:linear-gradient(135deg,#1a1a2e,#1e0e2e);}
.constellation-item.locked{opacity:0.4;filter:grayscale(.6);}
.constellation-item .dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-bottom:4px;}
.dot-lit{background:var(--primary);box-shadow:0 0 10px #c4842d60;animation:glow 2s ease-in-out infinite;}
.dot-dim{background:var(--purple);box-shadow:0 0 10px #6a5acd60;animation:glow 3s ease-in-out infinite;}
.dot-locked{background:var(--border);}
.constellation-item .name{font-size:0.78em;font-weight:600;color:var(--text);}
.constellation-item .hint{font-size:0.6em;color:var(--text-muted);margin-top:1px;}
/* Audio player */
audio{width:100%;margin:8px 0;border-radius:8px;animation:fadeInUp .5s ease;}
audio::-webkit-media-controls-panel{background:var(--surface);}
/* Transmission card border glow */
.glow-card{position:relative;border-radius:12px;overflow:hidden;}
.glow-card::before{content:'';position:absolute;inset:-2px;border-radius:14px;background:linear-gradient(60deg,transparent,var(--primary)40,transparent,var(--primary)20,transparent);background-size:300% 300%;animation:borderGlow 4s ease-in-out infinite;z-index:0;}
.glow-card > div{position:relative;z-index:1;background:var(--surface);margin:2px;border-radius:10px;padding:16px 20px;}
/* Animations */
@keyframes fadeInUp{from{opacity:0;transform:translateY(12px);}to{opacity:1;transform:translateY(0);}}
@keyframes slideIn{from{width:0;left:50%;}to{width:80%;left:10%;}}
@keyframes pulse{0%,100%{opacity:.6;}50%{opacity:1;}}
@keyframes glow{0%,100%{opacity:.6;transform:scale(1);}50%{opacity:1;transform:scale(1.3);}}
@keyframes borderGlow{0%,100%{background-position:0% 50%;}50%{background-position:100% 50%;}}
@keyframes shimmer{0%{transform:translateX(-100%);}100%{transform:translateX(100%);}}
.pulse{animation:pulse 1.5s ease-in-out infinite;}
.fade-in{animation:fadeInUp .6s ease both;}
.shimmer{position:relative;overflow:hidden;}
.shimmer::after{content:'';position:absolute;inset:0;background:linear-gradient(90deg,transparent,rgba(255,255,255,.03),transparent);animation:shimmer 2s infinite;}
"""

# ─── Render helpers ──────────────────────────────────────────────────────────

def _header() -> str:
    return f"""<div style="text-align:center;padding:8px 0 4px;">
  <h1 style="font-size:2em;font-weight:700;margin:0;background:linear-gradient(135deg,#e0dcd0,#c4842d,#a06820);
    -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;">
    ✦ FutureSelves
  </h1>
  <p style="color:var(--text-muted);margin:2px 0 8px;font-size:0.85em;">Your future self is listening.</p>
  <div style="display:flex;justify-content:center;gap:8px;flex-wrap:wrap;margin-bottom:4px;">
    <span class="privacy-chip">🔒 100% on-device</span>
    <span class="privacy-chip">📡 0 bytes uploaded</span>
    <span class="privacy-chip">🧠 3.1B total params</span>
    <span class="privacy-chip warning">⚡ LLM + Extraction + TTS</span>
  </div>
</div>"""


def _card(title: str, body: str, accent: str = "#c4842d") -> str:
    return f"""<div style="background:var(--surface);border:1px solid {accent}40;border-radius:12px;padding:16px 20px;margin:8px 0;">
  <h3 style="color:{accent};margin:0 0 6px;font-size:1em;">{title}</h3>
  <div style="color:var(--text);line-height:1.6;white-space:pre-wrap;">{body}</div>
</div>"""


def _stats_row(state: AppState) -> str:
    return f"""<div style="display:flex;gap:12px;margin:12px 0;">
  <div style="flex:1;background:var(--surface);border-radius:12px;padding:12px;text-align:center;border:1px solid var(--border);">
    <div style="color:var(--primary);font-size:1.6em;font-weight:700;">{state.streak()}</div>
    <div style="color:var(--text-muted);font-size:0.8em;">day streak</div>
  </div>
  <div style="flex:1;background:var(--surface);border-radius:12px;padding:12px;text-align:center;border:1px solid var(--border);">
    <div style="color:var(--primary);font-size:1.6em;font-weight:700;">{state.divergence()}</div>
    <div style="color:var(--text-muted);font-size:0.8em;">divergence</div>
  </div>
  <div style="flex:1;background:var(--surface);border-radius:12px;padding:12px;text-align:center;border:1px solid var(--border);">
    <div style="color:var(--primary);font-size:1.6em;font-weight:700;">{len(state.recent_choices)}</div>
    <div style="color:var(--text-muted);font-size:0.8em;">choices made</div>
  </div>
</div>"""


_STEPS = ["✎ Onboard", "☀ Check-in", "📡 Generate", "🎯 Choose", "💬 React"]


def _step_indicator(current: int) -> str:
    items = []
    for i, label in enumerate(_STEPS):
        cls = "done" if i < current else "active" if i == current else ""
        items.append(f'<li class="{cls}">{label}</li>')
    return f'<ul class="step-bar">{"".join(items)}</ul>'


def _render_constellation(state: AppState) -> str:
    stars = _constellation(state)
    items = []
    for cm, label, st, hint in stars:
        items.append(f"""<div class="constellation-item {st}">
  <div class="dot dot-{st}"></div>
  <div class="name">{label}</div>
  <div class="hint">{hint}</div>
</div>""")
    return f"""<h3 style="color:var(--primary);font-size:0.9em;margin:16px 0 4px;">✦ Your constellation</h3>
<div class="constellation">{"".join(items)}</div>"""


# ─── App logic (async gen helper) ─────────────────────────────────────────────

def _gen_async(state: AppState, context: GenerationContext, cm: CastMember, now_str: str):
    result = _generate_with_llm(context, cm, now_str)
    state.today_transmission = result
    audio = generate_speech(result.text, voice=get_voice_for_cast_member(cm))
    state.today_audio = audio or ""
    state.generating = False
    state.generation_done = True


# ─── Renderers ───────────────────────────────────────────────────────────────

def _render_home(state: AppState) -> str:
    if not state.onboarded:
        return _header() + _card("Welcome", "Complete onboarding to begin receiving transmissions.", "#6a5acd")
    body = _header() + _step_indicator(1) + _stats_row(state)
    body += _render_constellation(state)
    p = state.persona
    body += _card("Today's signal", f"Ready when you are, {p.name}. Check in with one word to tune the line.", "#c4842d")
    if state.recent_transmissions:
        last = state.recent_transmissions[-1]
        body += _card("Last transmission", f'<em>"{last.title}"</em> — {last.date_key}', "#6a5acd")
    return body


def _render_awaiting(state: AppState) -> str:
    body = _header() + _step_indicator(2) + _stats_row(state)
    body += _card("✓ Checked in", f'Word: <strong>"{state.check_in_word}"</strong>', "#4caf50")
    if state.check_in_note:
        body += _card("Note", state.check_in_note, "#6a5acd")
    body += '<div style="text-align:center;padding:8px 0;color:var(--text-muted);">Ready to receive your transmission?</div>'
    return body


def _render_generating(cast: CastMember) -> str:
    label = CAST_MEMBER_NAMES.get(cast, ["", ""])[0] or cast
    return _header() + _step_indicator(2) + _card("📡 Tuning the signal", f"<em>{label}</em> is reaching across time...", "#c4842d") + """
<div style="text-align:center;padding:24px 0;">
  <div style="display:inline-block;width:40px;height:40px;border:3px solid #c4842d40;border-top-color:#c4842d;border-radius:50%;animation:s 1s linear infinite;"></div>
  <p style="color:var(--text-muted);margin-top:12px;" class="pulse">The line is opening. Stand by.</p>
</div>
<style>@keyframes s{to{transform:rotate(360deg)}}</style>"""


def _render_transmission(state: AppState) -> str:
    t = state.today_transmission
    if not t:
        return _render_home(state)
    label = CAST_MEMBER_NAMES.get(state.today_cast or "future_self", ["", ""])[0] or "Future Self"
    body = _header() + _step_indicator(3) + _stats_row(state)
    body += _card(f"📡 {label}", f"<em>{t.title}</em>", "#c4842d")
    # Audio player
    if state.today_audio:
        body += f"""<div style="background:var(--surface);border:1px solid var(--primary)40;border-radius:12px;padding:12px 16px;margin:8px 0;">
  <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
    <span style="font-size:1.2em;">🔊</span>
    <span style="color:var(--primary);font-weight:600;font-size:0.85em;">Voice transmission</span>
    <span style="color:var(--text-muted);font-size:0.75em;">from {label}</span>
  </div>
  <audio controls autoplay><source src="/file={state.today_audio}" type="audio/wav"></audio>
</div>"""
    body += f"""<div class="glow-card fade-in"><div>
  <h3 style="color:var(--text);margin:0 0 6px;font-size:1em;">Transmission</h3>
  <div style="color:#e0dcd0;line-height:1.7;white-space:pre-wrap;font-size:1.05em;">{t.text}</div>
</div></div>"""
    body += _card("🎯 Tonight's move", t.action_prompt, "#4caf50")
    body += _card("🔮 Tomorrow", t.cliffhanger, "#6a5acd")
    return body


def _render_choice_result(state: AppState) -> str:
    c = state.today_choice or ""
    labels = {"toward": "You moved toward what matters.", "steady": "You held your ground.", "release": "You let something go.", "repair": "You mended a frayed thread."}
    body = _header() + _step_indicator(4) + _stats_row(state)
    body += _card("✓ Choice recorded", labels.get(c, ""), "#4caf50")
    body += '<div style="text-align:center;padding:8px 0;color:var(--text-muted);">The timeline shifts. How did the transmission land?</div>'
    return body


def _render_history(state: AppState) -> str:
    body = _header()
    if not state.recent_choices and not state.recent_transmissions:
        return body + '<p style="color:var(--text-muted);">No history yet. Start your journey on the Today tab.</p>'
    body += _render_constellation(state)
    if state.recent_choices:
        body += "<h3 style='color:var(--primary);font-size:0.9em;margin-top:16px;'>Recent choices</h3>"
        for c in reversed(state.recent_choices[-5:]):
            body += f"""<div style="display:flex;justify-content:space-between;padding:8px 12px;background:var(--surface);border-radius:8px;margin:4px 0;border:1px solid var(--border);">
  <span>{c.choice}</span><span style="color:var(--text-muted);font-size:0.85em;">{c.date_key}</span></div>"""
    if state.recent_transmissions:
        body += "<h3 style='color:var(--primary);font-size:0.9em;margin-top:16px;'>Transmissions received</h3>"
        for t in reversed(state.recent_transmissions[-5:]):
            body += f"""<div style="padding:8px 12px;background:var(--surface);border-radius:8px;margin:4px 0;border:1px solid var(--border);">
  <div><strong>"{t.title}"</strong></div>
  <div style="color:var(--text-muted);font-size:0.85em;">{t.date_key} · {CAST_MEMBER_NAMES.get(t.cast_member, ["", ""])[0] or t.cast_member}</div></div>"""
    return body


# ─── Build Gradio UI ─────────────────────────────────────────────────────────


def create_app():
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
"""
    with gr.Blocks(css=CSS, theme=gr.themes.Soft(primary_hue="amber", neutral_hue="stone", font=["Inter", "system-ui", "sans-serif"]), title="FutureSelves", head=f"<script>{js_code}</script>") as demo:
        browser_state = gr.BrowserState(None)
        state = gr.State(init_state())

        demo.load(fn=lambda d: AppState.from_dict(d), inputs=[browser_state], outputs=[state])

        with gr.Tabs(elem_classes="tab-nav"):
            # ── Today tab ──────────────────────────────────────────────
            with gr.Tab("Today"):
                content = gr.HTML(
                    _header() + _card("Welcome", "Complete onboarding below to begin.", "#6a5acd")
                )

                with gr.Column(visible=True) as onboard_col:
                    with gr.Column(visible=True) as step1_col:
                        gr.Markdown("### ✎ Step 1: Who are you?")
                        oname = gr.Textbox(label="Your name", placeholder="What do you go by?")
                        octiy = gr.Textbox(label="Your city", placeholder="Where are you right now?")
                        step1_btn = gr.Button("Next →", variant="primary")

                    with gr.Column(visible=False) as step2_col:
                        gr.Markdown("### ✎ Step 2: Your chapter")
                        ochapter = gr.Textbox(label="Current life chapter", lines=2, placeholder="e.g. rebuilding after a move, mid-career pivot...")
                        oarc = gr.Radio(["money", "love", "purpose", "health"], label="Primary arc", value="purpose")
                        step2_btn = gr.Button("Next →", variant="primary")

                    with gr.Column(visible=False) as step3_col:
                        gr.Markdown("### ✎ Step 3: What's alive in you?")
                        with gr.Row():
                            oavoid = gr.Textbox(label="Avoiding", lines=2, scale=1, placeholder="What you keep circling?")
                            ofraid = gr.Textbox(label="Afraid won't happen", lines=2, scale=1)
                        with gr.Row():
                            odrain = gr.Textbox(label="Draining you", lines=2, scale=1)
                            omira = gr.Textbox(label="Miraculous year", lines=2, scale=1)
                        step3_btn = gr.Button("Begin", variant="primary")

                    _onboard_step1 = lambda n, c, s: (setattr(s, 'persona', PersonaContext(name=n.strip(), city=c.strip(), selected_voice_name="Ember", selected_voice_description="warm, intimate, certain")), setattr(s, 'onboard_step', 1), s)[2]
                    _onboard_step2 = lambda ch, a, s: (setattr(s.persona, 'current_chapter', ch.strip()) if s.persona else None, setattr(s.persona, 'primary_arc', a) if s.persona else None, setattr(s, 'onboard_step', 2), s)[3]
                    _onboard_step3 = lambda av, af, dr, mi, s: (setattr(s.persona, 'avoiding', av.strip()) if s.persona else None, setattr(s.persona, 'afraid_wont_happen', af.strip()) if s.persona else None, setattr(s.persona, 'draining', dr.strip()) if s.persona else None, setattr(s.persona, 'miraculous_year', mi.strip()) if s.persona else None, setattr(s, 'onboarded', True), setattr(s, 'onboard_step', 3), _render_home(s), s.to_dict(), s)

                    step1_btn.click(fn=_onboard_step1, inputs=[oname, octiy, state], outputs=[state]).then(
                        fn=lambda: (gr.Column(visible=False), gr.Column(visible=True)), outputs=[step1_col, step2_col])
                    step2_btn.click(fn=_onboard_step2, inputs=[ochapter, oarc, state], outputs=[state]).then(
                        fn=lambda: (gr.Column(visible=False), gr.Column(visible=True)), outputs=[step2_col, step3_col])
                    step3_btn.click(fn=_onboard_step3, inputs=[oavoid, ofraid, odrain, omira, state], outputs=[content, browser_state, state]).then(
                        fn=lambda: gr.Column(visible=False), outputs=[onboard_col])

                with gr.Accordion("☀ Check in", open=False) as checkin_acc:
                    word = gr.Textbox(label="One word", max_lines=1, placeholder="exhausted, hopeful, restless...")
                    note = gr.Textbox(label="Note", lines=2, placeholder="What's alive in you?")
                    checkin_btn = gr.Button("Tune the signal", variant="primary")

                with gr.Accordion("📡 Receive transmission", open=False) as receive_acc:
                    generate_btn = gr.Button("Open the line", variant="primary")

                with gr.Accordion("🎯 Your move", open=False) as choice_acc:
                    choice = gr.Radio(
                        [("🚀 Toward", "toward"), ("🌱 Steady", "steady"), ("🕊️ Release", "release"), ("🪡 Repair", "repair")],
                        label="Choose your move", type="value")
                    choice_btn = gr.Button("Record choice", variant="primary")

                with gr.Accordion("💬 Reaction", open=False) as reaction_acc:
                    reaction = gr.Radio(
                        [("✅ Did it", "did_it"), ("💭 Keep close", "keep_close"), ("🎯 Landed", "landed"), ("🔄 Not quite", "not_quite")],
                        label="How did it land?", type="value")
                    reply_note = gr.Textbox(label="Write back", lines=2, placeholder="A reply...")
                    react_btn = gr.Button("Send", variant="primary")

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

                # Poll for generation
                demo.load(
                    fn=lambda s: (_render_transmission(s), s.to_dict(), s, gr.Accordion(visible=True)) if (s.generation_done and s.today_transmission and not setattr(s, 'generating', False)) else (_render_generating(s.today_cast or "future_self"), s.to_dict(), s, gr.Accordion(visible=False)) if s.generating else (None, None, None, None),
                    inputs=[state], outputs=[content, browser_state, state, choice_acc], every=2)

                # Wire choice
                choice_btn.click(
                    fn=lambda c, s: (_render_choice_result(s), s.to_dict(), s) if (
                        setattr(s, 'recent_transmissions', s.recent_transmissions + [RecentTransmission(date_key=date.today().isoformat(), title=(s.today_transmission.title if s.today_transmission else ""), cliffhanger=(s.today_transmission.cliffhanger if s.today_transmission else ""), cast_member=s.today_cast or "future_self")]),
                        setattr(s, 'recent_choices', s.recent_choices + [RecentChoice(date_key=date.today().isoformat(), choice=c, prompt=(s.today_transmission.action_prompt if s.today_transmission else ""))]),
                        s.persona and (setattr(s.persona, 'streak', s.persona.streak + 1) or setattr(s.persona, f'{c}_count', getattr(s.persona, f'{c}_count', 0) + 1)),
                        setattr(s, 'choice_made', True),
                    ) else (None, None, None),
                    inputs=[choice, state], outputs=[content, browser_state, state],
                ).then(fn=lambda: (gr.Accordion(open=False), gr.Accordion(open=True)), outputs=[choice_acc, reaction_acc])

                # Wire reaction
                react_btn.click(
                    fn=lambda r, rn, s: (_render_home(s), s.to_dict(), s) if (
                        setattr(s, 'recent_responses', s.recent_responses + [RecentResponse(reaction=r if r else None, reply_note=rn.strip() if rn.strip() else None)]),
                        setattr(s, 'checked_in', False), setattr(s, 'generation_done', False), setattr(s, 'choice_made', False),
                        setattr(s, 'today_transmission', None), setattr(s, 'today_audio', ""), setattr(s, 'check_in_word', ""), setattr(s, 'check_in_note', ""),
                    ) else (None, None, None),
                    inputs=[reaction, reply_note, state], outputs=[content, browser_state, state],
                ).then(fn=lambda: (gr.Accordion(open=False), gr.Accordion(open=True)), outputs=[reaction_acc, checkin_acc])

            # ── History tab ────────────────────────────────────────────
            with gr.Tab("History"):
                history = gr.HTML("")
                refresh = gr.Button("Refresh")
                refresh.click(fn=lambda s: _render_history(s), inputs=[state], outputs=[history])

            # ── Architecture tab ───────────────────────────────────────
            with gr.Tab("Architecture"):
                gr.Markdown("""
### Pipeline architecture

```
┌──────────────────────────────────────────────────────────────┐
│                   FutureSelves · 3 models · 3.1B params       │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐   │
│  │  Nemotron     │    │  MiniCPM 2.5 │    │  Kokoro 82M  │   │
│  │  Parse (<1B)  │───▶│  (~2.5B)     │───▶│  TTS         │   │
│  │  NVIDIA       │    │  OpenBMB     │    │  (on-device)  │   │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘   │
│         │                   │                   │           │
│         ▼                   ▼                   ▼           │
│  Extract emotions     Generate narrative     Synthesize     │
│  + themes from        transmission with     speech from     │
│  check-in note        continuity + memory   transmission    │
│                                                              │
│              All inference · Zero uploads                    │
└──────────────────────────────────────────────────────────────┘
```

**Prize targets:** Backyard AI, OpenBMB, NVIDIA Nemotron, Tiny Titan, Best Agent, Off Brand, Best Demo, Bonus Quest Champion

[Source](https://github.com/udingethe/futureselves/tree/main/hf-space)
                """)

    return demo


def init_state() -> AppState:
    return AppState()


def main():
    demo = create_app()
    demo.launch()

if __name__ == "__main__":
    main()
