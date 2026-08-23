from __future__ import annotations

from schemas import ConfidenceField, ConfidenceResult


def confidence_band(score: int | None) -> str | None:
    if score is None:
        return None
    if score >= 80:
        return "high"
    if score >= 50:
        return "medium"
    return "low"


def score_generation(
    passed_claims: int,
    total_claims: int,
    critical_removed: bool,
) -> int | None:
    if total_claims == 0:
        return None
    score = round(100 * passed_claims / total_claims)
    return min(score, 49) if critical_removed else score


def build_confidence(
    *,
    category_score: int | None,
    price_score: int | None,
    generation_score: int | None,
) -> ConfidenceResult:
    category = _field(category_score, "calibrated_probability")
    price = _field(price_score, "empirical_interval_reliability")
    generation = _field(generation_score, "grounded_claim_ratio")
    field_scores = (category_score, price_score, generation_score)
    overall_score = (
        None if any(score is None for score in field_scores) else min(field_scores)
    )
    return ConfidenceResult(
        category=category,
        price=price,
        generation=generation,
        overall=_field(overall_score, "minimum_field_score"),
    )


def _field(score: int | None, method: str) -> ConfidenceField:
    return ConfidenceField(
        score=score,
        band=confidence_band(score),
        method=method,
        status="available" if score is not None else "insufficient_evidence",
    )
