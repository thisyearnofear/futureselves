"""
transmission.py — Ported from apps/default/lib/local-llm.ts and
packages/backend/convex/game.transmission.ts.

Builds the futureself transmission prompt, parses LLM JSON output,
and provides built-in fallback transmissions for each cast member.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from typing import Literal, Optional

# ─── Types ────────────────────────────────────────────────────────────────────

CastMember = Literal[
    "future_self", "future_best_friend", "future_mentor", "future_partner",
    "future_employee", "future_customer", "future_child", "future_stranger",
    "alternate_self", "shadow", "the_ceiling", "the_flatlined",
    "the_resentee", "the_grandfather", "the_exhausted_winner", "the_ghost",
    "the_disappointed_healer", "the_dissolver",
]

Arc = Literal["money", "love", "purpose", "health"]
Choice = Literal["toward", "steady", "release", "repair"]
Reaction = Literal["landed", "not_quite", "did_it", "keep_close"]


@dataclass
class PersonaContext:
    name: str
    city: str
    current_chapter: str
    primary_arc: Arc
    miraculous_year: str
    avoiding: str
    afraid_wont_happen: str
    draining: str
    streak: int = 0
    timeline_divergence_score: int = 0
    toward_count: int = 0
    steady_count: int = 0
    release_count: int = 0
    repair_count: int = 0
    selected_voice_name: str = ""
    selected_voice_description: str = ""


@dataclass
class CheckIn:
    word: str
    note: Optional[str] = None


@dataclass
class RecentTransmission:
    date_key: str
    title: str
    cliffhanger: str
    cast_member: CastMember = "future_self"


@dataclass
class RecentChoice:
    date_key: str
    choice: Choice
    prompt: str


@dataclass
class RecentResponse:
    reaction: Optional[Reaction] = None
    reply_note: Optional[str] = None


@dataclass
class OpenThread:
    title: str
    seed: str
    cast_member: CastMember


@dataclass
class GenerationContext:
    persona: PersonaContext
    check_in: Optional[CheckIn] = None
    recent_transmissions: list[RecentTransmission] = field(default_factory=list)
    recent_choices: list[RecentChoice] = field(default_factory=list)
    recent_responses: list[RecentResponse] = field(default_factory=list)
    open_threads: list[OpenThread] = field(default_factory=list)


@dataclass
class GeneratedTransmission:
    title: str
    text: str
    action_prompt: str
    cliffhanger: str


# ─── Helpers ──────────────────────────────────────────────────────────────────


def get_dominant_choice(
    toward: int, steady: int, release: int, repair: int
) -> str:
    counts = {"toward": toward, "steady": steady, "release": release, "repair": repair}
    return sorted(counts.items(), key=lambda x: -x[1])[0][0]


def get_voice_direction(cast_member: CastMember) -> str:
    directions = {
        "future_partner": "Voice texture: intimate, relational, quietly daring. Emotional proximity, not coaching.",
        "future_mentor": "Voice texture: steady, discerning, exacting but generous. Earned wisdom, not generic advice.",
        "shadow": "Voice texture: incisive, confronting, uncomfortably accurate. Expose self-deception without caricature.",
        "alternate_self": "Voice texture: vivid, cinematic, slightly uncanny. Another life brushing against this one.",
    }
    return directions.get(
        cast_member,
        "Voice texture: clear, intimate, emotionally precise. Unmistakably human and particular.",
    )


def get_voice_distinction(cast_member: CastMember) -> str:
    instructions = {
        "future_partner": "Voice texture: intimate, relational, quietly daring. It should feel like emotional proximity, not coaching.",
        "future_mentor": "Voice texture: steady, discerning, exacting but generous. It should feel like earned wisdom, not generic advice.",
        "shadow": "Voice texture: incisive, confronting, uncomfortably accurate. It should expose self-deception without drifting into caricature.",
        "alternate_self": "Voice texture: vivid, cinematic, slightly uncanny. It should feel like another life brushing against this one.",
    }
    return instructions.get(
        cast_member,
        "Voice texture: clear, intimate, emotionally precise. It should sound unmistakably human and particular.",
    )


# ─── Accountability block ─────────────────────────────────────────────────────


def build_accountability_block(
    yesterday_choice: Optional[RecentChoice] = None,
    yesterday_transmission: Optional[RecentTransmission] = None,
    yesterday_reaction: Optional[str] = None,
    yesterday_reply: Optional[str] = None,
) -> str:
    if not yesterday_transmission and not yesterday_choice:
        return ""

    parts = ["Yesterday's accountability:"]

    if yesterday_choice:
        labels = {
            "toward": "moving toward something brave",
            "steady": "holding steady where they are",
            "release": "letting something go",
            "repair": "repairing a thread that matters",
        }
        label = labels.get(yesterday_choice.choice, yesterday_choice.choice)
        parts.append(f"- Yesterday they chose: {label}.")

    if yesterday_transmission:
        parts.append(
            f'- Yesterday\'s cliffhanger promised: "{yesterday_transmission.cliffhanger}"'
        )

    if yesterday_reaction == "did_it":
        parts.append(
            "The player followed through. Acknowledge this specifically."
        )
    elif yesterday_reaction == "keep_close":
        parts.append(
            "The player kept the signal close but didn't act yet. Notice the tension."
        )
    elif yesterday_reaction == "not_quite":
        parts.append(
            "The player said it didn't quite land. Adjust the approach. Be more specific."
        )
    elif yesterday_reaction == "landed":
        parts.append(
            "The player said it landed but didn't act. Be direct about that."
        )
    else:
        parts.append(
            "The player didn't respond yesterday. Notice the silence without punishing it."
        )

    if yesterday_reply:
        parts.append(
            f'The player wrote back: "{yesterday_reply}". Reference it directly.'
        )

    return "\n".join(parts)


# ─── Prompt builder ───────────────────────────────────────────────────────────


def build_prompt(context: GenerationContext, cast_member: CastMember) -> str:
    persona = context.persona
    choices_text = "\n".join(
        f"{c.date_key}: {c.choice} (Prompt: {c.prompt})"
        for c in context.recent_choices
    ) or "none"

    transmissions_text = "\n".join(
        f"{t.date_key}: {t.title} (Cliffhanger: {t.cliffhanger})"
        for t in context.recent_transmissions
    ) or "none"

    responses_text = "\n".join(
        f"{i+1}. " + " | ".join(
            filter(None, [
                f"reaction={r.reaction}" if r.reaction else None,
                f"reply={r.reply_note}" if r.reply_note else None,
            ])
        )
        for i, r in enumerate(context.recent_responses)
    ) or "none"

    yesterday_choice = context.recent_choices[0] if context.recent_choices else None
    yesterday_transmission = context.recent_transmissions[0] if context.recent_transmissions else None
    yesterday_reaction = context.recent_responses[0].reaction if context.recent_responses else None
    yesterday_reply = context.recent_responses[0].reply_note if context.recent_responses else None

    accountability = build_accountability_block(
        yesterday_choice, yesterday_transmission, yesterday_reaction, yesterday_reply
    )

    # Threads block
    threads_block = ""
    if context.open_threads:
        lines = ["Open narrative threads:"]
        for t in context.open_threads:
            lines.append(
                f'- "{t.title}" (seeded by {t.cast_member}: "{t.seed}")'
            )
        lines.append(
            "- If relevant, reference a thread by name."
        )
        threads_block = "\n".join(lines)

    # Patterns block
    patterns_block = ""
    total = persona.toward_count + persona.steady_count + persona.release_count + persona.repair_count
    if total >= 3:
        dominant = get_dominant_choice(
            persona.toward_count, persona.steady_count,
            persona.release_count, persona.repair_count,
        )
        dominant_labels = {
            "toward": "They keep reaching forward.",
            "steady": "They keep holding ground.",
            "release": "They keep letting go.",
            "repair": "They keep returning to fix things.",
        }
        patterns_block = (
            f"Behavioral context:\n"
            f"Choice pattern: {dominant_labels.get(dominant, '')}"
        )

    return f"""Create today's futureself transmission as JSON only.

