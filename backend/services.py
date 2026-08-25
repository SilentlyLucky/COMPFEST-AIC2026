from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

from errors import ApiError
from schemas import (
    CategoryCode,
    CategoryPrediction,
    CopyCandidate,
    ListingMetadata,
    MarketEvidence,
    ProcessedImage,
    ServiceReadiness,
)


class ListingGenerator(Protocol):
    version: str

    async def warmup(self) -> None: ...

    def readiness(self) -> ServiceReadiness: ...

    async def generate(
        self, image: ProcessedImage, metadata: ListingMetadata
    ) -> CopyCandidate: ...


class CategoryClassifier(Protocol):
    version: str

    async def warmup(self) -> None: ...

    def readiness(self) -> ServiceReadiness: ...

    async def classify(
        self,
        image: ProcessedImage,
        metadata: ListingMetadata,
        *,
        text_hint: str | None = None,
    ) -> CategoryPrediction: ...


class MarketPricingService(Protocol):
    version: str
    data_version: str

    async def warmup(self) -> None: ...

    def readiness(self) -> ServiceReadiness: ...

    async def find_comparables(
        self,
        metadata: ListingMetadata,
        category: CategoryCode,
        *,
        visual_query: str | None = None,
    ) -> MarketEvidence | None: ...


@dataclass(frozen=True)
class ListingServices:
    generator: ListingGenerator
    classifier: CategoryClassifier
    market: MarketPricingService

    async def warmup(self) -> None:
        unique_services = {
            id(service): service
            for service in (self.generator, self.classifier, self.market)
        }
        for service in unique_services.values():
            await service.warmup()

    def readiness(self) -> dict[str, ServiceReadiness]:
        return {
            "generator": self.generator.readiness(),
            "classifier": self.classifier.readiness(),
            "market": self.market.readiness(),
        }


class UnavailableCategoryClassifier:
    version = "unavailable"

    async def warmup(self) -> None:
        raise _unavailable_error("category classifier")

    def readiness(self) -> ServiceReadiness:
        return ServiceReadiness(
            ready=False,
            reason="canonical category classifier is not configured",
        )

    async def classify(
        self,
        image: ProcessedImage,
        metadata: ListingMetadata,
        *,
        text_hint: str | None = None,
    ) -> CategoryPrediction:
        del text_hint
        raise _unavailable_error("category classifier")


class UnavailableMarketPricingService:
    version = "unavailable"
    data_version = "unavailable"

    async def warmup(self) -> None:
        raise _unavailable_error("market pricing service")

    def readiness(self) -> ServiceReadiness:
        return ServiceReadiness(
            ready=False,
            reason="licensed versioned market data is not configured",
        )

    async def find_comparables(
        self,
        metadata: ListingMetadata,
        category: CategoryCode,
        *,
        visual_query: str | None = None,
    ) -> MarketEvidence | None:
        del visual_query
        raise _unavailable_error("market pricing service")


def _unavailable_error(service: str) -> ApiError:
    return ApiError(
        status_code=503,
        code="SERVICE_NOT_READY",
        message=f"{service} belum siap.",
        retryable=True,
    )
