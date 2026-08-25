from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from decimal import Decimal, InvalidOperation
from enum import Enum
from typing import Any, Literal

from PIL import Image
from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    StrictBool,
    StrictInt,
    ValidationInfo,
    field_validator,
    model_serializer,
    model_validator,
)


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

_MASS_UNITS = frozenset({"g", "gr", "gram", "kg"})
_VOLUME_UNITS = frozenset({"ml", "l", "lt", "liter"})
_UMKM_TAX_FREE_TURNOVER_IDR = 500_000_000
_UMKM_FINAL_TAX_MAX_TURNOVER_IDR = 4_800_000_000
_DEFAULT_PLATFORM_DEDUCTIONS: dict[Platform, tuple[Decimal, Decimal]] = {
    Platform.TOKOPEDIA: (Decimal(8), Decimal(0)),
    Platform.SHOPEE: (Decimal(10), Decimal(0)),
    Platform.BLIBLI: (Decimal(10), Decimal(0)),
    Platform.UMUM: (Decimal(0), Decimal(0)),
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
    pricing: PricingOptions | None = Field(default=None, validate_default=True)

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

    @field_validator("pricing")
    @classmethod
    def validate_effective_pricing_deductions(
        cls,
        pricing: PricingOptions | None,
        info: ValidationInfo,
    ) -> PricingOptions | None:
        if pricing is None:
            return None
        platform = info.data.get("platform")
        target_margin = info.data.get("target_margin_pct")
        platform_fee = info.data.get("platform_fee_pct")
        if not isinstance(platform, Platform) or not isinstance(target_margin, Decimal):
            return pricing
        default_commission, shipping = _DEFAULT_PLATFORM_DEDUCTIONS[platform]
        commission = (
            platform_fee
            if isinstance(platform_fee, Decimal) and platform_fee != 0
            else default_commission
        )
        annual_turnover = pricing.annual_turnover_idr
        # PPh UMKM is based on turnover, while PPN is normally collected from
        # the buyer and should not be treated as a seller cost here.
        tax = (
            Decimal("0.5")
            if _UMKM_TAX_FREE_TURNOVER_IDR
            < annual_turnover
            <= _UMKM_FINAL_TAX_MAX_TURNOVER_IDR
            else Decimal(0)
        )
        effective_deductions = (
            target_margin + commission + shipping + tax
        )
        if effective_deductions >= Decimal(95):
            raise ValueError(
                "effective platform deductions and target_margin_pct must be below 95"
            )
        return pricing

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


class PricingOptions(BaseModel):
    """Optional market-first inputs; omitted values retain the legacy cost basis."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    total_hpp_idr: int | None = Field(default=None, ge=1, le=1_000_000_000, strict=True)
    purchase_unit: str | None = Field(
        default=None, min_length=1, max_length=24, strict=True
    )
    purchase_quantity: Decimal | None = Field(default=None)
    sale_content: Decimal | None = Field(default=None)
    sale_unit: str | None = Field(
        default=None, min_length=1, max_length=24, strict=True
    )
    output_unit_count: Decimal | None = Field(default=None)
    output_unit_label: str | None = Field(
        default=None, min_length=1, max_length=32, strict=True
    )
    # These optional variant fields remain accepted for older API clients. The
    # current listing form intentionally does not collect them.
    colors: list[str] = Field(default_factory=list, max_length=12)
    sizes: list[str] = Field(default_factory=list, max_length=12)
    hpp_per_size_idr: dict[str, StrictInt] | None = Field(default=None, max_length=12)
    grades: list[str] = Field(default_factory=list, max_length=12)
    hpp_per_grade_idr: dict[str, StrictInt] | None = Field(default=None, max_length=12)
    annual_turnover_idr: int = Field(default=0, ge=0, le=100_000_000_000, strict=True)
    vat_registered: StrictBool = False

    @field_validator(
        "purchase_quantity", "sale_content", "output_unit_count", mode="before"
    )
    @classmethod
    def validate_positive_quantity(cls, value: Any) -> Decimal | None:
        if value is None:
            return None
        if isinstance(value, bool) or not isinstance(value, (int, float, Decimal)):
            # Pydantic does not wrap TypeError raised by a v2 validator.
            raise ValueError("quantity must be a finite positive number")  # noqa: TRY004
        try:
            number = Decimal(str(value))
        except (InvalidOperation, ValueError):
            raise ValueError("quantity must be a finite positive number") from None
        if not number.is_finite() or number <= 0:
            raise ValueError("quantity must be a finite positive number")
        return number

    @field_validator("colors", "sizes", "grades")
    @classmethod
    def validate_variant_labels(cls, values: list[str]) -> list[str]:
        if any(
            not isinstance(value, str) or not value.strip() or len(value) > 32
            for value in values
        ):
            raise ValueError(
                "variant labels must be non-empty strings up to 32 characters"
            )
        if len({value.casefold() for value in values}) != len(values):
            raise ValueError("variant labels must be unique")
        return values

    @field_validator("hpp_per_size_idr", "hpp_per_grade_idr")
    @classmethod
    def validate_variant_hpp_map(
        cls, values: dict[str, StrictInt] | None
    ) -> dict[str, StrictInt] | None:
        if values is None:
            return None
        for label, hpp in values.items():
            if not isinstance(label, str) or not label.strip() or len(label) > 32:
                raise ValueError("variant HPP map keys must be valid variant labels")
            if isinstance(hpp, bool) or not isinstance(hpp, int) or hpp <= 0:
                raise ValueError("variant HPP map values must be positive integers")
        return values

    @model_validator(mode="after")
    def validate_pricing_basis(self) -> PricingOptions:
        paired_fields = (
            (
                self.purchase_unit,
                self.purchase_quantity,
                "purchase_unit and purchase_quantity",
            ),
            (self.sale_content, self.sale_unit, "sale_content and sale_unit"),
        )
        for first, second, label in paired_fields:
            if (first is None) != (second is None):
                raise ValueError(f"{label} must be supplied together")
        if self.sale_content is not None and self.sale_unit is not None:
            sale_dimension = _content_dimension(self.sale_unit)
            if sale_dimension is None:
                raise ValueError(
                    "sale_unit must be a supported mass or volume unit when sale_content is supplied"
                )
            if self.purchase_unit is not None:
                purchase_dimension = _content_dimension(self.purchase_unit)
                if purchase_dimension is None:
                    raise ValueError(
                        "purchase_unit must be a supported mass or volume unit when sale_content is supplied"
                    )
                if purchase_dimension != sale_dimension:
                    raise ValueError(
                        "purchase_unit and sale_unit must use the same dimension"
                    )
        has_advanced_basis = any(
            value is not None
            for value in (
                self.purchase_unit,
                self.purchase_quantity,
                self.sale_content,
                self.sale_unit,
                self.output_unit_count,
                self.output_unit_label,
            )
        )
        if has_advanced_basis and self.total_hpp_idr is None:
            raise ValueError("total_hpp_idr is required for an advanced pricing basis")
        if self.hpp_per_size_idr is not None and (
            not self.sizes or not set(self.hpp_per_size_idr).issubset(self.sizes)
        ):
            raise ValueError("hpp_per_size_idr keys must match supplied sizes")
        if self.hpp_per_grade_idr is not None and (
            not self.grades or not set(self.hpp_per_grade_idr).issubset(self.grades)
        ):
            raise ValueError("hpp_per_grade_idr keys must match supplied grades")
        return self


def _content_dimension(unit: str) -> str | None:
    normalized = unit.casefold()
    if normalized in _MASS_UNITS:
        return "mass"
    if normalized in _VOLUME_UNITS:
        return "volume"
    return None


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
    p25: int | None = Field(default=None, gt=0)
    p50: int | None = Field(default=None, gt=0)
    p75: int | None = Field(default=None, gt=0)
    comparable_count: int = Field(ge=0)
    data_as_of: date
    confidence_score: int | None = Field(default=None, ge=0, le=100)

    @model_validator(mode="after")
    def validate_interval(self) -> MarketEvidence:
        if not self.low <= self.median <= self.high:
            raise ValueError("market evidence must satisfy low <= median <= high")
        if (self.p25 is None) != (self.p75 is None):
            raise ValueError("market evidence must provide p25 and p75 together")
        quartile_median = self.p50 if self.p50 is not None else self.median
        if self.p25 is not None and not self.p25 <= quartile_median <= self.p75:
            raise ValueError("market evidence must satisfy p25 <= p50 <= p75")
        return self


class MarketComparable(BaseModel):
    """A bounded, seller-visible sample of catalog evidence."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    title: str = Field(min_length=1, max_length=160)
    price: int = Field(gt=0)


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
    comparable_preview: tuple[MarketComparable, ...] = ()
    pricing_details: PriceDetails | None = None


class VariantPriceDetails(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    label: str = Field(min_length=1, max_length=32)
    kind: Literal["color", "size", "grade"]
    hpp_per_unit_idr: int = Field(gt=0)
    minimum_price_idr: int = Field(gt=0)
    recommended_price_idr: int = Field(gt=0)
    aggressive_price_idr: int = Field(gt=0)
    premium_price_idr: int = Field(gt=0)
    margin_pct: float
    cost_breakdown_idr: dict[str, int]
    note: str = Field(min_length=1, max_length=160)


class PriceDetails(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    hpp_per_unit_idr: int = Field(gt=0)
    sale_unit: str = Field(min_length=1, max_length=32)
    aggressive_price_idr: int = Field(gt=0)
    premium_price_idr: int = Field(gt=0)
    minimum_price_idr: int = Field(gt=0)
    zone: Literal["good", "fair", "tight", "danger"]
    margin_pct: float
    cost_breakdown_idr: dict[str, int]
    variant_prices: list[VariantPriceDetails] = Field(default_factory=list)
    suggested_variations: list[str] = Field(default_factory=list)
    explanation: str = Field(min_length=1, max_length=600)
    engine_version: str = Field(min_length=1, max_length=80)


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
    comparable_preview: tuple[MarketComparable, ...] = ()
    pricing_details: PriceDetails | None = None

    @model_serializer(mode="wrap")
    def serialize_optional_details(self, handler):
        payload = handler(self)
        if self.pricing_details is None:
            payload.pop("pricing_details", None)
        if not self.comparable_preview:
            payload.pop("comparable_preview", None)
        return payload


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
