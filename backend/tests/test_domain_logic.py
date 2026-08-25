from datetime import date, timedelta
from decimal import Decimal

import pytest

from ai.pricing.market_first import _tier_prices, price_with_market_first
from confidence import build_confidence, score_generation
from guardrails import ground_copy
from pricing import PricingInputError, align_market_price, calculate_viable_floor
from schemas import CopyCandidate, ListingMetadata, MarketEvidence, PriceAlignment

TODAY = date(2026, 8, 23)


def test_viable_floor_uses_margin_on_sale_price_and_rounds_up() -> None:
    assert (
        calculate_viable_floor(
            total_cost_idr=13_000,
            platform_fee_pct=Decimal(8),
            target_margin_pct=Decimal(30),
        )
        == 20_968
    )


def test_viable_floor_rejects_unsafe_fee_and_margin_sum() -> None:
    with pytest.raises(PricingInputError):
        calculate_viable_floor(10_000, Decimal(40), Decimal(55))


def test_market_first_converts_total_hpp_and_defaults_marketplace_tariff() -> None:
    """A wholesale 3 kg purchase must become the HPP of each 250 g sale bag."""
    metadata = ListingMetadata.model_validate(
        {
            "platform": "tokopedia",
            "production_cost_idr": 12_000,
            "packaging_cost_idr": 1_000,
            "target_margin_pct": 30,
            "pricing": {
                "total_hpp_idr": 120_000,
                "purchase_unit": "kg",
                "purchase_quantity": 3,
                "sale_content": 250,
                "sale_unit": "g",
                "output_unit_label": "bag",
                "sizes": ["250 g", "500 g"],
                "hpp_per_size_idr": {"250 g": 11_000, "500 g": 20_000},
            },
        }
    )
    evidence = MarketEvidence(
        median=25_000,
        low=23_000,
        high=28_000,
        comparable_count=30,
        data_as_of=TODAY,
        confidence_score=80,
    )

    result = price_with_market_first(
        metadata,
        "camilan_olahan",
        evidence,
        comparable_titles=(
            "Keripik Pisang Rasa Cokelat 250 g",
            "Keripik Pisang Rasa Keju 500 g",
            "Keripik Pisang Kemasan 250 g",
        ),
    )

    assert result.pricing_details is not None
    assert result.pricing_details.hpp_per_unit_idr == 11_000
    assert result.pricing_details.sale_unit == "bag"
    assert result.pricing_details.variant_prices[1].hpp_per_unit_idr == 20_000
    assert result.pricing_details.suggested_variations == [
        "Comparable titles show color variants; consider a color option.",
        "Comparable titles show weight or content variants; consider separate content options.",
        "Comparable titles show flavor variants; consider flavor options.",
    ]
    assert "PLATFORM_FEE_DEFAULTED" in result.warnings


def test_market_first_withholds_details_when_market_evidence_is_stale() -> None:
    """Cost-only figures cannot be presented as a market-backed recommendation."""
    metadata = ListingMetadata(
        platform="tokopedia", production_cost_idr=12_000, target_margin_pct=30
    )
    stale = MarketEvidence(
        median=25_000,
        low=23_000,
        high=28_000,
        comparable_count=30,
        data_as_of=TODAY - timedelta(days=91),
        confidence_score=80,
    )

    result = price_with_market_first(metadata, "camilan_olahan", stale)

    assert result.recommended is None
    assert result.pricing_details is None
    assert result.confidence_score is None


def test_market_first_defaults_sale_unit_to_pcs() -> None:
    """An advanced basis without a label defaults its detail sale unit to pcs."""
    metadata = ListingMetadata.model_validate(
        {
            "platform": "umum",
            "production_cost_idr": 12_000,
            "target_margin_pct": 30,
            "pricing": {"total_hpp_idr": 12_000},
        }
    )
    evidence = MarketEvidence(
        median=25_000,
        low=23_000,
        high=28_000,
        comparable_count=30,
        data_as_of=TODAY,
        confidence_score=80,
    )

    result = price_with_market_first(metadata, "camilan_olahan", evidence)

    assert result.pricing_details is not None
    assert result.pricing_details.sale_unit == "pcs"


@pytest.mark.parametrize(
    ("floor", "zone", "recommended", "aggressive", "premium"),
    [
        (5_000, "good", 19_900, 9_900, 19_900),
        (15_000, "fair", 19_900, 15_900, 32_900),
        (25_000, "tight", 28_900, 27_900, 32_900),
        (32_000, "danger", 32_900, 32_900, 32_900),
    ],
)
def test_market_first_uses_model_harga_zone_tiers_with_hard_floor(
    floor: int, zone: str, recommended: int, aggressive: int, premium: int
) -> None:
    """Tier options follow market-first zones but never drop below the safety floor."""
    evidence = MarketEvidence(
        low=10_000,
        median=20_000,
        high=30_000,
        comparable_count=20,
        data_as_of=TODAY,
    )

    tiers = _tier_prices(floor, evidence)

    assert (tiers.zone, tiers.recommended, tiers.aggressive, tiers.premium) == (
        zone,
        recommended,
        aggressive,
        premium,
    )
    assert min(tiers.recommended, tiers.aggressive, tiers.premium) >= floor
    assert tiers.aggressive <= tiers.recommended <= tiers.premium


