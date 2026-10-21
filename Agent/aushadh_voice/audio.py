"""Bilingual audio transport pipeline: Groq multilingual STT and Murf Falcon TTS."""

from __future__ import annotations

import logging
from typing import Sequence

from livekit.agents import (
    EndpointingOptions,
    InterruptionOptions,
    TurnHandlingOptions,
    stt,
    tts,
)
from livekit.plugins import groq, murf

from aushadh_voice.config import Settings

logger = logging.getLogger(__name__)


def build_groq_stt(
    settings: Settings,
    *,
    language: str = "en",
    detect_language: bool = True,
) -> stt.STT:
    """Build Groq Whisper speech-to-text with bilingual/multilingual detection."""
    return groq.STT(
        model=settings.groq_stt_model,
        api_key=settings.groq_api_key,
        language=language,
        detect_language=detect_language,
    )


def build_murf_tts(
    settings: Settings,
    *,
    voice: str | None = None,
) -> tts.TTS:
    """Build Murf Falcon TTS with verified voice ID."""
    selected_voice = voice or settings.murf_voice_id_hi
    return murf.TTS(
        api_key=settings.murf_api_key,
        model="FALCON",
        voice=selected_voice,
    )


def build_tts_pipeline(
    settings: Settings,
    *,
    primary_voice: str | None = None,
    fallback_voice: str | None = None,
) -> tts.TTS:
    """Build resilient TTS pipeline with Murf Falcon and fallback adapter."""
    primary = build_murf_tts(settings, voice=primary_voice or settings.murf_voice_id_hi)
    fallback = build_murf_tts(settings, voice=fallback_voice or settings.murf_voice_id_en)
    return tts.FallbackAdapter([primary, fallback], max_retry_per_tts=2)


def build_turn_handling(
    *,
    min_endpointing_delay: float = 0.5,
    max_endpointing_delay: float = 3.0,
    min_interruption_duration: float = 0.3,
    min_interruption_words: int = 1,
) -> TurnHandlingOptions:
    """Configure turn handling with tuned endpointing and interruption (barge-in)."""
    return TurnHandlingOptions(
        endpointing=EndpointingOptions(
            mode="dynamic",
            min_delay=min_endpointing_delay,
            max_delay=max_endpointing_delay,
        ),
        interruption=InterruptionOptions(
            enabled=True,
            mode="adaptive",
            min_duration=min_interruption_duration,
            min_words=min_interruption_words,
        ),
    )


class LatencyTracker:
    """Track turn-by-turn latency metrics from user speech end to first agent audio."""

    def __init__(self) -> None:
        self._latencies_ms: list[float] = []

    def record(self, latency_ms: float) -> None:
        if latency_ms >= 0:
            self._latencies_ms.append(latency_ms)

    @property
    def count(self) -> int:
        return len(self._latencies_ms)

    @property
    def median_ms(self) -> float | None:
        if not self._latencies_ms:
            return None
        sorted_vals = sorted(self._latencies_ms)
        n = len(sorted_vals)
        mid = n // 2
        if n % 2 == 1:
            return sorted_vals[mid]
        return (sorted_vals[mid - 1] + sorted_vals[mid]) / 2.0

    @property
    def p90_ms(self) -> float | None:
        if not self._latencies_ms:
            return None
        sorted_vals = sorted(self._latencies_ms)
        idx = int(0.9 * (len(sorted_vals) - 1))
        return sorted_vals[idx]

    @property
    def max_ms(self) -> float | None:
        return max(self._latencies_ms) if self._latencies_ms else None

    def summary(self) -> dict[str, float | int | None]:
        return {
            "samples": self.count,
            "median_ms": round(self.median_ms, 1) if self.median_ms is not None else None,
            "p90_ms": round(self.p90_ms, 1) if self.p90_ms is not None else None,
            "max_ms": round(self.max_ms, 1) if self.max_ms is not None else None,
        }
