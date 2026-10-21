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
    max_request_body_bytes: int = Field(default=6_291_456, ge=1_024, le=20_971_520)
    upstream_timeout_seconds: float = Field(default=10.0, gt=0, le=60)
    ocr_max_image_bytes: int = Field(default=5_000_000, ge=65_536, le=10_000_000)
    ocr_max_image_pixels: int = Field(default=12_000_000, ge=1_000_000, le=20_000_000)
    ocr_worker_count: int = Field(default=2, ge=1, le=4)
    ocr_timeout_seconds: float = Field(default=15.0, ge=1, le=30)
    tesseract_cmd: str | None = None
    gemma_model: str = "gemma-4-26b-a4b-it"
    gemma_api_base_url: str = "https://generativelanguage.googleapis.com"
    gemma_api_key: SecretStr | None = None
    groq_api_key: SecretStr | None = None
    groq_normalizer_model: str | None = None
    normalization_timeout_seconds: float = Field(default=4.0, ge=0.5, le=10)
    agent_backend_token: SecretStr | None = None

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

    @field_validator("gemma_api_base_url")
    @classmethod
    def validate_gemma_api_base_url(cls, value: str) -> str:
        normalized = value.strip().rstrip("/")
        parsed = urlsplit(normalized)
        if (
            parsed.scheme != "https"
            or not parsed.hostname
            or parsed.username
            or parsed.password
            or parsed.query
            or parsed.fragment
        ):
            raise ValueError("GEMMA_API_BASE_URL must be an HTTPS base URL without credentials, query, or fragment")
        return normalized

    @field_validator("database_url", mode="before")
    @classmethod
    def empty_database_url_is_unset(cls, value: object) -> object:
        return None if value == "" else value

    @field_validator("gemma_api_key", "groq_api_key", "agent_backend_token", mode="before")
    @classmethod
    def empty_provider_key_is_unset(cls, value: object) -> object:
        return None if value == "" else value

    @field_validator("groq_normalizer_model", mode="before")
    @classmethod
    def empty_model_is_unset(cls, value: object) -> object:
        return None if value == "" else value

