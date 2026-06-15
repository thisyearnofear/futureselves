"""
maya.py — Demo persona for the Build Small Space.

When a judge (or curious visitor) lands on the Space cold, the 5-step
onboarding flow is a real barrier between them and the product's magic.
This module gives them an escape hatch: one click loads a fully-formed
persona — Maya, a 28-year-old founder — with four days of past
transmissions, audio for each, and a transmission waiting for today.

The audio is pre-rendered with Piper TTS and lives in `audio/voices/`.
The text is also pre-written so judges see the product's voice range
immediately, not just whatever MiniCPM happens to produce on first
hit (when the model is still loading and the fallback gets used).

This is the "first 5 seconds" of the demo. It is the difference between
"this is a build I'm being shown" and "this is a product I have
actually used."

All content here is written for the demo, not generated. The MiniCPM
generation path is the real product; this is the showcase.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, timedelta

from transmission import (
    PersonaContext,
    GeneratedTransmission,
    RecentChoice,
    RecentResponse,
    RecentTransmission,
)


# ─── Persona ─────────────────────────────────────────────────────────────────


def make_maya() -> PersonaContext:
    """Maya — 28, Brooklyn, building first startup."""
    return PersonaContext(
        name="Maya",
        city="Brooklyn",
        current_chapter="Rebuilding my relationship with ambition",
        primary_arc="purpose",
        miraculous_year=(
            "Raising a seed round, finding a co-founder I trust, "
            "and shipping the v2 my users keep asking for"
        ),
        avoiding="Asking for help and naming the parts I am scared of",
        afraid_wont_happen="Product-market fit. The team I have been promised.",
        draining="The news. Slack before 9am. Sunday planning that becomes dread.",
        streak=4,
        timeline_divergence_score=3,
        toward_count=2,
        steady_count=1,
        release_count=0,
        repair_count=1,
        selected_voice_name="Ember",
        selected_voice_description="warm, intimate, certain",
    )


# ─── Past transmissions (4-day history) ─────────────────────────────────────


def maya_past_transmissions() -> list[RecentTransmission]:
    today = date.today()
    return [
        RecentTransmission(
            date_key=(today - timedelta(days=4)).isoformat(),
            title="You know which conversation you keep rescheduling",
            cliffhanger=(
                "Send it tomorrow and watch how quickly the silence around it "
                "changes shape."
            ),
            cast_member="shadow",
        ),
        RecentTransmission(
            date_key=(today - timedelta(days=3)).isoformat(),
            title="You are not behind. You are building.",
            cliffhanger=(
                "Tomorrow I can show you which part of your fear was bluffing, "
                "but only if you give me something concrete to point at."
            ),
            cast_member="future_mentor",
        ),
        RecentTransmission(
            date_key=(today - timedelta(days=2)).isoformat(),
            title="You are softer than the world taught you to be",
            cliffhanger=(
                "If you do it, tomorrow I can tell you what shifts in the line "
                "when you stop performing and start speaking."
            ),
            cast_member="future_partner",
        ),
        RecentTransmission(
            date_key=(today - timedelta(days=1)).isoformat(),
            title="The weight you are carrying is not all yours to carry",
            cliffhanger=(
                "Send it tomorrow and the line will tell you what it feels like "
                "to walk into next week without that weight."
            ),
            cast_member="future_self",
        ),
    ]


def maya_past_choices() -> list[RecentChoice]:
    today = date.today()
    return [
        RecentChoice(
            date_key=(today - timedelta(days=4)).isoformat(),
            choice="toward",
            prompt="Open the email you have been avoiding and write the actual reply, even if you save it as a draft.",
        ),
        RecentChoice(
            date_key=(today - timedelta(days=3)).isoformat(),
            choice="steady",
            prompt="Pick the task you have been postponing that creates the most resistance. Do it badly. Just finish it.",
        ),
        RecentChoice(
            date_key=(today - timedelta(days=2)).isoformat(),
            choice="repair",
            prompt="Say the one true sentence you have been editing before it leaves your mouth. Out loud. Tonight.",
        ),
        RecentChoice(
            date_key=(today - timedelta(days=1)).isoformat(),
            choice="toward",
            prompt="Identify the one piece of work that is actually someone else's job. Draft the message handing it over, even if you do not send it yet.",
        ),
    ]


def maya_past_responses() -> list[RecentResponse]:
    today = date.today()
    return [
        RecentResponse(reaction="did_it", reply_note="Sent the email. He replied in 9 minutes."),
        RecentResponse(reaction="landed", reply_note=None),
        RecentResponse(reaction="keep_close", reply_note="Wrote it down. Will say it to A. tomorrow."),
        RecentResponse(reaction="did_it", reply_note="Drafted the message. Reading it back now and it sounds like me."),
    ]


# ─── Today's transmission (what the demo button shows) ──────────────────────


def maya_today_transmission() -> GeneratedTransmission:
    return GeneratedTransmission(
        title="The threshold is a door, not a wall",
        text=(
            "Maya, today you wrote threshold. I have been waiting for this word from you. "
            "A threshold is not a wall. It is a door you have been standing in front of for "
            "weeks, and the cost of standing there is higher than the cost of walking through. "
            "You are in the chapter of rebuilding your relationship with ambition, and you "
            "are doing it well. But the next room requires one specific thing: the email "
            "you keep composing and deleting. The pitch you keep rehearsing. The conversation "
            "with your co-founder candidate that you keep scheduling for next week. "
            "Tonight, one concrete move. Send the thing. Not a thought about the thing. "
            "The thing. The future you are afraid will not happen is one sent message away "
            "from happening. You have done this before. Last Tuesday. Last Thursday. "
            "I am not asking you to become braver. I am asking you to do the ordinary brave "
            "thing you have already done four times this month."
        ),
        action_prompt=(
            "Send the one message you have been composing and deleting. "
            "Not a draft. The actual send. Before midnight."
        ),
        cliffhanger=(
            "Send it, and tomorrow the line will tell you what the next threshold is. "
            "There is always a next one. That is the deal."
        ),
    )


# ─── Full state factory ─────────────────────────────────────────────────────


@dataclass
class MayaDemoBundle:
    """Everything needed to populate the Space with Maya's history."""

    persona: PersonaContext
    past_transmissions: list[RecentTransmission]
    past_choices: list[RecentChoice]
    past_responses: list[RecentResponse]
    today_transmission: GeneratedTransmission
    today_cast: str
    today_audio_path: str
    check_in_word: str
    check_in_note: str


def build_maya_demo() -> MayaDemoBundle:
    """Assemble the full Maya demo state."""
    return MayaDemoBundle(
        persona=make_maya(),
        past_transmissions=maya_past_transmissions(),
        past_choices=maya_past_choices(),
        past_responses=maya_past_responses(),
        today_transmission=maya_today_transmission(),
        today_cast="future_self",
        today_audio_path="audio/voices/today-threshold.wav",
        check_in_word="threshold",
        check_in_note="Standing at the edge of something. Want to walk through it.",
    )
