from __future__ import annotations

import asyncio

from pydantic import ValidationError

from confidence import build_confidence, score_generation
from errors import ApiError
from guardrails import ground_copy
from pricing import align_market_price, calculate_viable_floor
from schemas import (
    CATEGORY_LABELS,
    CategoryResult,
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
        market_evidence = await self._services.market.find_comparables(
            metadata, category.code
        )

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
        if metadata.platform.value != "umum" and metadata.platform_fee_pct == 0:
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
                price_model_version=self._services.market.version,
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
