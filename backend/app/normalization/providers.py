"""Gemma-first, Groq-fallback normalization of OCR query text only."""

from __future__ import annotations

import json
import re
from decimal import Decimal
from typing import Any
from urllib.parse import quote

import httpx

from app.config import Settings


_STRENGTH = re.compile(r"(?<!\w)(\d+(?:\.\d+)?)\s*(mg|mcg|g|iu|%)(?!\w)", re.IGNORECASE)
_TOKEN = re.compile(r"^[\w.+-]{2,80}(?:\s+[\w.+-]{1,40}){0,4}$", re.UNICODE)
_SYSTEM = (
    "Normalize OCR snippets into medicine name query tokens only. Output JSON exactly as "
    '{"lines":[{"line_index":0,"query_tokens":["clean name"]}]}. '
    "Only correct spelling/spacing using text in the given line. Do not add a medicine, "
    "strength, composition, dosage, instruction, price, diagnosis, or any explanation. "
    "Do not return a line if no medicine name can be read. The output is untrusted."
)


class ProviderError(ValueError):
    """A provider is unavailable or returned an unusable response."""


def _canonical_strength(amount: str, unit: str) -> tuple[str, str]:
    return format(Decimal(amount).normalize(), "f"), unit.casefold()


def _extract_json(text: str) -> dict[str, Any]:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", cleaned, flags=re.IGNORECASE)
    try:
        value = json.loads(cleaned)
    except json.JSONDecodeError as exc:
        raise ProviderError("Provider returned malformed JSON") from exc
    if not isinstance(value, dict) or not isinstance(value.get("lines"), list):
        raise ProviderError("Provider returned an invalid response shape")
    return value


def validate_normalized_lines(value: dict[str, Any], source_lines: list[str]) -> dict[int, list[str]]:
    """Keep only bounded tokens tied to valid input line indexes."""
    normalized: dict[int, list[str]] = {}
    for row in value["lines"][:20]:
        if not isinstance(row, dict):
            continue
        index = row.get("line_index")
        tokens = row.get("query_tokens")
        if type(index) is not int or not 0 <= index < len(source_lines) or index in normalized:
            continue
        if not isinstance(tokens, list):
            continue
        safe_tokens = []
        observed_strengths_ordered = [
            _canonical_strength(amount, unit)
            for amount, unit in _STRENGTH.findall(source_lines[index])
        ]
        observed_strengths = set(observed_strengths_ordered)
        for token in tokens[:4]:
            if not isinstance(token, str):
                continue
            token = " ".join(token.strip().split())
            if len(token) > 120 or not _TOKEN.fullmatch(token) or not any(c.isalpha() for c in token):
                continue
            token_strengths = {
                _canonical_strength(amount, unit)
                for amount, unit in _STRENGTH.findall(token)
            }
            if not token_strengths.issubset(observed_strengths):
                continue
            if observed_strengths:
                if not token_strengths:
                    token = " ".join(
                        f"{token} {amount}{unit}" if index == 0 else f"{amount}{unit}"
                        for index, (amount, unit) in enumerate(observed_strengths_ordered)
                    )
            if token.casefold() not in {existing.casefold() for existing in safe_tokens}:
                safe_tokens.append(token)
        if safe_tokens:
            normalized[index] = safe_tokens
    if not normalized:
        raise ProviderError("Provider returned no usable medicine query tokens")
    return normalized


class OCRNormalizer:
    """Use Google-hosted Gemma first, then configured Groq, then caller fallback."""

    def __init__(
        self,
        settings: Settings,
        *,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        self.settings = settings
        self.transport = transport

    @property
    def available(self) -> bool:
        return bool(
            (self.settings.gemma_api_key and self.settings.gemma_model)
            or (self.settings.groq_api_key and self.settings.groq_normalizer_model)
        )

    async def normalize(self, lines: list[str]) -> tuple[str, dict[int, list[str]]]:
        if self.settings.gemma_api_key and self.settings.gemma_model:
            try:
                result = await self._gemma(lines)
                return "gemma", validate_normalized_lines(result, lines)
            except (ProviderError, httpx.HTTPError, ValueError, KeyError, TypeError):
                pass
        if self.settings.groq_api_key and self.settings.groq_normalizer_model:
            try:
                result = await self._groq(lines)
                return "groq", validate_normalized_lines(result, lines)
            except (ProviderError, httpx.HTTPError, ValueError, KeyError, TypeError):
                pass
        return "none", {}

    async def _post(self, url: str, *, headers: dict[str, str], body: dict[str, Any]) -> dict[str, Any]:
        try:
            chunks = []
            size = 0
            async with httpx.AsyncClient(
                timeout=self.settings.normalization_timeout_seconds,
                transport=self.transport,
            ) as client:
                async with client.stream("POST", url, headers=headers, json=body) as response:
                    response.raise_for_status()
                    async for chunk in response.aiter_bytes():
                        size += len(chunk)
                        if size > 131_072:
                            raise ProviderError("Provider response exceeded size limit")
                        chunks.append(chunk)
            value = json.loads(b"".join(chunks))
        except (httpx.HTTPError, ValueError) as exc:
            raise ProviderError("Provider request failed") from exc
        if not isinstance(value, dict):
            raise ProviderError("Provider returned an invalid response")
        return value

    async def _gemma(self, lines: list[str]) -> dict[str, Any]:
        model = quote(self.settings.gemma_model, safe="")
        response = await self._post(
            f"{self.settings.gemma_api_base_url}/v1beta/models/{model}:generateContent",
            headers={"x-goog-api-key": self.settings.gemma_api_key.get_secret_value()},
            body={
                "systemInstruction": {"parts": [{"text": _SYSTEM}]},
                "contents": [{"parts": [{"text": json.dumps(lines, ensure_ascii=False)}]}],
                "generationConfig": {"temperature": 0, "maxOutputTokens": 256},
            },
        )
        candidates = response.get("candidates")
        if not isinstance(candidates, list) or not candidates:
            raise ProviderError("Gemma returned no candidate")
        if not isinstance(candidates[0], dict):
            raise ProviderError("Gemma returned an invalid candidate")
        content_block = candidates[0].get("content")
        if not isinstance(content_block, dict):
            raise ProviderError("Gemma returned no content")
        parts = content_block.get("parts", [])
        content = "".join(part.get("text", "") for part in parts if isinstance(part, dict))
        return _extract_json(content)

    async def _groq(self, lines: list[str]) -> dict[str, Any]:
        response = await self._post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={"Authorization": f"Bearer {self.settings.groq_api_key.get_secret_value()}"},
            body={
                "model": self.settings.groq_normalizer_model,
                "messages": [
                    {"role": "system", "content": _SYSTEM},
                    {"role": "user", "content": json.dumps(lines, ensure_ascii=False)},
                ],
                "temperature": 0,
                "max_completion_tokens": 256,
                "response_format": {"type": "json_object"},
            },
        )
        choices = response.get("choices")
        if not isinstance(choices, list) or not choices:
            raise ProviderError("Groq returned no candidate")
        if not isinstance(choices[0], dict):
            raise ProviderError("Groq returned an invalid candidate")
        message = choices[0].get("message")
        if not isinstance(message, dict):
            raise ProviderError("Groq returned no message")
        content = message.get("content")
        if not isinstance(content, str):
            raise ProviderError("Groq returned no text")
        return _extract_json(content)
