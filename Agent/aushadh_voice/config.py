"""Validated, server-only worker configuration."""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Mapping
from urllib.parse import urlsplit


@dataclass(frozen=True)
class Settings:
    livekit_url: str
    livekit_api_key: str
    livekit_api_secret: str
    backend_private_url: str
    agent_backend_token: str
    agent_name: str
    groq_api_key: str
    groq_voice_model: str

    @classmethod
    def from_env(cls, env: Mapping[str, str] | None = None) -> Settings:
        values = os.environ if env is None else env
        required = (
            "LIVEKIT_URL",
            "LIVEKIT_API_KEY",
            "LIVEKIT_API_SECRET",
            "BACKEND_PRIVATE_URL",
            "AGENT_BACKEND_TOKEN",
            "GROQ_API_KEY",
        )
        missing = [name for name in required if not values.get(name, "").strip()]
        if missing:
            raise ValueError("Missing required settings: " + ", ".join(missing))

        livekit_url = values["LIVEKIT_URL"].strip().rstrip("/")
        backend_url = values["BACKEND_PRIVATE_URL"].strip().rstrip("/")
        _validate_url("LIVEKIT_URL", livekit_url, secure_scheme="wss", local_scheme="ws")
        _validate_url("BACKEND_PRIVATE_URL", backend_url, secure_scheme="https", local_scheme="http")

        agent_name = values.get("LIVEKIT_AGENT_NAME", "aushadh-voice").strip()
        if not agent_name or len(agent_name) > 64 or not all(c.isalnum() or c in "-_" for c in agent_name):
            raise ValueError("LIVEKIT_AGENT_NAME must be a short alphanumeric name")

        groq_model = values.get("GROQ_VOICE_MODEL", "").strip() or "llama-3.3-70b-versatile"
        if len(groq_model) > 128 or not all(c.isalnum() or c in "-_/." for c in groq_model):
            raise ValueError("GROQ_VOICE_MODEL must be a model identifier")

        return cls(
            livekit_url=livekit_url,
            livekit_api_key=values["LIVEKIT_API_KEY"].strip(),
            livekit_api_secret=values["LIVEKIT_API_SECRET"].strip(),
            backend_private_url=backend_url,
            agent_backend_token=values["AGENT_BACKEND_TOKEN"].strip(),
            agent_name=agent_name,
            groq_api_key=values["GROQ_API_KEY"].strip(),
            groq_voice_model=groq_model,
        )


def _validate_url(name: str, value: str, *, secure_scheme: str, local_scheme: str) -> None:
    parsed = urlsplit(value)
    local = parsed.hostname in {"localhost", "127.0.0.1", "::1"}
    valid_scheme = parsed.scheme == secure_scheme or (local and parsed.scheme == local_scheme)
    if not valid_scheme or not parsed.hostname or parsed.username or parsed.password or parsed.query or parsed.fragment:
        raise ValueError(f"{name} must use {secure_scheme} (or {local_scheme} on localhost), without URL credentials")
