"""Small, catalog-compatible market-first pricing adapter.

The catalog remains the source of market evidence.  This module only applies
transparent cost, tariff, unit, and variant calculations to that evidence.
"""

from __future__ import annotations

import logging
import math
import re
from collections.abc import Iterable
from dataclasses import dataclass
from decimal import ROUND_CEILING, Decimal
from itertools import pairwise

try:
    from pricing import align_market_price
    from schemas import (
        CategoryCode,
        ListingMetadata,
        MarketEvidence,
        PriceAlignment,
        PriceDecision,
        PriceDetails,
        VariantPriceDetails,
    )
except ModuleNotFoundError:  # Allow import through backend.ai.pricing at repo root.
    from backend.pricing import align_market_price
    from backend.schemas import (
        CategoryCode,
        ListingMetadata,
        MarketEvidence,
        PriceAlignment,
        PriceDecision,
        PriceDetails,
        VariantPriceDetails,
    )

LOGGER = logging.getLogger(__name__)
ENGINE_VERSION = "market-first-catalog-v1"
CATALOG_VARIATION_MINIMUM_PERCENT = 20
UMKM_TAX_FREE_TURNOVER_IDR = 500_000_000
UMKM_FINAL_TAX_MAX_TURNOVER_IDR = 4_800_000_000

_CATEGORY_TARIFF = {
    "bumbu_masak": "makanan_minuman",
    "camilan_olahan": "makanan_minuman",
    "pokok_tani": "makanan_minuman",
    "minuman_herbal": "minuman_herbal",
    "fashion_perawatan": "fashion_perawatan",
    "kriya_rumah": "kriya_rumah",
    "lainnya": "lainnya",
}
_PLATFORM_TARIFFS = {
    "tokopedia": {
        "commission": {
            "fashion_perawatan": Decimal(8),
            "makanan_minuman": Decimal("5.75"),
            "minuman_herbal": Decimal("7.5"),
            "kriya_rumah": Decimal(8),
            "lainnya": Decimal(8),
        },
        "shipping": Decimal(0),
        "processing": 1_250,
        "commission_cap": 80_000,
    },
    "shopee": {
        "commission": {
            "fashion_perawatan": Decimal(10),
            "makanan_minuman": Decimal(10),
            "minuman_herbal": Decimal("6.5"),
            "kriya_rumah": Decimal(10),
            "lainnya": Decimal(9),
        },
        # Program ongkir is optional and seller/program dependent; it is not
        # included in the baseline estimate.
        "shipping": Decimal(0),
        "processing": 1_250,
        "commission_cap": None,
    },
    "blibli": {
        "commission": {
            "fashion_perawatan": Decimal(10),
            "makanan_minuman": Decimal("5.75"),
            "minuman_herbal": Decimal("5.75"),
            "kriya_rumah": Decimal(8),
            "lainnya": Decimal("7.5"),
        },
        "shipping": Decimal(0),
        "processing": 0,
        "commission_cap": None,
    },
}
_UNIT_MULTIPLIERS = {
    "lusin": Decimal(12),
    "kodi": Decimal(20),
    "gross": Decimal(144),
    "bal": Decimal(12),
    "dus": Decimal(24),
    "pack": Decimal(6),
}
_SIZE_PATTERN = re.compile(
    r"(\d+(?:[.,]\d+)?)\s*(kg|gr|gram|g|ml|liter|lt|l)\b", re.IGNORECASE
)
_SIZE_ANCHORS = {
    "weight": {50: 1.0, 100: 1.85, 150: 2.6, 250: 4.0, 500: 7.0, 1000: 12.0},
    "volume": {15: 1.0, 30: 1.8, 60: 3.2, 100: 4.8},
}
_FASHION_SIZE_FACTORS = {
    "xs": 1.0,
    "s": 1.0,
    "m": 1.0,
    "l": 1.0,
    "xl": 1.0,
    "xxl": 1.05,
    "2xl": 1.05,
    "3xl": 1.1,
    "xxxl": 1.1,
    "4xl": 1.15,
    "5xl": 1.2,
}
_VARIATION_PATTERNS = (
    (
        re.compile(
            r"\b(hitam|putih|merah|biru|hijau|kuning|coklat|cokelat|abu|navy|maroon|pink|ungu|krem|gold|silver|tosca|mocca|warna)\b",
            re.IGNORECASE,
        ),
        "Comparable titles show color variants; consider a color option.",
    ),
    (
        re.compile(
            r"\b(all\s?size|allsize|ukuran|size|xs|xl|xxl|2xl|3xl|4xl|5xl)\b",
            re.IGNORECASE,
        ),
        "Comparable titles show size variants; consider size options.",
    ),
    (
        re.compile(
            r"\b\d+(?:[.,]\d+)?\s*(kg|gr|gram|g|ml|liter|lt|l)\b",
            re.IGNORECASE,
        ),
        "Comparable titles show weight or content variants; consider separate content options.",
    ),
    (
        re.compile(r"\b(rasa|varian rasa|flavor)\b", re.IGNORECASE),
        "Comparable titles show flavor variants; consider flavor options.",
    ),
    (
        re.compile(r"\b\d+\s*(gb|tb)\b", re.IGNORECASE),
        "Comparable titles show capacity variants; consider capacity options.",
    ),
)
_GRADE_FACTORS = {
    "fashion_perawatan": {"reguler": 1.0, "premium": 1.5},
    "camilan_olahan": {"reguler": 1.0, "premium": 1.8},
    "bumbu_masak": {"reguler": 1.0, "premium": 1.8},
    "pokok_tani": {"reguler": 1.0, "premium": 1.8},
    "minuman_herbal": {"reguler": 1.0, "premium": 1.8},
    "kriya_rumah": {"reguler": 1.0, "premium": 2.5},
    "lainnya": {"reguler": 1.0, "premium": 1.5},
}


