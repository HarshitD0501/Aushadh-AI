"""Domain service for cities, Kendras, OSM places, and routing."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from app.config import Settings
from app.errors import AppError
from app.places.models import City, PlaceRecord, PlaceSource, RouteResponse
from app.places.osm import PlacesOSMAdapter, haversine_distance_m

DATA_DIR = Path(__file__).resolve().parents[2] / "data"
KENDRAS_PATH = DATA_DIR / "kendras.json"


class PlacesService:
    """Manages curated Kendras, city selector, OSM places and routing."""

    def __init__(
        self,
        settings: Settings,
        osm_adapter: PlacesOSMAdapter | None = None,
        kendras_path: Path | None = None,
    ) -> None:
        self.settings = settings
        self.osm_adapter = osm_adapter or PlacesOSMAdapter(settings)
        self.kendras_path = kendras_path or KENDRAS_PATH
        self._load_kendras()

    def _load_kendras(self) -> None:
        with self.kendras_path.open(encoding="utf-8") as handle:
            data = json.load(handle)

        self.cities: list[City] = [
            City(city_id=c["city_id"], name=c["name"], state=c["state"])
            for c in data.get("cities", [])
        ]
        self.cities_by_id: dict[str, dict[str, Any]] = {
            c["city_id"]: c for c in data.get("cities", [])
        }
        self.raw_kendras: list[dict[str, Any]] = data.get("kendras", [])

    def get_cities(self) -> list[City]:
        """Return curated city choices."""
        return self.cities

    async def get_stores(
        self,
        city_id: str | None = None,
        lat: float | None = None,
        lng: float | None = None,
        radius_m: int = 5000,
        limit: int = 20,
    ) -> list[PlaceRecord]:
        """Retrieve separate place records with kind, coordinates, distance, and source provenance.

        - If lat and lng are provided, origin coordinates exist, so distance_m is calculated and
          results are sorted nearest-first.
        - If queried solely by city_id without origin coordinates, distance_m is None.
        - Kendras use curated PMBI verification; OSM places retain kind (pharmacy/clinic/hospital).
        """
        if (lat is not None and lng is None) or (lat is None and lng is not None):
            raise AppError(
                code="INVALID_COORDINATES",
                message="Both lat and lng coordinates must be provided together.",
                status_code=400,
            )

        if city_id is None and lat is None and lng is None:
            raise AppError(
                code="MISSING_LOCATION",
                message="Provide either city_id or lat and lng coordinates.",
                status_code=400,
            )

        if lat is not None and not (-90.0 <= lat <= 90.0):
            raise AppError(
                code="INVALID_COORDINATES",
                message="Latitude must be between -90 and 90 degrees.",
                status_code=400,
            )
        if lng is not None and not (-180.0 <= lng <= 180.0):
            raise AppError(
                code="INVALID_COORDINATES",
                message="Longitude must be between -180 and 180 degrees.",
                status_code=400,
            )

        city_meta: dict[str, Any] | None = None
        if city_id is not None:
            city_meta = self.cities_by_id.get(city_id)
            if city_meta is None:
                raise AppError(
                    code="CITY_NOT_FOUND",
                    message=f"City '{city_id}' is not in the curated directory.",
                    status_code=404,
                )

        results: list[PlaceRecord] = []
        origin_has_coords = lat is not None and lng is not None

        # Filter Kendras
        matching_kendras = []
        if city_id is not None:
            matching_kendras = [k for k in self.raw_kendras if k.get("city_id") == city_id]
        elif origin_has_coords:
            # Match kendras within radius or reasonable vicinity (max 50km)
            for k in self.raw_kendras:
                dist = haversine_distance_m(lat, lng, k["lat"], k["lng"])
                if dist <= max(radius_m, 25000):
                    matching_kendras.append(k)

        for k in matching_kendras:
            dist_m = None
            if origin_has_coords:
                dist_m = haversine_distance_m(lat, lng, k["lat"], k["lng"])

            src = k["source"]
            results.append(
                PlaceRecord(
                    id=k["id"],
                    name=k["name"],
                    kind="kendra",
                    lat=k["lat"],
                    lng=k["lng"],
                    address=k.get("address"),
                    hours=k.get("hours"),
                    contact=k.get("contact"),
                    city_id=k.get("city_id"),
                    distance_m=dist_m,
                    source=PlaceSource(
                        provider="PMBI",
                        attribution="Pradhan Mantri Bhartiya Janaushadhi Pariyojana",
                        license=src.get("license", "Government of India Open Data"),
                        document_ref=src.get("document_ref"),
                        source_url=src.get("source_url"),
                        checked_on=src.get("checked_on"),
                    ),
                )
            )

        # Query OSM places
        search_lat = lat if lat is not None else (city_meta["lat"] if city_meta else None)
        search_lng = lng if lng is not None else (city_meta["lng"] if city_meta else None)

        if search_lat is not None and search_lng is not None:
            osm_places = await self.osm_adapter.query_osm_places(
                search_lat,
                search_lng,
                radius_m=radius_m,
                limit=limit,
            )
            for p in osm_places:
                if not origin_has_coords:
                    # If origin coordinates were not provided by user, distance is None
                    p.distance_m = None
                else:
                    p.distance_m = haversine_distance_m(lat, lng, p.lat, p.lng)
                if city_id:
                    p.city_id = city_id
                results.append(p)

        # Sort: if origin coordinates exist, sort nearest to farthest
        if origin_has_coords:
            results.sort(key=lambda r: r.distance_m if r.distance_m is not None else float("inf"))

        return results[:limit]

    async def get_route(
        self,
        from_lat: float,
        from_lng: float,
        to_lat: float,
        to_lng: float,
        mode: str = "driving",
    ) -> RouteResponse:
        """Calculate route between coordinates."""
        return await self.osm_adapter.get_route(
            from_lat=from_lat,
            from_lng=from_lng,
            to_lat=to_lat,
            to_lng=to_lng,
            mode=mode,
        )
