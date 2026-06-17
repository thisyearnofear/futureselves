"""Unit tests for AppState methods — no Gradio, no heavy deps."""
from __future__ import annotations

import sys
from datetime import date
from unittest import TestCase, main
from unittest.mock import MagicMock

gr = MagicMock()
gr.Blocks = MagicMock
gr.HTML = MagicMock
gr.Button = MagicMock
gr.Textbox = MagicMock
gr.Radio = MagicMock
gr.Column = MagicMock
gr.Tab = MagicMock
gr.Tabs = MagicMock
gr.Markdown = MagicMock
gr.State = MagicMock
gr.BrowserState = MagicMock
gr.Timer = MagicMock
gr.update = MagicMock
gr.themes = MagicMock()
gr.themes.Base = MagicMock
gr.themes.Color = MagicMock
sys.modules["gradio"] = gr
sys.modules["gradio"].themes = gr.themes

from app import AppState
from transmission import PersonaContext


def _persona(**kw) -> PersonaContext:
    return PersonaContext(
        name=kw.get("name", "test"),
        city=kw.get("city", ""),
        current_chapter=kw.get("current_chapter", "a chapter"),
        primary_arc=kw.get("primary_arc", "purpose"),
        miraculous_year=kw.get("miraculous_year", "a good year"),
        avoiding=kw.get("avoiding", "something"),
        afraid_wont_happen=kw.get("afraid_wont_happen", "nothing"),
        draining=kw.get("draining", "nothing"),
        selected_voice_name=kw.get("selected_voice_name", "Ember"),
        selected_voice_description=kw.get("selected_voice_description", "warm"),
        streak=kw.get("streak", 0),
        toward_count=kw.get("toward_count", 0),
        steady_count=kw.get("steady_count", 0),
        release_count=kw.get("release_count", 0),
        repair_count=kw.get("repair_count", 0),
        timeline_divergence_score=kw.get("timeline_divergence_score", 0),
    )


class TestApplyCheckin(TestCase):
    def test_creates_default_persona(self):
        s = AppState()
        s.apply_checkin("restless", "a note")
        self.assertIsNotNone(s.persona)
        self.assertEqual(s.persona.name, "you")
        self.assertEqual(s.check_in_word, "restless")
        self.assertEqual(s.check_in_note, "a note")
        self.assertTrue(s.checked_in)

    def test_truncates_long_word(self):
        s = AppState(persona=_persona())
        s.apply_checkin("x" * 100, "")
        self.assertEqual(len(s.check_in_word), 40)

    def test_preserves_existing_persona(self):
        s = AppState(persona=_persona(name="Alice"))
        s.apply_checkin("hopeful", "")
        self.assertEqual(s.persona.name, "Alice")


class TestStartGeneration(TestCase):
    def test_sets_flags(self):
        s = AppState(persona=_persona())
        s.start_generation()
        self.assertTrue(s.generating)
        self.assertFalse(s.generation_done)
        self.assertEqual(s.today_audio, "")
        self.assertIsNone(s.today_transmission)
        self.assertIsNotNone(s.today_cast)


class TestRecordMemory(TestCase):
    def _setup(self) -> AppState:
        s = AppState(persona=_persona())
        s.today_cast = "future_self"
        s.today_transmission = type("T", (), {
            "title": "You are closer than you think", "text": "body",
            "action_prompt": "reach out", "cliffhanger": "something shifts",
        })()
        return s

    def test_appends_history(self):
        s = self._setup()
        s.record_memory("do_it", "great message")
        self.assertEqual(len(s.recent_transmissions), 1)
        self.assertEqual(s.recent_transmissions[0].title, "You are closer than you think")
        self.assertEqual(s.recent_choices[0].choice, "toward")
        self.assertEqual(s.recent_responses[0].reaction, "did_it")
        self.assertEqual(s.recent_responses[0].reply_note, "great message")
        self.assertEqual(s.persona.streak, 1)
        self.assertEqual(s.persona.toward_count, 1)

    def test_maps_keep_value(self):
        s = self._setup()
        s.record_memory("keep", "")
        self.assertEqual(s.recent_choices[0].choice, "steady")
        self.assertEqual(s.recent_responses[0].reaction, "keep_close")

    def test_maps_landed_value(self):
        s = self._setup()
        s.record_memory("landed", "")
        self.assertEqual(s.recent_choices[0].choice, "repair")
        self.assertEqual(s.recent_responses[0].reaction, "landed")

    def test_maps_not_quite_value(self):
        s = self._setup()
        s.record_memory("not_quite", "")
        self.assertEqual(s.recent_choices[0].choice, "release")
        self.assertEqual(s.recent_responses[0].reaction, "not_quite")

    def test_works_without_transmission(self):
        s = AppState(persona=_persona())
        s.record_memory("do_it", "")
        self.assertEqual(len(s.recent_transmissions), 0)
        self.assertEqual(s.recent_choices[0].choice, "toward")

    def test_resets_for_next_cycle(self):
        s = self._setup()
        s.checked_in = True
        s.generation_done = True
        s.choice_made = True
        s.check_in_word = "old"
        s.check_in_note = "old note"
        s.record_memory("do_it", "")
        self.assertFalse(s.checked_in)
        self.assertFalse(s.generation_done)
        self.assertFalse(s.choice_made)
        self.assertEqual(s.check_in_word, "")
        self.assertEqual(s.check_in_note, "")


if __name__ == "__main__":
    main()
