"""Frozen OpenCLIP image/text category inference."""

from __future__ import annotations

import asyncio
import importlib
import math
import os
import threading
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Final

try:
    from errors import ApiError
    from schemas import (
        CategoryCode,
        CategoryPrediction,
        ListingMetadata,
        ProcessedImage,
        ServiceReadiness,
    )
except (
    ModuleNotFoundError
):  # Allow importing as backend.ai.category from the repo root.
    from backend.errors import ApiError
    from backend.schemas import (
        CategoryCode,
        CategoryPrediction,
        ListingMetadata,
        ProcessedImage,
        ServiceReadiness,
    )

BACKEND_ROOT = Path(__file__).resolve().parents[2]
MODEL_ROOT = BACKEND_ROOT / "ai" / "category" / "model"
DEFAULT_ARTIFACT_PATH = MODEL_ROOT / "category_heads.pt"
DEFAULT_ENCODER_PATH = MODEL_ROOT / "openclip_vit_b32_laion2b_s34b_b79k.safetensors"

CATEGORY_MODEL_VERSION: Final = "openclip-hybrid-category-v1"
CALIBRATION_VERSION: Final = "openclip-hybrid-category-cal-v1"
MODEL_NAME: Final = "ViT-B-32"
EXPECTED_EMBEDDING_DIM: Final = 512
REQUIRED_MODULES: Final = ("torch", "open_clip")
CATEGORY_MODEL_PATH_ENV: Final = "LAPAKIN_CATEGORY_MODEL_PATH"
CATEGORY_ENCODER_PATH_ENV: Final = "LAPAKIN_CATEGORY_ENCODER_PATH"


@dataclass(frozen=True)
class _Artifact:
    classes: tuple[CategoryCode, ...]
    embedding_dim: int
    image_state_dict: dict[str, Any]
    text_state_dict: dict[str, Any]
    image_temperature: float
    text_temperature: float
    hybrid_alpha: float
    hybrid_temperature: float
    encoder_model: str


def _clean(value: object) -> str:
    return " ".join(str(value or "").split())


def _fact_text(title: str, brand: str | None, keyword: str) -> str:
    values = [
        f"jenis produk: {_clean(title)}",
        f"merek: {_clean(brand)}",
        f"kata pencarian: {_clean(keyword)}",
    ]
    return ". ".join(value for value in values if not value.endswith(": "))


def build_category_fact_text(metadata: ListingMetadata) -> str:
    """Build the production text contract used by the trained text head.

    The training parquet uses a full title, brand, and a short search keyword.
    Form fields are mapped to that same shape so optional details enrich the
    title without introducing a second prompt format at inference time.
    """

    title_parts = [
        metadata.product_type,
        metadata.variant,
        metadata.size,
        metadata.material_or_ingredients,
    ]
    title = " ".join(value for value in (_clean(item) for item in title_parts) if value)
    return _fact_text(title, metadata.brand, _clean(metadata.product_type))


def _normalize(features: Any) -> Any:
    return features / features.norm(dim=-1, keepdim=True).clamp_min(1e-12)


def _finite_positive(value: object) -> float:
    number = float(value)
    if not math.isfinite(number) or number <= 0:
        raise ValueError("calibration values must be finite and positive")
    return number


