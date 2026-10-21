"""Validate kendras shape and geographic safety invariants."""

from __future__ import annotations

import json
import sys
from datetime import date
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator, FormatChecker

DATA_DIR = Path(__file__).resolve().parents[2] / "data"
SCHEMA_PATH = DATA_DIR / "kendras.schema.json"
KENDRAS_PATH = DATA_DIR / "kendras.json"


class KendraValidationError(ValueError):
    """A kendra dataset entry violates safety invariants."""


def _load_json(path: Path) -> dict[str, Any]:
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def validate_kendras_data(data: dict[str, Any], today: date | None = None) -> list[str]:
    """Validate kendras and cities JSON against schema and business invariants."""
    schema = _load_json(SCHEMA_PATH)
    validator = Draft202012Validator(schema, format_checker=FormatChecker())
    errors = [err.message for err in validator.iter_errors(data)]
    if errors:
        return errors

    check_date = today or date.today()
    dataset_date = date.fromisoformat(data["checked_on"])
    if dataset_date > check_date:
        errors.append(f"dataset checked_on {dataset_date} is in the future")

    city_ids: set[str] = set()
    for i, city in enumerate(data.get("cities", [])):
        cid = city["city_id"]
        if cid in city_ids:
            errors.append(f"cities[{i}]: duplicate city_id '{cid}'")
        city_ids.add(cid)
        if not (-90.0 <= city["lat"] <= 90.0):
            errors.append(f"cities[{i}]: invalid lat {city['lat']}")
        if not (-180.0 <= city["lng"] <= 180.0):
            errors.append(f"cities[{i}]: invalid lng {city['lng']}")

    kendra_ids: set[str] = set()
    for i, k in enumerate(data.get("kendras", [])):
        kid = k["id"]
        if kid in kendra_ids:
            errors.append(f"kendras[{i}]: duplicate id '{kid}'")
        kendra_ids.add(kid)

        if k["city_id"] not in city_ids:
            errors.append(f"kendras[{i}]: unknown city_id '{k['city_id']}'")

        if k["kind"] != "kendra":
            errors.append(f"kendras[{i}]: kind must be 'kendra', got '{k['kind']}'")

        if not (-90.0 <= k["lat"] <= 90.0):
            errors.append(f"kendras[{i}]: invalid lat {k['lat']}")
        if not (-180.0 <= k["lng"] <= 180.0):
            errors.append(f"kendras[{i}]: invalid lng {k['lng']}")

        src = k.get("source", {})
        src_checked = date.fromisoformat(src["checked_on"])
        if src_checked > check_date:
            errors.append(f"kendras[{i}].source: checked_on {src_checked} is in the future")

    return errors


def validate_kendras_file(path: Path | None = None, today: date | None = None) -> list[str]:
    target = path or KENDRAS_PATH
    data = _load_json(target)
    return validate_kendras_data(data, today=today)


if __name__ == "__main__":
    validation_errors = validate_kendras_file()
    if validation_errors:
        print(f"Kendra dataset invalid ({len(validation_errors)} errors):")
        for err in validation_errors:
            print(f" - {err}")
        sys.exit(1)
    print("Kendras valid.")
