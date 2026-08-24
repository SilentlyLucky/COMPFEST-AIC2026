from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from decimal import Decimal, InvalidOperation
from enum import Enum
from typing import Any, Literal

from PIL import Image
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class Platform(str, Enum):
    TOKOPEDIA = "tokopedia"
    SHOPEE = "shopee"
    BLIBLI = "blibli"
    UMUM = "umum"


class CategoryCode(str, Enum):
    FASHION_PERAWATAN = "fashion_perawatan"
    KRIYA_RUMAH = "kriya_rumah"
    POKOK_TANI = "pokok_tani"
    MINUMAN_HERBAL = "minuman_herbal"
    BUMBU_MASAK = "bumbu_masak"
    CAMILAN_OLAHAN = "camilan_olahan"
    LAINNYA = "lainnya"


CATEGORY_LABELS: dict[CategoryCode, str] = {
    CategoryCode.FASHION_PERAWATAN: "Fashion & Perawatan",
    CategoryCode.KRIYA_RUMAH: "Kriya & Rumah",
    CategoryCode.POKOK_TANI: "Produk Pokok & Hasil Tani",
    CategoryCode.MINUMAN_HERBAL: "Minuman & Herbal",
    CategoryCode.BUMBU_MASAK: "Bumbu Masak",
    CategoryCode.CAMILAN_OLAHAN: "Camilan Olahan",
    CategoryCode.LAINNYA: "Lainnya",
}


