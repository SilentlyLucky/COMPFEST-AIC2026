from __future__ import annotations

import asyncio
import inspect
import re

from pydantic import ValidationError

from confidence import build_confidence, score_generation
from errors import ApiError
from guardrails import ground_copy
from pricing import align_market_price, calculate_viable_floor
from schemas import (
    CATEGORY_LABELS,
    CategoryResult,
    CopyCandidate,
    GenerateListingData,
    GenerateListingResponse,
    ListingMetadata,
    ListingResult,
    PriceResult,
    ProcessedImage,
    ResponseMeta,
)
from services import ListingServices

GUARDRAIL_VERSION = "ground-v1"
TAXONOMY_VERSION = "umkm-id-v1"
VISUAL_QUERY_MAX_CHARS = 240
VISUAL_QUERY_EXCLUDED_TOKENS = frozenset({"blibli", "shopee", "tokopedia", "umum"})


class ListingOrchestrator:
    def __init__(self, services: ListingServices) -> None:
        self._services = services

    async def generate(
        self,
        image: ProcessedImage,
        metadata: ListingMetadata,
        request_id: str,
    ) -> GenerateListingResponse:
        readiness = self._services.readiness()
        unavailable = [
            name
            for name, status in readiness.items()
            if not status.ready and not status.startable
        ]
        if unavailable:
            raise ApiError(
                status_code=503,
                code="SERVICE_NOT_READY",
                message="Layanan generasi belum siap.",
                retryable=True,
                details={"unavailable_services": unavailable},
            )

        candidate, category = await asyncio.gather(
            self._services.generator.generate(image, metadata),
            self._services.classifier.classify(image, metadata),
        )
        visual_query = _visual_query(candidate)
        catalog_pricer = getattr(
            self._services.market, "price_market_first_from_catalog", None
        )
        if callable(catalog_pricer):
            price = _price_from_catalog(
                catalog_pricer, metadata, category.code, visual_query
            )
            if inspect.isawaitable(price):
                price = await price
        else:
            market_evidence = await self._services.market.find_comparables(
                metadata, category.code
            )
            market_pricer = getattr(self._services.market, "price_market_first", None)
            if callable(market_pricer):
                price = market_pricer(metadata, category.code, market_evidence)
                if inspect.isawaitable(price):
                    price = await price
            else:
                viable_floor = calculate_viable_floor(
                    metadata.total_cost_idr,
                    metadata.platform_fee_pct,
                    metadata.target_margin_pct,
                )
                price = align_market_price(viable_floor, market_evidence)
        try:
            grounded = ground_copy(
                candidate,
                confirmed_facts=metadata.confirmed_facts(),
                visual_evidence=category.evidence_terms,
            )
            generation_score = score_generation(
                grounded.passed_claims,
                grounded.total_claims,
                grounded.critical_removed_count > 0,
            )
            confidence = build_confidence(
                category_score=category.score,
                price_score=price.confidence_score,
                generation_score=generation_score,
            )
            listing = ListingResult(
                title=grounded.grounded.title,
                description=grounded.grounded.description,
                category=CategoryResult(
                    code=category.code,
                    label=CATEGORY_LABELS[category.code],
                ),
                price=PriceResult(
                    recommended=price.recommended,
                    market_interval=price.market_interval,
                    viable_floor=price.viable_floor,
                    alignment=price.alignment,
                    comparable_count=price.comparable_count,
                    data_as_of=price.data_as_of,
                    comparable_preview=price.comparable_preview,
                    pricing_details=price.pricing_details,
                ),
            )
        except ValidationError:
            raise ApiError(
                status_code=503,
                code="GENERATOR_OUTPUT_INVALID",
                message="Hasil model tidak memenuhi kontrak listing.",
                retryable=True,
            ) from None

        warnings = [*grounded.warnings, *price.warnings]
        if (
            metadata.platform.value != "umum"
            and metadata.platform_fee_pct == 0
            and price.pricing_details is None
            and "PLATFORM_FEE_DEFAULTED" not in price.warnings
        ):
            warnings.append("PLATFORM_FEE_NOT_PROVIDED")

        return GenerateListingResponse(
            data=GenerateListingData(
                listing=listing,
                confidence=confidence,
                warnings=list(dict.fromkeys(warnings)),
            ),
            meta=ResponseMeta(
                request_id=request_id,
                generator_version=self._services.generator.version,
                taxonomy_version=TAXONOMY_VERSION,
                category_model_version=self._services.classifier.version,
                price_model_version=getattr(
                    self._services.market,
                    "pricing_version",
                    self._services.market.version,
                ),
                price_data_version=self._services.market.data_version,
                guardrail_version=GUARDRAIL_VERSION,
                calibration_version=_calibration_version(self._services),
            ),
        )


def _calibration_version(services: ListingServices) -> str | None:
    category_version = getattr(services.classifier, "calibration_version", None)
    price_version = getattr(services.market, "calibration_version", None)
    if category_version and category_version == price_version:
        return str(category_version)
    return None


def _price_from_catalog(
    catalog_pricer,
    metadata: ListingMetadata,
    category_code,
    visual_query: str | None,
):
    """Use the optional hint only with catalog implementations that support it."""
    try:
        parameters = inspect.signature(catalog_pricer).parameters.values()
    except (TypeError, ValueError):
        return catalog_pricer(metadata, category_code)
    supports_hint = any(
        parameter.name == "visual_query"
        or parameter.kind is inspect.Parameter.VAR_KEYWORD
        for parameter in parameters
    )
    if supports_hint:
        return catalog_pricer(metadata, category_code, visual_query=visual_query)
    return catalog_pricer(metadata, category_code)


def _visual_query(candidate: CopyCandidate) -> str | None:
    """Build a bounded copy-only hint without numeric, platform, or region tokens."""
    words = [
        word.casefold()
        for word in re.findall(r"[A-Za-z]+", f"{candidate.title} {candidate.description}")
        if len(word) >= 3 and word.casefold() not in VISUAL_QUERY_EXCLUDED_TOKENS
    ]
    query = " ".join(words)
    return query[:VISUAL_QUERY_MAX_CHARS].rstrip() or None
