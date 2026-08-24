from __future__ import annotations

from datetime import date, datetime, timezone
from decimal import ROUND_CEILING, Decimal

from schemas import MarketEvidence, MarketInterval, PriceAlignment, PriceDecision


class PricingInputError(ValueError):
    pass


def calculate_viable_floor(
    total_cost_idr: int,
    platform_fee_pct: Decimal,
    target_margin_pct: Decimal,
) -> int:
    fee = platform_fee_pct / Decimal(100)
    margin = target_margin_pct / Decimal(100)
    if fee + margin >= Decimal("0.95"):
        raise PricingInputError("platform fee and target margin must sum to below 95%")

    floor = Decimal(total_cost_idr) / (Decimal(1) - fee - margin)
    return int(floor.to_integral_value(rounding=ROUND_CEILING))


def align_market_price(
    viable_floor: int,
    evidence: MarketEvidence | None,
    *,
    today: date | None = None,
) -> PriceDecision:
    reference_date = today or datetime.now(timezone.utc).date()
    if evidence is None:
        return _insufficient_price(viable_floor)

    is_stale = (reference_date - evidence.data_as_of).days > 90
    # PRD defines the robust market method at >=15 comparables. The 8-14 range
    # has no approved fallback yet, so P0 withholds a recommendation rather
    # than presenting a weak estimate as market-aligned.
    if evidence.comparable_count < 15 or is_stale:
        warning = "MARKET_DATA_STALE" if is_stale else "INSUFFICIENT_COMPARABLES"
        return _insufficient_price(
            viable_floor,
            comparable_count=evidence.comparable_count,
            data_as_of=evidence.data_as_of,
            warning=warning,
        )

    interval = MarketInterval(low=evidence.low, high=evidence.high)
    if viable_floor > evidence.high:
        return PriceDecision(
            recommended=viable_floor,
            market_interval=interval,
            viable_floor=viable_floor,
            alignment=PriceAlignment.ABOVE_MARKET,
            comparable_count=evidence.comparable_count,
            data_as_of=evidence.data_as_of,
            confidence_score=evidence.confidence_score,
            warnings=("COST_ABOVE_MARKET",),
        )

    return PriceDecision(
        recommended=max(evidence.median, viable_floor),
        market_interval=interval,
        viable_floor=viable_floor,
        alignment=PriceAlignment.WITHIN_MARKET,
        comparable_count=evidence.comparable_count,
        data_as_of=evidence.data_as_of,
        confidence_score=evidence.confidence_score,
    )


def _insufficient_price(
    viable_floor: int,
    *,
    comparable_count: int = 0,
    data_as_of: date | None = None,
    warning: str = "MARKET_EVIDENCE_UNAVAILABLE",
) -> PriceDecision:
    return PriceDecision(
        recommended=None,
        market_interval=None,
        viable_floor=viable_floor,
        alignment=PriceAlignment.INSUFFICIENT_EVIDENCE,
        comparable_count=comparable_count,
        data_as_of=data_as_of,
        confidence_score=None,
        warnings=(warning,),
    )
