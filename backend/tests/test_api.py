import asyncio
import io
import json
from datetime import date
from pathlib import Path

import main as main_module
import pytest
from ai.category import OpenClipCategoryClassifier
from ai.listing import SulinganVlmGenerator
from ai.pricing import CatalogPricingService
from errors import ApiError
from fastapi.testclient import TestClient
from main import GenerationCapacity, app, get_services, parse_cors_origins
from PIL import Image
from schemas import (
    CategoryCode,
    CategoryPrediction,
    CopyCandidate,
    ListingMetadata,
    MarketEvidence,
    ProcessedImage,
    ServiceReadiness,
)
from services import ListingServices

TODAY = date(2026, 8, 23)


class FakeGenerator:
    version = "generator-test-v1"
    calls = 0
    warmup_calls = 0

    async def warmup(self) -> None:
        type(self).warmup_calls += 1

    def readiness(self) -> ServiceReadiness:
        return ServiceReadiness(ready=True)

    async def generate(
        self, image: ProcessedImage, metadata: ListingMetadata
    ) -> CopyCandidate:
        type(self).calls += 1
        assert image.image.mode == "RGB"
        assert max(image.image.size) <= 512
        return CopyCandidate(
            title="Keripik Pisang Renyah 250 g",
            description=(
                "Keripik pisang ukuran 250 g untuk camilan sehari-hari. "
                "Dikemas praktis untuk dinikmati bersama keluarga."
            ),
        )


class FakeClassifier:
    version = "classifier-test-v1"
    calibration_version = "catalog-test-cal-v1"
    calls = 0
    warmup_calls = 0

    async def warmup(self) -> None:
        type(self).warmup_calls += 1

    def readiness(self) -> ServiceReadiness:
        return ServiceReadiness(ready=True)

    async def classify(
        self, image: ProcessedImage, metadata: ListingMetadata
    ) -> CategoryPrediction:
        type(self).calls += 1
        return CategoryPrediction(
            code=CategoryCode.CAMILAN_OLAHAN,
            score=87,
            evidence_terms=("keripik pisang", "250 g"),
        )


class FakeMarketService:
    version = "price-test-v1"
    data_version = "snapshot-test"
    calibration_version = "catalog-test-cal-v1"
    warmup_calls = 0

    async def warmup(self) -> None:
        type(self).warmup_calls += 1

    def readiness(self) -> ServiceReadiness:
        return ServiceReadiness(ready=True)

    async def find_comparables(
        self, metadata: ListingMetadata, category: CategoryCode
    ) -> MarketEvidence:
        return MarketEvidence(
            median=25_000,
            low=23_000,
            high=28_000,
            comparable_count=38,
            data_as_of=TODAY,
            confidence_score=76,
        )


class FakeInvalidGenerator(FakeGenerator):
    async def generate(
        self, image: ProcessedImage, metadata: ListingMetadata
    ) -> CopyCandidate:
        return CopyCandidate(
            title="Keripik 500 g BPOM",
            description="Sudah BPOM. Kemasan 500 g.",
        )


class FakeEmptyMarketService(FakeMarketService):
    async def find_comparables(
        self, metadata: ListingMetadata, category: CategoryCode
    ) -> None:
        return None


class FakeSlowGenerator(FakeGenerator):
    async def generate(
        self, image: ProcessedImage, metadata: ListingMetadata
    ) -> CopyCandidate:
        await asyncio.sleep(0.05)
        return await super().generate(image, metadata)


class FakeFailingWarmupGenerator(FakeGenerator):
    async def warmup(self) -> None:
        raise RuntimeError("generator warmup failed")


@pytest.fixture
def client() -> TestClient:
    FakeGenerator.calls = 0
    FakeGenerator.warmup_calls = 0
    FakeClassifier.calls = 0
    FakeClassifier.warmup_calls = 0
    FakeMarketService.warmup_calls = 0
    services = ListingServices(
        generator=FakeGenerator(),
        classifier=FakeClassifier(),
        market=FakeMarketService(),
    )
    app.dependency_overrides[get_services] = lambda: services
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def make_image_bytes(
    image_format: str = "PNG", size: tuple[int, int] = (640, 480)
) -> bytes:
    output = io.BytesIO()
    Image.new("RGBA", size, (240, 180, 20, 128)).save(output, format=image_format)
    return output.getvalue()


def valid_metadata() -> dict[str, object]:
    return {
        "product_type": "Keripik pisang",
        "platform": "tokopedia",
        "market_region_code": "ID-YO",
        "production_cost_idr": 12_000,
        "size": "250 g",
        "packaging_cost_idr": 1_000,
        "target_margin_pct": 30,
        "platform_fee_pct": 8,
    }


