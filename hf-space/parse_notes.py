"""
parse_notes.py — Nemotron Parse wrapper for structured extraction
from check-in notes.

Uses NVIDIA's Nemotron-Parse (<1B params) to extract emotions,
themes, entities, and sentiment from the player's daily check-in
note. This unlocks the NVIDIA Nemotron sponsor prize.

Because this runs in the same HF Space as MiniCPM (the main LLM),
we load Nemotron-Parse as a secondary model for structured extraction
only — not for generation. The model is tiny enough (<1B) that it
adds minimal GPU memory pressure alongside MiniCPM 2.5B.

Usage:
  from parse_notes import extract_note_insights
  insights = extract_note_insights("I'm exhausted from overworking")
  # -> { "sentiment": "negative", "emotions": ["exhaustion"],
  #      "themes": ["burnout", "work"], "entities": [] }

HF Space env config:
  Set NEMOTRON_PARSE_MODEL=nvidia/Nemotron-Parse-H-Base-v1
  (or omit for default)

See: https://huggingface.co/nvidia/Nemotron-Parse-H-Base-v1
"""

from __future__ import annotations

import json
import logging
import os
from dataclasses import dataclass, field
from typing import Optional

logger = logging.getLogger(__name__)

# ─── Types ────────────────────────────────────────────────────────────────────


@dataclass
class NoteInsights:
    sentiment: str  # positive | negative | neutral | mixed
    emotions: list[str] = field(default_factory=list)
    themes: list[str] = field(default_factory=list)
    entities: list[str] = field(default_factory=list)
    intensity: float = 0.0  # 0.0 to 1.0


# ─── Extraction via Nemotron-Parse ────────────────────────────────────────────

DEFAULT_MODEL = "nvidia/Nemotron-Parse-H-Base-v1"

_PIPELINE = None


def _get_pipeline():
    global _PIPELINE
    if _PIPELINE is None:
        import torch
        from transformers import AutoModelForCausalLM, AutoTokenizer

        model_name = os.environ.get(
            "NEMOTRON_PARSE_MODEL", DEFAULT_MODEL
        )
        logger.info("Loading Nemotron-Parse: %s", model_name)
        tokenizer = AutoTokenizer.from_pretrained(
            model_name, trust_remote_code=True
        )
        model = AutoModelForCausalLM.from_pretrained(
            model_name,
            trust_remote_code=True,
            torch_dtype=torch.float16,
            device_map="auto",
        )
        _PIPELINE = {"model": model, "tokenizer": tokenizer}
        logger.info("Nemotron-Parse loaded")
    return _PIPELINE["model"], _PIPELINE["tokenizer"]


_EXTRACTION_PROMPT = """\
Extract structured insights from this journal note.
Return valid JSON with these fields:
- "sentiment": "positive" | "negative" | "neutral" | "mixed"
- "emotions": list of emotion words present (e.g. ["anxiety", "hope"])
- "themes": list of thematic keywords (e.g. ["work", "relationships", "health"])
- "entities": list of specific people, places, or things mentioned
- "intensity": float 0.0 to 1.0 describing emotional intensity

Note: {note}

JSON:
"""


def extract_note_insights(note: str) -> Optional[NoteInsights]:
    if not note or not note.strip():
        return None

    try:
        model, tokenizer = _get_pipeline()
        prompt = _EXTRACTION_PROMPT.format(note=note.strip())

        inputs = tokenizer(prompt, return_tensors="pt")
        outputs = model.generate(
            **inputs,
            max_new_tokens=128,
            temperature=0.1,
            do_sample=False,
        )
        decoded = tokenizer.decode(
            outputs[0][inputs["input_ids"].shape[1]:],
            skip_special_tokens=True,
        ).strip()

        # Strip any trailing conversational fluff
        if "{" in decoded:
            decoded = decoded[decoded.index("{"):decoded.rindex("}")+1]

        data = json.loads(decoded)
        return NoteInsights(
            sentiment=data.get("sentiment", "neutral"),
            emotions=data.get("emotions", []),
            themes=data.get("themes", []),
            entities=data.get("entities", []),
            intensity=float(data.get("intensity", 0.0)),
        )
    except Exception as exc:
        logger.warning("Nemotron-Parse extraction failed: %s", exc)
        return None


# ─── Simple keyword fallback (no model needed) ───────────────────────────────


def _keyword_sentiment(note: str) -> str:
    negative_words = {
        "tired", "exhausted", "sad", "angry", "frustrated", "anxious",
        "worried", "scared", "alone", "stuck", "overwhelmed", "burnout",
    }
    positive_words = {
        "happy", "grateful", "hopeful", "excited", "proud", "peaceful",
        "joyful", "loved", "inspired", "motivated", "alive",
    }
    words = set(note.lower().split())
    pos = len(words & positive_words)
    neg = len(words & negative_words)
    if pos > neg:
        return "positive"
    if neg > pos:
        return "negative"
    if pos == 0 and neg == 0:
        return "neutral"
    return "mixed"


def fast_insights(note: str) -> Optional[NoteInsights]:
    if not note or not note.strip():
        return None
    return NoteInsights(
        sentiment=_keyword_sentiment(note),
        emotions=list({
            w for w in note.lower().split()
            if w in {
                "tired", "exhausted", "sad", "angry", "frustrated",
                "anxious", "worried", "scared", "happy", "grateful",
                "hopeful", "excited", "proud", "peaceful", "joyful",
                "loved", "inspired", "motivated", "alive", "hopeful",
            }
        }),
        themes=[],
        entities=[],
        intensity=0.5,
    )
