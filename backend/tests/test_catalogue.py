"""Safety checks for sourced catalogue records."""

import copy
import json
import unittest
from datetime import date
from pathlib import Path

from app.catalogue.validate import CatalogueValidationError, validate_catalogue


CATALOGUE_PATH = Path(__file__).resolve().parents[1] / "data" / "medicines.json"
SOURCE_URL = "https://janaushadhi.gov.in/product-portfolio/product-view-list"


class CatalogueValidationTests(unittest.TestCase):
    def setUp(self):
        self.catalogue = json.loads(CATALOGUE_PATH.read_text(encoding="utf-8"))
        self.today = date(2026, 10, 21)

    def check_invalid(self, expected: str):
        with self.assertRaises(CatalogueValidationError) as caught:
            validate_catalogue(self.catalogue, today=self.today)
        self.assertIn(expected, str(caught.exception))

    def verified_fixture(self):
        item = self.catalogue["records"][0]
        item["record_status"] = "verified"
        item["reviewed_by"] = "Human reviewer fixture"
        item["reviewed_on"] = "2026-10-21"
        item["source"]["source_url"] = SOURCE_URL
        item["source"]["source_as_of"] = "2026-10-01"
        item["pmbjp_price"] = {
            "amount_paise": 1200,
            "currency": "INR",
            "unit": "pack",
            "source": copy.deepcopy(item["source"]),
        }
        return item

    def test_bundled_review_status_and_prices_validate(self):
        validate_catalogue(self.catalogue, today=self.today)
        self.assertEqual(
            {item["product_code"]: item["record_status"] for item in self.catalogue["records"]},
            {"299": "incomplete", "300": "verified", "291": "incomplete"},
        )
        self.assertEqual(
            {item["product_code"]: item["pmbjp_price"]["amount_paise"] for item in self.catalogue["records"]},
            {"299": 1134, "300": 1238, "291": 1021},
        )
        telmisartan_40 = next(item for item in self.catalogue["records"] if item["product_code"] == "300")
        self.assertEqual(telmisartan_40["nppa_ceiling_price"]["amount_paise"], 692)
        self.assertEqual(telmisartan_40["nppa_ceiling_price"]["unit"], "tablet")
        self.assertEqual(len(telmisartan_40["brand_products"]), 1)
        brand = telmisartan_40["brand_products"][0]
        self.assertEqual(brand["brand_id"], "a2b-40mg-tablet-10")
        self.assertEqual(brand["market_price"]["amount_paise"], 7462)
        self.assertEqual(brand["market_price"]["unit"], "pack")
        self.assertEqual(telmisartan_40["reviewed_by"], "HarshitD05")
        self.assertEqual(telmisartan_40["reviewed_on"], "2026-10-21")

    def test_wrong_nppa_unit_is_rejected(self):
        item = self.catalogue["records"][1]
        item["nppa_ceiling_price"]["unit"] = "ml"
        self.check_invalid("NPPA ceiling unit conflicts")

    def test_duplicate_id_is_rejected(self):
        self.catalogue["records"][1]["medicine_id"] = self.catalogue["records"][0]["medicine_id"]
        self.check_invalid("duplicate medicine_id")

    def test_duplicate_product_code_is_rejected(self):
        self.catalogue["records"][1]["product_code"] = self.catalogue["records"][0]["product_code"]
        self.check_invalid("duplicate product_code")

    def test_missing_source_is_rejected(self):
        del self.catalogue["records"][0]["source"]["source_url"]
        self.check_invalid("source_url")

    def test_bad_price_unit_is_rejected(self):
        item = self.verified_fixture()
        item["pmbjp_price"]["unit"] = "tablet"
        self.check_invalid("exact pack basis")

    def test_missing_verified_price_is_rejected(self):
        item = self.verified_fixture()
        item["pmbjp_price"] = None
        self.check_invalid("requires product code and PMBJP price")

    def test_stale_verified_price_is_rejected(self):
        item = self.verified_fixture()
        item["pmbjp_price"]["source"]["source_as_of"] = "2018-12-11"
        self.check_invalid("stale PMBJP price source")

    def test_zero_verified_price_is_rejected(self):
        item = self.verified_fixture()
        item["pmbjp_price"]["amount_paise"] = 0
        self.check_invalid("zero PMBJP MRP")

    def test_unreviewed_verified_row_is_rejected(self):
        item = self.verified_fixture()
        item["reviewed_by"] = None
        self.check_invalid("human reviewer")

    def test_valid_verified_fixture(self):
        self.verified_fixture()
        validate_catalogue(self.catalogue, today=self.today)

    def test_strength_label_mismatch_is_rejected(self):
        self.catalogue["records"][0]["strength_label"] = "40 mg"
        self.check_invalid("strength_label")

    def test_mismatched_brand_strength_is_rejected(self):
        item = self.verified_fixture()
        brand = self.make_brand(item)
        brand["molecule_components"][0]["amount"] = 40
        item["brand_products"].append(brand)
        self.check_invalid("composition or strength differs")

    def test_mismatched_brand_form_release_pack_are_rejected(self):
        for changed_field, value, expected in [
            ("form", "capsule", "form or release type differs"),
            ("release_type", "extended", "form or release type differs"),
            ("pack", {"quantity": 15, "unit": "tablet"}, "pack differs"),
        ]:
            with self.subTest(changed_field=changed_field):
                item = self.verified_fixture()
                brand = self.make_brand(item)
                brand[changed_field] = value
                item["brand_products"] = [brand]
                self.check_invalid(expected)
                self.setUp()

    def test_missing_market_mrp_is_allowed(self):
        item = self.verified_fixture()
        item["brand_products"] = [self.make_brand(item)]
        validate_catalogue(self.catalogue, today=self.today)
        self.assertIsNone(item["brand_products"][0]["market_price"])

    def test_stale_brand_mrp_is_rejected(self):
        item = self.verified_fixture()
        brand = self.make_brand(item)
        brand["market_price"] = {
            "amount_paise": 2400,
            "currency": "INR",
            "unit": "pack",
            "source": copy.deepcopy(item["source"]),
        }
        brand["market_price"]["source"]["source_as_of"] = "2018-12-11"
        item["brand_products"] = [brand]
        self.check_invalid("stale market MRP source")

    @staticmethod
    def make_brand(item):
        return {
            "brand_id": "fixture-brand",
            "name": "Fixture brand",
            "molecule_components": copy.deepcopy(item["molecule_components"]),
            "form": item["form"],
            "release_type": item["release_type"],
            "pack": copy.deepcopy(item["pack"]),
            "market_price": None,
            "source": copy.deepcopy(item["source"]),
        }


if __name__ == "__main__":
    unittest.main()
