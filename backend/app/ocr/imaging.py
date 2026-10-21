"""Validate and preprocess supported prescription/pack images in memory."""

from __future__ import annotations

import warnings
from io import BytesIO

from PIL import Image, ImageOps, UnidentifiedImageError

from app.errors import AppError


_MIME_FORMATS = {
    "image/jpeg": "JPEG",
    "image/png": "PNG",
    "image/webp": "WEBP",
}


def preprocess_image(content: bytes, declared_mime: str, *, max_pixels: int) -> bytes:
    """Return a thresholded PNG, rejecting mismatched or oversized image data."""
    expected_format = _MIME_FORMATS.get(declared_mime.casefold().strip())
    if expected_format is None:
        raise AppError("UNSUPPORTED_MEDIA_TYPE", "Upload a JPEG, PNG, or WebP image.", 400)

    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(BytesIO(content)) as probe:
                if probe.format != expected_format:
                    raise AppError("INVALID_IMAGE", "Image content does not match its file type.", 400)
                width, height = probe.size
                if width < 1 or height < 1 or width * height > max_pixels:
                    raise AppError("IMAGE_TOO_LARGE", "Image dimensions exceed the supported limit.", 413)
                probe.verify()
            with Image.open(BytesIO(content)) as image:
                if getattr(image, "is_animated", False):
                    raise AppError("INVALID_IMAGE", "Animated images are not supported.", 400)
                image.load()
                grayscale = ImageOps.grayscale(image)
                stretched = ImageOps.autocontrast(grayscale, cutoff=1)
                thresholded = stretched.point(lambda pixel: 255 if pixel >= 170 else 0)
                result = BytesIO()
                thresholded.save(result, format="PNG", optimize=True)
                return result.getvalue()
    except AppError:
        raise
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError, Image.DecompressionBombWarning) as exc:
        raise AppError("INVALID_IMAGE", "The uploaded image could not be decoded.", 400) from exc
