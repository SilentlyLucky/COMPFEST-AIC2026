from datetime import date, timedelta
from decimal import Decimal

import pytest

from confidence import build_confidence, score_generation
from guardrails import ground_copy
from pricing import PricingInputError, align_market_price, calculate_viable_floor
from schemas import CopyCandidate, MarketEvidence, PriceAlignment

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
