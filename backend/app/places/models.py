"""Data models for cities, places and routing."""

from __future__ import annotations

from typing import Any, Literal
from pydantic import BaseModel, Field


class City(BaseModel):
    city_id: str
    name: str
    state: str


class PlaceSource(BaseModel):
    provider: str
    attribution: str
    license: str
    document_ref: str | None = None
    source_url: str | None = None
    checked_on: str | None = None


class PlaceRecord(BaseModel):
    id: str
    name: str
    kind: Literal["kendra", "pharmacy", "clinic", "hospital"]
    lat: float
    lng: float
    address: str | None = None
    hours: str | None = None
    contact: str | None = None
    city_id: str | None = None
    distance_m: int | None = None
    source: PlaceSource


class RouteStep(BaseModel):
    instruction: str
    distance_m: int
    duration_s: int


class RouteResponse(BaseModel):
    distance_m: int
    duration_s: int
    geometry_geojson: dict[str, Any]
    steps: list[RouteStep]
    profile: Literal["driving"]
    provider: Literal["osrm"]
