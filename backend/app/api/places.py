"""HTTP endpoints for curated cities, verified Kendras, OSM places, and routes."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Query, Request

from app.places.models import City, PlaceRecord, RouteResponse

router = APIRouter(prefix="/api/v1", tags=["places"])


@router.get("/cities", response_model=list[City])
async def get_cities(request: Request) -> list[City]:
    """Return curated city choices with verified Jan Aushadhi coverage."""
    return request.app.state.places.get_cities()


@router.get("/stores", response_model=list[PlaceRecord])
async def get_stores(
    request: Request,
    city_id: Annotated[str | None, Query(max_length=60, pattern=r"^[a-z0-9-]+$")] = None,
    lat: Annotated[float | None, Query(ge=-90.0, le=90.0)] = None,
    lng: Annotated[float | None, Query(ge=-180.0, le=180.0)] = None,
    radius_m: Annotated[int, Query(ge=100, le=50000)] = 5000,
    limit: Annotated[int, Query(ge=1, le=50)] = 20,
) -> list[PlaceRecord]:
    """Return verified Kendras and OSM places (pharmacies, clinics, hospitals).

    - If lat/lng are provided, records include distance_m sorted nearest first.
    - If queried by city_id without lat/lng, distance_m is None.
    - Curated Kendras have verified PMBI provenance; OSM places retain actual kind.
    """
    return await request.app.state.places.get_stores(
        city_id=city_id,
        lat=lat,
        lng=lng,
        radius_m=radius_m,
        limit=limit,
    )


@router.get("/routes", response_model=RouteResponse)
async def get_route(
    request: Request,
    from_lat: Annotated[float, Query(ge=-90.0, le=90.0)],
    from_lng: Annotated[float, Query(ge=-180.0, le=180.0)],
    to_lat: Annotated[float, Query(ge=-90.0, le=90.0)],
    to_lng: Annotated[float, Query(ge=-180.0, le=180.0)],
    mode: Annotated[str, Query(min_length=1, max_length=20)] = "driving",
) -> RouteResponse:
    """Calculate driving route geometry and steps between coordinates via OSRM."""
    return await request.app.state.places.get_route(
        from_lat=from_lat,
        from_lng=from_lng,
        to_lat=to_lat,
        to_lng=to_lng,
        mode=mode,
    )