@dataclass(frozen=True)
class _Tariff:
    commission_pct: Decimal
    shipping_pct: Decimal
    processing_idr: int
    commission_cap_idr: int | None
    defaulted: bool


@dataclass(frozen=True)
class _TierPrices:
    minimum: int
    zone: str
    recommended: int
    aggressive: int
    premium: int


def price_with_market_first(
    metadata: ListingMetadata,
    category: CategoryCode | str,
    evidence: MarketEvidence | None,
    *,
    comparable_titles: Iterable[str] = (),
) -> PriceDecision:
    """Return legacy-compatible top-level pricing plus optional rich details."""
    hpp_per_unit = _hpp_per_unit(metadata)
    if metadata.pricing is None:
        # Platform fees must still be applied for the simple form path. The
        # category is predicted from the image before this function runs, so
        # sellers do not need to guess a fee themselves.
        tariff, tariff_warnings = _tariff(metadata, category)
        viable_floor = _minimum_price(
            metadata.total_cost_idr,
            tariff,
            metadata.target_margin_pct,
            0,
            False,
        )
    else:
        tariff, tariff_warnings = _tariff(metadata, category)
        if metadata.pricing.annual_turnover_idr > UMKM_FINAL_TAX_MAX_TURNOVER_IDR:
            tariff_warnings = (*tariff_warnings, "PPh_FINAL_NOT_APPLIED_OVER_4_8B")
        viable_floor = _minimum_price(
            hpp_per_unit,
            tariff,
            metadata.target_margin_pct,
            metadata.pricing.annual_turnover_idr,
            metadata.pricing.vat_registered,
        )
    aligned = align_market_price(viable_floor, evidence)
    if aligned.recommended is None or evidence is None:
        return aligned.model_copy(
            update={"warnings": (*aligned.warnings, *tariff_warnings)}
        )

    tiers = _tier_prices(viable_floor, evidence)
    annual_turnover = metadata.pricing.annual_turnover_idr if metadata.pricing else 0
    vat_registered = metadata.pricing.vat_registered if metadata.pricing else False
    breakdown = _breakdown(
        tiers.recommended, hpp_per_unit, tariff, annual_turnover, vat_registered
    )
    details = None
    if metadata.pricing is not None:
        sale_unit = metadata.pricing.output_unit_label or "pcs"
        variants, suggestions = _variant_prices(
            metadata,
            category.value if isinstance(category, CategoryCode) else str(category),
            evidence,
            tariff,
            tiers,
            hpp_per_unit,
            annual_turnover,
            vat_registered,
        )
        suggestions = _catalog_variation_suggestions(comparable_titles, suggestions)
        explanation = (
            f"Market evidence from {evidence.comparable_count} comparable listings sets the "
            f"reference range at IDR {evidence.low:,} to IDR {evidence.high:,}. "
            f"The recommended IDR {tiers.recommended:,} per {sale_unit} stays above the "
            f"IDR {viable_floor:,} safety floor based on HPP, marketplace costs, and "
            f"the requested target margin."
        )
        details = PriceDetails(
            hpp_per_unit_idr=hpp_per_unit,
            sale_unit=sale_unit,
            aggressive_price_idr=tiers.aggressive,
            premium_price_idr=tiers.premium,
            minimum_price_idr=viable_floor,
            zone=tiers.zone,
            margin_pct=_margin_pct(tiers.recommended, hpp_per_unit),
            cost_breakdown_idr=breakdown,
            variant_prices=variants,
            suggested_variations=suggestions,
            explanation=explanation,
            engine_version=ENGINE_VERSION,
        )
    return aligned.model_copy(
        update={
            "recommended": tiers.recommended,
            "viable_floor": viable_floor,
            "alignment": (
                PriceAlignment.ABOVE_MARKET
                if viable_floor > evidence.high
                else PriceAlignment.WITHIN_MARKET
            ),
            "warnings": (*aligned.warnings, *tariff_warnings),
            "pricing_details": details,
        }
    )