def test_generate_listing_accepts_valid_multipart_and_returns_real_contract(
    client: TestClient,
) -> None:
    response = client.post(
        "/v1/listings/generate",
        files={"image": ("product.png", make_image_bytes(), "image/png")},
        data={"metadata": json.dumps(valid_metadata())},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["error"] is None
    assert body["meta"]["request_id"].startswith("req_")
    assert body["meta"]["calibration_version"] == "catalog-test-cal-v1"
    assert body["data"]["listing"]["category"]["code"] == "camilan_olahan"
    assert body["data"]["listing"]["price"] == {
        "currency": "IDR",
        "recommended": 25_000,
        "market_interval": {
            "low": 23_000,
            "high": 28_000,
            "target_coverage": 0.8,
        },
        "viable_floor": 20_968,
        "alignment": "within_market",
        "comparable_count": 38,
        "data_as_of": TODAY.isoformat(),
    }
    assert body["data"]["confidence"]["overall"]["score"] == 76
    assert FakeGenerator.calls == 1
    assert FakeClassifier.calls == 1


def test_generate_listing_accepts_metadata_without_market_region_code(
    client: TestClient,
) -> None:
    metadata = valid_metadata()
    metadata.pop("market_region_code")

    response = client.post(
        "/v1/listings/generate",
        files={"image": ("product.png", make_image_bytes(), "image/png")},
        data={"metadata": json.dumps(metadata)},
    )

    assert response.status_code == 200
    assert response.json()["error"] is None
    assert FakeGenerator.calls == 1
    assert FakeClassifier.calls == 1


@pytest.mark.parametrize("product_type", ["missing", None, "   "])
def test_generate_listing_accepts_missing_null_or_empty_product_type(
    client: TestClient, product_type: str | None
) -> None:
    metadata = valid_metadata()
    if product_type == "missing":
        metadata.pop("product_type")
    else:
        metadata["product_type"] = product_type

    response = client.post(
        "/v1/listings/generate",
        files={"image": ("product.png", make_image_bytes(), "image/png")},
        data={"metadata": json.dumps(metadata)},
    )

    assert response.status_code == 200
    assert response.json()["error"] is None
    assert FakeGenerator.calls == 1
    assert FakeClassifier.calls == 1


def test_generate_listing_rejects_malformed_market_region_code(
    client: TestClient,
) -> None:
    metadata = valid_metadata() | {"market_region_code": "ID-jk"}

    response = client.post(
        "/v1/listings/generate",
        files={"image": ("product.png", make_image_bytes(), "image/png")},
        data={"metadata": json.dumps(metadata)},
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "METADATA_INVALID"
    assert response.json()["error"]["field"] == "market_region_code"
    assert FakeGenerator.calls == 0
    assert FakeClassifier.calls == 0


def test_invalid_metadata_json_is_a_400_envelope(client: TestClient) -> None:
    response = client.post(
        "/v1/listings/generate",
        files={"image": ("product.png", make_image_bytes(), "image/png")},
        data={"metadata": "{not-json"},
    )

    assert response.status_code == 400
    assert response.json()["data"] is None
    assert response.json()["error"]["code"] == "INVALID_METADATA_JSON"
    assert response.json()["meta"].keys() == {"request_id", "api_version"}
    assert response.json()["meta"]["request_id"].startswith("req_")
    assert FakeGenerator.calls == 0
    assert FakeClassifier.calls == 0


@pytest.mark.parametrize("product_type", ["x", "a" * 81])
def test_invalid_product_type_hint_is_a_422_envelope(
    client: TestClient, product_type: str
) -> None:
    metadata = valid_metadata() | {"product_type": product_type}
    response = client.post(
        "/v1/listings/generate",
        files={"image": ("product.png", make_image_bytes(), "image/png")},
        data={"metadata": json.dumps(metadata)},
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "METADATA_INVALID"
    assert response.json()["error"]["field"] == "product_type"
    assert FakeGenerator.calls == 0
    assert FakeClassifier.calls == 0


@pytest.mark.parametrize(
    "invalid_fields",
    [
        {"production_cost_idr": True},
        {"target_margin_pct": "30"},
        {"target_margin_pct": float("nan")},
        {"platform_fee_pct": float("inf")},
        {"unexpected": "value"},
    ],
)
def test_metadata_rejects_coercion_non_finite_numbers_and_extra_fields(
    client: TestClient, invalid_fields: dict[str, object]
) -> None:
    response = client.post(
        "/v1/listings/generate",
        files={"image": ("product.png", make_image_bytes(), "image/png")},
        data={"metadata": json.dumps(valid_metadata() | invalid_fields)},
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "METADATA_INVALID"
    assert FakeGenerator.calls == 0
    assert FakeClassifier.calls == 0


@pytest.mark.parametrize(
    ("content", "content_type"),
    [
        (make_image_bytes(), "image/jpeg"),
        (make_image_bytes(), "text/plain"),
    ],
)
def test_mime_or_magic_mismatch_is_rejected(
    client: TestClient, content: bytes, content_type: str
) -> None:
    response = client.post(
        "/v1/listings/generate",
        files={"image": ("product.bin", content, content_type)},
        data={"metadata": json.dumps(valid_metadata())},
    )

    assert response.status_code == 415
    assert response.json()["error"]["field"] == "image"
    assert FakeGenerator.calls == 0
    assert FakeClassifier.calls == 0


def test_invalid_decodable_image_is_rejected(client: TestClient) -> None:
    content = b"\x89PNG\r\n\x1a\n" + b"not-an-image"
    response = client.post(
        "/v1/listings/generate",
        files={"image": ("product.png", content, "image/png")},
        data={"metadata": json.dumps(valid_metadata())},
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "IMAGE_INVALID"
    assert FakeGenerator.calls == 0
    assert FakeClassifier.calls == 0


def test_oversize_image_is_rejected_before_decode(client: TestClient) -> None:
    content = b"\x89PNG\r\n\x1a\n" + b"0" * (5 * 1024 * 1024)
    response = client.post(
        "/v1/listings/generate",
        files={"image": ("product.png", content, "image/png")},
        data={"metadata": json.dumps(valid_metadata())},
    )

    assert response.status_code == 413
    assert response.json()["error"]["code"] == "IMAGE_TOO_LARGE"
    assert FakeGenerator.calls == 0
    assert FakeClassifier.calls == 0


def test_lifespan_warms_injected_services_before_serving() -> None:
    FakeGenerator.warmup_calls = 0
    FakeClassifier.warmup_calls = 0
    FakeMarketService.warmup_calls = 0
    services = ListingServices(
        generator=FakeGenerator(),
        classifier=FakeClassifier(),
        market=FakeMarketService(),
    )
    app.dependency_overrides[get_services] = lambda: services
    try:
        assert FakeGenerator.warmup_calls == 0
        with TestClient(app) as test_client:
            assert test_client.get("/health/live").status_code == 200
            assert FakeGenerator.warmup_calls == 1
            assert FakeClassifier.warmup_calls == 1
            assert FakeMarketService.warmup_calls == 1
    finally:
        app.dependency_overrides.clear()


def test_service_warmup_deduplicates_shared_catalog_instance() -> None:
    class SharedCatalog:
        warmup_calls = 0

        async def warmup(self) -> None:
            self.warmup_calls += 1

    catalog = SharedCatalog()
    services = ListingServices(
        generator=FakeGenerator(),
        classifier=catalog,
        market=catalog,
    )

    asyncio.run(services.warmup())

    assert catalog.warmup_calls == 1


def test_readiness_reports_injected_service_state(client: TestClient) -> None:
    response = client.get("/health/ready")

    assert response.status_code == 200
    assert response.json()["status"] == "ready"
    assert all(item["ready"] for item in response.json()["services"].values())


def test_lifespan_propagates_warmup_failure_and_never_serves() -> None:
    services = ListingServices(
        generator=FakeFailingWarmupGenerator(),
        classifier=FakeClassifier(),
        market=FakeMarketService(),
    )
    app.dependency_overrides[get_services] = lambda: services
    try:
        with (
            pytest.raises(RuntimeError, match="generator warmup failed"),
            TestClient(app),
        ):
            pytest.fail("startup failure must prevent the client from serving")
    finally:
        app.dependency_overrides.clear()


def test_cors_origins_have_a_safe_localhost_default(monkeypatch) -> None:
    monkeypatch.delenv(main_module.CORS_ALLOWED_ORIGINS_ENV, raising=False)

    assert parse_cors_origins() == ("http://localhost:3000",)


def test_cors_origins_parse_trim_normalize_and_deduplicate() -> None:
    assert parse_cors_origins(
        " https://lapakin.example/,http://localhost:3000,https://lapakin.example "
    ) == ("https://lapakin.example", "http://localhost:3000")


def test_cors_preflight_allows_localhost_and_rejects_other_origin(
    client: TestClient,
) -> None:
    base_headers = {
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type",
    }

    allowed = client.options(
        "/v1/listings/generate",
        headers={**base_headers, "Origin": "http://localhost:3000"},
    )
    assert allowed.status_code == 200
    assert allowed.headers["access-control-allow-origin"] == "http://localhost:3000"

    rejected = client.options(
        "/v1/listings/generate",
        headers={**base_headers, "Origin": "http://127.0.0.1:3000"},
    )
    assert rejected.status_code == 400
    assert "access-control-allow-origin" not in rejected.headers


@pytest.mark.parametrize(
    "raw_origins",
    [
        "*",
        "lapakin.example",
        "https://user:password@lapakin.example",
        "https://lapakin.example/path",
    ],
)
def test_cors_origins_reject_unsafe_or_non_origin_values(raw_origins: str) -> None:
    with pytest.raises(RuntimeError, match="CORS_ALLOWED_ORIGINS"):
        parse_cors_origins(raw_origins)


def test_default_services_use_only_packaged_production_components() -> None:
    services = main_module.DEFAULT_SERVICES

    assert isinstance(services.generator, SulinganVlmGenerator)
    assert isinstance(services.classifier, OpenClipCategoryClassifier)
    assert isinstance(services.market, CatalogPricingService)
    assert services.classifier is not services.market
    assert main_module.ADAPTER_PATH.parent == (
        Path(__file__).parents[1] / "ai" / "listing"
    )


def test_available_market_service_can_return_honest_insufficient_evidence() -> None:
    services = ListingServices(
        generator=FakeGenerator(),
        classifier=FakeClassifier(),
        market=FakeEmptyMarketService(),
    )
    app.dependency_overrides[get_services] = lambda: services
    try:
        with TestClient(app) as test_client:
            response = test_client.post(
                "/v1/listings/generate",
                files={"image": ("product.png", make_image_bytes(), "image/png")},
                data={"metadata": json.dumps(valid_metadata())},
            )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    body = response.json()["data"]
    assert body["listing"]["price"]["recommended"] is None
    assert body["listing"]["price"]["market_interval"] is None
    assert body["confidence"]["price"]["score"] is None
    assert body["confidence"]["overall"]["status"] == "insufficient_evidence"
    assert "MARKET_EVIDENCE_UNAVAILABLE" in body["warnings"]


def test_all_removed_or_too_short_copy_returns_controlled_service_error() -> None:
    services = ListingServices(
        generator=FakeInvalidGenerator(),
        classifier=FakeClassifier(),
        market=FakeMarketService(),
    )
    app.dependency_overrides[get_services] = lambda: services
    try:
        with TestClient(app) as test_client:
            response = test_client.post(
                "/v1/listings/generate",
                files={"image": ("product.png", make_image_bytes(), "image/png")},
                data={"metadata": json.dumps(valid_metadata())},
            )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 503
    assert response.json()["error"]["code"] == "GENERATOR_OUTPUT_INVALID"


def test_generation_timeout_uses_a_retryable_504_envelope(monkeypatch) -> None:
    services = ListingServices(
        generator=FakeSlowGenerator(),
        classifier=FakeClassifier(),
        market=FakeMarketService(),
    )
    app.dependency_overrides[get_services] = lambda: services
    monkeypatch.setattr(main_module, "REQUEST_TIMEOUT_SECONDS", 0.001)
    try:
        with TestClient(app) as test_client:
            response = test_client.post(
                "/v1/listings/generate",
                files={"image": ("product.png", make_image_bytes(), "image/png")},
                data={"metadata": json.dumps(valid_metadata())},
            )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 504
    assert response.json()["error"] == {
        "code": "GENERATION_TIMEOUT",
        "message": "Generasi listing melewati batas waktu.",
        "field": None,
        "retryable": True,
        "details": {},
    }


def test_generation_capacity_rejects_requests_instead_of_queueing() -> None:
    capacity = GenerationCapacity(1)

    async def reserve_twice() -> None:
        async with capacity.reserve():
            with pytest.raises(ApiError) as error:
                async with capacity.reserve():
                    pass
            assert error.value.status_code == 429

    asyncio.run(reserve_twice())


def test_legacy_mock_routes_are_deprecated_and_do_not_return_fake_results(
    client: TestClient,
) -> None:
    response = client.post("/predict-category", json={"image": "base64"})

    assert response.status_code == 503
    assert response.json()["error"]["code"] == "LEGACY_ENDPOINT_DEPRECATED"
    assert response.headers["Deprecation"] == "true"
    assert app.openapi()["paths"]["/predict-category"]["post"]["deprecated"] is True
