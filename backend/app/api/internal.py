"""Protected internal endpoints for AI agent and server-to-server operations."""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Header, Request
from pydantic import BaseModel

from app.catalogue.service import CatalogueService
from app.config import Settings
from app.errors import AppError


router = APIRouter(prefix="/api/v1/internal", tags=["internal"])


def _verify_agent_token(
    request: Request,
    authorization: str | None,
) -> None:
    settings: Settings = request.app.state.settings
    if not settings.agent_backend_token:
        raise AppError("AGENT_AUTH_DISABLED", "Agent backend token is not configured on the server.", 503)
    if not authorization:
        raise AppError("UNAUTHORIZED", "Agent authorization header is required.", 401)
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or token.strip() != settings.agent_backend_token.get_secret_value():
        raise AppError("FORBIDDEN", "Invalid agent authorization token.", 403)


class UsageSummary(BaseModel):
    hi: str
    en: str
    source: dict[str, Any]


class MedicineFact(BaseModel):
    medicine_id: str
    product_code: str | None
    molecule_label: str
    strength_label: str
    form: str
    release_type: str | None
    pack_label: str
    record_status: str
    has_usage_summary: bool
    usage_summary: UsageSummary | None
    source: dict[str, Any]


@router.get("/medicines/{medicine_id}", response_model=MedicineFact)
async def get_medicine_fact(
    medicine_id: str,
    request: Request,
    authorization: Annotated[str | None, Header()] = None,
) -> dict[str, Any]:
    _verify_agent_token(request, authorization)
    catalogue: CatalogueService = request.app.state.catalogue
    item = catalogue.records.get(medicine_id)
    if item is None:
        raise AppError("NOT_FOUND", f"Medicine '{medicine_id}' was not found in the catalogue.", 404)

    usage = item.get("usage_summary")
    has_summary = bool(usage and isinstance(usage, dict) and usage.get("hi") and usage.get("en"))
    quantity = item["pack"]["quantity"]
    unit = item["pack"]["unit"]
    pack_label = f"{quantity} {unit if quantity == 1 else unit + 's'}"

    return {
        "medicine_id": item["medicine_id"],
        "product_code": item.get("product_code"),
        "molecule_label": item["molecule_label"],
        "strength_label": item["strength_label"],
        "form": item["form"],
        "release_type": item.get("release_type"),
        "pack_label": pack_label,
        "record_status": item["record_status"],
        "has_usage_summary": has_summary,
        "usage_summary": usage if has_summary else None,
        "source": item["source"],
    }