def _hpp_per_unit(metadata: ListingMetadata) -> int:
    options = metadata.pricing
    if options is None or options.total_hpp_idr is None:
        return metadata.total_cost_idr
    if options.output_unit_count is not None:
        units = options.output_unit_count
    else:
        units = _converted_output_units(options)
    hpp = Decimal(options.total_hpp_idr) / units
    return (
        int(hpp.to_integral_value(rounding=ROUND_CEILING))
        + metadata.packaging_cost_idr
        + metadata.other_cost_idr
    )


def _converted_output_units(options) -> Decimal:
    if options.purchase_quantity is None or options.purchase_unit is None:
        return Decimal(1)
    purchase_unit = options.purchase_unit.casefold()
    quantity = options.purchase_quantity
    if options.sale_content is not None and options.sale_unit is not None:
        source = _base_unit_quantity(quantity, purchase_unit)
        sale = _base_unit_quantity(options.sale_content, options.sale_unit.casefold())
        if source[0] != sale[0]:
            raise ValueError("purchase and sale units must use the same dimension")
        return source[1] / sale[1]
    return quantity * _UNIT_MULTIPLIERS.get(purchase_unit, Decimal(1))


def _base_unit_quantity(quantity: Decimal, unit: str) -> tuple[str, Decimal]:
    if unit in {"g", "gr", "gram"}:
        return "weight", quantity
    if unit == "kg":
        return "weight", quantity * 1_000
    if unit == "ml":
        return "volume", quantity
    if unit in {"l", "lt", "liter"}:
        return "volume", quantity * 1_000
    raise ValueError("sale-content conversion supports mass or volume units only")


def _tariff(
    metadata: ListingMetadata, category: CategoryCode | str
) -> tuple[_Tariff, tuple[str, ...]]:
    if metadata.platform.value == "umum":
        return _Tariff(Decimal(0), Decimal(0), 0, None, False), ()
    category_value = (
        category.value if isinstance(category, CategoryCode) else str(category)
    )
    tariff_category = _CATEGORY_TARIFF.get(category_value)
    warnings: list[str] = []
    if tariff_category is None:
        LOGGER.warning(
            "Unknown backend pricing category %r; using lainnya tariff", category_value
        )
        tariff_category = "lainnya"
        warnings.append("UNKNOWN_CATEGORY_TARIFF_FALLBACK")
    config = _PLATFORM_TARIFFS[metadata.platform.value]
    defaulted = metadata.platform_fee_pct == 0
    if defaulted:
        commission = config["commission"][tariff_category]
        warnings.append("PLATFORM_FEE_DEFAULTED")
    else:
        commission = metadata.platform_fee_pct
    return (
        _Tariff(
            commission,
            config["shipping"],
            config["processing"],
            config["commission_cap"],
            defaulted,
        ),
        tuple(warnings),
    )