def test_estimated_grade_variant_preserves_danger_zone_tier_order() -> None:
    """Grade scaling cannot restore an inverted danger-zone price ladder."""
    metadata = ListingMetadata.model_validate(
        {
            "platform": "umum",
            "production_cost_idr": 32_000,
            "pricing": {
                "total_hpp_idr": 32_000,
                "grades": ["premium"],
            },
        }
    )
    evidence = MarketEvidence(
        low=10_000,
        median=20_000,
        high=30_000,
        comparable_count=20,
        data_as_of=TODAY,
    )

    result = price_with_market_first(metadata, "fashion_perawatan", evidence)

    assert result.pricing_details is not None
    grade = result.pricing_details.variant_prices[0]
    assert grade.minimum_price_idr >= 32_000
    assert (
        grade.aggressive_price_idr
        <= grade.recommended_price_idr
        <= grade.premium_price_idr
    )


def test_market_first_uses_filtered_quartiles_not_public_interval_bounds() -> None:
    """Tier decisions use P25/P75 while the public low/high interval remains P10/P90."""
    evidence = MarketEvidence(
        low=10_000,
        p25=15_000,
        median=20_000,
        p50=20_000,
        p75=25_000,
        high=30_000,
        comparable_count=20,
        data_as_of=TODAY,
    )

    fair = _tier_prices(16_000, evidence)
    tight = _tier_prices(22_000, evidence)

    assert (fair.zone, fair.recommended, fair.aggressive, fair.premium) == (
        "fair",
        19_900,
        17_900,
        27_900,
    )
    assert (tight.zone, tight.recommended, tight.aggressive, tight.premium) == (
        "tight",
        24_900,
        23_900,
        27_900,
    )


def test_grade_prices_distinguish_estimated_markup_from_explicit_hpp() -> None:
    """Estimated grades scale base tiers; supplied HPP receives a fresh tier decision."""
    metadata = ListingMetadata.model_validate(
        {
            "platform": "umum",
            "production_cost_idr": 10_000,
            "pricing": {
                "total_hpp_idr": 10_000,
                "grades": ["regular", "premium"],
                "hpp_per_grade_idr": {"regular": 10_000},
            },
        }
    )
    evidence = MarketEvidence(
        low=10_000,
        median=20_000,
        high=30_000,
        comparable_count=20,
        data_as_of=TODAY,
    )

    result = price_with_market_first(metadata, "fashion_perawatan", evidence)

    assert result.pricing_details is not None
    regular, premium = result.pricing_details.variant_prices
    assert regular.note == "seller-provided HPP"
    assert regular.hpp_per_unit_idr == 10_000
    assert regular.recommended_price_idr == 19_900
    assert regular.margin_pct == 99.0
    assert premium.note.startswith("estimated price factor 1.50")
    assert premium.hpp_per_unit_idr == 10_000
    assert premium.recommended_price_idr == 29_900
    assert premium.margin_pct == 199.0


def test_explicit_grade_hpp_uses_unscaled_market_tiers() -> None:
    """A seller-supplied grade cost must not inherit the estimated grade multiplier."""
    metadata = ListingMetadata.model_validate(
        {
            "platform": "umum",
            "production_cost_idr": 10_000,
            "pricing": {
                "total_hpp_idr": 10_000,
                "grades": ["premium"],
                "hpp_per_grade_idr": {"premium": 20_000},
            },
        }
    )
    evidence = MarketEvidence(
        low=10_000,
        median=20_000,
        high=30_000,
        comparable_count=20,
        data_as_of=TODAY,
    )

    result = price_with_market_first(metadata, "fashion_perawatan", evidence)

    assert result.pricing_details is not None
    premium = result.pricing_details.variant_prices[0]
    assert premium.note == "seller-provided HPP"
    assert premium.hpp_per_unit_idr == 20_000
    assert premium.recommended_price_idr == 29_900
    assert premium.margin_pct == 49.5


def test_market_first_applies_tokopedia_commission_cap_to_high_price_floor() -> None:
    """The Tokopedia commission cap prevents a high-cost item from being overcharged."""
    metadata = ListingMetadata.model_validate(
        {
            "platform": "tokopedia",
            "production_cost_idr": 2_000_000,
            "target_margin_pct": 30,
            "pricing": {"total_hpp_idr": 2_000_000},
        }
    )
    evidence = MarketEvidence(
        median=4_000_000,
        low=3_500_000,
        high=4_500_000,
        comparable_count=30,
        data_as_of=TODAY,
        confidence_score=80,
    )

    result = price_with_market_first(metadata, "camilan_olahan", evidence)

    assert result.pricing_details is not None
    assert result.pricing_details.minimum_price_idr == 2_973_215


