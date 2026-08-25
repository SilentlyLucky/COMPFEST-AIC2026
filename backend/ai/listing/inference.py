from __future__ import annotations

import asyncio
import importlib
import logging
import threading
from pathlib import Path
from typing import Any, Final

from pydantic import BaseModel, ConfigDict, Field, ValidationError

try:
    from errors import ApiError
    from schemas import CopyCandidate, ListingMetadata, ProcessedImage, ServiceReadiness
except ModuleNotFoundError:  # Allow importing as backend.ai.listing from the repo root.
    from backend.errors import ApiError
    from backend.schemas import (
        CopyCandidate,
        ListingMetadata,
        ProcessedImage,
        ServiceReadiness,
    )

MODEL_PROMPT: Final = (
    "Lihat foto produk ini. Tulis listing untuk platform {platform}. "
    "Jawab JSON dengan kunci judul dan deskripsi. Jangan sebut ukuran, "
    "berat, garansi, izin, merek, atau khasiat yang tidak terlihat."
)
BASE_MODEL: Final = "Qwen/Qwen2.5-VL-3B-Instruct"
BASE_MODEL_REVISION: Final = "66285546d2b821cf421d4f5eb2576359d3770cd3"
REQUIRED_MODULES: Final = ("torch", "transformers", "peft", "huggingface_hub")
REQUIRED_ASSETS: Final = (
    "adapter_config.json",
    "adapter_model.safetensors",
    "chat_template.jinja",
    "processor_config.json",
    "tokenizer.json",
    "tokenizer_config.json",
)

logger = logging.getLogger(__name__)


class _AdapterOutput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    judul: str = Field(min_length=1, max_length=120)
    deskripsi: str = Field(min_length=50, max_length=600)


class SulinganVlmGenerator:
    version = "qwen2.5-vl-3b-lora-v1"

    def __init__(self, adapter_path: Path) -> None:
        self._adapter_path = adapter_path
        self._load_lock = threading.Lock()
        self._inference_lock = threading.Lock()
        self._processor: Any = None
        self._model: Any = None
        self._torch: Any = None
        self._load_error: str | None = None

    def readiness(self) -> ServiceReadiness:
        if self._load_error:
            return ServiceReadiness(ready=False, reason="model initialization failed")
        if not all((self._adapter_path / name).is_file() for name in REQUIRED_ASSETS):
            return ServiceReadiness(
                ready=False, reason="model adapter assets are unavailable"
            )
        try:
            torch = importlib.import_module("torch")
            for module in REQUIRED_MODULES[1:]:
                importlib.import_module(module)
        except Exception:  # noqa: BLE001 - runtime loaders can fail during import.
            return ServiceReadiness(
                ready=False,
                reason="optional model runtime dependencies are unavailable",
            )
        if not torch.cuda.is_available():
            return ServiceReadiness(ready=False, reason="CUDA GPU is unavailable")
        return ServiceReadiness(
            ready=self._model is not None,
            startable=True,
            reason=None
            if self._model is not None
            else "model is configured but not warm",
            details={"loaded": self._model is not None},
        )

    async def generate(
        self, image: ProcessedImage, metadata: ListingMetadata
    ) -> CopyCandidate:
        status = self.readiness()
        if not status.ready and not status.startable:
            raise ApiError(
                status_code=503,
                code="MODEL_NOT_READY",
                message="Model generator belum siap.",
                retryable=True,
            )
        try:
            return await asyncio.to_thread(self._infer, image, metadata)
        except ApiError:
            raise
        except Exception as error:  # noqa: BLE001 - translate third-party inference failures at the boundary.
            self._load_error = f"{type(error).__name__}: {error}"
            logger.exception("Listing model inference failed")
            raise ApiError(
                status_code=503,
                code="MODEL_INFERENCE_FAILED",
                message="Model generator gagal melakukan inferensi.",
                retryable=True,
            ) from None

    async def warmup(self) -> None:
        """Load the pinned base model and adapter before the API accepts traffic."""
        await asyncio.to_thread(self._load)

    def _infer(self, image: ProcessedImage, metadata: ListingMetadata) -> CopyCandidate:
        self._load()
        with self._inference_lock, self._torch.inference_mode():
            messages = [
                {
                    "role": "user",
                    "content": [
                        {"type": "image"},
                        {
                            "type": "text",
                            "text": MODEL_PROMPT.format(
                                platform=metadata.platform.value
                            ),
                        },
                    ],
                }
            ]
            prompt = self._processor.apply_chat_template(
                messages,
                tokenize=False,
                add_generation_prompt=True,
            )
            encoded = self._processor(
                text=[prompt],
                images=[image.image],
                return_tensors="pt",
            ).to(self._model.device)
            generated = self._model.generate(
                **encoded,
                max_new_tokens=220,
                do_sample=False,
                temperature=None,
            )
            prompt_length = encoded["input_ids"].shape[1]
            raw_output = self._processor.tokenizer.decode(
                generated[0][prompt_length:],
                skip_special_tokens=True,
            )

        try:
            output = _AdapterOutput.model_validate_json(raw_output)
        except ValidationError:
            raise ApiError(
                status_code=503,
                code="MODEL_OUTPUT_INVALID",
                message="Model menghasilkan format listing yang tidak valid.",
                retryable=True,
            ) from None
        return CopyCandidate(title=output.judul, description=output.deskripsi)

    def _load(self) -> None:
        if self._model is not None:
            return
        with self._load_lock:
            if self._model is not None:
                return
            try:
                import torch
                from huggingface_hub import snapshot_download
                from peft import PeftModel
                from transformers import AutoModelForImageTextToText, AutoProcessor

                snapshot_path = snapshot_download(
                    BASE_MODEL,
                    revision=BASE_MODEL_REVISION,
                    local_files_only=True,
                )
                processor = AutoProcessor.from_pretrained(
                    snapshot_path,
                    local_files_only=True,
                )
                base_model = AutoModelForImageTextToText.from_pretrained(
                    snapshot_path,
                    local_files_only=True,
                    dtype=torch.bfloat16,
                    device_map="cuda",
                )
                model = PeftModel.from_pretrained(
                    base_model, self._adapter_path
                ).eval()
            except Exception as error:  # noqa: BLE001 - model loaders expose heterogeneous failures.
                self._load_error = f"{type(error).__name__}: {error}"
                logger.exception("Listing model initialization failed")
                raise ApiError(
                    status_code=503,
                    code="MODEL_LOAD_FAILED",
                    message="Model generator tidak dapat dimuat.",
                    retryable=True,
                ) from None

            self._torch = torch
            self._processor = processor
            self._model = model
