"""Tests for Phase B5 places, stores and routing APIs."""

from __future__ import annotations

import unittest
from typing import Any

import httpx
from starlette.testclient import TestClient

from app.config import Settings
from app.main import create_app
from app.places.osm import PlacesOSMAdapter
from app.places.service import PlacesService


class PlacesAndRoutingTests(unittest.TestCase):
    def setUp(self) -> None:
        self.settings = Settings(
            _env_file=None,
            app_origin="https://aushadhai.example",
            osrm_base_url="https://router.project-osrm.org",
            overpass_base_url="https://overpass-api.de/api/interpreter",
        )
        self.app = create_app(self.settings)

        def default_mock(request: httpx.Request) -> httpx.Response:
            if "overpass" in str(request.url):
                return httpx.Response(200, json={"elements": []})
            return httpx.Response(404)

        self.app.state.places.osm_adapter.transport = httpx.MockTransport(default_mock)
        self.client = TestClient(self.app, base_url="https://aushadhai.example")

    def test_cities_returns_curated_list(self) -> None:
        response = self.client.get("/api/v1/cities")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIsInstance(data, list)
        self.assertGreaterEqual(len(data), 5)
        delhi = next((c for c in data if c["city_id"] == "delhi"), None)
        self.assertIsNotNone(delhi)
        self.assertEqual(delhi["name"], "Delhi")
        self.assertEqual(delhi["state"], "Delhi")
        for city in data:
            self.assertIn("city_id", city)
            self.assertIn("name", city)
            self.assertIn("state", city)

    def test_missing_coordinates_and_city_rejected_with_400(self) -> None:
        # Neither city nor lat/lng
        res1 = self.client.get("/api/v1/stores")
        self.assertEqual(res1.status_code, 400)
        self.assertEqual(res1.json()["error"]["code"], "MISSING_LOCATION")

        # Only lat without lng
        res2 = self.client.get("/api/v1/stores?lat=28.6139")
        self.assertEqual(res2.status_code, 400)
        self.assertEqual(res2.json()["error"]["code"], "INVALID_COORDINATES")

        # Only lng without lat
        res3 = self.client.get("/api/v1/stores?lng=77.2090")
        self.assertEqual(res3.status_code, 400)
        self.assertEqual(res3.json()["error"]["code"], "INVALID_COORDINATES")

    def test_unknown_city_returns_404(self) -> None:
        response = self.client.get("/api/v1/stores?city_id=atlantis")
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json()["error"]["code"], "CITY_NOT_FOUND")

    def test_stores_by_city_returns_kendras_with_verified_source_and_no_distance(self) -> None:
        response = self.client.get("/api/v1/stores?city_id=delhi")
        self.assertEqual(response.status_code, 200)
        stores = response.json()
        self.assertIsInstance(stores, list)
        self.assertGreater(len(stores), 0)

        # Kendras should have kind == "kendra", verified source, and distance_m is None
        kendras = [s for s in stores if s["kind"] == "kendra"]
        self.assertGreater(len(kendras), 0)
        k = kendras[0]
        self.assertIsNone(k["distance_m"])  # No origin coordinates provided
        self.assertEqual(k["source"]["provider"], "PMBI")
        self.assertIn("Janaushadhi", k["source"]["attribution"])
        self.assertTrue(k["source"]["document_ref"])
        self.assertTrue(k["lat"])
        self.assertTrue(k["lng"])

    def test_stores_by_coordinates_returns_near_far_sorted(self) -> None:
        # Near Connaught place Kendra (28.6315, 77.2167)
        response = self.client.get("/api/v1/stores?lat=28.6310&lng=77.2160")
        self.assertEqual(response.status_code, 200)
        stores = response.json()
        self.assertIsInstance(stores, list)
        self.assertGreater(len(stores), 0)

        # All records must have distance_m calculated
        for s in stores:
            self.assertIsNotNone(s["distance_m"])

        # Check ascending sort (near to far)
        distances = [s["distance_m"] for s in stores if s["distance_m"] is not None]
        self.assertEqual(distances, sorted(distances))

    def test_zero_kendras_city_returns_no_invented_kendras(self) -> None:
        # Shimla has no curated Kendras
        response = self.client.get("/api/v1/stores?city_id=shimla")
        self.assertEqual(response.status_code, 200)
        stores = response.json()
        kendras = [s for s in stores if s["kind"] == "kendra"]
        self.assertEqual(len(kendras), 0)

    def test_osm_pharmacies_retain_actual_kind_never_relabeled_as_kendra(self) -> None:
        # Mock Overpass response returning a pharmacy, clinic, and hospital
        mock_overpass_payload = {
            "elements": [
                {
                    "type": "node",
                    "id": 101,
                    "lat": 28.6320,
                    "lon": 77.2170,
                    "tags": {
                        "amenity": "pharmacy",
                        "name": "Apollo Pharmacy",
                        "addr:street": "Barakhamba Road",
                    },
                },
                {
                    "type": "node",
                    "id": 102,
                    "lat": 28.6330,
                    "lon": 77.2180,
                    "tags": {
                        "amenity": "clinic",
                        "name": "Dr. Lal PathLabs Clinic",
                    },
                },
                {
                    "type": "way",
                    "id": 103,
                    "center": {"lat": 28.6340, "lon": 77.2190},
                    "tags": {
                        "amenity": "hospital",
                        "name": "Ram Manohar Lohia Hospital",
                    },
                },
            ]
        }

        def mock_handler(request: httpx.Request) -> httpx.Response:
            if "overpass" in str(request.url):
                return httpx.Response(200, json=mock_overpass_payload)
            return httpx.Response(404)

        transport = httpx.MockTransport(mock_handler)
        adapter = PlacesOSMAdapter(self.settings, transport=transport)
        service = PlacesService(self.settings, osm_adapter=adapter)
        app = create_app(self.settings)
        app.state.places = service
        client = TestClient(app, base_url="https://aushadhai.example")

        response = client.get("/api/v1/stores?lat=28.6315&lng=77.2167")
        self.assertEqual(response.status_code, 200)
        stores = response.json()

        pharmacies = [s for s in stores if s["kind"] == "pharmacy"]
        clinics = [s for s in stores if s["kind"] == "clinic"]
        hospitals = [s for s in stores if s["kind"] == "hospital"]

        self.assertGreaterEqual(len(pharmacies), 1)
        self.assertGreaterEqual(len(clinics), 1)
        self.assertGreaterEqual(len(hospitals), 1)

        for p in pharmacies + clinics + hospitals:
            self.assertNotEqual(p["kind"], "kendra")
            self.assertEqual(p["source"]["provider"], "OpenStreetMap")
            self.assertIn("OpenStreetMap", p["source"]["attribution"])

    def test_overpass_outage_graceful_degradation(self) -> None:
        # Mock Overpass failing with 500 error
        def mock_handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(500, text="Internal Server Error")

        transport = httpx.MockTransport(mock_handler)
        adapter = PlacesOSMAdapter(self.settings, transport=transport)
        service = PlacesService(self.settings, osm_adapter=adapter)
        app = create_app(self.settings)
        app.state.places = service
        client = TestClient(app, base_url="https://aushadhai.example")

        # Must still succeed and return curated Kendras
        response = client.get("/api/v1/stores?city_id=delhi")
        self.assertEqual(response.status_code, 200)
        stores = response.json()
        self.assertGreater(len(stores), 0)
        self.assertTrue(all(s["kind"] == "kendra" for s in stores))

    def test_route_driving_success_with_osrm_geojson_and_steps(self) -> None:
        mock_osrm_payload = {
            "code": "Ok",
            "routes": [
                {
                    "distance": 8450.2,
                    "duration": 960.5,
                    "geometry": {
                        "type": "LineString",
                        "coordinates": [
                            [77.2167, 28.6315],
                            [77.2130, 28.6000],
                            [77.2100, 28.5672],
                        ],
                    },
                    "legs": [
                        {
                            "steps": [
                                {
                                    "maneuver": {"instruction": "Head south on Palika Marg"},
                                    "distance": 450.0,
                                    "duration": 60.0,
                                },
                                {
                                    "name": "Barakhamba Road",
                                    "distance": 8000.2,
                                    "duration": 900.5,
                                },
                            ]
                        }
                    ],
                }
            ],
        }

        def mock_handler(request: httpx.Request) -> httpx.Response:
            if "route/v1/driving" in str(request.url):
                return httpx.Response(200, json=mock_osrm_payload)
            return httpx.Response(404)

        transport = httpx.MockTransport(mock_handler)
        adapter = PlacesOSMAdapter(self.settings, transport=transport)
        service = PlacesService(self.settings, osm_adapter=adapter)
        app = create_app(self.settings)
        app.state.places = service
        client = TestClient(app, base_url="https://aushadhai.example")

        response = client.get(
            "/api/v1/routes?from_lat=28.6315&from_lng=77.2167&to_lat=28.5672&to_lng=77.2100&mode=driving"
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["distance_m"], 8450)
        self.assertEqual(data["duration_s"], 960)
        self.assertEqual(data["profile"], "driving")
        self.assertEqual(data["provider"], "osrm")
        self.assertEqual(data["geometry_geojson"]["type"], "LineString")
        self.assertEqual(len(data["steps"]), 2)
        self.assertEqual(data["steps"][0]["instruction"], "Head south on Palika Marg")
        self.assertEqual(data["steps"][0]["distance_m"], 450)

    def test_route_unsupported_mode_walking_rejected(self) -> None:
        response = self.client.get(
            "/api/v1/routes?from_lat=28.6315&from_lng=77.2167&to_lat=28.5672&to_lng=77.2100&mode=walking"
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["error"]["code"], "UNSUPPORTED_ROUTING_MODE")

    def test_route_invalid_coordinates_range_rejected(self) -> None:
        # Invalid latitude (95 > 90)
        response = self.client.get(
            "/api/v1/routes?from_lat=95.0&from_lng=77.2167&to_lat=28.5672&to_lng=77.2100&mode=driving"
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["error"]["code"], "VALIDATION_ERROR")

    def test_route_too_long_rejected(self) -> None:
        # Delhi to London (> 5000 km)
        response = self.client.get(
            "/api/v1/routes?from_lat=28.6139&from_lng=77.2090&to_lat=51.5074&to_lng=-0.1278&mode=driving"
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["error"]["code"], "ROUTE_TOO_LONG")

    def test_route_no_route_returns_404(self) -> None:
        def mock_handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(200, json={"code": "NoRoute"})

        transport = httpx.MockTransport(mock_handler)
        adapter = PlacesOSMAdapter(self.settings, transport=transport)
        service = PlacesService(self.settings, osm_adapter=adapter)
        app = create_app(self.settings)
        app.state.places = service
        client = TestClient(app, base_url="https://aushadhai.example")

        response = client.get(
            "/api/v1/routes?from_lat=28.6315&from_lng=77.2167&to_lat=28.5672&to_lng=77.2100&mode=driving"
        )
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json()["error"]["code"], "ROUTE_NOT_FOUND")

    def test_osrm_outage_returns_503(self) -> None:
        def mock_handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(502, text="Bad Gateway")

        transport = httpx.MockTransport(mock_handler)
        adapter = PlacesOSMAdapter(self.settings, transport=transport)
        service = PlacesService(self.settings, osm_adapter=adapter)
        app = create_app(self.settings)
        app.state.places = service
        client = TestClient(app, base_url="https://aushadhai.example")

        response = client.get(
            "/api/v1/routes?from_lat=28.6315&from_lng=77.2167&to_lat=28.5672&to_lng=77.2100&mode=driving"
        )
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json()["error"]["code"], "ROUTING_UNAVAILABLE")

    def test_capabilities_shows_stores_and_routes_true(self) -> None:
        response = self.client.get("/api/v1/capabilities")
        self.assertEqual(response.status_code, 200)
        caps = response.json()
        self.assertTrue(caps["stores"])
        self.assertTrue(caps["routes"])


if __name__ == "__main__":
    unittest.main()