def _read_artifact(payload: object) -> _Artifact:
    if not isinstance(payload, dict):
        raise TypeError("category artifact must be a mapping")

    try:
        raw_classes = tuple(CategoryCode(value) for value in payload["classes"])
        embedding_dim = int(payload["embedding_dim"])
        image_state_dict = payload["image_state_dict"]
        text_state_dict = payload["text_state_dict"]
        image_temperature = _finite_positive(payload["image_temperature"])
        text_temperature = _finite_positive(payload["text_temperature"])
        hybrid_alpha = float(payload["hybrid_alpha"])
        hybrid_temperature = _finite_positive(payload["hybrid_temperature"])
        encoder = payload["encoder"]
        encoder_model = str(encoder["model"])
    except (KeyError, TypeError, ValueError, OverflowError) as error:
        raise ValueError("category artifact has an invalid schema") from error

    expected_classes = tuple(sorted(CategoryCode, key=lambda item: item.value))
    if raw_classes != expected_classes:
        raise ValueError("category artifact classes do not match the API taxonomy")
    if embedding_dim != EXPECTED_EMBEDDING_DIM:
        raise ValueError("category artifact embedding dimension is unsupported")
    if not isinstance(image_state_dict, dict) or not isinstance(text_state_dict, dict):
        raise TypeError("category artifact heads are invalid")
    if not math.isfinite(hybrid_alpha) or hybrid_alpha < 0:
        raise ValueError("hybrid alpha must be finite and non-negative")
    if encoder_model != MODEL_NAME:
        raise ValueError("category artifact encoder model is unsupported")
    return _Artifact(
        classes=raw_classes,
        embedding_dim=embedding_dim,
        image_state_dict=image_state_dict,
        text_state_dict=text_state_dict,
        image_temperature=image_temperature,
        text_temperature=text_temperature,
        hybrid_alpha=hybrid_alpha,
        hybrid_temperature=hybrid_temperature,
        encoder_model=encoder_model,
    )


