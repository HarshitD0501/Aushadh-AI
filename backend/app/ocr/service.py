"""Bounded OCR work and local-catalogue resolution."""

from __future__ import annotations

import asyncio
import csv
import io
import re
import shutil
from pathlib import Path
from typing import Awaitable, Callable

from app.catalogue.service import CatalogueService
from app.config import Settings
from app.errors import AppError
from app.normalization.providers import OCRNormalizer
from app.ocr.imaging import preprocess_image


_PRIVATE_CONTEXT = re.compile(
    r"\b(patient|name|age|sex|dob|date|phone|mobile|address|doctor|hospital|uhid|mrn|diagnosis)\b|\bdr\.?\b",
    re.IGNORECASE,
)
_INSTRUCTION = re.compile(
    r"\b(?:od|bd|tds|qid|hs|ac|pc|morning|afternoon|evening|night|breakfast|lunch|dinner|"
    r"after|before|food|daily|once|twice|thrice|tablet|tablets|tab|tabs|capsule|capsules|cap)\b"
    r"|\b\d+\s*[-/]\s*\d+(?:\s*[-/]\s*\d+)?\b",
    re.IGNORECASE,
)
_WHITESPACE = re.compile(r"\s+")


def tesseract_path(configured: str | None) -> str | None:
    candidate = configured.strip() if configured else "tesseract"
    found = shutil.which(candidate)
    if found:
        return found
    path = Path(candidate)
    return str(path) if path.is_file() else None


def parse_tsv(payload: str) -> tuple[str, float | None]:
    """Build line text and mean confidence from Tesseract's TSV word output."""
    try:
        rows = csv.DictReader(io.StringIO(payload), delimiter="\t")
        grouped: dict[tuple[str, str, str, str], list[str]] = {}
        confidences: list[float] = []
        for row in rows:
            if row.get("level") != "5":
                continue
            word = (row.get("text") or "").strip()
            try:
                confidence = float(row.get("conf", "-1"))
            except ValueError:
                confidence = -1
            if word and confidence >= 0:
                key = (row.get("page_num", "0"), row.get("block_num", "0"),
                       row.get("par_num", "0"), row.get("line_num", "0"))
                grouped.setdefault(key, []).append(word)
                confidences.append(confidence)
        lines = [" ".join(words) for words in grouped.values()]
        return "\n".join(lines)[:4_000], (
            sum(confidences) / len(confidences) if confidences else None
        )
    except (csv.Error, TypeError):
        return "", None


