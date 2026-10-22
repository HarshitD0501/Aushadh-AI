"""A0 contract and privacy checks without a LiveKit or Backend account."""

from __future__ import annotations

import asyncio
import io
import json
import logging
import unittest

import httpx

from aushadh_voice.config import Settings
from aushadh_voice.context import BackendCallContextReader, ContextUnavailable, call_id_from_dispatch
from aushadh_voice.telemetry import call_ref, configure_logging, event, new_request_id


class SettingsTests(unittest.TestCase):
    def test_missing_settings_names_only(self) -> None:
        with self.assertRaisesRegex(ValueError, "LIVEKIT_URL.*AGENT_BACKEND_TOKEN") as error:
            Settings.from_env({})
        self.assertNotIn("Bearer", str(error.exception))

    def test_rejects_insecure_remote_backend(self) -> None:
        values = {
            "LIVEKIT_URL": "wss://test.livekit.cloud",
            "LIVEKIT_API_KEY": "private-key",
            "LIVEKIT_API_SECRET": "private-secret",
            "BACKEND_PRIVATE_URL": "http://example.org",
            "AGENT_BACKEND_TOKEN": "private-token",
            "GROQ_API_KEY": "private-groq-token",
            "MURF_API_KEY": "private-murf-token",
        }
        with self.assertRaisesRegex(ValueError, "BACKEND_PRIVATE_URL") as error:
            Settings.from_env(values)
        self.assertNotIn("private-token", str(error.exception))


class DispatchTests(unittest.TestCase):
    def test_accepts_only_opaque_id_and_never_logs_metadata(self) -> None:
        self.assertEqual(call_id_from_dispatch('{"call_id":"test-call_1"}'), "test-call_1")
        for metadata in (
            "not json",
            '{"call_id":"+not-an-id"}',
            '{"call_id":"../../other"}',
            '{"call_id":"x\\npatient transcript"}',
        ):
            with self.subTest(metadata=metadata), self.assertRaises(ValueError):
                call_id_from_dispatch(metadata)

    def test_log_contains_only_allowlisted_fields(self) -> None:
        configure_logging()
        stream = io.StringIO()
        handler = logging.StreamHandler(stream)
        logger = logging.getLogger("aushadh_voice")
        logger.handlers.clear()
        logger.addHandler(handler)
        event("job_started", new_request_id(), ref=call_ref("opaque-call-id"))
        record = json.loads(stream.getvalue())
        self.assertEqual(set(record), {"event", "request_id", "call_ref"})
        self.assertNotIn("opaque-call-id", stream.getvalue())


class BackendBoundaryTests(unittest.TestCase):
    def test_authenticated_read_only_context_fetch(self) -> None:
        requests: list[httpx.Request] = []

        def respond(request: httpx.Request) -> httpx.Response:
            requests.append(request)
            return httpx.Response(200, json={"checkup": {"date_local": "2026-10-21"}})

        reader = BackendCallContextReader(
            "https://backend.example", "secret-token", transport=httpx.MockTransport(respond)
        )
        result = asyncio.run(reader.fetch("call_123"))
        self.assertEqual(result["checkup"]["date_local"], "2026-10-21")
        self.assertEqual(requests[0].method, "GET")
        self.assertEqual(requests[0].url.path, "/api/v1/internal/calls/call_123/context")
        self.assertEqual(requests[0].headers["Authorization"], "Bearer secret-token")

    def test_backend_error_never_exposes_response_body(self) -> None:
        reader = BackendCallContextReader(
            "https://backend.example",
            "secret-token",
            transport=httpx.MockTransport(lambda _: httpx.Response(503, text="private patient data")),
        )
        with self.assertRaises(ContextUnavailable) as error:
            asyncio.run(reader.fetch("call_123"))
        self.assertNotIn("private patient data", str(error.exception))
        self.assertNotIn("secret-token", str(error.exception))


if __name__ == "__main__":
    unittest.main()
