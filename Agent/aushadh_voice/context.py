"""Private, read-only backend call-context boundary."""

from __future__ import annotations

import json
import re
from typing import Any, Mapping, Protocol

import httpx


_CALL_ID = re.compile(r"[A-Za-z0-9][A-Za-z0-9_-]{0,127}\Z")


class ContextUnavailable(Exception):
    """The confirmed context could not be fetched safely."""


class CallContextReader(Protocol):
    async def fetch(self, call_id: str) -> Mapping[str, Any]: ...


def call_id_from_dispatch(metadata: str) -> str:
    """Accept only a small opaque ID, never medical or phone data from metadata."""
    if not metadata or len(metadata) > 512:
        raise ValueError("Dispatch metadata must contain an opaque call ID")
    try:
        parsed = json.loads(metadata)
    except (TypeError, json.JSONDecodeError) as exc:
        raise ValueError("Invalid dispatch metadata") from exc
    if not isinstance(parsed, dict) or not isinstance(parsed.get("call_id"), str):
        raise ValueError("Dispatch metadata must contain an opaque call ID")
    call_id = parsed["call_id"]
    if not _CALL_ID.fullmatch(call_id):
        raise ValueError("Invalid opaque call ID")
    return call_id


class BackendCallContextReader:
    """GET-only client. A3 will validate the returned fact schema and freshness."""

    def __init__(self, base_url: str, token: str, *, transport: httpx.AsyncBaseTransport | None = None):
        self._base_url = base_url
        self._token = token
        self._transport = transport

    async def fetch(self, call_id: str) -> Mapping[str, Any]:
        if not _CALL_ID.fullmatch(call_id):
            raise ValueError("Invalid opaque call ID")
        try:
            async with httpx.AsyncClient(timeout=5.0, transport=self._transport, trust_env=False) as client:
                response = await client.get(
                    f"{self._base_url}/api/v1/internal/calls/{call_id}/context",
                    headers={"Authorization": f"Bearer {self._token}"},
                )
                response.raise_for_status()
                payload = response.json()
        except (httpx.HTTPError, ValueError) as exc:
            raise ContextUnavailable("Private call context unavailable") from exc
        if not isinstance(payload, dict):
            raise ContextUnavailable("Private call context unavailable")
        return payload