class ListingMetadata(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    product_type: str | None = Field(
        default=None, min_length=2, max_length=80, strict=True
    )
    platform: Platform
    market_region_code: str | None = Field(
        default=None, pattern=r"^ID-[A-Z]{2}$", strict=True
    )
    production_cost_idr: int = Field(ge=1_000, le=1_000_000_000, strict=True)
    brand: str | None = Field(default=None, max_length=120, strict=True)
    variant: str | None = Field(default=None, max_length=120, strict=True)
    size: str | None = Field(default=None, max_length=120, strict=True)
    material_or_ingredients: str | None = Field(
        default=None, max_length=120, strict=True
    )
    packaging_cost_idr: int = Field(default=0, ge=0, le=1_000_000_000, strict=True)
    other_cost_idr: int = Field(default=0, ge=0, le=1_000_000_000, strict=True)
    target_margin_pct: Decimal = Field(default=Decimal(30), ge=0, le=80)
    platform_fee_pct: Decimal = Field(default=Decimal(0), ge=0, le=40)

    @field_validator("product_type", mode="before")
    @classmethod
    def empty_product_type_becomes_none(cls, value: str | None) -> str | None:
        if isinstance(value, str) and not value.strip():
            return None
        return value

    @field_validator("brand", "variant", "size", "material_or_ingredients")
    @classmethod
    def empty_optional_string_becomes_none(cls, value: str | None) -> str | None:
        return value or None

    @field_validator("target_margin_pct", "platform_fee_pct", mode="before")
    @classmethod
    def validate_finite_percentage(cls, value: Any) -> Decimal:
        if isinstance(value, bool) or not isinstance(value, (int, float, Decimal)):
            # Pydantic v2 does not wrap TypeError from validators as ValidationError.
            raise ValueError("percentage must be a finite number")  # noqa: TRY004
        try:
            decimal_value = Decimal(str(value))
        except (InvalidOperation, ValueError):
            raise ValueError("percentage must be a finite number") from None
        if not decimal_value.is_finite():
            raise ValueError("percentage must be a finite number")
        return decimal_value

    @model_validator(mode="after")
    def validate_fee_and_margin(self) -> ListingMetadata:
        if self.target_margin_pct + self.platform_fee_pct >= Decimal(95):
            raise ValueError("platform_fee_pct + target_margin_pct must be below 95")
        return self

    @property
    def total_cost_idr(self) -> int:
        return self.production_cost_idr + self.packaging_cost_idr + self.other_cost_idr

    def confirmed_facts(self) -> tuple[str, ...]:
        values = (
            self.product_type,
            self.brand,
            self.variant,
            self.size,
            self.material_or_ingredients,
        )
        return tuple(value for value in values if value)


@dataclass(frozen=True)
class ProcessedImage:
    image: Image.Image
    detected_mime: str
    original_width: int
    original_height: int


class ServiceReadiness(BaseModel):
    ready: bool
    startable: bool = False
    reason: str | None = None
    details: dict[str, Any] = Field(default_factory=dict)


class CopyCandidate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    title: str = Field(min_length=1, max_length=120)
    description: str = Field(min_length=1, max_length=600)


class CategoryPrediction(BaseModel):
    code: CategoryCode
    # Populated only by a matching held-out calibration artifact.
    score: int | None = Field(default=None, ge=0, le=100)
    evidence_terms: tuple[str, ...] = ()


class MarketEvidence(BaseModel):
    median: int = Field(gt=0)
    low: int = Field(gt=0)
    high: int = Field(gt=0)
    comparable_count: int = Field(ge=0)
    data_as_of: date
    confidence_score: int | None = Field(default=None, ge=0, le=100)

    @model_validator(mode="after")
    def validate_interval(self) -> MarketEvidence:
        if not self.low <= self.median <= self.high:
            raise ValueError("market evidence must satisfy low <= median <= high")
        return self


class PriceAlignment(str, Enum):
    WITHIN_MARKET = "within_market"
    ABOVE_MARKET = "above_market"
    INSUFFICIENT_EVIDENCE = "insufficient_evidence"


class MarketInterval(BaseModel):
    low: int
    high: int
    target_coverage: float = 0.8


class PriceDecision(BaseModel):
    recommended: int | None
    market_interval: MarketInterval | None
    viable_floor: int
    alignment: PriceAlignment
    comparable_count: int
    data_as_of: date | None
    confidence_score: int | None = Field(default=None, ge=0, le=100)
    warnings: tuple[str, ...] = ()


class GroundingResult(BaseModel):
    grounded: CopyCandidate
    passed_claims: int = Field(ge=0)
    total_claims: int = Field(ge=0)
    critical_removed_count: int = Field(ge=0)
    warnings: tuple[str, ...] = ()


class CategoryResult(BaseModel):
    code: CategoryCode
    label: str


class PriceResult(BaseModel):
    currency: Literal["IDR"] = "IDR"
    recommended: int | None
    market_interval: MarketInterval | None
    viable_floor: int
    alignment: PriceAlignment
    comparable_count: int
    data_as_of: date | None


class ListingResult(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    description: str = Field(min_length=50, max_length=600)
    category: CategoryResult
    price: PriceResult


class ConfidenceField(BaseModel):
    score: int | None = Field(default=None, ge=0, le=100)
    band: Literal["low", "medium", "high"] | None = None
    method: str
    status: Literal["available", "insufficient_evidence"] = "available"


class ConfidenceResult(BaseModel):
    category: ConfidenceField
    price: ConfidenceField
    generation: ConfidenceField
    overall: ConfidenceField


class GenerateListingData(BaseModel):
    listing: ListingResult
    confidence: ConfidenceResult
    warnings: list[str]


class BaseResponseMeta(BaseModel):
    request_id: str
    api_version: Literal["v1"] = "v1"


class ResponseMeta(BaseResponseMeta):
    generator_version: str | None = None
    taxonomy_version: str | None = None
    category_model_version: str | None = None
    price_model_version: str | None = None
    price_data_version: str | None = None
    guardrail_version: str | None = None
    calibration_version: str | None = None


class ErrorDetail(BaseModel):
    code: str
    message: str
    field: str | None = None
    retryable: bool = False
    details: dict[str, Any] = Field(default_factory=dict)


class GenerateListingResponse(BaseModel):
    data: GenerateListingData
    meta: ResponseMeta
    error: None = None


class ErrorResponse(BaseModel):
    data: None = None
    meta: BaseResponseMeta
    error: ErrorDetail


class HealthResponse(BaseModel):
    status: Literal["live", "ready", "not_ready"]
    services: dict[str, ServiceReadiness] = Field(default_factory=dict)


# Legacy one-sprint request/response contracts. Runtime mock generation is disabled.
Kategori = Literal[
    "home_and_kitchen",
    "beauty_and_personal_care",
    "grocery_and_gourmet_food",
]


class PredictCategoryRequest(BaseModel):
    image: str


class PredictCategoryResponse(BaseModel):
    kategori: Kategori


class GenerateDescriptionRequest(BaseModel):
    image: str


class GenerateDescriptionResponse(BaseModel):
    deskripsi: str


class GenerateTitleRequest(BaseModel):
    kategori: Kategori
    nama_dasar: str
    varian: str | None = None
    ukuran: str | None = None


class GenerateTitleResponse(BaseModel):
    judul: str


class PredictPriceRequest(BaseModel):
    kategori: Kategori
    rating_avg: float
    lokasi: str
    nama_produk: str
    terjual: float | None = 0


class PredictPriceResponse(BaseModel):
    min_price: int
    max_price: int
