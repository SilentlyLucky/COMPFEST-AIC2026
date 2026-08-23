from __future__ import annotations

import re
from collections.abc import Iterable

from schemas import CopyCandidate, GroundingResult

CRITICAL_TERM_PATTERN = re.compile(
    r"\b(?:bpom|p-?irt|sni|halal|iso|garansi|menyembuhkan|mengobati|"
    r"mencegah penyakit|berkhasiat)\b",
    flags=re.IGNORECASE,
)
NUMBER_PATTERN = re.compile(
    r"\b\d+(?:[.,]\d+)?\s*(?:kg|g|gr|gram|ml|l|liter|cm|mm|m|pcs|buah|"
    r"butir|tablet|kapsul|%)?\b",
    flags=re.IGNORECASE,
)
EXPLICIT_BRAND_PATTERN = re.compile(r"\b(?:merek|brand)\s+[\w.-]+", re.IGNORECASE)
SENTENCE_SPLIT_PATTERN = re.compile(r"(?<=[.!?])\s+")


def ground_copy(
    candidate: CopyCandidate,
    *,
    confirmed_facts: Iterable[str],
    visual_evidence: Iterable[str],
) -> GroundingResult:
    support = _normalize(" ".join((*confirmed_facts, *visual_evidence)))
    title, title_removed = _clean_title(candidate.title, support)

    sentences = [
        part.strip() for part in SENTENCE_SPLIT_PATTERN.split(candidate.description)
    ]
    kept_sentences: list[str] = []
    removed_count = 0
    for sentence in sentences:
        if not sentence:
            continue
        if _unsupported_critical_claims(sentence, support):
            removed_count += 1
            continue
        kept_sentences.append(sentence)

    total_claims = 1 + len(sentences)
    critical_removed_count = removed_count + int(title_removed)
    warnings = ("UNSUPPORTED_CRITICAL_CLAIM_REMOVED",) if critical_removed_count else ()
    description = " ".join(kept_sentences).strip()
    return GroundingResult(
        grounded=CopyCandidate(title=title, description=description),
        passed_claims=total_claims - critical_removed_count,
        total_claims=total_claims,
        critical_removed_count=critical_removed_count,
        warnings=warnings,
    )


def _clean_title(title: str, support: str) -> tuple[str, bool]:
    unsupported = _unsupported_critical_claims(title, support)
    if not unsupported:
        return title, False

    cleaned = title
    for claim in unsupported:
        cleaned = re.sub(re.escape(claim), "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\s+", " ", cleaned).strip(" ,;:-")
    return cleaned, True


def _unsupported_critical_claims(text: str, support: str) -> tuple[str, ...]:
    claims = (
        *(match.group(0) for match in CRITICAL_TERM_PATTERN.finditer(text)),
        *(match.group(0) for match in NUMBER_PATTERN.finditer(text)),
        *(match.group(0) for match in EXPLICIT_BRAND_PATTERN.finditer(text)),
    )
    return tuple(claim for claim in claims if not _is_supported(claim, support))


def _is_supported(claim: str, support: str) -> bool:
    normalized_claim = _normalize(claim)
    if NUMBER_PATTERN.fullmatch(normalized_claim):
        supported_numbers = {
            _normalize(match.group(0)) for match in NUMBER_PATTERN.finditer(support)
        }
        return normalized_claim in supported_numbers

    brand_match = EXPLICIT_BRAND_PATTERN.fullmatch(normalized_claim)
    if brand_match:
        normalized_claim = re.sub(r"^(?:merek|brand)\s+", "", normalized_claim)

    return (
        re.search(
            rf"(?<!\w){re.escape(normalized_claim)}(?!\w)",
            support,
            flags=re.IGNORECASE,
        )
        is not None
    )


def _normalize(value: str) -> str:
    return re.sub(r"\s+", " ", value.casefold()).strip()