class OpenClipCategoryClassifier:
    """Classify categories with calibrated image/text OpenCLIP heads."""

    version = CATEGORY_MODEL_VERSION
    calibration_version = CALIBRATION_VERSION

    def __init__(
        self,
        artifact_path: Path | None = None,
        encoder_path: Path | None = None,
        *,
        device: str | None = None,
    ) -> None:
        self._artifact_path = Path(
            artifact_path
            or os.getenv(CATEGORY_MODEL_PATH_ENV, str(DEFAULT_ARTIFACT_PATH))
        )
        self._encoder_path = Path(
            encoder_path
            or os.getenv(CATEGORY_ENCODER_PATH_ENV, str(DEFAULT_ENCODER_PATH))
        )
        self._requested_device = device or os.getenv("LAPAKIN_CATEGORY_DEVICE", "auto")
        self._load_lock = threading.Lock()
        self._inference_lock = threading.Lock()
        self._torch: Any = None
        self._model: Any = None
        self._preprocess: Any = None
        self._tokenizer: Any = None
        self._image_head: Any = None
        self._text_head: Any = None
        self._classes: tuple[CategoryCode, ...] = ()
        self._image_temperature = 1.0
        self._text_temperature = 1.0
        self._hybrid_alpha = 0.0
        self._hybrid_temperature = 1.0
        self._device = "cpu"
        self._load_error: str | None = None

    def readiness(self) -> ServiceReadiness:
        if self._load_error:
            return ServiceReadiness(
                ready=False, reason="category model initialization failed"
            )
        if not self._artifact_path.is_file() or not self._encoder_path.is_file():
            return ServiceReadiness(
                ready=False,
                reason="category model assets are unavailable",
                details={
                    "artifact": self._artifact_path.name,
                    "encoder": self._encoder_path.name,
                },
            )
        try:
            for module in REQUIRED_MODULES:
                importlib.import_module(module)
        except Exception:  # noqa: BLE001 - optional model runtime boundary.
            return ServiceReadiness(
                ready=False,
                reason="optional category model dependencies are unavailable",
            )
        return ServiceReadiness(
            ready=self._model is not None,
            startable=True,
            reason=None
            if self._model is not None
            else "category model is configured but not warm",
            details={"loaded": self._model is not None, "device": self._device},
        )

    async def warmup(self) -> None:
        """Load the local encoder and calibrated heads before serving traffic."""

        await asyncio.to_thread(self._load)

    async def classify(
        self, image: ProcessedImage, metadata: ListingMetadata
    ) -> CategoryPrediction:
        status = self.readiness()
        if not status.ready and not status.startable:
            raise ApiError(
                status_code=503,
                code="CATEGORY_MODEL_NOT_READY",
                message="Model kategori belum siap.",
                retryable=True,
            )
        try:
            return await asyncio.to_thread(self._infer, image, metadata)
        except ApiError:
            raise
        except Exception:  # noqa: BLE001 - translate inference failures at the API boundary.
            self._load_error = "category model inference failed"
            raise ApiError(
                status_code=503,
                code="CATEGORY_MODEL_INFERENCE_FAILED",
                message="Model kategori gagal melakukan inferensi.",
                retryable=True,
            ) from None

    def _resolve_device(self, torch: Any) -> str:
        if self._requested_device != "auto":
            return self._requested_device
        return "cuda" if torch.cuda.is_available() else "cpu"

    def _load(self) -> None:
        if self._model is not None:
            return
        with self._load_lock:
            if self._model is not None:
                return
            try:
                torch = importlib.import_module("torch")
                open_clip = importlib.import_module("open_clip")
                payload = torch.load(
                    self._artifact_path,
                    map_location="cpu",
                    weights_only=True,
                )
                artifact = _read_artifact(payload)
                device = self._resolve_device(torch)
                model, _, preprocess = open_clip.create_model_and_transforms(
                    artifact.encoder_model,
                    pretrained=str(self._encoder_path),
                    device=device,
                )
                tokenizer = open_clip.get_tokenizer(artifact.encoder_model)
                image_head = torch.nn.Linear(
                    artifact.embedding_dim, len(artifact.classes)
                )
                text_head = torch.nn.Linear(
                    artifact.embedding_dim, len(artifact.classes)
                )
                image_head.load_state_dict(artifact.image_state_dict, strict=True)
                text_head.load_state_dict(artifact.text_state_dict, strict=True)
                model.eval().requires_grad_(False)
                image_head.to(device).eval()
                text_head.to(device).eval()
            except Exception:  # noqa: BLE001 - third-party loaders are heterogeneous.
                self._load_error = "category model initialization failed"
                raise ApiError(
                    status_code=503,
                    code="CATEGORY_MODEL_LOAD_FAILED",
                    message="Model kategori tidak dapat dimuat.",
                    retryable=True,
                ) from None

            self._torch = torch
            self._model = model
            self._preprocess = preprocess
            self._tokenizer = tokenizer
            self._image_head = image_head
            self._text_head = text_head
            self._classes = artifact.classes
            self._image_temperature = artifact.image_temperature
            self._text_temperature = artifact.text_temperature
            self._hybrid_alpha = artifact.hybrid_alpha
            self._hybrid_temperature = artifact.hybrid_temperature
            self._device = device

    def _infer(
        self, image: ProcessedImage, metadata: ListingMetadata
    ) -> CategoryPrediction:
        self._load()
        fact_text = build_category_fact_text(metadata)
        with self._inference_lock, self._torch.inference_mode():
            image_tensor = self._preprocess(image.image).unsqueeze(0).to(self._device)
            image_features = _normalize(self._model.encode_image(image_tensor))
            image_logits = self._image_head(image_features).float()
            logits = image_logits
            temperature = self._image_temperature

            if fact_text:
                text_tensor = self._tokenizer([fact_text]).to(self._device)
                text_features = _normalize(self._model.encode_text(text_tensor))
                text_logits = self._text_head(text_features).float()
                logits = image_logits + self._hybrid_alpha * text_logits
                temperature = self._hybrid_temperature

            probabilities = self._torch.softmax(logits / temperature, dim=-1)[0]
            winner = int(probabilities.argmax().item())
            score = round(float(probabilities[winner].item()) * 100)

        return CategoryPrediction(
            code=self._classes[winner],
            score=max(0, min(score, 100)),
            evidence_terms=tuple(metadata.confirmed_facts()[:5]),
        )


__all__ = [
    "CALIBRATION_VERSION",
    "CATEGORY_MODEL_VERSION",
    "DEFAULT_ARTIFACT_PATH",
    "DEFAULT_ENCODER_PATH",
    "OpenClipCategoryClassifier",
    "build_category_fact_text",
]