async def run_tesseract(image_png: bytes, executable: str, *, timeout: float) -> tuple[str, float | None]:
    """Run Tesseract without a shell, kill it on timeout, and never persist input."""
    try:
        process = await asyncio.create_subprocess_exec(
            executable,
            "stdin",
            "stdout",
            "-l", "eng",
            "--oem", "1",
            "--psm", "6",
            "tsv",
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
    except (OSError, ValueError) as exc:
        raise AppError("OCR_UNAVAILABLE", "Prescription image reading is not available right now.", 503) from exc
    try:
        stdout, _stderr = await asyncio.wait_for(process.communicate(input=image_png), timeout=timeout)
    except TimeoutError as exc:
        process.kill()
        await process.communicate()
        raise AppError("OCR_TIMEOUT", "Image reading timed out. Try a clearer or smaller image.", 503) from exc
    if process.returncode != 0:
        raise AppError("OCR_FAILED", "Image reading failed. You can enter the medicine name manually.", 503)
    return parse_tsv(stdout.decode("utf-8", errors="replace"))


def _normalization_lines(raw_text: str) -> list[str]:
    """Keep short medicine-like OCR lines and omit obvious personal/schedule text."""
    lines: list[str] = []
    for raw_line in raw_text.splitlines()[:40]:
        if _PRIVATE_CONTEXT.search(raw_line):
            continue
        cleaned = _WHITESPACE.sub(" ", _INSTRUCTION.sub(" ", raw_line)).strip(" \t,;:.-")
        if len(cleaned) < 3 or len(cleaned) > 120 or not any(char.isalpha() for char in cleaned):
            continue
        if not any(any(char.isalpha() for char in word) and len(word) >= 2 for word in cleaned.split()):
            continue
        lines.append(cleaned)
        if len(lines) == 20:
            break
    return lines


class OCRService:
    """A small fixed worker pool; timed-out requests keep their slot until work ends."""

    def __init__(
        self,
        settings: Settings,
        catalogue: CatalogueService,
        normalizer: OCRNormalizer | None = None,
        *,
        recognizer: Callable[[bytes, str, float], Awaitable[tuple[str, float | None]]] | None = None,
    ) -> None:
        self.settings = settings
        self.catalogue = catalogue
        self.normalizer = normalizer or OCRNormalizer(settings)
        self.recognizer = recognizer or self._recognize
        self.executable = tesseract_path(settings.tesseract_cmd)
        self._slots: asyncio.Queue[int] = asyncio.Queue(maxsize=settings.ocr_worker_count)
        for token in range(settings.ocr_worker_count):
            self._slots.put_nowait(token)

    @property
    def ocr_available(self) -> bool:
        return self.executable is not None

    async def _recognize(self, image: bytes, executable: str, timeout: float) -> tuple[str, float | None]:
        return await run_tesseract(image, executable, timeout=timeout)

    async def analyze(self, content: bytes, mime_type: str) -> dict:
        if self.executable is None:
            raise AppError("OCR_UNAVAILABLE", "Prescription image reading is not available right now.", 503)
        if not content:
            raise AppError("EMPTY_IMAGE", "Choose an image before uploading.", 400)
        if len(content) > self.settings.ocr_max_image_bytes:
            raise AppError("IMAGE_TOO_LARGE", "Image exceeds the upload size limit.", 413)
        try:
            slot = self._slots.get_nowait()
        except asyncio.QueueEmpty as exc:
            raise AppError("OCR_BUSY", "Image reader is busy. Try again shortly or enter the name manually.", 503) from exc

        task = asyncio.create_task(self._analyze(content, mime_type))
        task.add_done_callback(lambda _task: self._slots.put_nowait(slot))
        try:
            return await asyncio.wait_for(
                asyncio.shield(task), timeout=self.settings.ocr_timeout_seconds
            )
        except TimeoutError as exc:
            raise AppError("OCR_TIMEOUT", "Image reading took too long. Enter the medicine name manually.", 503) from exc

    async def _analyze(self, content: bytes, mime_type: str) -> dict:
        image_png = await asyncio.to_thread(
            preprocess_image,
            content,
            mime_type,
            max_pixels=self.settings.ocr_max_image_pixels,
        )
        raw_text, confidence = await self.recognizer(
            image_png,
            self.executable or "tesseract",
            min(self.settings.ocr_timeout_seconds, 8.0),
        )
        raw_text = raw_text[:4_000]
        warnings: list[str] = []
        if not raw_text.strip():
            warnings.append("No readable text found. Try a sharper image or type the medicine name.")
        if confidence is not None and confidence < 45:
            warnings.append("OCR confidence is low. Review every medicine name before selecting it.")
        if len(raw_text) == 4_000:
            warnings.append("Only the first part of the text was read.")

        safe_lines = _normalization_lines(raw_text)
        provider, normalized = await self.normalizer.normalize(safe_lines) if safe_lines else ("none", {})
        suggestions = []
        for line_index, observed in enumerate(raw_text.splitlines()[:40]):
            line_for_normalization = _normalization_lines(observed)
            if not line_for_normalization:
                continue
            safe_line = line_for_normalization[0]
            safe_index = safe_lines.index(safe_line) if safe_line in safe_lines else None
            query_tokens = normalized.get(safe_index, []) if safe_index is not None else []
            if not query_tokens:
                query_tokens = [safe_line]
            candidate_ids: list[str] = []
            for token in query_tokens:
                for candidate in self.catalogue.search(token, limit=8)["candidates"]:
                    medicine_id = candidate["medicine_id"]
                    if medicine_id not in candidate_ids:
                        candidate_ids.append(medicine_id)
            suggestions.append({
                "observed_text": observed[:160],
                "query_tokens": query_tokens,
                "candidate_medicine_ids": candidate_ids[:8],
                "status": "unconfirmed",
            })
            if len(suggestions) == 20:
                warnings.append("Only the first 20 medicine-like lines are shown.")
                break

        return {
            "raw_text": raw_text,
            "normalization_provider": provider,
            "suggestions": suggestions,
            "warnings": warnings,
        }
