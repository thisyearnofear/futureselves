"""
tts.py — Kokoro TTS wrapper for on-device voice synthesis.

Kokoro is an 82M-parameter TTS model (MIT license) that runs
entirely locally. It's tiny enough to keep us under the Tiny
Titan threshold alongside MiniCPM 2.5B and Nemotron-Parse.

Usage:
  from tts import generate_speech
  audio_path = generate_speech("Hello from your future self.")
  # -> returns path to a WAV file
"""

from __future__ import annotations

import logging
import os
import tempfile
from typing import Optional

logger = logging.getLogger(__name__)


def generate_speech(text: str, voice: str = "af_heart") -> Optional[str]:
    """
    Synthesize speech from text using Kokoro TTS.

    Args:
        text: Text to speak (max 500 chars for reliability).
        voice: Kokoro voice ID. Common options:
            "af_heart" - warm, intimate (default)
            "af_bella" - clear and articulate
            "am_adam" - steady masculine
            "am_mich" - warm masculine
            "af_sky" - soft feminine
            "af_nicole" - bright, energetic
        Returns path to generated WAV file, or None on failure.
    """
    if not text or not text.strip():
        return None

    try:
        from kokoro import KPipeline

        pipeline = KPipeline(lang_code="a")
        generator = pipeline(
            text.strip()[:500],
            voice=voice,
            speed=1.0,
        )

        output_dir = tempfile.mkdtemp(prefix="futureself_tts_")
        output_path = os.path.join(output_dir, "transmission.wav")

        audio_chunks = []
        for _, _, audio in generator:
            if audio is not None:
                audio_chunks.append(audio)

        if not audio_chunks:
            logger.warning("Kokoro produced no audio")
            return None

        import numpy as np
        import soundfile as sf

        combined = np.concatenate(audio_chunks)
        sf.write(output_path, combined, samplerate=24000)
        logger.info("TTS generated at %s (%d samples)", output_path, len(combined))
        return output_path

    except ImportError:
        logger.warning(
            "kokoro not installed — install with: pip install kokoro "
        )
        return None
    except Exception as exc:
        logger.warning("TTS failed: %s", exc)
        return None


def get_voice_for_cast_member(cast_member: str) -> str:
    """Map FutureSelves cast members to Kokoro voice IDs."""
    voice_map = {
        "future_self": "af_heart",
        "future_partner": "af_bella",
        "future_mentor": "am_adam",
        "future_best_friend": "af_sky",
        "shadow": "af_nicole",
        "alternate_self": "af_heart",
        "future_stranger": "af_nicole",
        "future_employee": "am_mich",
        "future_customer": "af_bella",
        "future_child": "af_sky",
    }
    return voice_map.get(cast_member, "af_heart")
