"""FastAPI entry point for the B0 foundation."""

import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from starlette.exceptions import HTTPException

from app.api.catalogue import router as catalogue_router
from app.api.internal import router as internal_router
from app.api.ocr import router as ocr_router
from app.catalogue.service import CatalogueService
from app.config import Settings
from app.errors import AppError, ErrorEnvelope, error_response
from app.middleware import RequestGuardMiddleware
from app.normalization.providers import OCRNormalizer
from app.ocr.service import OCRService


logger = logging.getLogger("aushadhai.api")


def create_app(settings: Settings | None = None) -> FastAPI:
    config = settings or Settings()
    app = FastAPI(
        title="AushadhAi API",
        version="0.1.0",
        responses={
            400: {"model": ErrorEnvelope},
            404: {"model": ErrorEnvelope},
            413: {"model": ErrorEnvelope},
            500: {"model": ErrorEnvelope},
        },
    )
    app.state.settings = config
    app.state.catalogue = CatalogueService.from_path()
    app.state.ocr = OCRService(
        config,
        app.state.catalogue,
        OCRNormalizer(config),
    )
    app.include_router(catalogue_router)
    app.include_router(ocr_router)
    app.include_router(internal_router)

    app.add_middleware(
        RequestGuardMiddleware,
        max_body_bytes=config.max_request_body_bytes,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[config.app_origin],
        allow_credentials=False,
        allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type"],
        expose_headers=["X-Request-ID", "ETag"],
    )

    @app.exception_handler(AppError)
    async def handle_app_error(request: Request, exc: AppError):
        return error_response(
            request, code=exc.code, message=exc.message, status_code=exc.status_code
        )

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(request: Request, exc: RequestValidationError):
        logger.info("Invalid request id=%s", request.state.request_id)
        return error_response(
            request,
            code="VALIDATION_ERROR",
            message="Invalid request parameters.",
            status_code=400,
        )

    @app.exception_handler(HTTPException)
    async def handle_http_error(request: Request, exc: HTTPException):
        code = {
            404: "NOT_FOUND",
            405: "METHOD_NOT_ALLOWED",
        }.get(exc.status_code, "HTTP_ERROR")
        message = {
            404: "Resource not found.",
            405: "Method not allowed.",
        }.get(exc.status_code, "Request could not be completed.")
        return error_response(
            request, code=code, message=message, status_code=exc.status_code
        )

    @app.exception_handler(Exception)
    async def handle_unexpected_error(request: Request, exc: Exception):
        # No exception string, traceback, request body, query, or credentials in logs.
        logger.error(
            "Unhandled error type=%s id=%s",
            type(exc).__name__,
            request.state.request_id,
        )
        response = error_response(
            request,
            code="INTERNAL_ERROR",
            message="An unexpected server error occurred.",
            status_code=500,
        )
        # Starlette's outer error middleware handles unexpected failures before
        # the inner CORS middleware can decorate its response.
        if request.headers.get("origin") == config.app_origin:
            response.headers["Access-Control-Allow-Origin"] = config.app_origin
            response.headers["Vary"] = "Origin"
        return response

    @app.get("/api/v1/health", tags=["system"])
    async def health() -> dict[str, str]:
        return {"status": "ok", "service": "aushadhai-backend", "version": "0.1.0"}

    @app.get("/api/v1/capabilities", tags=["system"])
    async def capabilities() -> dict[str, bool]:
        # Set each flag true only after its phase and actual configuration work.
        return {
            "ocr": app.state.ocr.ocr_available,
            "normalizer": app.state.ocr.normalizer.available,
            "stores": False,
            "routes": False,
            "whatsapp": False,
            "calling": False,
        }

    return app


app = create_app()
