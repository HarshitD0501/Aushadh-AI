"""Unit tests for the A2 audio pipeline (Groq STT, Murf Falcon TTS, FallbackAdapter, LatencyTracker)."""

from __future__ import annotations

import unittest
from unittest.mock import MagicMock, patch

from livekit.agents import EndpointingOptions, InterruptionOptions, TurnHandlingOptions, tts
from livekit.plugins import groq, murf

from aushadh_voice.audio import (
    LatencyTracker,
    build_groq_stt,
    build_murf_tts,
    build_tts_pipeline,
    build_turn_handling,
)
from aushadh_voice.config import Settings


def make_settings(**overrides: str) -> Settings:
    values = {
        "LIVEKIT_URL": "wss://test.livekit.cloud",
        "LIVEKIT_API_KEY": "test-key",
        "LIVEKIT_API_SECRET": "test-secret",
        "BACKEND_PRIVATE_URL": "https://backend.example",
        "AGENT_BACKEND_TOKEN": "test-token",
        "GROQ_API_KEY": "test-groq-key",
        "MURF_API_KEY": "test-murf-key",
    }
    values.update(overrides)
    return Settings.from_env(values)


class AudioConfigTests(unittest.TestCase):
    def test_missing_murf_api_key_raises_error(self) -> None:
        values = {
            "LIVEKIT_URL": "wss://test.livekit.cloud",
            "LIVEKIT_API_KEY": "test-key",
            "LIVEKIT_API_SECRET": "test-secret",
            "BACKEND_PRIVATE_URL": "https://backend.example",
            "AGENT_BACKEND_TOKEN": "test-token",
            "GROQ_API_KEY": "test-groq-key",
            "MURF_API_KEY": "",
        }
        with self.assertRaisesRegex(ValueError, "MURF_API_KEY"):
            Settings.from_env(values)

    def test_default_audio_settings(self) -> None:
        s = make_settings()
        self.assertEqual(s.murf_voice_id_hi, "hi-IN-shweta")
        self.assertEqual(s.murf_voice_id_en, "en-US-natalie")
        self.assertEqual(s.groq_stt_model, "whisper-large-v3-turbo")

    def test_custom_audio_settings(self) -> None:
        s = make_settings(
            MURF_VOICE_ID_HI="hi-IN-kabir",
            MURF_VOICE_ID_EN="en-US-carter",
            GROQ_STT_MODEL="whisper-large-v3",
        )
        self.assertEqual(s.murf_voice_id_hi, "hi-IN-kabir")
        self.assertEqual(s.murf_voice_id_en, "en-US-carter")
        self.assertEqual(s.groq_stt_model, "whisper-large-v3")

    def test_invalid_voice_id_rejected(self) -> None:
        with self.assertRaisesRegex(ValueError, "MURF_VOICE_ID_HI"):
            make_settings(MURF_VOICE_ID_HI="invalid voice!@#")


class AudioFactoryTests(unittest.TestCase):
    def test_build_groq_stt_configures_model_and_language(self) -> None:
        s = make_settings(GROQ_STT_MODEL="whisper-large-v3-turbo")
        stt_dynamic = build_groq_stt(s, detect_language=True)
        self.assertIsInstance(stt_dynamic, groq.STT)
        self.assertEqual(stt_dynamic._opts.model, "whisper-large-v3-turbo")
        self.assertTrue(stt_dynamic._opts.detect_language)

        stt_fixed = build_groq_stt(s, language="hi", detect_language=False)
        self.assertEqual(stt_fixed._opts.languages, ["hi"])
        self.assertFalse(stt_fixed._opts.detect_language)

    def test_build_murf_tts_configures_falcon_model_and_voice(self) -> None:
        s = make_settings(MURF_VOICE_ID_HI="hi-IN-shweta")
        tts_instance = build_murf_tts(s)
        self.assertIsInstance(tts_instance, murf.TTS)
        self.assertEqual(tts_instance._opts.model, "FALCON")
        self.assertEqual(tts_instance._opts.voice, "hi-IN-shweta")

    def test_build_murf_tts_explicit_voice_override(self) -> None:
        s = make_settings()
        tts_instance = build_murf_tts(s, voice="en-US-natalie")
        self.assertEqual(tts_instance._opts.voice, "en-US-natalie")

    def test_build_tts_pipeline_uses_fallback_adapter(self) -> None:
        s = make_settings()
        pipeline = build_tts_pipeline(s)
        self.assertIsInstance(pipeline, tts.FallbackAdapter)
        self.assertEqual(len(pipeline._tts_instances), 2)
        primary, fallback = pipeline._tts_instances
        self.assertEqual(primary._opts.voice, "hi-IN-shweta")
        self.assertEqual(fallback._opts.voice, "en-US-natalie")

    def test_build_turn_handling_options(self) -> None:
        th = build_turn_handling()
        self.assertEqual(th["endpointing"]["min_delay"], 0.5)
        self.assertEqual(th["endpointing"]["max_delay"], 3.0)
        self.assertEqual(th["endpointing"]["mode"], "dynamic")
        self.assertTrue(th["interruption"]["enabled"])
        self.assertEqual(th["interruption"]["min_duration"], 0.3)
        self.assertEqual(th["interruption"]["min_words"], 1)


class LatencyTrackerTests(unittest.TestCase):
    def test_empty_tracker_returns_none_summary(self) -> None:
        tracker = LatencyTracker()
        self.assertEqual(tracker.count, 0)
        self.assertIsNone(tracker.median_ms)
        self.assertIsNone(tracker.p90_ms)
        self.assertIsNone(tracker.max_ms)
        summary = tracker.summary()
        self.assertEqual(summary["samples"], 0)
        self.assertIsNone(summary["median_ms"])

    def test_tracker_calculates_median_p90_max(self) -> None:
        tracker = LatencyTracker()
        for sample in [100.0, 200.0, 300.0, 400.0, 500.0]:
            tracker.record(sample)
        self.assertEqual(tracker.count, 5)
        self.assertEqual(tracker.median_ms, 300.0)
        self.assertEqual(tracker.p90_ms, 400.0)
        self.assertEqual(tracker.max_ms, 500.0)
        summary = tracker.summary()
        self.assertEqual(summary["samples"], 5)
        self.assertEqual(summary["median_ms"], 300.0)
        self.assertEqual(summary["max_ms"], 500.0)

    def test_tracker_ignores_negative_values(self) -> None:
        tracker = LatencyTracker()
        tracker.record(-50.0)
        self.assertEqual(tracker.count, 0)


if __name__ == "__main__":
    unittest.main()