def _deductions_pct(annual_turnover: int, _vat_registered: bool) -> Decimal:
    """Return seller-side PPh estimate, not buyer-collected PPN.

    PP 20/2026 keeps the 0.5% UMKM final rate and exempts the first
    Rp500 million of an eligible individual taxpayer's annual turnover. The
    estimate applies the rate only once the supplied turnover is above that
    threshold. PPN is deliberately excluded because it is not a seller cost
    when charged to the buyer.
    """
    return (
        Decimal("0.5")
        if UMKM_TAX_FREE_TURNOVER_IDR < annual_turnover <= UMKM_FINAL_TAX_MAX_TURNOVER_IDR
        else Decimal(0)
    )


def _minimum_price(
    hpp: int,
    tariff: _Tariff,
    target_margin_pct: Decimal,
    annual_turnover: int,
    vat_registered: bool,
) -> int:
    percentage = (
        tariff.commission_pct
        + tariff.shipping_pct
        + _deductions_pct(annual_turnover, vat_registered)
        + target_margin_pct
    )
    if percentage >= Decimal(95):
        raise ValueError(
            "combined pricing deductions and target margin must be below 95%"
        )
    numerator = Decimal(hpp + tariff.processing_idr)
    preliminary = numerator / (Decimal(1) - percentage / Decimal(100))
    if (
        tariff.commission_cap_idr is not None
        and preliminary * tariff.commission_pct / Decimal(100)
        > tariff.commission_cap_idr
    ):
        capped_numerator = numerator + tariff.commission_cap_idr
        percentage_without_commission = percentage - tariff.commission_pct
        preliminary = capped_numerator / (
            Decimal(1) - percentage_without_commission / Decimal(100)
        )
    return int(preliminary.to_integral_value(rounding=ROUND_CEILING))


