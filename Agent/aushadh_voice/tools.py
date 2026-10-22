"""Authenticated read-only backend tools for medicine usage summaries and sourced Kendras."""

from __future__ import annotations

import logging
import re
from typing import Any, Mapping

import httpx

from aushadh_voice.conversation import VerifiedFact

logger = logging.getLogger(__name__)

_CATALOGUE_ID = re.compile(r"[A-Za-z0-9][A-Za-z0-9_-]{0,63}\Z")
_CITY_ID = re.compile(r"[A-Za-z0-9][A-Za-z0-9_-]{0,63}\Z")


class ToolError(Exception):
    """Base error for read-only tools."""


class MedicineUnavailable(ToolError):
    """The requested medicine fact is unverified or missing."""


class StoreLookupUnavailable(ToolError):
    """Store lookup endpoint is unavailable."""


class BackendReadOnlyTools:
    """Read-only client. Absolutely no write endpoints (no POST/PUT/DELETE) can be invoked."""

    def __init__(self, base_url: str, token: str, *, transport: httpx.AsyncBaseTransport | None = None):
        self._base_url = base_url.rstrip("/")
        self._token = token
        self._transport = transport

    def __getattr__(self, name: str) -> Any:
        if name.lower() in {"post", "put", "patch", "delete", "write"}:
            raise AttributeError("Read-only client: write operations are forbidden")
        raise AttributeError(f"'{type(self).__name__}' has no attribute '{name}'")

    async def fetch_medicine_usage(self, medicine_id: str) -> VerifiedFact | None:
        """Fetch reviewed molecule/usage fact by confirmed catalogue ID.
        
        Caller speech is untrusted: medicine_id is strictly validated against
        the catalogue pattern to prevent path traversal or prompt injection.
        """
        cleaned_id = medicine_id.strip()
        if not _CATALOGUE_ID.fullmatch(cleaned_id):
            raise ValueError("Invalid medicine catalogue ID format")

        try:
            async with httpx.AsyncClient(timeout=5.0, transport=self._transport, trust_env=False) as client:
                res = await client.get(
                    f"{self._base_url}/api/v1/internal/medicines/{cleaned_id}",
                    headers={"Authorization": f"Bearer {self._token}"},
                )
                if res.status_code == 404:
                    return None
                if res.status_code in (401, 403):
                    raise PermissionError("Unauthorized medicine fact access: invalid token")
                res.raise_for_status()
                payload = res.json()
        except (httpx.HTTPError, ValueError) as exc:
            if isinstance(exc, PermissionError):
                raise
            raise MedicineUnavailable("Medicine backend unavailable") from exc

        if not isinstance(payload, dict):
            return None

        # Only reviewed, verified usage summaries count as verified facts
        is_verified = bool(payload.get("verified", False))
        usage_summary = str(payload.get("usage_summary", "")).strip()
        name = str(payload.get("name", cleaned_id)).strip()

        if not is_verified or not usage_summary:
            return None

        return VerifiedFact(kind="medicine_usage", label=name, value=usage_summary)

    async def lookup_kendras(
        self,
        *,
        city_id: str = "",
        lat: float | None = None,
        lng: float | None = None,
    ) -> tuple[VerifiedFact, ...]:
        """Fetch verified Jan Aushadhi Kendras for a confirmed city or location."""
        params: dict[str, Any] = {}
        if city_id:
            cleaned_city = city_id.strip()
            if not _CITY_ID.fullmatch(cleaned_city):
                raise ValueError("Invalid city ID format")
            params["city_id"] = cleaned_city

        if lat is not None and lng is not None:
            if not (-90.0 <= lat <= 90.0 and -180.0 <= lng <= 180.0):
                raise ValueError("Invalid coordinates: lat must be [-90, 90], lng [-180, 180]")
            params["lat"] = lat
            params["lng"] = lng

        if not params:
            raise ValueError("Must provide either confirmed city_id or coordinates")

        try:
            async with httpx.AsyncClient(timeout=5.0, transport=self._transport, trust_env=False) as client:
                res = await client.get(
                    f"{self._base_url}/api/v1/stores",
                    params=params,
                )
                if res.status_code in (404, 503):
                    return ()
                res.raise_for_status()
                payload = res.json()
        except (httpx.HTTPError, ValueError) as exc:
            raise StoreLookupUnavailable("Stores backend unavailable") from exc

        places = payload if isinstance(payload, list) else payload.get("stores", [])
        if not isinstance(places, list):
            return ()

        facts: list[VerifiedFact] = []
        for p in places:
            if not isinstance(p, dict):
                continue
            # Accept only verified Kendra records (ignore unverified generic pharmacies)
            if p.get("kind") != "kendra":
                continue
            name = str(p.get("name", "Jan Aushadhi Kendra")).strip()
            addr = str(p.get("address", "")).strip()
            hours = str(p.get("hours", "")).strip()
            details = f"{addr} (Open: {hours})" if hours else addr
            if details:
                facts.append(VerifiedFact(kind="store", label=name, value=details))

        return tuple(facts)
