"""Validate catalogue shape and safety invariants before publishing data."""

from __future__ import annotations

import json
import sys
from datetime import date, timedelta
from decimal import Decimal
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator, FormatChecker


DATA_DIR = Path(__file__).resolve().parents[2] / "data"
SCHEMA_PATH = DATA_DIR / "medicines.schema.json"
CATALOGUE_PATH = DATA_DIR / "medicines.json"


class CatalogueValidationError(ValueError):
    """A catalogue row cannot safely be published."""


def _load_json(path: Path) -> dict[str, Any]:
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def _strength_label(components: list[dict[str, Any]]) -> str:
    return " + ".join(
        f"{Decimal(str(item['amount'])):f} {item['unit']}".replace(".0 ", " ")
        for item in components
    )


def _composition_key(components: list[dict[str, Any]]) -> tuple[tuple[str, Decimal, str], ...]:
    return tuple(
        sorted(
            (item["name"].casefold().strip(), Decimal(str(item["amount"])), item["unit"])
            for item in components
        )
    )


def _validate_source(source: dict[str, Any], path: str, today: date, errors: list[str]) -> None:
    checked = date.fromisoformat(source["checked_on"])
    published = date.fromisoformat(source["source_as_of"])
    if published > checked:
        errors.append(f"{path}: source_as_of follows checked_on")
    if checked > today:
        errors.append(f"{path}: checked_on is in the future")


def _validate_price(price: dict[str, Any] | None, path: str, today: date, errors: list[str]) -> None:
    if price is None:
        return
    _validate_source(price["source"], f"{path}.source", today, errors)


def validate_catalogue(
    catalogue: dict[str, Any],
    *,
    schema: dict[str, Any] | None = None,
    today: date | None = None,
) -> None:
    """Raise on schema, provenance, duplicate, or comparability errors.

    `verified` requires a PMBJP pack price and reviewer. A current source is
    required before claiming a row is ready for a live comparison.
    """
    schema = schema or _load_json(SCHEMA_PATH)
    today = today or date.today()
    Draft202012Validator.check_schema(schema)
    structural = sorted(
        Draft202012Validator(schema, format_checker=FormatChecker()).iter_errors(catalogue),
        key=lambda error: list(map(str, error.absolute_path)),
    )
    if structural:
        first = structural[0]
        location = ".".join(map(str, first.absolute_path)) or "catalogue"
        raise CatalogueValidationError(f"{location}: {first.message}")

    errors: list[str] = []
    if date.fromisoformat(catalogue["checked_on"]) > today:
        errors.append("checked_on: future date")
    medicine_ids: set[str] = set()
    product_codes: set[str] = set()
    brand_ids: set[str] = set()
    for index, item in enumerate(catalogue["records"]):
        path = f"records[{index}]"
        medicine_id = item["medicine_id"]
        if medicine_id in medicine_ids:
            errors.append(f"{path}: duplicate medicine_id {medicine_id}")
        medicine_ids.add(medicine_id)
        product_code = item["product_code"]
        if product_code is not None:
            if product_code in product_codes:
                errors.append(f"{path}: duplicate product_code {product_code}")
            product_codes.add(product_code)

        expected_molecule = " + ".join(component["name"] for component in item["molecule_components"])
        if item["molecule_label"].casefold().strip() != expected_molecule.casefold():
            errors.append(f"{path}: molecule_label differs from components")
        if item["strength_label"].strip() != _strength_label(item["molecule_components"]):
            errors.append(f"{path}: strength_label differs from components")
        if item["form"] in {"tablet", "capsule", "sachet", "injection"}:
            expected_unit = "vial" if item["form"] == "injection" else item["form"]
            if item["pack"]["unit"] != expected_unit:
                errors.append(f"{path}: pack unit conflicts with form")
        _validate_source(item["source"], f"{path}.source", today, errors)
        _validate_price(item["pmbjp_price"], f"{path}.pmbjp_price", today, errors)
        _validate_price(item["nppa_ceiling_price"], f"{path}.nppa_ceiling_price", today, errors)
        if item.get("usage_summary") is not None:
            _validate_source(item["usage_summary"]["source"], f"{path}.usage_summary.source", today, errors)
        if item["pmbjp_price"] is not None and item["pmbjp_price"]["unit"] != "pack":
            errors.append(f"{path}: PMBJP price must use the exact pack basis")
        if item["nppa_ceiling_price"] is not None and item["nppa_ceiling_price"]["unit"] not in {
            "pack", item["pack"]["unit"]
        }:
            errors.append(f"{path}: NPPA ceiling unit conflicts with formulation")

        if item["record_status"] == "verified":
            if not item["reviewed_by"] or not item["reviewed_on"]:
                errors.append(f"{path}: verified row requires human reviewer and review date")
            if not item["product_code"] or item["pmbjp_price"] is None:
                errors.append(f"{path}: verified row requires product code and PMBJP price")
            elif item["pmbjp_price"]["amount_paise"] == 0:
                errors.append(f"{path}: zero PMBJP MRP cannot be published as available")
            if today - date.fromisoformat(item["source"]["source_as_of"]) > timedelta(days=365):
                errors.append(f"{path}: verified row has stale product source")
            if item["pmbjp_price"] is not None and today - date.fromisoformat(
                item["pmbjp_price"]["source"]["source_as_of"]
            ) > timedelta(days=365):
                errors.append(f"{path}: verified row has stale PMBJP price source")
            if item["reviewed_on"] and date.fromisoformat(item["reviewed_on"]) > today:
                errors.append(f"{path}: reviewed_on is in the future")
            if item["reviewed_on"] and date.fromisoformat(item["reviewed_on"]) < date.fromisoformat(
                item["source"]["source_as_of"]
            ):
                errors.append(f"{path}: review predates product source")

        for brand in item["brand_products"]:
            brand_path = f"{path}.brand_products[{brand['brand_id']}]"
            if brand["brand_id"] in brand_ids:
                errors.append(f"{brand_path}: duplicate brand_id")
            brand_ids.add(brand["brand_id"])
            if _composition_key(brand["molecule_components"]) != _composition_key(item["molecule_components"]):
                errors.append(f"{brand_path}: composition or strength differs")
            if brand["form"] != item["form"] or brand["release_type"] != item["release_type"]:
                errors.append(f"{brand_path}: form or release type differs")
            if brand["pack"] != item["pack"]:
                errors.append(f"{brand_path}: pack differs")
            if brand["market_price"] is not None and brand["market_price"]["unit"] != "pack":
                errors.append(f"{brand_path}: market price must use the exact pack basis")
            _validate_source(brand["source"], f"{brand_path}.source", today, errors)
            _validate_price(brand["market_price"], f"{brand_path}.market_price", today, errors)
            if (
                item["record_status"] == "verified"
                and brand["market_price"] is not None
                and today - date.fromisoformat(brand["market_price"]["source"]["source_as_of"])
                > timedelta(days=365)
            ):
                errors.append(f"{brand_path}: stale market MRP source")

    if errors:
        raise CatalogueValidationError("\n".join(errors))


def main() -> int:
    try:
        validate_catalogue(_load_json(CATALOGUE_PATH))
    except (CatalogueValidationError, ValueError, OSError) as exc:
        print(f"Catalogue invalid: {exc}", file=sys.stderr)
        return 1
    print("Catalogue valid.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
