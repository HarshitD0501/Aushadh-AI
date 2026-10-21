"""In-memory, reviewed catalogue search and exact pack-price comparison."""

from __future__ import annotations

import hashlib
import json
import re
import unicodedata
from decimal import Decimal, ROUND_HALF_UP
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any

from app.catalogue.validate import CATALOGUE_PATH, validate_catalogue
from app.errors import AppError

try:
    from rapidfuzz import fuzz, process
except ModuleNotFoundError:  # local/offline development only; deployed package installs RapidFuzz
    fuzz = process = None


_NUMBER_WITH_UNIT = re.compile(r"(?<!\w)(\d+(?:\.\d+)?)\s*(mg|mcg|g|iu|%)(?!\w)")
_BARE_NUMBER = re.compile(r"(?<![\w.])\d+(?:\.\d+)?(?!\w)")
_NON_WORD = re.compile(r"[^\w%]+", re.UNICODE)
_SPACE = re.compile(r"\s+")


def normalize_query(value: str) -> str:
    """Normalize names for ranking only; never derive medical facts from text."""
    normalized = unicodedata.normalize("NFKC", value).casefold()
    normalized = _NON_WORD.sub(" ", normalized)
    return _SPACE.sub(" ", normalized).strip()


def _search_strength(query: str) -> tuple[str, str] | None:
    observed = _NUMBER_WITH_UNIT.findall(query)
    if len(observed) == 1:
        amount, unit = observed[0]
        return (str(Decimal(amount).normalize()), unit.lower())
    if observed:
        return None
    bare = _BARE_NUMBER.findall(query)
    if len(bare) == 1:
        return (str(Decimal(bare[0]).normalize()), "")
    return None


def _matches_strength(record: dict[str, Any], observed: tuple[str, str] | None) -> bool:
    if observed is None:
        return True
    amount, unit = observed
    return any(
        str(Decimal(str(component["amount"])).normalize()) == amount
        and (not unit or component["unit"].lower() == unit)
        for component in record["molecule_components"]
    )


def _fallback_score(query: str, choice: str) -> float:
    """Deterministic degraded search for a development environment without wheels."""
    if query == choice:
        return 100.0
    ratio = 100 * SequenceMatcher(None, query, choice).ratio()
    if query in choice or choice in query:
        ratio = max(ratio, 90.0)
    return ratio


def _matches(query: str, choices: list[str]):
    if process is not None:
        yield from process.extract_iter(
            query, choices, scorer=fuzz.WRatio, score_cutoff=75, processor=None
        )
        return
    for index, choice in enumerate(choices):
        score = _fallback_score(query, choice)
        if score >= 75:
            yield choice, score, index


def _pack_label(record: dict[str, Any]) -> str:
    quantity = record["pack"]["quantity"]
    unit = record["pack"]["unit"]
    return f"{quantity} {unit if quantity == 1 else unit + 's'}"


def _public_price(price: dict[str, Any] | None) -> dict[str, Any] | None:
    if price is None:
        return None
    return {
        "amount_paise": price["amount_paise"],
        "currency": price["currency"],
        "unit": price["unit"],
        "source_url": price["source"]["source_url"],
        "checked_on": price["source"]["checked_on"],
    }


def _percent(numerator: int, denominator: int) -> float | None:
    if denominator <= 0:
        return None
    return float((Decimal(numerator) * 100 / Decimal(denominator)).quantize(
        Decimal("0.1"), rounding=ROUND_HALF_UP
    ))


