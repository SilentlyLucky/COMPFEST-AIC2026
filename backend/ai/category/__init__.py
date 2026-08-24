"""OpenCLIP category-classification runtime."""

from .openclip import (
    CALIBRATION_VERSION,
    CATEGORY_MODEL_VERSION,
    DEFAULT_ARTIFACT_PATH,
    DEFAULT_ENCODER_PATH,
    OpenClipCategoryClassifier,
    build_category_fact_text,
)

__all__ = [
    "CALIBRATION_VERSION",
    "CATEGORY_MODEL_VERSION",
    "DEFAULT_ARTIFACT_PATH",
    "DEFAULT_ENCODER_PATH",
    "OpenClipCategoryClassifier",
    "build_category_fact_text",
]
