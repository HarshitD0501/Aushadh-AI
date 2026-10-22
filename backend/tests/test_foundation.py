import unittest

from fastapi import Request
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.config import Settings
from app.errors import AppError
from app.main import create_app


class FoundationTests(unittest.TestCase):
    def setUp(self) -> None:
        self.settings = Settings(
            _env_file=None,
            app_origin="https://aushadhai.example",
            max_request_body_bytes=1024,
        )
        self.app = create_app(self.settings)
        self.client = TestClient(self.app, raise_server_exceptions=False)

    def test_health_and_openapi_do_not_need_a_database(self) -> None:
        response = self.client.get("/api/v1/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "ok")
        self.assertEqual(len(response.headers["x-request-id"]), 32)
        self.assertIsNone(self.settings.database_url)

        openapi = self.client.get("/openapi.json")
        self.assertEqual(openapi.status_code, 200)
        self.assertIn("/api/v1/health", openapi.json()["paths"])
        self.assertIn("/api/v1/capabilities", openapi.json()["paths"])
        self.assertIn("ErrorEnvelope", openapi.json()["components"]["schemas"])

    def test_unimplemented_capabilities_are_false(self) -> None:
        response = self.client.get("/api/v1/capabilities")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {
                "ocr": False,
                "normalizer": False,
                "stores": True,
                "routes": True,
                "whatsapp": False,
                "calling": False,
            },
        )

    def test_cors_allows_only_configured_origin(self) -> None:
        allowed = self.client.options(
            "/api/v1/health",
            headers={
                "Origin": "https://aushadhai.example",
                "Access-Control-Request-Method": "GET",
            },
        )
        self.assertEqual(allowed.status_code, 200)
        self.assertEqual(
            allowed.headers["access-control-allow-origin"],
            "https://aushadhai.example",
        )

        denied = self.client.options(
            "/api/v1/health",
            headers={
                "Origin": "https://untrusted.example",
                "Access-Control-Request-Method": "GET",
            },
        )
        self.assertEqual(denied.status_code, 400)
        self.assertNotIn("access-control-allow-origin", denied.headers)

    def test_validation_and_http_errors_use_contract_envelope(self) -> None:
        @self.app.get("/test/validated")
        async def validated(limit: int) -> dict[str, int]:
            return {"limit": limit}

        invalid = self.client.get("/test/validated?limit=bad")
        self.assertEqual(invalid.status_code, 400)
        self.assertEqual(invalid.json()["error"]["code"], "VALIDATION_ERROR")
        self.assertEqual(
            invalid.json()["error"]["request_id"],
            invalid.headers["x-request-id"],
        )

        missing = self.client.get("/api/v1/unknown")
        self.assertEqual(missing.status_code, 404)
        self.assertEqual(missing.json()["error"]["code"], "NOT_FOUND")

        wrong_method = self.client.post("/api/v1/health")
        self.assertEqual(wrong_method.status_code, 405)
        self.assertEqual(
            wrong_method.json()["error"]["code"], "METHOD_NOT_ALLOWED"
        )

    def test_app_errors_and_unexpected_errors_hide_internal_detail(self) -> None:
        @self.app.get("/test/app-error")
        async def app_error() -> None:
            raise AppError("UPSTREAM_UNAVAILABLE", "Service unavailable.", 503)

        expected = self.client.get("/test/app-error")
        self.assertEqual(expected.status_code, 503)
        self.assertEqual(expected.json()["error"]["code"], "UPSTREAM_UNAVAILABLE")

        @self.app.get("/test/crash")
        async def crash() -> None:
            raise RuntimeError("private-marker-must-not-leak")

        with self.assertLogs("aushadhai.api", level="ERROR") as captured:
            unexpected = self.client.get("/test/crash")
        self.assertEqual(unexpected.status_code, 500)
        self.assertEqual(unexpected.json()["error"]["code"], "INTERNAL_ERROR")
        self.assertNotIn("private-marker", str(unexpected.json()))
        self.assertNotIn("private-marker", "\n".join(captured.output))

        from_browser = self.client.get(
            "/test/crash", headers={"Origin": "https://aushadhai.example"}
        )
        self.assertEqual(
            from_browser.headers.get("access-control-allow-origin"),
            "https://aushadhai.example",
        )

    def test_body_limit_applies_to_declared_and_streamed_requests(self) -> None:
        @self.app.post("/test/consume")
        async def consume(request: Request) -> dict[str, int]:
            return {"size": len(await request.body())}

        declared = self.client.post("/test/consume", content=b"x" * 1025)
        self.assertEqual(declared.status_code, 413)
        self.assertEqual(declared.json()["error"]["code"], "PAYLOAD_TOO_LARGE")

        declared_with_origin = self.client.post(
            "/test/consume",
            content=b"x" * 1025,
            headers={"Origin": "https://aushadhai.example"},
        )
        self.assertEqual(
            declared_with_origin.headers.get("access-control-allow-origin"),
            "https://aushadhai.example",
        )

        streamed = self.client.post(
            "/test/consume", content=(part for part in (b"x" * 600, b"y" * 600))
        )
        self.assertEqual(streamed.status_code, 413)
        self.assertEqual(streamed.json()["error"]["code"], "PAYLOAD_TOO_LARGE")

    def test_logs_omit_query_values_and_settings_hide_database_url(self) -> None:
        secret = "patient-private-query-marker"
        with self.assertLogs("aushadhai.api", level="INFO") as captured:
            response = self.client.get(f"/api/v1/health?note={secret}")
        self.assertEqual(response.status_code, 200)
        self.assertNotIn(secret, "\n".join(captured.output))

        settings = Settings(
            _env_file=None,
            database_url="postgresql://user:private-password@localhost:5432/db",
        )
        self.assertNotIn("private-password", repr(settings))

    def test_settings_reject_invalid_origins_and_limits(self) -> None:
        for origin in ("javascript:alert(1)", "https://site.example/path", ""):
            with self.subTest(origin=origin), self.assertRaises(ValidationError):
                Settings(_env_file=None, app_origin=origin)

        with self.assertRaises(ValidationError):
            Settings(_env_file=None, max_request_body_bytes=0)

        with self.assertRaises(ValidationError):
            Settings(_env_file=None, upstream_timeout_seconds=0)


if __name__ == "__main__":
    unittest.main()
