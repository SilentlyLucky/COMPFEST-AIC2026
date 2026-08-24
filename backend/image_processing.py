from __future__ import annotations

import io
from typing import Final

from fastapi import UploadFile
from PIL import Image, ImageOps, UnidentifiedImageError

from errors import ApiError
from schemas import ProcessedImage

MAX_IMAGE_BYTES: Final = 5 * 1024 * 1024
MAX_IMAGE_PIXELS: Final = 20_000_000
MAX_MODEL_DIMENSION: Final = 512

MIME_BY_FORMAT: Final = {
    "JPEG": "image/jpeg",
    "PNG": "image/png",
    "WEBP": "image/webp",
}


def _detect_mime(content: bytes) -> str | None:
    if content.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if content.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if len(content) >= 12 and content[:4] == b"RIFF" and content[8:12] == b"WEBP":
        return "image/webp"
    return None


async def process_uploaded_image(upload: UploadFile) -> ProcessedImage:
    content = await upload.read(MAX_IMAGE_BYTES + 1)
    if len(content) > MAX_IMAGE_BYTES:
        raise ApiError(
            status_code=413,
            code="IMAGE_TOO_LARGE",
            message="Foto melebihi 5 MiB.",
            field="image",
        )
    return process_image_bytes(content, upload.content_type or "")


def process_image_bytes(content: bytes, declared_mime: str) -> ProcessedImage:
    if not content:
        raise ApiError(
            status_code=422,
            code="IMAGE_EMPTY",
            message="Foto tidak boleh kosong.",
            field="image",
        )

    detected_mime = _detect_mime(content)
    if detected_mime is None or declared_mime not in MIME_BY_FORMAT.values():
        raise ApiError(
            status_code=415,
            code="IMAGE_TYPE_UNSUPPORTED",
            message="Foto harus berupa JPEG, PNG, atau WebP.",
            field="image",
        )
    if detected_mime != declared_mime:
        raise ApiError(
            status_code=415,
            code="IMAGE_TYPE_MISMATCH",
            message="Tipe foto tidak sesuai dengan isi file.",
            field="image",
        )

    try:
        with Image.open(io.BytesIO(content)) as source:
            decoded_mime = MIME_BY_FORMAT.get(source.format or "")
            if decoded_mime != detected_mime:
                raise ApiError(
                    status_code=415,
                    code="IMAGE_TYPE_MISMATCH",
                    message="Format foto hasil decode tidak sesuai.",
                    field="image",
                )
            if getattr(source, "n_frames", 1) != 1:
                raise ApiError(
                    status_code=422,
                    code="IMAGE_ANIMATED_UNSUPPORTED",
                    message="Foto animasi tidak didukung.",
                    field="image",
                )

            width, height = source.size
            if width <= 0 or height <= 0 or width * height > MAX_IMAGE_PIXELS:
                raise ApiError(
                    status_code=422,
                    code="IMAGE_DIMENSIONS_EXCEEDED",
                    message="Resolusi foto melebihi 20 megapiksel.",
                    field="image",
                )

            source.load()
            normalized = ImageOps.exif_transpose(source).convert("RGB")
            normalized.thumbnail(
                (MAX_MODEL_DIMENSION, MAX_MODEL_DIMENSION), Image.Resampling.LANCZOS
            )
            # Rebuild from pixels so EXIF/ICC/text chunks cannot reach inference.
            normalized = Image.frombytes("RGB", normalized.size, normalized.tobytes())
    except ApiError:
        raise
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError):
        raise ApiError(
            status_code=422,
            code="IMAGE_INVALID",
            message="Foto rusak atau tidak dapat dibaca.",
            field="image",
        ) from None

    return ProcessedImage(
        image=normalized,
        detected_mime=detected_mime,
        original_width=width,
        original_height=height,
    )
