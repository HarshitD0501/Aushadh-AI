"""Validated runtime configuration with no dependency on external services."""

from pathlib import Path
from urllib.parse import urlsplit

from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


_BACKEND_DIR = Path(__file__).resolve().parents[1]


class Settings(BaseSettings):
    """Configuration loaded once when the application is created.

    Integration credentials are intentionally not modelled until their phase.
    Unknown future values in ``.env`` are ignored so B0 works with the shared
    template and does not require WhatsApp, database, or voice credentials.
    """

    model_config = SettingsConfigDict(
        env_file=_BACKEND_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    app_origin: str = "http://localhost:5173"
    database_url: SecretStr | None = None
    max_request_body_bytes: int = Field(default=1_048_576, ge=1_024, le=20_971_520)
    upstream_timeout_seconds: float = Field(default=10.0, gt=0, le=60)

    @field_validator("app_origin")
    @classmethod
    def validate_app_origin(cls, value: str) -> str:
        normalized = value.strip().rstrip("/")
        parsed = urlsplit(normalized)
        if (
            parsed.scheme not in {"http", "https"}
            or not parsed.hostname
            or parsed.username
            or parsed.password
            or parsed.path
            or parsed.query
            or parsed.fragment
        ):
            raise ValueError("APP_ORIGIN must be one http(s) origin without a path")
        return normalized

    @field_validator("database_url", mode="before")
    @classmethod
    def empty_database_url_is_unset(cls, value: object) -> object:
        return None if value == "" else value
