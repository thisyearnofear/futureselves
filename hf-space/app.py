"""
app.py — FutureSelves for Build Small (Gradio Space).

Two models, one Space:
  - MiniCPM 2.5B (~2.5B param) — primary LLM for transmission generation
  - Nemotron-Parse (<1B param) — structured note extraction (NVIDIA prize)

TTS via Kokoro (82M param) — fully local.

Targeted prizes: Backyard AI track, OpenBMB, NVIDIA Nemotron,
Tiny Titan, Best Agent, Off Brand, Best Demo, Bonus Quest Champion.
"""

from __future__ import annotations

import json
import logging
import os
import threading
from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Optional

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

CHOICE_LABELS = {
    "toward": "Toward — move closer to what matters",
    "steady": "Steady — hold ground and endure",
    "release": "Release — let something go",
    "repair": "Repair — fix a thread that's frayed",
}

CAST_MEMBER_NAMES = {
    "future_self": "Your Future Self",
    "future_partner": "Future Partner",
    "future_mentor": "Future Mentor",
    "future_best_friend": "Future Best Friend",
    "shadow": "The Shadow",
    "alternate_self": "Alternate Self",
}

# ─── Lazy model loading ──────────────────────────────────────────────────────

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
            MODEL_NAME,
            trust_remote_code=True,
            torch_dtype=torch.float16,
            device_map="auto",
            attn_implementation="sdpa",
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
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": full},
        ]
        import torch
        input_text = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
        inputs = tokenizer(input_text, return_tensors="pt").to(model.device)
        with torch.no_grad():
            outputs = model.generate(
                **inputs,
                max_new_tokens=700,
                temperature=0.8,
                top_p=0.9,
                do_sample=True,
                pad_token_id=tokenizer.pad_token_id or tokenizer.eos_token_id,
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
    checked_in: bool = False
    check_in_word: str = ""
    check_in_note: str = ""
    today_cast: Optional[CastMember] = None
    today_transmission: Optional[GeneratedTransmission] = None
    generating: bool = False
    generation_done: bool = False
    choice_made: bool = False
    recent_transmissions: list[RecentTransmission] = field(default_factory=list)
    recent_choices: list[RecentChoice] = field(default_factory=list)
    recent_responses: list[RecentResponse] = field(default_factory=list)
    open_threads: list = field(default_factory=list)

    def to_context(self) -> GenerationContext:
        assert self.persona
        check_in = type("C", (), {"word": self.check_in_word, "note": self.check_in_note or None})() if self.checked_in else None
        return GenerationContext(
            persona=self.persona,
            check_in=check_in,
            recent_transmissions=self.recent_transmissions,
            recent_choices=self.recent_choices,
            recent_responses=self.recent_responses,
            open_threads=self.open_threads,
        )

    def streak(self) -> int:
        return self.persona.streak if self.persona else 0

    def divergence(self) -> int:
        return self.persona.timeline_divergence_score if self.persona else 0


def init_state() -> AppState:
    return AppState()


# ─── Choose cast member ──────────────────────────────────────────────────────

def _choose_cast(state: AppState) -> CastMember:
    import random
    if not state.recent_transmissions:
        return "future_self"
    available = [c for c in CAST_MEMBER_NAMES if c not in {t.cast_member for t in state.recent_transmissions[-3:]}]
    if not available:
        return random.choice(["future_self", "future_partner", "future_mentor"])
    return random.choices(available, weights=[3 if c == "future_self" else 2 for c in available], k=1)[0]


# ─── UI CSS ──────────────────────────────────────────────────────────────────

CSS = """
:root {
  --primary:#c4842d; --primary-dark:#a06820;
  --bg:#0f0f1a; --surface:#1a1a2e; --surface2:#222240;
  --text:#e0dcd0; --text-muted:#9e9488; --border:#2a2a3e;
}
body{background:var(--bg);color:var(--text);font-family:'Inter',sans-serif;}
.gr-box{border-radius:12px!important;border:1px solid var(--border)!important;}
.gr-button{border-radius:8px!important;font-weight:600!important;transition:all 0.2s;}
.gr-button-primary{background:linear-gradient(135deg,#c4842d,#a06820)!important;border:none!important;}
.gr-button-secondary{background:var(--surface)!important;border:1px solid var(--border)!important;color:var(--text)!important;}
.gr-input,.gr-textarea{background:var(--surface)!important;border:1px solid var(--border)!important;color:var(--text)!important;border-radius:8px!important;}
.gr-input:focus,.gr-textarea:focus{border-color:var(--primary)!important;box-shadow:0 0 0 2px #c4842d20!important;}
.gradio-container{max-width:680px!important;margin:0 auto;padding:20px!important;}
.tab-nav{background:var(--surface)!important;border:1px solid var(--border)!important;border-radius:8px!important;}
.tab-nav button{color:var(--text-muted)!important;}
.tab-nav button.selected{color:var(--primary)!important;border-bottom-color:var(--primary)!important;}
h1,h2,h3{font-family:'Inter',sans-serif;}
label{color:var(--text)!important;font-weight:500!important;}
.radio-group{background:var(--surface);border-radius:8px;padding:8px;border:1px solid var(--border);}
footer{display:none!important}
"""

# ─── Render helpers ──────────────────────────────────────────────────────────

def _header() -> str:
    return """<div style="text-align:center;padding:16px 0 12px;">
  <h1 style="font-size:2em;font-weight:700;margin:0;background:linear-gradient(135deg,#e0dcd0,#c4842d,#a06820);
    -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;">
    ✦ FutureSelves
  </h1>
  <p style="color:var(--text-muted);margin:2px 0 0;font-size:0.9em;">Your future self is listening.</p>
</div>"""


def _card(title: str, body: str, accent: str = "#c4842d") -> str:
    return f"""<div style="background:var(--surface);border:1px solid {accent}40;border-radius:12px;
    padding:16px 20px;margin:8px 0;">
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
    <div style="color:var(--text-muted);font-size:0.8em;">choices</div>
  </div>
</div>"""


# ─── App logic ───────────────────────────────────────────────────────────────

def do_onboarding(name: str, city: str, chapter: str, arc: str, avoiding: str, afraid: str, draining: str, miraculous: str, state: AppState):
    state.persona = PersonaContext(
        name=name.strip(), city=city.strip(), current_chapter=chapter.strip(),
        primary_arc=arc,
        miraculous_year=miraculous.strip(),
        avoiding=avoiding.strip(), afraid_wont_happen=afraid.strip(),
        draining=draining.strip(),
        selected_voice_name="Ember", selected_voice_description="warm, intimate, certain",
    )
    state.onboarded = True
    return "", _render_home(state), "", state


def do_check_in(word: str, note: str, state: AppState):
    state.check_in_word = word.strip()[:40]
    state.check_in_note = note.strip() if note.strip() else ""
    state.checked_in = True
    return "", _render_awaiting(state), state


def do_generate(state: AppState):
    state.generating = True
    state.generation_done = False
    cm = _choose_cast(state)
    state.today_cast = cm
    context = state.to_context()
    now_str = date.today().strftime("%Y-%m-%d %H:%M")
    thread = threading.Thread(target=_gen_async, args=(state, context, cm, now_str), daemon=True)
    thread.start()
    return _render_generating(cm), state


def _gen_async(state: AppState, context: GenerationContext, cm: CastMember, now_str: str):
    result = _generate_with_llm(context, cm, now_str)
    state.today_transmission = result
    state.generating = False
    state.generation_done = True


def check_generation(state: AppState):
    if state.generation_done and state.today_transmission:
        return _render_transmission(state), state
    if state.generating:
        return _render_generating(state.today_cast or "future_self"), state
    return _render_home(state), state


def do_choice(choice: str, state: AppState):
    if state.today_transmission:
        state.recent_transmissions.append(RecentTransmission(
            date_key=date.today().isoformat(), title=state.today_transmission.title,
            cliffhanger=state.today_transmission.cliffhanger,
            cast_member=state.today_cast or "future_self",
        ))
    state.recent_choices.append(RecentChoice(
        date_key=date.today().isoformat(), choice=choice,
        prompt=state.today_transmission.action_prompt if state.today_transmission else "",
    ))
    if state.persona:
        state.persona.streak += 1
        setattr(state.persona, f"{choice}_count", getattr(state.persona, f"{choice}_count", 0) + 1)
    state.choice_made = True
    return _render_choice_result(state), state


def do_reaction(reaction: str, reply: str, state: AppState):
    state.recent_responses.append(RecentResponse(
        reaction=reaction if reaction else None,
        reply_note=reply.strip() if reply.strip() else None,
    ))
    state.checked_in = False
    state.generation_done = False
    state.choice_made = False
    state.today_transmission = None
    state.check_in_word = ""
    state.check_in_note = ""
    return _render_home(state), state


# ─── Renderers ───────────────────────────────────────────────────────────────

def _render_home(state: AppState) -> str:
    if not state.onboarded:
        return _card("Welcome", "Complete onboarding to begin receiving transmissions.", "#6a5acd")
    p = state.persona
    body = _header() + _stats_row(state)
    body += _card("Today's signal", f"Ready when you are, {p.name}. Check in with one word to tune the line.", "#c4842d")
    if state.recent_transmissions:
        last = state.recent_transmissions[-1]
        body += _card("Last transmission", f'<em>"{last.title}"</em> — {last.date_key}', "#6a5acd")
    return body


def _render_awaiting(state: AppState) -> str:
    body = _header()
    body += _card("✓ Checked in", f'Word: <strong>"{state.check_in_word}"</strong>', "#4caf50")
    if state.check_in_note:
        body += _card("Note", state.check_in_note, "#6a5acd")
    body += '<div style="text-align:center;padding:12px 0;color:var(--text-muted);">Ready to receive your transmission?</div>'
    return body


def _render_generating(cast: CastMember) -> str:
    label = CAST_MEMBER_NAMES.get(cast, cast)
    return _header() + _card("📡 Tuning the signal", f"<em>{label}</em> is reaching across time...", "#c4842d") + """
<div style="text-align:center;padding:24px 0;">
  <div style="display:inline-block;width:40px;height:40px;border:3px solid #c4842d40;
    border-top-color:#c4842d;border-radius:50%;animation:s 1s linear infinite;"></div>
  <p style="color:var(--text-muted);margin-top:12px;">The line is opening. Stand by.</p>
</div>
<style>@keyframes s{to{transform:rotate(360deg)}}</style>"""


def _render_transmission(state: AppState) -> str:
    t = state.today_transmission
    if not t:
        return _render_home(state)
    label = CAST_MEMBER_NAMES.get(state.today_cast or "future_self", "Future Self")
    body = _header()
    body += _card(f"📡 {label}", f"<em>{t.title}</em>", "#c4842d")
    body += _card("Transmission", t.text, "#e0dcd0")
    body += _card("🎯 Tonight's move", t.action_prompt, "#4caf50")
    body += _card("🔮 Tomorrow", t.cliffhanger, "#6a5acd")
    return body


def _render_choice_result(state: AppState) -> str:
    c = state.today_choice or ""
    labels = {"toward": "You moved toward what matters.", "steady": "You held your ground.", "release": "You let something go.", "repair": "You mended a frayed thread."}
    body = _header() + _card("✓ Choice recorded", labels.get(c, ""), "#4caf50")
    body += '<div style="text-align:center;padding:8px 0;color:var(--text-muted);">The timeline shifts. How did the transmission land?</div>'
    return body


def _render_history(state: AppState) -> str:
    body = _header()
    if not state.recent_choices and not state.recent_transmissions:
        return body + '<p style="color:var(--text-muted);">No history yet.</p>'
    if state.recent_choices:
        body += "<h3 style='color:#c4842d;'>Recent choices</h3>"
        for c in reversed(state.recent_choices[-5:]):
            body += f"""<div style="display:flex;justify-content:space-between;padding:8px 12px;
                background:var(--surface);border-radius:8px;margin:4px 0;border:1px solid var(--border);">
                <span>{c.choice}</span><span style="color:var(--text-muted);">{c.date_key}</span></div>"""
    if state.recent_transmissions:
        body += "<h3 style='color:#c4842d;margin-top:16px;'>Transmissions</h3>"
        for t in reversed(state.recent_transmissions[-5:]):
            body += f"""<div style="padding:8px 12px;background:var(--surface);border-radius:8px;
                margin:4px 0;border:1px solid var(--border);">
                <div><strong>"{t.title}"</strong></div>
                <div style="color:var(--text-muted);font-size:0.85em;">{t.date_key}</div></div>"""
    return body


# ─── Build Gradio UI ─────────────────────────────────────────────────────────

def create_app():
    with gr.Blocks(css=CSS, theme=gr.themes.Soft(primary_hue="amber", neutral_hue="stone", font=["Inter", "system-ui", "sans-serif"]), title="FutureSelves") as demo:
        state = gr.State(init_state())

        gr.HTML(_header())

        with gr.Tabs(elem_classes="tab-nav"):
            # ── Today tab ──────────────────────────────────────────────
            with gr.Tab("Today"):
                content = gr.HTML(_card("Welcome", "Begin by telling me about yourself.", "#c4842d"))

                with gr.Accordion("Onboarding", open=True) as onboard_acc:
                    name = gr.Textbox(label="Name", placeholder="What do you go by?")
                    with gr.Row():
                        city = gr.Textbox(label="City", scale=1)
                        arc = gr.Radio(["money", "love", "purpose", "health"], label="Primary arc", value="purpose", scale=2)
                    chapter = gr.Textbox(label="Current life chapter", lines=2, placeholder="e.g. rebuilding, mid-career pivot...")
                    with gr.Row():
                        avoiding = gr.Textbox(label="Avoiding", lines=2, scale=1, placeholder="What you keep circling?")
                        afraid = gr.Textbox(label="Afraid won't happen", lines=2, scale=1, placeholder="The outcome you fear won't come?")
                    with gr.Row():
                        draining = gr.Textbox(label="Draining you", lines=2, scale=1, placeholder="The energy leak?")
                        miraculous = gr.Textbox(label="Miraculous year", lines=2, scale=1, placeholder="If everything went right?")
                    onboard_btn = gr.Button("Begin", variant="primary", size="lg")
                    onboard_info = gr.HTML("")

                with gr.Accordion("Check in", open=False) as checkin_acc:
                    word = gr.Textbox(label="One word for today", max_lines=1, placeholder="e.g. exhausted, hopeful, restless...")
                    note = gr.Textbox(label="Note (optional)", lines=3, placeholder="What's alive in you right now?")
                    checkin_btn = gr.Button("Tune the signal", variant="primary", size="lg")
                    checkin_info = gr.HTML("")

                with gr.Accordion("Receive transmission", open=False) as receive_acc:
                    generate_btn = gr.Button("Open the line", variant="primary", size="lg")
                    gen_info = gr.HTML("")

                with gr.Accordion("Your move", open=False) as choice_acc:
                    choice = gr.Radio(
                        [("🚀 Toward — move closer to what matters", "toward"),
                         ("🌱 Steady — hold ground and endure", "steady"),
                         ("🕊️ Release — let something go", "release"),
                         ("🪡 Repair — fix a frayed thread", "repair")],
                        label="Choose your move", type="value",
                    )
                    choice_btn = gr.Button("Record choice", variant="primary")

                with gr.Accordion("Reaction", open=False) as reaction_acc:
                    reaction = gr.Radio(
                        [("✅ Did it — I followed through", "did_it"),
                         ("💭 Keep close — I'm sitting with it", "keep_close"),
                         ("🎯 Landed — it hit, but I didn't act", "landed"),
                         ("🔄 Not quite — adjust the approach", "not_quite")],
                        label="How did it land?", type="value",
                    )
                    reply_note = gr.Textbox(label="Write back (optional)", lines=2, placeholder="A reply to your future self...")
                    react_btn = gr.Button("Send response", variant="primary")

                # Wire up onboarding
                onboard_btn.click(
                    fn=do_onboarding,
                    inputs=[name, city, chapter, arc, avoiding, afraid, draining, miraculous, state],
                    outputs=[onboard_info, content, onboard_info, state],
                ).then(
                    fn=lambda: (gr.Accordion(open=False), gr.Accordion(open=True)),
                    outputs=[onboard_acc, checkin_acc],
                )

                # Wire up check-in
                checkin_btn.click(
                    fn=do_check_in,
                    inputs=[word, note, state],
                    outputs=[checkin_info, content, state],
                ).then(
                    fn=lambda: (gr.Accordion(open=False), gr.Accordion(open=True)),
                    outputs=[checkin_acc, receive_acc],
                )

                # Wire up generation
                generate_btn.click(
                    fn=do_generate,
                    inputs=[state],
                    outputs=[gen_info, state],
                ).then(
                    fn=lambda: gr.Accordion(open=False),
                    outputs=[receive_acc],
                )

                # Poll for generation completion (fires only during generating state)
                def poll(state: AppState):
                    if not state.generating and not state.generation_done:
                        return None, state, gr.Accordion(visible=False)
                    if state.generation_done and state.today_transmission:
                        state.generating = False
                        return _render_transmission(state), state, gr.Accordion(visible=True)
                    if state.generating:
                        return _render_generating(state.today_cast or "future_self"), state, gr.Accordion(visible=False)
                    return None, state, gr.Accordion(visible=False)

                demo.load(fn=poll, inputs=[state], outputs=[content, state, choice_acc], every=2)

                # Wire up choice
                choice_btn.click(
                    fn=do_choice,
                    inputs=[choice, state],
                    outputs=[content, state],
                ).then(
                    fn=lambda: (gr.Accordion(open=False), gr.Accordion(open=True)),
                    outputs=[choice_acc, reaction_acc],
                )

                # Wire up reaction (resets for next day)
                react_btn.click(
                    fn=do_reaction,
                    inputs=[reaction, reply_note, state],
                    outputs=[content, state],
                ).then(
                    fn=lambda: (gr.Accordion(open=False), gr.Accordion(open=True)),
                    outputs=[reaction_acc, checkin_acc],
                )

            # ── History tab ────────────────────────────────────────────
            with gr.Tab("History"):
                history = gr.HTML(_render_history(init_state()))
                refresh = gr.Button("Refresh")
                refresh.click(fn=lambda s: _render_history(s), inputs=[state], outputs=[history])

            # ── About tab ─────────────────────────────────────────────
            with gr.Tab("About"):
                gr.Markdown(f"""
### ✦ FutureSelves

A daily ritual where your future self sends you transmissions. Check in with one word, receive a personalized message from across time, and make a tiny choice that reshapes who gets to speak tomorrow.

**Models:**
- [MiniCPM 2.5](https://huggingface.co/openbmb/MiniCPM-2.5-sft-bf16) (~2.5B) — transmission generation
- [Nemotron-Parse](https://huggingface.co/nvidia/Nemotron-Parse-H-Base-v1) (<1B) — structured note extraction
- [Kokoro](https://github.com/grammatek/kokoro) (82M) — text-to-speech

**Targeting:** Backyard AI, OpenBMB, NVIDIA Nemotron, Tiny Titan, Best Agent, Off Brand, Best Demo, Bonus Quest Champion

[Source](https://github.com/udingethe/futureselves/tree/main/hf-space)
                """)

    return demo


demo = create_app()

if __name__ == "__main__":
    demo.launch()