@pytest.mark.parametrize(
    ("titles", "expected"),
    [
        (
            (
                "Keripik Pisang Rasa Keju",
                "Keripik Pisang Original",
                "Keripik Pisang Manis",
                "Keripik Pisang Renyah",
                "Keripik Pisang Pilihan",
                "Keripik Pisang Favorit",
            ),
            [],
        ),
        (
            (
                "Keripik Pisang Rasa Keju",
                "Keripik Pisang Original",
                "Keripik Pisang Manis",
                "Keripik Pisang Renyah",
                "Keripik Pisang Pilihan",
            ),
            ["Comparable titles show flavor variants; consider flavor options."],
        ),
    ],
)
def test_catalog_variation_suggestions_require_twenty_percent_of_titles(
    titles: tuple[str, ...], expected: list[str]
) -> None:
    """One matching title is meaningful only when it reaches the catalog threshold."""
    metadata = ListingMetadata.model_validate(
        {
            "platform": "umum",
            "production_cost_idr": 12_000,
            "pricing": {"total_hpp_idr": 12_000},
        }
    )
    evidence = MarketEvidence(
        median=25_000,
        low=23_000,
        high=28_000,
        comparable_count=30,
        data_as_of=TODAY,
        confidence_score=80,
    )

    result = price_with_market_first(
        metadata, "camilan_olahan", evidence, comparable_titles=titles
    )

    assert result.pricing_details is not None
    assert result.pricing_details.suggested_variations == expected


def test_price_alignment_uses_floor_when_cost_is_above_market() -> None:
    evidence = MarketEvidence(
        median=20_000,
        low=18_000,
        high=22_000,
        comparable_count=30,
        data_as_of=TODAY,
        confidence_score=80,
    )

    result = align_market_price(viable_floor=25_000, evidence=evidence)

    assert result.recommended == 25_000
    assert result.alignment == PriceAlignment.ABOVE_MARKET
    assert "COST_ABOVE_MARKET" in result.warnings


@pytest.mark.parametrize(
    "evidence",
    [
        None,
        MarketEvidence(
            median=20_000,
            low=18_000,
            high=22_000,
            comparable_count=7,
            data_as_of=TODAY,
            confidence_score=80,
        ),
        MarketEvidence(
            median=20_000,
            low=18_000,
            high=22_000,
            comparable_count=10,
            data_as_of=TODAY,
            confidence_score=60,
        ),
        MarketEvidence(
            median=20_000,
            low=18_000,
            high=22_000,
            comparable_count=30,
            data_as_of=TODAY - timedelta(days=91),
            confidence_score=80,
        ),
    ],
)
def test_price_is_withheld_when_market_evidence_is_insufficient(
    evidence: MarketEvidence | None,
) -> None:
    result = align_market_price(viable_floor=15_000, evidence=evidence, today=TODAY)

    assert result.recommended is None
    assert result.market_interval is None
    assert result.alignment == PriceAlignment.INSUFFICIENT_EVIDENCE
    assert result.confidence_score is None


def test_overall_confidence_is_null_when_one_field_is_unavailable() -> None:
    result = build_confidence(category_score=90, price_score=None, generation_score=85)

    assert result.category.band == "high"
    assert result.price.score is None
    assert result.price.band is None
    assert result.overall.score is None
    assert result.overall.status == "insufficient_evidence"


def test_critical_grounding_failure_caps_generation_confidence() -> None:
    assert (
        score_generation(passed_claims=4, total_claims=5, critical_removed=True) == 49
    )


def test_guardrail_removes_unconfirmed_number_and_certification_but_keeps_facts() -> (
    None
):
    candidate = CopyCandidate(
        title="Keripik Pisang Renyah 250 g",
        description=(
            "Keripik pisang ukuran 250 g cocok untuk camilan keluarga. "
            "Kemasan 500 g praktis dibawa. Sudah BPOM dan berkhasiat. "
            "Rasanya nikmat untuk dinikmati kapan saja bersama keluarga."
        ),
    )

    result = ground_copy(
        candidate,
        confirmed_facts=("keripik pisang", "250 g"),
        visual_evidence=(),
    )

    assert "250 g" in result.grounded.description
    assert "500 g" not in result.grounded.description
    assert "BPOM" not in result.grounded.description
    assert "berkhasiat" not in result.grounded.description
    assert result.critical_removed_count == 2
    assert "UNSUPPORTED_CRITICAL_CLAIM_REMOVED" in result.warnings


def test_grounding_does_not_treat_number_substrings_as_evidence() -> None:
    candidate = CopyCandidate(
        title="Keripik Pisang 50 g",
        description=(
            "Keripik pisang untuk camilan keluarga setiap hari. "
            "Kemasan 50 g praktis dibawa ke mana saja."
        ),
    )

    result = ground_copy(
        candidate,
        confirmed_facts=("Keripik pisang", "250 g"),
        visual_evidence=(),
    )

    assert "50 g" not in result.grounded.title
    assert "50 g" not in result.grounded.description
    assert result.critical_removed_count == 2
