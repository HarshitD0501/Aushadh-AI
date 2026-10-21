"""Tests for B4: Private agent medicine facts lookup and frontend print slip fields."""

import unittest
from starlette.testclient import TestClient

from app.config import Settings
from app.main import create_app


class AgentFactsAndPrintSlipTests(unittest.TestCase):
    def setUp(self):
        self.agent_token = "secret-agent-token-test-123"
        self.settings = Settings(
            _env_file=None,
            agent_backend_token=self.agent_token,
        )
        self.app = create_app(self.settings)
        self.client = TestClient(self.app)

    def test_agent_token_required_and_validated(self):
        # 1. Missing header -> 401
        res = self.client.get("/api/v1/internal/medicines/pmbjp-300")
        self.assertEqual(res.status_code, 401)
        self.assertEqual(res.json()["error"]["code"], "UNAUTHORIZED")

        # 2. Wrong token -> 403
        res = self.client.get(
            "/api/v1/internal/medicines/pmbjp-300",
            headers={"Authorization": "Bearer wrong-token"},
        )
        self.assertEqual(res.status_code, 403)
        self.assertEqual(res.json()["error"]["code"], "FORBIDDEN")

        # 3. Server with no token configured -> 503
        no_token_app = create_app(Settings(_env_file=None, agent_backend_token=None))
        no_token_client = TestClient(no_token_app)
        res = no_token_client.get(
            "/api/v1/internal/medicines/pmbjp-300",
            headers={"Authorization": f"Bearer {self.agent_token}"},
        )
        self.assertEqual(res.status_code, 503)
        self.assertEqual(res.json()["error"]["code"], "AGENT_AUTH_DISABLED")

    def test_unknown_id_returns_404(self):
        res = self.client.get(
            "/api/v1/internal/medicines/non-existent-id-999",
            headers={"Authorization": f"Bearer {self.agent_token}"},
        )
        self.assertEqual(res.status_code, 404)
        self.assertEqual(res.json()["error"]["code"], "NOT_FOUND")

    def test_reviewed_usage_summary_returned_for_verified_medicine(self):
        res = self.client.get(
            "/api/v1/internal/medicines/pmbjp-300",
            headers={"Authorization": f"Bearer {self.agent_token}"},
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["medicine_id"], "pmbjp-300")
        self.assertEqual(data["product_code"], "300")
        self.assertEqual(data["molecule_label"], "Telmisartan")
        self.assertEqual(data["strength_label"], "40 mg")
        self.assertEqual(data["form"], "tablet")
        self.assertEqual(data["pack_label"], "10 tablets")
        self.assertTrue(data["has_usage_summary"])
        self.assertIsNotNone(data["usage_summary"])
        self.assertIn("उच्च रक्तचाप", data["usage_summary"]["hi"])
        self.assertIn("hypertension", data["usage_summary"]["en"])
        self.assertIn("source_url", data["usage_summary"]["source"])
        self.assertEqual(data["source"]["source_url"], "https://janaushadhi.gov.in/product-portfolio/product-view-list")

    def test_missing_summary_is_explicit_and_no_explanation_invented(self):
        res = self.client.get(
            "/api/v1/internal/medicines/pmbjp-299",
            headers={"Authorization": f"Bearer {self.agent_token}"},
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["medicine_id"], "pmbjp-299")
        self.assertFalse(data["has_usage_summary"])
        self.assertIsNone(data["usage_summary"])

    def test_compare_includes_verified_product_code_source_and_date_for_slip(self):
        res = self.client.post(
            "/api/v1/compare",
            json={"items": [{"medicine_id": "pmbjp-300", "brand_id": "a2b-40mg-tablet-10", "pack_count": 1}]},
        )
        self.assertEqual(res.status_code, 200)
        line = res.json()["items"][0]
        self.assertEqual(line["product_code"], "300")
        self.assertIsNotNone(line["source"])
        self.assertEqual(line["source"]["document_ref"], "PMBI Product List CSV, exported 2026-10-21 11:28 IST, SHA-256 4fb1753879b75946372496c8fe8e104f3bc8f55e868dbcb329ac8f4712b66a2f")
        self.assertEqual(line["source"]["checked_on"], "2026-10-21")
        self.assertEqual(line["pmbjp_price"]["checked_on"], "2026-10-21")
        self.assertEqual(line["pmbjp_price"]["source_url"], "https://janaushadhi.gov.in/product-portfolio/product-view-list")


if __name__ == "__main__":
    unittest.main()
