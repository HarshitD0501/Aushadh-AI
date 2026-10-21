"""Stable public error responses without provider or patient details."""

from dataclasses import dataclass

from fastapi import Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel


class ErrorDetail(BaseModel):
    code: str
    message: str
    request_id: str


class ErrorEnvelope(BaseModel):
    error: ErrorDetail


@dataclass(frozen=True)
class AppError(Exception):
    code: str
    message: str
    status_code: int


def error_response(
    request: Request, *, code: str, message: str, status_code: int
) -> JSONResponse:
    request_id = getattr(request.state, "request_id", "unknown")
    return JSONResponse(
        status_code=status_code,
        content=ErrorEnvelope(
            error=ErrorDetail(code=code, message=message, request_id=request_id)
        ).model_dump(),
    )
