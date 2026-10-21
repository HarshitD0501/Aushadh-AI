"""Unconfirmed prescription/medicine image OCR endpoint."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, File, Request, UploadFile
from pydantic import BaseModel

from app.errors import AppError
from app.ocr.service import OCRService


router = APIRouter(prefix="/api/v1", tags=["ocr"])


class OCRSuggestion(BaseModel):
    observed_text: str
    query_tokens: list[str]
    candidate_medicine_ids: list[str]
    status: str


class OCRResult(BaseModel):
    raw_text: str
    normalization_provider: str
    suggestions: list[OCRSuggestion]
    warnings: list[str]


def _ocr(request: Request) -> OCRService:
    return request.app.state.ocr


@router.post("/ocr", response_model=OCRResult)
async def read_medicine_image(
    request: Request,
    image: Annotated[UploadFile, File(description="JPEG, PNG, or WebP strip, box, or prescription image")],
) -> dict:
    service = _ocr(request)
    try:
        content = await image.read(service.settings.ocr_max_image_bytes + 1)
        if len(content) > service.settings.ocr_max_image_bytes:
            raise AppError("IMAGE_TOO_LARGE", "Image exceeds the upload size limit.", 413)
        return await service.analyze(content, image.content_type or "")
    finally:
        await image.close()