class CatalogueService:
    """Immutable catalogue snapshot indexed once at application creation."""

    def __init__(self, document: dict[str, Any]) -> None:
        validate_catalogue(document)
        self.version = document["version"]
        self.checked_on = document["checked_on"]
        self.records = {item["medicine_id"]: item for item in document["records"]}
        self.brand_owner = {
            brand["brand_id"]: item["medicine_id"]
            for item in document["records"]
            for brand in item["brand_products"]
        }
        self.aliases: list[tuple[str, str, str]] = []
        for item in document["records"]:
            if item["record_status"] != "verified":
                continue
            names = [
                item["molecule_label"],
                f"{item['molecule_label']} {item['strength_label']}",
                *[brand["name"] for brand in item["brand_products"]],
            ]
            self.aliases.extend(
                (normalize_query(name), item["medicine_id"], name) for name in names
            )
        self.choices = [alias[0] for alias in self.aliases]
        self.public_document = {
            "version": self.version,
            "checked_on": self.checked_on,
            "records": [
                {
                    "medicine_id": item["medicine_id"],
                    "molecule_label": item["molecule_label"],
                    "strength_label": item["strength_label"],
                    "form": item["form"],
                    "release_type": item["release_type"],
                    "pack_label": _pack_label(item),
                    "brands": [
                        {"brand_id": brand["brand_id"], "name": brand["name"]}
                        for brand in item["brand_products"]
                    ],
                }
                for item in document["records"] if item["record_status"] == "verified"
            ],
        }
        canonical = json.dumps(self.public_document, sort_keys=True, separators=(",", ":"))
        self.etag = '"' + hashlib.sha256(canonical.encode("utf-8")).hexdigest() + '"'

    @classmethod
    def from_path(cls, path: Path = CATALOGUE_PATH) -> "CatalogueService":
        with path.open(encoding="utf-8") as handle:
            return cls(json.load(handle))

    def search(self, query: str, limit: int = 8) -> dict[str, Any]:
        cleaned = normalize_query(query)
        if not cleaned:
            return {"query": query, "candidates": []}
        strength = _search_strength(unicodedata.normalize("NFKC", query).casefold())
        best: dict[str, tuple[float, str]] = {}
        for _, score, alias_index in _matches(cleaned, self.choices):
            _, medicine_id, matched_text = self.aliases[alias_index]
            item = self.records[medicine_id]
            if not _matches_strength(item, strength):
                continue
            previous = best.get(medicine_id)
            if previous is None or score > previous[0]:
                best[medicine_id] = (score, matched_text)
        ranked = sorted(best.items(), key=lambda pair: (-pair[1][0], pair[0]))[:limit]
        return {
            "query": query,
            "candidates": [
                {
                    "medicine_id": medicine_id,
                    "matched_text": matched_text,
                    "molecule_label": self.records[medicine_id]["molecule_label"],
                    "strength_label": self.records[medicine_id]["strength_label"],
                    "form": self.records[medicine_id]["form"],
                    "release_type": self.records[medicine_id]["release_type"],
                    "pack_label": _pack_label(self.records[medicine_id]),
                    "brands": [
                        {"brand_id": brand["brand_id"], "name": brand["name"]}
                        for brand in self.records[medicine_id]["brand_products"]
                    ],
                    "match_score": round(score),
                    "requires_confirmation": True,
                }
                for medicine_id, (score, matched_text) in ranked
            ],
        }

    def compare(self, items: list[dict[str, Any]]) -> dict[str, Any]:
        lines: list[dict[str, Any]] = []
        market_total = generic_total = comparable = 0
        seen: set[tuple[str, str | None]] = set()
        for requested in items:
            medicine_id = requested["medicine_id"]
            brand_id = requested["brand_id"]
            pack_count = requested["pack_count"]
            key = (medicine_id, brand_id)
            if key in seen:
                raise AppError("DUPLICATE_ITEM", "A medicine/brand pair was selected twice.", 409)
            seen.add(key)
            item = self.records.get(medicine_id)
            if item is None:
                raise AppError("NOT_FOUND", "Medicine was not found in the catalogue.", 404)
            brand = None
            if brand_id is not None:
                owner = self.brand_owner.get(brand_id)
                if owner is None:
                    raise AppError("NOT_FOUND", "Brand was not found in the catalogue.", 404)
                if owner != medicine_id:
                    raise AppError("INCOMPATIBLE_PAIR", "Brand does not match this exact medicine pack.", 422)
                brand = next(row for row in item["brand_products"] if row["brand_id"] == brand_id)

            generic = item["pmbjp_price"]
            market = brand["market_price"] if brand is not None else None
            reason = None
            if item["record_status"] != "verified":
                reason = "unverified_record"
            elif market is None:
                reason = "market_mrp_unavailable" if brand is not None else "brand_not_selected"
            elif generic is None:
                reason = "pmbjp_price_unavailable"
            elif market["amount_paise"] == 0:
                reason = "zero_market_mrp"
            saving = None
            line_market_total = line_generic_total = None
            if reason is None:
                line_market_total = market["amount_paise"] * pack_count
                line_generic_total = generic["amount_paise"] * pack_count
                saving = line_market_total - line_generic_total
                market_total += line_market_total
                generic_total += line_generic_total
                comparable += 1
            lines.append({
                "medicine_id": medicine_id,
                "brand_id": brand_id,
                "molecule_label": item["molecule_label"],
                "strength_label": item["strength_label"],
                "form": item["form"],
                "release_type": item["release_type"],
                "pack_label": _pack_label(item),
                "pack_count": pack_count,
                "product_code": item["product_code"],
                "market_price": _public_price(market),
                "nppa_ceiling_price": _public_price(item["nppa_ceiling_price"]),
                "pmbjp_price": _public_price(generic),
                "market_total_paise": line_market_total,
                "pmbjp_total_paise": line_generic_total,
                "saving_paise": saving,
                "saving_percent": _percent(saving, line_market_total) if saving is not None else None,
                "comparison_basis": _pack_label(item),
                "excluded_reason": reason,
            })
        difference = market_total - generic_total
        return {
            "items": lines,
            "totals": {
                "comparable_item_count": comparable,
                "incomplete_item_count": len(lines) - comparable,
                "market_total_paise": market_total,
                "pmbjp_total_paise": generic_total,
                "saving_total_paise": difference,
                "saving_percent": _percent(difference, market_total),
            },
            "savings_label": (
                "No comparable items" if comparable == 0 else
                "Estimated potential savings" if difference > 0 else
                "Estimated extra cost" if difference < 0 else "No estimated price difference"
            ),
            "disclaimer": "Informational only — confirm with doctor or pharmacist before substituting.",
        }