def _round_at_least(value: int, floor: int) -> int:
    if value < 10_000:
        step = 500
    elif value < 100_000:
        step = 1_000
    elif value < 1_000_000:
        step = 5_000
    else:
        step = 10_000
    rounded = round(value / step) * step - 100
    if rounded >= floor:
        return max(rounded, 100)
    return max(((floor + 100 + step - 1) // step) * step - 100, 100)


def _zone(floor: int, evidence: MarketEvidence) -> str:
    upper_quartile = evidence.p75 or evidence.high
    lower_quartile = evidence.p25 or evidence.low
    quartile_median = evidence.p50 or evidence.median
    if floor > upper_quartile:
        return "danger"
    if floor > quartile_median:
        return "tight"
    if floor > lower_quartile:
        return "fair"
    return "good"


def _tier_prices(floor: int, evidence: MarketEvidence) -> _TierPrices:
    """Adapt model_harga's zone decision tiers to catalog low/median/high evidence."""
    lower_quartile = evidence.p25 or evidence.low
    upper_quartile = evidence.p75 or evidence.high
    quartile_median = evidence.p50 or evidence.median
    zone = _zone(floor, evidence)
    if zone == "danger":
        recommended_base = upper_quartile
    elif zone == "tight":
        recommended_base = min(
            max(_percent_of(floor, "1.15"), quartile_median), upper_quartile
        )
    elif zone == "fair":
        recommended_base = min(
            max(quartile_median, _percent_of(floor, "1.20")), upper_quartile
        )
    else:
        recommended_base = quartile_median
    aggressive_base = max(lower_quartile, _percent_of(floor, "1.10"))
    premium_base = min(_percent_of(upper_quartile, "1.10"), _percent_of(floor, "2.5"))
    recommended = _round_at_least(recommended_base, floor)
    aggressive = min(_round_at_least(aggressive_base, floor), recommended)
    premium = max(_round_at_least(premium_base, floor), recommended)
    return _TierPrices(
        minimum=floor,
        zone=zone,
        recommended=recommended,
        aggressive=aggressive,
        premium=premium,
    )


def _percent_of(value: int, multiplier: str) -> int:
    return int(Decimal(value) * Decimal(multiplier))


def _breakdown(
    price: int, hpp: int, tariff: _Tariff, annual_turnover: int, _vat_registered: bool
) -> dict[str, int]:
    commission = min(
        int(Decimal(price) * tariff.commission_pct / Decimal(100)),
        tariff.commission_cap_idr or price,
    )
    shipping = int(Decimal(price) * tariff.shipping_pct / Decimal(100))
    tax_pct = _deductions_pct(annual_turnover, False)
    tax = int(Decimal(price) * tax_pct / Decimal(100))
    profit = price - hpp - commission - shipping - tariff.processing_idr - tax
    return {
        "hpp": hpp,
        "platform_commission": commission,
        "shipping_program": shipping,
        "processing_fee": tariff.processing_idr,
        "income_tax": tax,
        "net_profit": profit,
    }


def _margin_pct(price: int, hpp: int) -> Decimal:
    return (Decimal(price - hpp) * Decimal(100) / Decimal(hpp)).quantize(Decimal("0.1"))


def _variant_prices(
    metadata,
    category: str,
    evidence: MarketEvidence,
    tariff: _Tariff,
    base_tiers: _TierPrices,
    base_hpp: int,
    annual_turnover: int,
    vat_registered: bool,
) -> tuple[list[VariantPriceDetails], list[str]]:
    options = metadata.pricing
    if options is None:
        return [], []
    variants: list[VariantPriceDetails] = []
    suggestions: list[str] = []
    if options.colors:
        for label in options.colors:
            variants.append(
                _variant(
                    label,
                    "color",
                    base_hpp,
                    evidence,
                    tariff,
                    metadata.target_margin_pct,
                    annual_turnover,
                    vat_registered,
                    "same price as the base unit",
                    base_tiers,
                )
            )
    if options.sizes:
        base_label = options.sizes[0]
        for label in options.sizes:
            explicit = (options.hpp_per_size_idr or {}).get(label)
            factor = (
                Decimal(explicit) / Decimal(base_hpp)
                if explicit
                else Decimal(str(_size_factor(label, base_label)))
            )
            hpp = explicit or max(1, int(Decimal(base_hpp) * factor))
            note = (
                "seller-provided HPP"
                if explicit
                else f"estimated from size factor {factor:.2f}"
            )
            variants.append(
                _variant(
                    label,
                    "size",
                    hpp,
                    _scaled_evidence(evidence, factor),
                    tariff,
                    metadata.target_margin_pct,
                    annual_turnover,
                    vat_registered,
                    note,
                    None,
                )
            )
    if options.grades:
        grade_factors = _GRADE_FACTORS.get(category, _GRADE_FACTORS["lainnya"])
        for label in options.grades:
            explicit = (options.hpp_per_grade_idr or {}).get(label)
            if explicit:
                hpp, note = explicit, "seller-provided HPP"
                grade_evidence = evidence
                estimated_tiers = None
            else:
                factor = Decimal(str(grade_factors.get(label.casefold(), 1.0)))
                hpp, note, grade_evidence, estimated_tiers = (
                    base_hpp,
                    f"estimated price factor {factor:.2f}; HPP is unchanged",
                    evidence,
                    _scaled_tiers(base_tiers, factor, base_tiers.minimum),
                )
            variants.append(
                _variant(
                    label,
                    "grade",
                    hpp,
                    grade_evidence,
                    tariff,
                    metadata.target_margin_pct,
                    annual_turnover,
                    vat_registered,
                    note,
                    estimated_tiers,
                )
            )
    return variants, suggestions


def _catalog_variation_suggestions(
    comparable_titles: Iterable[str], existing: list[str]
) -> list[str]:
    titles = tuple(str(title) for title in comparable_titles)
    title_count = len(titles)
    suggestions = list(existing)
    for pattern, suggestion in _VARIATION_PATTERNS:
        if (
            title_count
            and sum(bool(pattern.search(title)) for title in titles) * 100
            >= title_count * CATALOG_VARIATION_MINIMUM_PERCENT
            and suggestion not in suggestions
        ):
            suggestions.append(suggestion)
        if len(suggestions) == 5:
            break
    return suggestions


def _variant(
    label: str,
    kind: str,
    hpp: int,
    evidence: MarketEvidence,
    tariff: _Tariff,
    target_margin: Decimal,
    annual_turnover: int,
    vat_registered: bool,
    note: str,
    tiers_override: _TierPrices | None,
) -> VariantPriceDetails:
    minimum = _minimum_price(
        hpp, tariff, target_margin, annual_turnover, vat_registered
    )
    tiers = tiers_override or _tier_prices(minimum, evidence)
    breakdown = _breakdown(
        tiers.recommended, hpp, tariff, annual_turnover, vat_registered
    )
    return VariantPriceDetails(
        label=label,
        kind=kind,
        hpp_per_unit_idr=hpp,
        minimum_price_idr=minimum,
        recommended_price_idr=tiers.recommended,
        aggressive_price_idr=tiers.aggressive,
        premium_price_idr=tiers.premium,
        margin_pct=_margin_pct(tiers.recommended, hpp),
        cost_breakdown_idr=breakdown,
        note=note,
    )


def _scaled_tiers(tiers: _TierPrices, factor: Decimal, floor: int) -> _TierPrices:
    recommended = _round_at_least(int(tiers.recommended * factor), floor)
    return _TierPrices(
        minimum=floor,
        zone=tiers.zone,
        recommended=recommended,
        aggressive=min(
            _round_at_least(int(tiers.aggressive * factor), floor), recommended
        ),
        premium=max(_round_at_least(int(tiers.premium * factor), floor), recommended),
    )


def _scaled_evidence(evidence: MarketEvidence, factor: Decimal) -> MarketEvidence:
    updates = {
        "low": max(1, int(evidence.low * factor)),
        "median": max(1, int(evidence.median * factor)),
        "high": max(1, int(evidence.high * factor)),
    }
    if evidence.p25 is not None and evidence.p75 is not None:
        updates["p25"] = max(1, int(evidence.p25 * factor))
        updates["p50"] = max(
            updates["p25"], int((evidence.p50 or evidence.median) * factor)
        )
        updates["p75"] = max(updates["p50"], int(evidence.p75 * factor))
    return evidence.model_copy(update=updates)


def _size_factor(label: str, base_label: str) -> float:
    candidate = _size_value(label)
    base = _size_value(base_label)
    if candidate is None or base is None or candidate[0] != base[0]:
        return 1.0
    return _anchor_factor(candidate[1], candidate[0]) / _anchor_factor(base[1], base[0])


def _size_value(label: str) -> tuple[str, float] | None:
    match = _SIZE_PATTERN.search(label)
    if match:
        quantity = float(match.group(1).replace(",", "."))
        unit = match.group(2).casefold()
        if unit == "kg":
            return "weight", quantity * 1_000
        if unit in {"g", "gr", "gram"}:
            return "weight", quantity
        return "volume", quantity * (1_000 if unit in {"l", "lt", "liter"} else 1)
    normalized = label.casefold().replace(" ", "").replace("-", "")
    if normalized in _FASHION_SIZE_FACTORS:
        return "fashion", _FASHION_SIZE_FACTORS[normalized]
    return None


def _anchor_factor(quantity: float, dimension: str) -> float:
    if dimension == "fashion":
        return quantity
    points = sorted(_SIZE_ANCHORS[dimension].items())
    left, right = points[0], points[1]
    for first, second in pairwise(points):
        if first[0] <= quantity <= second[0]:
            left, right = first, second
            break
        if quantity > second[0]:
            left, right = first, second
    exponent = math.log(right[1] / left[1]) / math.log(right[0] / left[0])
    return left[1] * (quantity / left[0]) ** exponent


__all__ = ["ENGINE_VERSION", "price_with_market_first"]