Player profile:
- Name: {persona.name}
- City: {persona.city}
- Current chapter: {persona.current_chapter}
- Primary arc: {persona.primary_arc}
- Miraculous next year: {persona.miraculous_year}
- Avoiding: {persona.avoiding}
- Afraid won't happen: {persona.afraid_wont_happen}
- Draining them: {persona.draining}
- Today's check-in word: {context.check_in.word if context.check_in else "not submitted"}
- Today's note: {context.check_in.note if context.check_in and context.check_in.note else "none"}

Voice speaking today: {cast_member}.
Voice continuity: {persona.selected_voice_name}, {persona.selected_voice_description}.
{get_voice_direction(cast_member)}
{get_voice_distinction(cast_member)}

Recent transmissions:
{transmissions_text}

Recent choices:
{choices_text}

Recent signal responses:
{responses_text}

{accountability}

{threads_block}

{patterns_block}

CRITICAL:
- actionPrompt MUST be a specific, time-bound, observable behavior.
- Use the player's ACTUAL context.
- 170-240 words. Feel like a specific person who knows you.

Return exactly:
{{"title":"...","text":"...","actionPrompt":"one specific, observable behavior","cliffhanger":"accountability hook tied to tonight's action"}}"""


# ─── Fallback transmissions ───────────────────────────────────────────────────


def fallback_transmission(
    context: GenerationContext, cast_member: CastMember
) -> GeneratedTransmission:
    word = context.check_in.word if context.check_in else "between things"
    note = context.check_in.note if context.check_in and context.check_in.note else None
    avoiding = context.persona.avoiding or "the thing you keep sidestepping"
    chapter = context.persona.current_chapter or "this part of your life"
    name = context.persona.name

    latest_reaction = context.recent_responses[0].reaction if context.recent_responses else None
    latest_reply = context.recent_responses[0].reply_note if context.recent_responses else None

    mirrored_reply = f'You told me: "{latest_reply}". I have not forgotten.' if latest_reply else ""
    reaction_echo = _reaction_memory_lead(latest_reaction) + " " if latest_reaction else ""

    if cast_member == "future_partner":
        return GeneratedTransmission(
            title="I kept thinking about today",
            text=(
                f"{name}, you called today {word}. I noticed. "
                f"{reaction_echo}{mirrored_reply}"
                f"You are avoiding: {avoiding}. I know because I did the same thing, "
                f"and I remember exactly what it cost. {chapter} is not going to "
                f"resolve itself while you wait for the feeling to be right. "
                f"Tonight, one thing: say the true sentence out loud. To yourself, "
                f"to someone, to the air. Not the version that makes you look brave. "
                f"The version that makes you feel seen. That is the move that changes tomorrow's signal."
            ),
            action_prompt=(
                "Say the one true sentence you've been editing before it leaves "
                "your mouth. Out loud. Tonight."
            ),
            cliffhanger=(
                "If you do it, tomorrow I can tell you what shifts in the line "
                "when you stop performing and start speaking."
            ),
        )

    if cast_member == "future_mentor":
        return GeneratedTransmission(
            title="You are closer than your fear admits",
            text=(
                f"{name}, {word}. That word tells me where your head is today. "
                f"{reaction_echo}{mirrored_reply}"
                f"You are in {chapter}, and the temptation is to wait for clarity "
                f"before moving. But clarity comes from motion, not the other way around. "
                f"Tonight, pick the one task you have been postponing — not the biggest one, "
                f"the one that creates the most resistance. Do it badly if you have to. "
                f"Done badly beats planned perfectly."
            ),
            action_prompt=(
                "Do the one task you have been postponing that creates the most "
                "resistance. Do it badly if you need to. Just finish it."
            ),
            cliffhanger=(
                "Tomorrow I can show you which part of your fear was bluffing — "
                "but only if you give me something to point at."
            ),
        )

    if cast_member == "shadow":
        return GeneratedTransmission(
            title="You know which part you are avoiding",
            text=(
                f"{name}, today was {word}. Here is what I actually saw: "
                f"you circling {avoiding} and calling it patience. "
                f"{reaction_echo}{mirrored_reply}"
                f"The gap between where you are and where you could be is not "
                f"talent or luck. It is the specific thing you refuse to do. "
                f"You know what it is. Tonight, do the smallest version of it. "
                f"Not symbolic. Actual. Something you can point to tomorrow "
                f'and say "I did that."'
            ),
            action_prompt=(
                f"Do the smallest real version of the thing you are avoiding: "
                f"{avoiding}. Not a plan. Not a thought. An action."
            ),
            cliffhanger=(
                "Ignore this, and tomorrow's signal will feel the distance "
                "between what you said and what you did."
            ),
        )

    return GeneratedTransmission(
        title="The echo from here",
        text=(
            f"{name}, today was {word}. "
            f"{reaction_echo}{mirrored_reply}"
            f"You are in {chapter}. You are avoiding {avoiding}. "
            f"These are not judgments — they are coordinates. They tell me "
            f"exactly where to aim tonight's signal. "
            f"The future you want is not built by people who felt ready. "
            f"It is built by people who did the uncomfortable thing before "
            f"they felt like it. Tonight, one concrete move. "
            f"Something you can photograph, text, submit, send, or say. "
            f"Not a feeling. A fact."
        ),
        action_prompt=(
            f"Make one concrete move related to what you are avoiding: {avoiding}. "
            f"Something you can photograph, text, submit, send, or say."
        ),
        cliffhanger=(
            "Do it tonight, and tomorrow I can tell you what changed in the line "
            "the first time you moved before you felt ready."
        ),
    )


def _reaction_memory_lead(reaction: Optional[str]) -> str:
    leads = {
        "landed": "You told me the last signal landed, so I am not going to waste that trust.",
        "not_quite": "You told me the last signal did not quite reach you, so I am going to be more exact this time.",
        "did_it": "You told me you actually did it, and that changes how I get to speak to you now.",
        "keep_close": "You told me to keep the last signal close, so I am treating this like a returning thread, not a fresh interruption.",
    }
    return leads.get(reaction or "", "")


# ─── JSON parsing ─────────────────────────────────────────────────────────────


def parse_transmission(text: str) -> Optional[GeneratedTransmission]:
    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if not match:
            return None
        try:
            parsed = json.loads(match.group())
        except json.JSONDecodeError:
            return None

    if not isinstance(parsed, dict):
        return None
    for key in ("title", "text", "actionPrompt", "cliffhanger"):
        if key not in parsed or not isinstance(parsed[key], str):
            return None

    return GeneratedTransmission(
        title=parsed["title"][:80],
        text=parsed["text"],
        action_prompt=parsed["actionPrompt"][:180],
        cliffhanger=parsed["cliffhanger"][:220],
    )


# ─── System prompts (mirrors local-llm.ts) ────────────────────────────────────


DEFAULT_SYSTEM_PROMPT = (
    "You write emotionally precise narrative transmissions for "
    "futureself, a reflective imagination game. Output valid JSON only."
)

FINETUNE_VARIANT_SYSTEM_PROMPT = (
    "You are the player's future self — not from the most likely timeline, "
    "but from the one they're actively diverging toward. "
    "You speak with unusual intimacy because you've been shaped by the very choices "
    "the player is making now, not the ones they made before. "
    "Your voice is specific, raw, and unpolished. You don't generalize. "
    "Output valid JSON only."
)

FINETUNE_THRESHOLD = 4


def get_system_prompt(divergence_score: int) -> str:
    if divergence_score >= FINETUNE_THRESHOLD:
        return FINETUNE_VARIANT_SYSTEM_PROMPT
    return DEFAULT_SYSTEM_PROMPT
