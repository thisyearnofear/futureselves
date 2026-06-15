"""
form_helpers.py — example phrases and warmup text for the onboarding form.

This module exists to kill the blank-page feeling. Every Textbox in the
onboarding form gets:
  1. A rich, in-voice placeholder
  2. A row of 3-4 example chips below it (click to populate)
  3. A short primer line above the form setting emotional tone

The example phrases are deliberately specific (not generic), span
multiple life arcs (not just "founder"), and are written in the
FutureSelves voice. They are starting points the user can edit, not
prescriptions.

The choice and reaction radios also get subtitles so the user can
tell what each option means without hovering or guessing.
"""

from __future__ import annotations

from typing import Optional


# ─── In-voice placeholders ──────────────────────────────────────────────────
# These appear inside the empty textbox as italic guidance. They are
# the FIRST thing the user reads, so they have to set the right tone:
# intimate, specific, evocative — not "Enter your avoiding item here."

PLACEHOLDERS = {
    "name": "What should I call you?",
    "city": "Where are you right now? (or skip — it's optional)",
    "chapter": "A sentence or two. The chapter you're in, not the chapter you wish you were in.",
    "avoiding": "The thing you keep circling. Not the thing you're already doing — the thing you're not doing.",
    "afraid": "The thing that wakes you at 3am. The future you don't want to find out about.",
    "draining": "The energy leak. The thing that costs you and gives you nothing back.",
    "miraculous": "The version of next year that would feel like a miracle. Be specific. 'Everything works out' is not a miracle — it's a wish.",
    "word": "One word. The one that fits. Not the polite one.",
    "note": "What's alive in you right now? A sentence is enough. Three is plenty.",
    "reply": "What landed. What didn't. The sentence you want your future self to hear next time.",
}


# ─── Example chips ──────────────────────────────────────────────────────────
# Click any of these to populate the field. The user can edit afterward.
# The chips are deliberately a mix of life arcs (work, love, health,
# creativity, parenting) so the user sees themselves reflected.

EXAMPLES = {
    "avoiding": [
        "the email I keep composing and deleting",
        "asking for help with the part I'm scared of",
        "the conversation I keep rescheduling",
        "the call I owe someone I love",
        "the doctor's appointment I cancelled twice",
    ],
    "afraid": [
        "the launch I've been promising",
        "the team I keep telling myself I'll find",
        "the version of me that ships the thing",
        "the people I'm losing to my own silence",
        "the year I keep pushing to next year",
    ],
    "draining": [
        "the news after 9pm",
        "the Sunday plan that becomes dread",
        "the meeting that should have been an email",
        "pretending I'm fine",
        "the open tabs I never close",
    ],
    "miraculous": [
        "a co-founder who fits",
        "shipping v2 before Q3",
        "a quiet life with the people I love",
        "my body feeling like mine again",
        "the book I've been saying I'll write",
        "being the parent I want to be",
    ],
    "note": [
        "I keep reaching for the same thing and pulling back",
        "something happened today and I don't know what to do with it",
        "I am tired in a way sleep doesn't fix",
        "I want to remember this exact feeling",
        "I almost said the true thing. Almost.",
    ],
    "reply": [
        "It landed. Especially the part about tonight.",
        "Not quite. I need it shorter, more concrete.",
        "I did it. The reply is sent.",
        "Holding this for tomorrow. Not ready yet.",
    ],
}


# ─── Choice subtitles ───────────────────────────────────────────────────────
# Each choice in the radio gets a longer description so the user knows
# what they're picking. The first part is the short label; the second
# part is the meaning.

CHOICE_OPTIONS = [
    ("🚀 Toward", "toward", "moving toward something brave"),
    ("🌱 Steady", "steady", "holding ground where I am"),
    ("🕊️ Release", "release", "letting something go"),
    ("🪡 Repair", "repair", "mending a frayed thread"),
]


REACTION_OPTIONS = [
    ("✓ Did it", "did_it", "I did the thing"),
    ("✋ Keep close", "keep_close", "holding this for later"),
    ("✦ Landed", "landed", "it landed but I haven't acted"),
    ("↺ Not quite", "not_quite", "didn't quite reach me"),
]


ARC_OPTIONS = [
    ("💰 Money", "money", "building wealth, stability, freedom"),
    ("💜 Love", "love", "relationships, family, connection"),
    ("🧭 Purpose", "purpose", "mission, craft, impact"),
    ("🌱 Health", "health", "body, mind, energy, rest"),
]

# Map arc value to emoji for dynamic headings
ARC_EMOJI = {
    "money": "💰",
    "love": "💜",
    "purpose": "🧭",
    "health": "🌱",
}

# Voice emoji mapping for step 1 heading
VOICE_EMOJI = {
    "Ember": "🔥",
    "Nova": "✨",
    "Sol": "☀️",
    "River": "🌊",
    "Stone": "🪨",
    "Wind": "💨",
}


