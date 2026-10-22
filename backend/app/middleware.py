"""Request IDs, bounded bodies, and metadata-only access logs."""

import logging
from uuid import uuid4

from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Message, Receive, Scope, Send


logger = logging.getLogger("aushadhai.api")


class _BodyTooLarge(Exception):
    pass


class RequestGuardMiddleware:
    def __init__(self, app: ASGIApp, *, max_body_bytes: int) -> None:
        self.app = app
        self.max_body_bytes = max_body_bytes

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        request_id = uuid4().hex
        scope.setdefault("state", {})["request_id"] = request_id
        status_code = 500
        response_started = False
        bytes_received = 0

        async def send_with_request_id(message: Message) -> None:
            nonlocal status_code, response_started
            if message["type"] == "http.response.start":
                response_started = True
                status_code = message["status"]
                headers = list(message.get("headers", []))
                headers.append((b"x-request-id", request_id.encode("ascii")))
                message = {**message, "headers": headers}
            await send(message)

        async def receive_with_limit() -> Message:
            nonlocal bytes_received
            message = await receive()
            if message["type"] == "http.request":
                bytes_received += len(message.get("body", b""))
                if bytes_received > self.max_body_bytes:
                    raise _BodyTooLarge
            return message

        async def reject(*, code: str, message: str, status: int) -> None:
            response = JSONResponse(
                status_code=status,
                content={
                    "error": {
                        "code": code,
                        "message": message,
                        "request_id": request_id,
                    }
                },
            )
            await response(scope, receive, send_with_request_id)

        try:
            headers = dict(scope.get("headers", []))
            content_length = headers.get(b"content-length")
            if content_length is not None:
                try:
                    declared_size = int(content_length)
                except ValueError:
                    await reject(
                        code="VALIDATION_ERROR",
                        message="Invalid Content-Length header.",
                        status=400,
                    )
                    return
                if declared_size < 0:
                    await reject(
                        code="VALIDATION_ERROR",
                        message="Invalid Content-Length header.",
                        status=400,
                    )
                    return
                if declared_size > self.max_body_bytes:
                    await reject(
                        code="PAYLOAD_TOO_LARGE",
                        message="Request body exceeds the configured size limit.",
                        status=413,
                    )
                    return

            await self.app(scope, receive_with_limit, send_with_request_id)
        except _BodyTooLarge:
            if response_started:
                logger.error("Request exceeded body limit after response start id=%s", request_id)
                return
            await reject(
                code="PAYLOAD_TOO_LARGE",
                message="Request body exceeds the configured size limit.",
                status=413,
            )
        finally:
            # The query, headers, body, and patient data are never logged.
            logger.info(
                "request method=%s path=%s status=%s id=%s",
                scope["method"],
                scope["path"],
                status_code,
                request_id,
            )
