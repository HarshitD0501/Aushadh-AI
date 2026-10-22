"""OpenStreetMap Overpass adapter and OSRM routing client."""

from __future__ import annotations

import logging
import math
import time
from datetime import date
from typing import Any

import httpx

from app.config import Settings
from app.errors import AppError
from app.places.models import PlaceRecord, PlaceSource, RouteResponse, RouteStep

logger = logging.getLogger("aushadhai.places")


def haversine_distance_m(lat1: float, lng1: float, lat2: float, lng2: float) -> int:
    """Calculate the great-circle distance between two points on Earth in meters."""
    r = 6371000.0
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lng2 - lng1)
    a = (
        math.sin(delta_phi / 2.0) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    )
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return int(round(r * c))


class PlacesOSMAdapter:
    """Rate-limited, cached adapter for OpenStreetMap Overpass API and OSRM."""

    def __init__(
        self,
        settings: Settings,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        self.settings = settings
        self.transport = transport
        self._places_cache: dict[str, tuple[float, list[PlaceRecord]]] = {}
        self._last_overpass_request: float = 0.0

    async def query_osm_places(
        self,
        lat: float,
        lng: float,
        radius_m: int = 5000,
        limit: int = 20,
    ) -> list[PlaceRecord]:
        """Query nearby pharmacies, clinics and hospitals via Overpass.

        Degrades gracefully to empty list on Overpass outage, timeout or rate-limits.
        Never relabels OSM places as Kendras.
        """
        cache_key = f"{round(lat, 3)}:{round(lng, 3)}:{radius_m}"
        now = time.monotonic()
        if cache_key in self._places_cache:
            cached_at, cached_records = self._places_cache[cache_key]
            if now - cached_at < self.settings.places_cache_ttl_seconds:
                return cached_records[:limit]

        query = (
            f"[out:json][timeout:5];\n"
            f"(\n"
            f'  node["amenity"~"^(pharmacy|clinic|hospital)$"](around:{radius_m},{lat:.5f},{lng:.5f});\n'
            f'  way["amenity"~"^(pharmacy|clinic|hospital)$"](around:{radius_m},{lat:.5f},{lng:.5f});\n'
            f");\n"
            f"out center {limit};\n"
        )

        try:
            async with httpx.AsyncClient(
                timeout=self.settings.upstream_timeout_seconds,
                transport=self.transport,
            ) as client:
                response = await client.post(
                    self.settings.overpass_base_url,
                    data={"data": query},
                    headers={"Accept": "application/json"},
                )
                if response.status_code != 200:
                    logger.warning("Overpass returned status %s", response.status_code)
                    return []
                data = response.json()
        except Exception as exc:
            logger.warning("Overpass request failed: %s", type(exc).__name__)
            return []

        elements = data.get("elements", [])
        records: list[PlaceRecord] = []
        today_iso = date.today().isoformat()

        for el in elements:
            tags = el.get("tags", {})
            amenity = tags.get("amenity")
            if amenity not in {"pharmacy", "clinic", "hospital"}:
                continue

            kind: Any = amenity
            el_lat = el.get("lat") or el.get("center", {}).get("lat")
            el_lng = el.get("lon") or el.get("center", {}).get("lon")
            if el_lat is None or el_lng is None:
                continue

            name = (
                tags.get("name")
                or tags.get("name:en")
                or f"Local {kind.capitalize()}"
            )
            address_parts = [
                tags.get("addr:housenumber"),
                tags.get("addr:street"),
                tags.get("addr:suburb") or tags.get("addr:district"),
                tags.get("addr:city"),
                tags.get("addr:postcode"),
            ]
            address = ", ".join(p for p in address_parts if p) or tags.get("addr:full")
            hours = tags.get("opening_hours")
            contact = tags.get("phone") or tags.get("contact:phone")
            osm_type = el.get("type", "node")
            osm_id = el.get("id", "")

            records.append(
                PlaceRecord(
                    id=f"osm-{osm_type}-{osm_id}",
                    name=name,
                    kind=kind,
                    lat=float(el_lat),
                    lng=float(el_lng),
                    address=address,
                    hours=hours,
                    contact=contact,
                    distance_m=haversine_distance_m(lat, lng, float(el_lat), float(el_lng)),
                    source=PlaceSource(
                        provider="OpenStreetMap",
                        attribution="© OpenStreetMap contributors",
                        license="ODbL 1.0",
                        source_url=f"https://www.openstreetmap.org/{osm_type}/{osm_id}",
                        checked_on=today_iso,
                    ),
                )
            )

        self._places_cache[cache_key] = (now, records)
        return records[:limit]

    async def get_route(
        self,
        from_lat: float,
        from_lng: float,
        to_lat: float,
        to_lng: float,
        mode: str = "driving",
    ) -> RouteResponse:
        """Fetch driving route geometry and steps from OSRM."""
        if mode != "driving":
            raise AppError(
                code="UNSUPPORTED_ROUTING_MODE",
                message=f"Mode '{mode}' is not supported. Only 'driving' profile is configured.",
                status_code=400,
            )

        if not (-90.0 <= from_lat <= 90.0 and -90.0 <= to_lat <= 90.0):
            raise AppError(
                code="INVALID_COORDINATES",
                message="Latitude must be between -90 and 90 degrees.",
                status_code=400,
            )
        if not (-180.0 <= from_lng <= 180.0 and -180.0 <= to_lng <= 180.0):
            raise AppError(
                code="INVALID_COORDINATES",
                message="Longitude must be between -180 and 180 degrees.",
                status_code=400,
            )

        straight_distance = haversine_distance_m(from_lat, from_lng, to_lat, to_lng)
        if straight_distance > 500_000:
            raise AppError(
                code="ROUTE_TOO_LONG",
                message="Requested coordinates exceed maximum supported routing distance (500 km).",
                status_code=400,
            )

        url = (
            f"{self.settings.osrm_base_url.rstrip('/')}/route/v1/driving/"
            f"{from_lng:.6f},{from_lat:.6f};{to_lng:.6f},{to_lat:.6f}"
            f"?overview=full&geometries=geojson&steps=true"
        )

        try:
            async with httpx.AsyncClient(
                timeout=self.settings.upstream_timeout_seconds,
                transport=self.transport,
            ) as client:
                response = await client.get(url)
                if response.status_code != 200:
                    logger.warning("OSRM upstream returned status %s", response.status_code)
                    raise AppError(
                        code="ROUTING_UNAVAILABLE",
                        message="Route calculation service is temporarily unavailable.",
                        status_code=503,
                    )
                data = response.json()
        except AppError:
            raise
        except Exception as exc:
            logger.warning("OSRM request failed: %s", type(exc).__name__)
            raise AppError(
                code="ROUTING_UNAVAILABLE",
                message="Route calculation service is temporarily unavailable.",
                status_code=503,
            ) from exc

        code = data.get("code")
        if code == "NoRoute":
            raise AppError(
                code="ROUTE_NOT_FOUND",
                message="No route found between the specified coordinates.",
                status_code=404,
            )
        if code != "Ok" or not data.get("routes"):
            raise AppError(
                code="ROUTING_UNAVAILABLE",
                message="Route calculation service returned an unexpected response.",
                status_code=503,
            )

        route = data["routes"][0]
        distance_m = int(round(route.get("distance", 0)))
        duration_s = int(round(route.get("duration", 0)))
        geometry_geojson = route.get("geometry", {})

        steps: list[RouteStep] = []
        for leg in route.get("legs", []):
            for step in leg.get("steps", []):
                instruction = (
                    step.get("maneuver", {}).get("instruction")
                    or step.get("name")
                    or "Continue"
                )
                steps.append(
                    RouteStep(
                        instruction=instruction,
                        distance_m=int(round(step.get("distance", 0))),
                        duration_s=int(round(step.get("duration", 0))),
                    )
                )

        return RouteResponse(
            distance_m=distance_m,
            duration_s=duration_s,
            geometry_geojson=geometry_geojson,
            steps=steps,
            profile="driving",
            provider="osrm",
        )