# ─── Primer / warmup copy ──────────────────────────────────────────────────
# Appears above the onboarding form. Sets the emotional tone before
# the user is asked to write. The product is a private conversation,
# not a database form.

PRIMER_HTML = (
    '<div class="onboard-primer">'
    '<div class="primer-eyebrow">— before the line opens —</div>'
    '<div class="primer-line">A few questions so the future can find you. '
    'A sentence is enough. A few words is plenty. You can always come back.</div>'
    '</div>'
)


# ─── Atmospheric button text ────────────────────────────────────────────────
# Replace cold default button text with copy that matches the chamber.

BUTTON_TEXT = {
    "step1_next": "Tune in →",
    "step2_next": "Continue →",
    "step3_begin": "✦ Open the line",
    "checkin_submit": "Tune the signal →",
    "generate": "Open the line",
    "choice_submit": "Record the move",
    "reaction_submit": "Send it back",
}


def chip_html(examples: list[str], field_id: str) -> str:
    """Render example chips as HTML for embedding in a Gradio layout.

    Each chip is a small button that, when clicked, populates the
    matching textbox via a global JS handler. We use HTML rather
    than a row of gr.Button components because (a) it's lighter
    visually and (b) the chips are presentation, not actions that
    need their own event chain.

    The JS handler dispatches a CustomEvent on the document that
    the Gradio form listens for. See app.py for the listener.

    Format: a flex row of small italic mono chips with paper-mute
    color, amber on hover, wrapping.
    """
    chips = "".join(
        f'<button type="button" class="ex-chip" data-field="{field_id}" data-value="{ex}">{ex}</button>'
        for ex in examples
    )
    return f'<div class="ex-chip-row" data-field="{field_id}">{chips}</div>'


def _word_chips_html() -> str:
    """Render example word chips (one-word prompts).

    These are shown above the check-in note field so the user has
    a concrete starting point. Each chip populates the word textbox.
    """
    words = ["restless", "hopeful", "tired", "open", "scattered", "still"]
    chips = "".join(
        f'<button type="button" class="ex-chip" data-field="field-word" data-value="{w}">{w}</button>'
        for w in words
    )
    return f'<div class="ex-chip-row" data-field="field-word">{chips}</div>'


def _choice_cards_html(selected: str = "toward") -> str:
    """Render 4 choice cards for the 'Your move' moment.

    Each card is clickable, shows emoji + label + meaning, and
    triggers a JavaScript handler that sets the hidden radio value.
    The selected card gets an .active class.
    """
    cards_data = CHOICE_OPTIONS
    items = []
    for emoji_label, value, subtitle in cards_data:
        cls = "choice-card active" if value == selected else "choice-card"
        items.append(
            f'<button type="button" class="{cls}" data-value="{value}">'
            f'<span class="card-emoji">{emoji_label.split()[0]}</span>'
            f'<span class="card-label">{" ".join(emoji_label.split()[1:])}</span>'
            f'<span class="card-sub">{subtitle}</span>'
            f'</button>'
        )
    return f'<div class="card-grid choice-grid">{"".join(items)}</div>'


def _reaction_cards_html(selected: str = "landed") -> str:
    """Render 4 reaction cards for the 'How did it land?' moment.

    Same visual as choice cards but with different copy and values.
    """
    cards_data = REACTION_OPTIONS
    items = []
    for emoji_label, value, subtitle in cards_data:
        cls = "reaction-card active" if value == selected else "reaction-card"
        items.append(
            f'<button type="button" class="{cls}" data-value="{value}">'
            f'<span class="card-emoji">{emoji_label.split()[0]}</span>'
            f'<span class="card-label">{" ".join(emoji_label.split()[1:])}</span>'
            f'<span class="card-sub">{subtitle}</span>'
            f'</button>'
        )
    return f'<div class="card-grid reaction-grid">{"".join(items)}</div>'


def _arc_cards_html(selected: str = "purpose") -> str:
    """Render 4 arc selection cards for Step 2 of onboarding.

    Each card is clickable, shows emoji + arc name + description, and
    triggers a JavaScript handler that sets the hidden radio value.
    The selected card gets an .active class.
    """
    cards_data = ARC_OPTIONS
    items = []
    for emoji_label, value, subtitle in cards_data:
        cls = "arc-card active" if value == selected else "arc-card"
        items.append(
            f'<button type="button" class="{cls}" data-value="{value}">'
            f'<span class="card-emoji">{emoji_label.split()[0]}</span>'
            f'<span class="card-label">{" ".join(emoji_label.split()[1:])}</span>'
            f'<span class="card-sub">{subtitle}</span>'
            f'</button>'
        )
    return f'<div class="card-grid arc-grid">{"".join(items)}</div>'
