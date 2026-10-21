"""Contract and safety tests for reviewed search and pack comparison."""

import copy
import json
import unittest
from pathlib import Path

from fastapi.testclient import TestClient

from app.catalogue.service import CatalogueService
from app.config import Settings
from app.main import create_app


CATALOGUE_PATH = Path(__file__).resolve().parents[1] / "data" / "medicines.json"


def catalogue_document():
    return json.loads(CATALOGUE_PATH.read_text(encoding="utf-8"))


def add_verified_variant(document, *, medicine_id, product_code, strength, form="tablet", release=None,
                         generic_paise=1000, market_paise=2000):
    item = copy.deepcopy(next(row for row in document["records"] if row["product_code"] == "300"))
    item["medicine_id"] = medicine_id
    item["product_code"] = product_code
    item["molecule_components"][0]["amount"] = strength
    item["strength_label"] = f"{strength} mg"
    item["form"] = form
    item["release_type"] = release
    item["pack"]["unit"] = form
    item["pmbjp_price"]["amount_paise"] = generic_paise
    brand = item["brand_products"][0]
    brand["brand_id"] = f"fixture-{medicine_id}"
    brand["name"] = f"Fixture Brand {strength} mg"
    brand["molecule_components"] = copy.deepcopy(item["molecule_components"])
    brand["form"] = form
    brand["release_type"] = release
    brand["pack"] = copy.deepcopy(item["pack"])
    brand["market_price"]["amount_paise"] = market_paise
    fixture_source = {
        "source_url": "https://example.test/fixture",
        "document_ref": "Synthetic test fixture; not medicine evidence",
        "row_ref": f"{medicine_id} synthetic test only",
        "checked_on": "2026-10-21",
        "source_as_of": "2026-10-21",
    }
    item["source"] = copy.deepcopy(fixture_source)
    item["pmbjp_price"]["source"] = copy.deepcopy(fixture_source)
    item["nppa_ceiling_price"] = None
    brand["source"] = copy.deepcopy(fixture_source)
    brand["market_price"]["source"] = copy.deepcopy(fixture_source)
    document["records"].append(item)
    return item


class SearchCompareTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(create_app(Settings()))

    def test_search_handles_typo_brand_molecule_and_bad_strength(self):
        for query in ("telmisrtan", "Telmisartan", "a2b", "A2B 40", " telmisartan-40mg "):
            with self.subTest(query=query):
                response = self.client.get("/api/v1/search", params={"q": query})
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.json()["candidates"][0]["medicine_id"], "pmbjp-300")
                self.assertTrue(response.json()["candidates"][0]["requires_confirmation"])
        for query in ("telmisartan 20mg", "Telmisartan 20", "unknownzzmedicine"):
            with self.subTest(query=query):
                response = self.client.get("/api/v1/search", params={"q": query})
                self.assertEqual(response.json()["candidates"], [])

    def test_public_catalogue_etag_and_no_price_leak(self):
        response = self.client.get("/api/v1/catalogue/public")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["version"], "2026-10-21-b1-curated-3-a2b")
        self.assertEqual([row["medicine_id"] for row in response.json()["records"]], ["pmbjp-300"])
        self.assertNotIn("price", response.text)
        self.assertNotIn("recipient", response.text)
        self.assertIn("ETag", response.headers)
        repeat = self.client.get("/api/v1/catalogue/public", headers={"If-None-Match": response.headers["ETag"]})
        self.assertEqual(repeat.status_code, 304)
        self.assertEqual(repeat.content, b"")

    def test_exact_one_pack_and_basket_math(self):
        one = self.client.post("/api/v1/compare", json={"items": [
            {"medicine_id": "pmbjp-300", "brand_id": "a2b-40mg-tablet-10", "pack_count": 1}
        ]})
        self.assertEqual(one.status_code, 200)
        line = one.json()["items"][0]
        self.assertEqual(line["market_price"]["amount_paise"], 7462)
        self.assertEqual(line["pmbjp_price"]["amount_paise"], 1238)
        self.assertEqual(line["nppa_ceiling_price"]["amount_paise"], 692)
        self.assertEqual(line["nppa_ceiling_price"]["unit"], "tablet")
        self.assertEqual(line["saving_paise"], 6224)
        self.assertEqual(line["saving_percent"], 83.4)
        self.assertEqual(line["comparison_basis"], "10 tablets")
        self.assertEqual(one.json()["totals"]["saving_total_paise"], 6224)

        basket = self.client.post("/api/v1/compare", json={"items": [
            {"medicine_id": "pmbjp-300", "brand_id": "a2b-40mg-tablet-10", "pack_count": 2},
            {"medicine_id": "pmbjp-299", "brand_id": None, "pack_count": 3},
        ]})
        self.assertEqual(basket.status_code, 200)
        totals = basket.json()["totals"]
        self.assertEqual(totals["comparable_item_count"], 1)
        self.assertEqual(totals["incomplete_item_count"], 1)
        self.assertEqual(totals["market_total_paise"], 14924)
        self.assertEqual(totals["pmbjp_total_paise"], 2476)
        self.assertEqual(totals["saving_total_paise"], 12448)
        self.assertEqual(basket.json()["items"][1]["excluded_reason"], "unverified_record")
        self.assertIsNone(basket.json()["items"][1]["saving_paise"])

    def test_no_brand_does_not_invent_market_price(self):
        response = self.client.post("/api/v1/compare", json={"items": [
            {"medicine_id": "pmbjp-300", "brand_id": None, "pack_count": 1}
        ]})
        self.assertEqual(response.status_code, 200)
        line = response.json()["items"][0]
        self.assertIsNone(line["market_price"])
        self.assertEqual(line["excluded_reason"], "brand_not_selected")
        self.assertIsNone(line["saving_paise"])
        self.assertEqual(response.json()["totals"]["comparable_item_count"], 0)

    def test_wrong_pair_unknown_id_duplicate_and_input_caps(self):
        for payload, status in [
            ({"items": [{"medicine_id": "pmbjp-299", "brand_id": "a2b-40mg-tablet-10"}]}, 422),
            ({"items": [{"medicine_id": "missing", "brand_id": None}]}, 404),
            ({"items": [{"medicine_id": "pmbjp-300", "brand_id": "missing"}]}, 404),
            ({"items": [{"medicine_id": "pmbjp-300", "brand_id": None, "pack_count": 0}]}, 400),
            ({"items": [{"medicine_id": "pmbjp-300", "brand_id": None, "pack_count": True}]}, 400),
            ({"items": [{"medicine_id": "pmbjp-300", "brand_id": None}] * 2}, 409),
            ({"items": []}, 400),
        ]:
            with self.subTest(payload=payload):
                response = self.client.post("/api/v1/compare", json=payload)
                self.assertEqual(response.status_code, status)
                self.assertIn("request_id", response.json()["error"])
        self.assertEqual(self.client.get("/api/v1/search", params={"q": "x" * 121}).status_code, 400)
        self.assertEqual(self.client.get("/api/v1/search", params={"q": "telmisartan", "limit": 9}).status_code, 400)
        self.assertEqual(self.client.get("/api/v1/search", params={"q": "  "}).json()["candidates"], [])

    def test_multiple_strengths_and_forms_stay_separate(self):
        document = catalogue_document()
        add_verified_variant(document, medicine_id="fixture-20", product_code="fixture20", strength=20)
        add_verified_variant(document, medicine_id="fixture-capsule", product_code="fixturecapsule", strength=40, form="capsule")
        service = CatalogueService(document)
        all_ids = {row["medicine_id"] for row in service.search("telmisartan")["candidates"]}
        self.assertEqual(all_ids, {"pmbjp-300", "fixture-20", "fixture-capsule"})
        exact_20 = {row["medicine_id"] for row in service.search("telmisartan 20mg")["candidates"]}
        self.assertEqual(exact_20, {"fixture-20"})
        exact_40 = service.search("telmisartan 40mg")["candidates"]
        self.assertEqual(
            {row["medicine_id"] for row in exact_40},
            {"pmbjp-300", "fixture-capsule"},
        )
        self.assertTrue(all(row["requires_confirmation"] for row in exact_40))
        with self.assertRaisesRegex(Exception, "Brand does not match this exact medicine pack"):
            service.compare([{
                "medicine_id": "pmbjp-300",
                "brand_id": "fixture-fixture-capsule",
                "pack_count": 1,
            }])

    def test_selected_brand_without_mrp_is_excluded(self):
        document = catalogue_document()
        variant = add_verified_variant(
            document, medicine_id="fixture-no-mrp", product_code="fixturenomrp", strength=60,
        )
        variant["brand_products"][0]["market_price"] = None
        result = CatalogueService(document).compare([{
            "medicine_id": variant["medicine_id"],
            "brand_id": variant["brand_products"][0]["brand_id"],
            "pack_count": 1,
        }])
        self.assertEqual(result["items"][0]["excluded_reason"], "market_mrp_unavailable")
        self.assertIsNone(result["items"][0]["saving_paise"])
        self.assertEqual(result["totals"]["comparable_item_count"], 0)
        self.assertEqual(result["savings_label"], "No comparable items")

    def test_negative_saving_and_no_nppa_are_honest(self):
        document = catalogue_document()
        variant = add_verified_variant(
            document, medicine_id="fixture-negative", product_code="fixturenegative",
            strength=80, generic_paise=3000, market_paise=2000,
        )
        service = CatalogueService(document)
        result = service.compare([{"medicine_id": variant["medicine_id"],
                                   "brand_id": variant["brand_products"][0]["brand_id"], "pack_count": 2}])
        self.assertEqual(result["items"][0]["saving_paise"], -2000)
        self.assertEqual(result["totals"]["saving_percent"], -50.0)
        self.assertEqual(result["savings_label"], "Estimated extra cost")
        self.assertIsNone(result["items"][0]["nppa_ceiling_price"])


if __name__ == "__main__":
    unittest.main()
