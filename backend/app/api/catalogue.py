"""Read-only search and confirmed comparison endpoints."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Query, Request, Response
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field

from app.catalogue.service import CatalogueService


router = APIRouter(prefix="/api/v1", tags=["catalogue"])


class BrandLabel(BaseModel):
    brand_id: str
    name: str


class PublicRecord(BaseModel):
    medicine_id: str
    molecule_label: str
    strength_label: str
    form: str
    release_type: str | None
    pack_label: str
    brands: list[BrandLabel]


class PublicCatalogue(BaseModel):
    version: str
    checked_on: str
    records: list[PublicRecord]


class SearchCandidate(PublicRecord):
    matched_text: str
    match_score: int
    requires_confirmation: bool


class SearchResult(BaseModel):
    query: str
    candidates: list[SearchCandidate]


class CompareItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    medicine_id: str = Field(min_length=1, max_length=80, pattern=r"^[a-z0-9-]+$")
    brand_id: str | None = Field(default=None, max_length=80, pattern=r"^[a-z0-9-]+$")
    pack_count: int = Field(default=1, strict=True, ge=1, le=30)


class CompareRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: list[CompareItem] = Field(min_length=1, max_length=20)


class SourcedPrice(BaseModel):
    amount_paise: int
    currency: str
    unit: str
    source_url: str
    checked_on: str


class MedicineSource(BaseModel):
    source_url: str
    document_ref: str
    row_ref: str
    checked_on: str
    source_as_of: str


class CompareLine(BaseModel):
    medicine_id: str
    brand_id: str | None
    molecule_label: str
    strength_label: str
    form: str
    release_type: str | None
    pack_label: str
    pack_count: int
    product_code: str | None
    market_price: SourcedPrice | None
    nppa_ceiling_price: SourcedPrice | None
    pmbjp_price: SourcedPrice | None
    market_total_paise: int | None
    pmbjp_total_paise: int | None
    saving_paise: int | None
    saving_percent: float | None
    comparison_basis: str
    excluded_reason: str | None
    source: MedicineSource | None = None


class CompareTotals(BaseModel):
    comparable_item_count: int
    incomplete_item_count: int
    market_total_paise: int
    pmbjp_total_paise: int
    saving_total_paise: int
    saving_percent: float | None


class CompareResult(BaseModel):
    items: list[CompareLine]
    totals: CompareTotals
    savings_label: str
    disclaimer: str


def _catalogue(request: Request) -> CatalogueService:
    return request.app.state.catalogue


@router.get("/catalogue/public", response_model=PublicCatalogue)
async def public_catalogue(request: Request) -> Response:
    catalogue = _catalogue(request)
    headers = {"ETag": catalogue.etag, "Cache-Control": "public, max-age=3600"}
    if request.headers.get("if-none-match") == catalogue.etag:
        return Response(status_code=304, headers=headers)
    return JSONResponse(catalogue.public_document, headers=headers)


@router.get("/search", response_model=SearchResult)
async def search(
    request: Request,
    q: Annotated[str, Query(max_length=120)] = "",
    limit: Annotated[int, Query(ge=1, le=8)] = 8,
) -> dict:
    return _catalogue(request).search(q, limit)


@router.post("/compare", response_model=CompareResult)
async def compare(request: Request, payload: CompareRequest) -> dict:
    return _catalogue(request).compare([item.model_dump() for item in payload.items])
