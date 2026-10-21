"""Private, read-only backend call-context boundary."""

from __future__ import annotations

from datetime import datetime, timezone
import json
import re
from typing import Any, Mapping, Protocol

import httpx


_CALL_ID = re.compile(r"[A-Za-z0-9][A-Za-z0-9_-]{0,127}\Z")


class ContextUnavailable(Exception):
    """The confirmed context could not be fetched safely."""


class CallContextReader(Protocol):
    async def fetch(self, call_id: str) -> Mapping[str, Any]: ...


def _parse_timestamp(val: Any) -> float | None:
    if isinstance(val, (int, float)):
        return float(val)
    if isinstance(val, str):
        try:
            dt = datetime.fromisoformat(val.replace("Z", "+00:00"))
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt.timestamp()
        except ValueError:
            return None
    return None


def validate_call_context(payload: Mapping[str, Any], *, now_ts: float | None = None) -> Mapping[str, Any]:
    """Validate freshness (max 24h) and confirmed schema of call context."""
    if not isinstance(payload, dict):
        raise ContextUnavailable("Malformed call context: root must be a dictionary")

    current_ts = datetime.now(timezone.utc).timestamp() if now_ts is None else now_ts

    if "expires_at" in payload:
        exp_ts = _parse_timestamp(payload["expires_at"])
        if exp_ts is not None and exp_ts < current_ts:
            raise ContextUnavailable("Call context has expired")

    if "created_at" in payload:
        created_ts = _parse_timestamp(payload["created_at"])
        if created_ts is not None and (current_ts - created_ts) > 86400.0:
            raise ContextUnavailable("Call context is stale (>24h old)")

    checkup = payload.get("checkup")
    if checkup is not None and not isinstance(checkup, dict):
        raise ContextUnavailable("Malformed call context: checkup must be an object")

    med_ids = payload.get("selected_medicine_ids")
    if med_ids is not None and not isinstance(med_ids, (list, tuple)):
        raise ContextUnavailable("Malformed call context: selected_medicine_ids must be a list")

    return payload


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
    """GET-only client validating fact schema, token authentication, and freshness."""

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
        return validate_call_context(payload)
