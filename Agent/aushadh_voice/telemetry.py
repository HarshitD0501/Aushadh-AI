"""Allowlisted operational logs without caller text, numbers, or secrets."""

from __future__ import annotations

import hashlib
import json
import logging
import uuid


_LOG = logging.getLogger("aushadh_voice")
_ALLOWED_EVENTS = {
    "worker_ready",
    "dispatch_rejected",
    "job_started",
    "context_unavailable",
    "context_fetched",
    "room_connected",
    "room_connect_failed",
    "job_closed",
}


def configure_logging() -> None:
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter("%(message)s"))
    _LOG.handlers.clear()
    _LOG.addHandler(handler)
    _LOG.setLevel(logging.INFO)
    _LOG.propagate = False


def new_request_id() -> str:
    return uuid.uuid4().hex


def call_ref(call_id: str) -> str:
    """Deterministic correlation handle; never emit the raw call ID."""
    return hashlib.sha256(call_id.encode("utf-8")).hexdigest()[:16]


def event(name: str, request_id: str, *, ref: str | None = None) -> None:
    if name not in _ALLOWED_EVENTS or not re_fullmatch_hex(request_id, 32):
        raise ValueError("Invalid log event")
    record = {"event": name, "request_id": request_id}
    if ref is not None:
        if not re_fullmatch_hex(ref, 16):
            raise ValueError("Invalid call reference")
        record["call_ref"] = ref
    _LOG.info(json.dumps(record, separators=(",", ":")))


def re_fullmatch_hex(value: str, length: int) -> bool:
    return len(value) == length and all(char in "0123456789abcdef" for char in value)
