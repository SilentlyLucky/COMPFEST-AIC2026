import asyncio
import hashlib
import json
from datetime import date
from pathlib import Path

import pyarrow as pa
import pyarrow.parquet as pq
import pytest
from PIL import Image

from ai.pricing import CatalogPricingService
from ai.pricing.catalog import _Manifest, _Row
from errors import ApiError
from orchestrator import ListingOrchestrator
from pricing import align_market_price
from schemas import (
    CategoryCode,
    CategoryPrediction,
    CopyCandidate,
    ListingMetadata,
    ProcessedImage,
    ServiceReadiness,
)
from services import ListingServices


def write_catalog(
    tmp_path: Path, *, include_category: bool = True
) -> tuple[Path, Path]:
    titles = [f"Keripik pisang renyah original camilan {index}" for index in range(20)]
    columns: dict[str, pa.Array] = {
        "title": pa.array(titles),
        "price": pa.array([18_000 + index * 500 for index in range(20)]),
    }
    if include_category:
        columns["kategori_umkm"] = pa.array(["camilan_olahan"] * 18 + ["lainnya"] * 2)
    columns["source"] = pa.array(["tokopedia"] * 20)

    dataset_path = tmp_path / "market_catalog.parquet"
    manifest_path = tmp_path / "market_catalog.manifest.json"
    pq.write_table(pa.table(columns), dataset_path)
    manifest_path.write_text(
        json.dumps(
            {
                "data_version": "catalog-test-v1",
                "data_as_of": "2026-08-20",
            }
        ),
        encoding="utf-8",
    )
    return dataset_path, manifest_path


def write_tote_catalog(tmp_path: Path) -> tuple[Path, Path]:
    tote_titles = [
        "Tas tote batik tulis motif parang",
        "Totebag batik handmade motif kawung",
        "Tas tote kain batik warna indigo",
    ]
    incompatible_titles = [
        f"Dress batik pesta wanita motif parang {index}" for index in range(18)
    ]
    generic_tote_titles = [
        f"Tas tote kanvas polos serbaguna {index}" for index in range(18)
    ]
    dataset_path = tmp_path / "market_catalog.parquet"
    manifest_path = tmp_path / "market_catalog.manifest.json"
    pq.write_table(
        pa.table(
            {
                "title": pa.array(
                    [*tote_titles, *incompatible_titles, *generic_tote_titles]
                ),
                "price": pa.array(
                    [
                        95_000,
                        105_000,
                        110_000,
                        *([250_000] * 18),
                        *([80_000] * 18),
                    ]
                ),
                "kategori_umkm": pa.array(["fashion_perawatan"] * 39),
            }
        ),
        dataset_path,
    )
    manifest_path.write_text(
        json.dumps(
            {"data_version": "catalog-tote-test-v1", "data_as_of": "2026-08-20"}
        ),
        encoding="utf-8",
    )
    return dataset_path, manifest_path


def metadata(product_type: str = "Keripik pisang renyah") -> ListingMetadata:
    return ListingMetadata(
        product_type=product_type,
        platform="tokopedia",
        market_region_code="ID-JK",
        production_cost_idr=10_000,
    )


def write_calibration(
    dataset_path: Path,
    manifest_path: Path,
    *,
    catalog_version: str = "catalog-test-v1",
    catalog_checksum: str | None = None,
    price_categories: tuple[str, ...] = ("camilan_olahan",),
) -> Path:
    checksum = hashlib.sha256(dataset_path.read_bytes()).hexdigest()
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    manifest.update({"sha256": checksum, "row_count": 20})
    manifest_path.write_text(json.dumps(manifest), encoding="utf-8")
    groups = {
        category: {"sample_count": 60, "covered_count": 45, "score": 75}
        for category in price_categories
    }
    calibration_path = dataset_path.with_name("market_catalog.calibration.json")
    calibration_path.write_text(
        json.dumps(
            {
                "format_version": 1,
                "artifact_version": "catalog-test-cal-v1",
                "method": "deterministic_grouped_three_way_holdout_listing_metadata_v2",
                "catalog": {
                    "data_version": catalog_version,
                    "sha256": catalog_checksum or checksum,
                    "row_count": 20,
                },
                "runtime": {
                    "service_version": "tfidf-market-catalog-v1",
                    "retrieval_k": 50,
                    "min_score": 0.0,
                    "minimum_evidence_count": 15,
                    "price_quantiles": [0.1, 0.9],
                    "holdout_query_contract": "product_type_title_prefix_80_only_v1",
                },
                "category": {
                    "minimum_bin_samples": 50,
                    "calibration_sample_count": 100,
                    "bins": [
                        {
                            "upper_bound": 1.0,
                            "sample_count": 100,
                            "correct_count": 90,
                            "score": 90,
                        }
                    ],
                },
                "price": {
                    "minimum_group_samples": 50,
                    "calibration_eligible_count": 60 * len(groups),
                    "groups": groups,
                },
            }
        ),
        encoding="utf-8",
    )
    return calibration_path


def test_catalog_warmup_builds_the_index_before_serving(tmp_path) -> None:
    dataset_path, manifest_path = write_catalog(tmp_path)
    service = CatalogPricingService(dataset_path, manifest_path, min_score=0.0)

    asyncio.run(service.warmup())

    readiness = service.readiness()
    assert readiness.ready is True
    assert readiness.startable is True
    assert readiness.details == {"loaded": True}


def test_catalog_loads_once_and_returns_category_and_market_evidence(tmp_path) -> None:
    dataset_path, manifest_path = write_catalog(tmp_path)
    service = CatalogPricingService(
        dataset_path,
        manifest_path,
        tmp_path / "missing-calibration.json",
        min_score=0.0,
    )

    cold = service.readiness()
    assert cold.ready is False
    assert cold.startable is True
    assert cold.details == {"loaded": False}

    evidence = asyncio.run(
        service.find_comparables(metadata(), CategoryCode.CAMILAN_OLAHAN)
    )
    category = asyncio.run(service.classify(None, metadata()))

    assert evidence is not None
    assert evidence.comparable_count == 18
    assert evidence.low <= evidence.median <= evidence.high
    assert evidence.low >= 18_000
    assert evidence.high <= 27_500
    assert evidence.p25 == 20_375
    assert evidence.p50 == 22_250
    assert evidence.p75 == 24_125
    assert evidence.data_as_of == date(2026, 8, 20)
    assert evidence.confidence_score is None
    assert category.code == CategoryCode.CAMILAN_OLAHAN
    # TF-IDF vote is useful for routing but is not a calibrated probability.
    assert category.score is None
    assert category.evidence_terms == ("Keripik pisang renyah",)
    assert service.data_version == "catalog-test-v1"
    assert service.readiness().ready is True


def test_catalog_market_first_reuses_one_async_retrieval(tmp_path, monkeypatch) -> None:
    """Pricing needs the same neighbors for evidence and title suggestions, not two reads."""
    service = CatalogPricingService(tmp_path / "missing.parquet")
    service._manifest = _Manifest("catalog-test-v1", date(2026, 8, 20), None, None)
    neighbors = [
        (
            _Row(f"Keripik pisang rasa keju {index}", 20_000 + index, "camilan_olahan"),
            3.0,
        )
        for index in range(15)
    ]
    calls = 0

    def retrieve(_: ListingMetadata) -> list[tuple[_Row, float]]:
        nonlocal calls
        calls += 1
        return neighbors

    monkeypatch.setattr(service, "_retrieve", retrieve)

    advanced_metadata = ListingMetadata.model_validate(
        {
            "product_type": "Keripik pisang renyah",
            "platform": "tokopedia",
            "market_region_code": "ID-JK",
            "production_cost_idr": 10_000,
            "pricing": {"total_hpp_idr": 10_000},
        }
    )
    result = asyncio.run(
        service.price_market_first_from_catalog(
            advanced_metadata, CategoryCode.CAMILAN_OLAHAN
        )
    )

    assert calls == 1
    assert result.pricing_details is not None
    assert result.pricing_details.suggested_variations == [
        "Comparable titles show flavor variants; consider flavor options."
    ]


def test_catalog_market_first_omits_details_without_advanced_pricing(tmp_path) -> None:
    """The real catalog uses new tiers for all users while keeping the old response shape."""
    dataset_path, manifest_path = write_catalog(tmp_path)
    service = CatalogPricingService(dataset_path, manifest_path, min_score=0.0)

    result = asyncio.run(
        service.price_market_first_from_catalog(metadata(), CategoryCode.CAMILAN_OLAHAN)
    )

    assert result.recommended is not None
    assert result.pricing_details is None
    assert result.warnings == ()
    assert [item.title for item in result.comparable_preview] == [
        "Keripik pisang renyah original camilan 0",
        "Keripik pisang renyah original camilan 1",
        "Keripik pisang renyah original camilan 2",
        "Keripik pisang renyah original camilan 3",
        "Keripik pisang renyah original camilan 4",
        "Keripik pisang renyah original camilan 5",
        "Keripik pisang renyah original camilan 6",
        "Keripik pisang renyah original camilan 7",
    ]
    assert [item.price for item in result.comparable_preview] == [
        18_000,
        18_500,
        19_000,
        19_500,
        20_000,
        20_500,
        21_000,
        21_500,
    ]


def test_explicit_tote_subtype_withholds_broad_fashion_matches_and_exposes_samples(
    tmp_path,
) -> None:
    """A batik tote must not receive a market price from generic tote/dress rows."""
    dataset_path, manifest_path = write_tote_catalog(tmp_path)
    service = CatalogPricingService(dataset_path, manifest_path, min_score=0.0)

    result = asyncio.run(
        service.price_market_first_from_catalog(
            metadata("Tas tote batik"), CategoryCode.FASHION_PERAWATAN
        )
    )

    assert result.recommended is None
    assert result.comparable_count == 3
    assert result.warnings == (
        "MARKET_CATEGORY_FALLBACK",
        "MARKET_SUBTYPE_COMPARABLES_INSUFFICIENT",
        "MARKET_ATTRIBUTE_COMPARABLES_INSUFFICIENT",
        "INSUFFICIENT_COMPARABLES",
    )
    assert [item.title for item in result.comparable_preview] == [
        "Tas tote batik tulis motif parang",
        "Totebag batik handmade motif kawung",
        "Tas tote kain batik warna indigo",
    ]
    assert [item.price for item in result.comparable_preview] == [95_000, 105_000, 110_000]


def test_visual_batik_hint_does_not_become_a_hard_attribute_constraint(tmp_path) -> None:
    """Generated copy may infer tote family, but only metadata can require batik."""
    dataset_path, manifest_path = write_tote_catalog(tmp_path)
    service = CatalogPricingService(dataset_path, manifest_path, min_score=0.0)

    result = asyncio.run(
        service.price_market_first_from_catalog(
            metadata("Produk tidak cocok"),
            CategoryCode.FASHION_PERAWATAN,
            visual_query="Tas tote batik",
        )
    )

    assert result.recommended is not None
    assert result.comparable_count == 18
    assert result.warnings == ("MARKET_VISUAL_QUERY_FALLBACK",)
    assert any("kanvas polos" in item.title for item in result.comparable_preview)


def test_catalog_uses_copy_hint_after_unmatched_confirmed_metadata(tmp_path) -> None:
    """Generated copy may retrieve evidence, but never becomes confirmed metadata."""
    dataset_path, manifest_path = write_catalog(tmp_path)
    service = CatalogPricingService(dataset_path, manifest_path, min_score=0.0)

    result = asyncio.run(
        service.price_market_first_from_catalog(
            metadata("Produk tidak cocok"),
            CategoryCode.CAMILAN_OLAHAN,
            visual_query="Keripik pisang renyah camilan",
        )
    )

    assert result.recommended is not None
    assert result.comparable_count == 18
    assert result.warnings == ("MARKET_VISUAL_QUERY_FALLBACK",)


def test_catalog_uses_bounded_deterministic_category_rows_after_text_fallbacks(
    tmp_path,
) -> None:
    """Category fallback uses catalog rows only and still has enough comparables."""
    dataset_path, manifest_path = write_catalog(tmp_path)
    service = CatalogPricingService(
        dataset_path,
        manifest_path,
        retrieval_k=15,
        min_score=0.0,
    )

    result = asyncio.run(
        service.price_market_first_from_catalog(
            metadata("Produk tidak cocok"),
            CategoryCode.CAMILAN_OLAHAN,
            visual_query="Tidak ada di katalog",
        )
    )

    assert result.recommended is not None
    assert result.comparable_count == 15
    assert result.warnings == (
        "MARKET_VISUAL_QUERY_FALLBACK",
        "MARKET_CATEGORY_FALLBACK",
    )


def test_category_fallback_reuses_only_matching_empirical_category_score(tmp_path) -> None:
    dataset_path, manifest_path = write_catalog(tmp_path)
    calibration_path = write_calibration(dataset_path, manifest_path)
    service = CatalogPricingService(
        dataset_path,
        manifest_path,
        calibration_path,
        min_score=0.0,
    )

    result = asyncio.run(
        service.price_market_first_from_catalog(
            metadata("Produk tidak cocok"), CategoryCode.CAMILAN_OLAHAN
        )
    )

    assert result.recommended is not None
    assert result.comparable_count == 18
    assert result.confidence_score == 75
    assert result.warnings == ("MARKET_CATEGORY_FALLBACK",)


def test_category_fallback_never_bypasses_the_stale_data_gate(tmp_path) -> None:
    dataset_path, manifest_path = write_catalog(tmp_path)
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    manifest["data_as_of"] = "2026-01-01"
    manifest_path.write_text(json.dumps(manifest), encoding="utf-8")
    service = CatalogPricingService(dataset_path, manifest_path, min_score=0.0)

    result = asyncio.run(
        service.price_market_first_from_catalog(
            metadata("Produk tidak cocok"), CategoryCode.CAMILAN_OLAHAN
        )
    )

    assert result.recommended is None
    assert result.confidence_score is None
    assert result.warnings == ("MARKET_CATEGORY_FALLBACK", "MARKET_DATA_STALE")


def test_orchestrator_real_catalog_keeps_legacy_shopee_floor_without_pricing(
    tmp_path,
) -> None:
    """A real catalog path must not apply default tariffs to legacy metadata."""
    dataset_path, manifest_path = write_catalog(tmp_path)
    market = CatalogPricingService(dataset_path, manifest_path, min_score=0.0)

    class Generator:
        version = "test-generator"

        async def generate(self, image, metadata):
            return CopyCandidate(
                title="Keripik Pisang",
                description=(
                    "Keripik pisang renyah untuk camilan keluarga sehari-hari "
                    "dengan kemasan praktis."
                ),
            )

        def readiness(self) -> ServiceReadiness:
            return ServiceReadiness(ready=True)

    class Classifier:
        version = "test-classifier"

        async def classify(self, image, metadata):
            return CategoryPrediction(code=CategoryCode.CAMILAN_OLAHAN)

        def readiness(self) -> ServiceReadiness:
            return ServiceReadiness(ready=True)

    metadata = ListingMetadata(
        product_type="Keripik pisang",
        platform="shopee",
        production_cost_idr=10_000,
        target_margin_pct=80,
        platform_fee_pct=0,
    )
    image = ProcessedImage(Image.new("RGB", (8, 8)), "image/png", 8, 8)
    result = asyncio.run(
        ListingOrchestrator(
            ListingServices(
                generator=Generator(), classifier=Classifier(), market=market
            )
        ).generate(image, metadata, "req_catalog")
    )

    assert result.data.listing.price.recommended is not None
    assert result.data.listing.price.pricing_details is None
    assert "PLATFORM_FEE_NOT_PROVIDED" in result.data.warnings


def test_matching_holdout_artifact_returns_empirical_confidence(tmp_path) -> None:
    dataset_path, manifest_path = write_catalog(tmp_path)
    calibration_path = write_calibration(dataset_path, manifest_path)
    service = CatalogPricingService(
        dataset_path,
        manifest_path,
        calibration_path,
        min_score=0.0,
    )

    evidence = asyncio.run(
        service.find_comparables(metadata(), CategoryCode.CAMILAN_OLAHAN)
    )
    category = asyncio.run(service.classify(None, metadata()))

    assert evidence is not None
    assert evidence.confidence_score == 75
    assert category.score == 90
    assert service.calibration_version == "catalog-test-cal-v1"


@pytest.mark.parametrize(
    ("catalog_version", "catalog_checksum"),
    [
        ("other-version", None),
        ("catalog-test-v1", "0" * 64),
    ],
)
def test_mismatched_calibration_is_ignored(
    tmp_path, catalog_version: str, catalog_checksum: str | None
) -> None:
    dataset_path, manifest_path = write_catalog(tmp_path)
    calibration_path = write_calibration(
        dataset_path,
        manifest_path,
        catalog_version=catalog_version,
        catalog_checksum=catalog_checksum,
    )
    service = CatalogPricingService(
        dataset_path,
        manifest_path,
        calibration_path,
        min_score=0.0,
    )

    evidence = asyncio.run(
        service.find_comparables(metadata(), CategoryCode.CAMILAN_OLAHAN)
    )
    category = asyncio.run(service.classify(None, metadata()))

    assert evidence is not None
    assert evidence.confidence_score is None
    assert category.score is None
    assert service.calibration_version is None


def test_price_confidence_is_null_for_category_without_holdout_support(
    tmp_path,
) -> None:
    dataset_path, manifest_path = write_catalog(tmp_path)
    calibration_path = write_calibration(dataset_path, manifest_path)
    service = CatalogPricingService(
        dataset_path,
        manifest_path,
        calibration_path,
        min_score=0.0,
    )

    evidence = asyncio.run(service.find_comparables(metadata(), CategoryCode.LAINNYA))

    assert evidence is not None
    assert evidence.confidence_score is None
    assert service.calibration_version == "catalog-test-cal-v1"


def test_under_15_catalog_comparables_never_expose_price_confidence(tmp_path) -> None:
    dataset_path, manifest_path = write_catalog(tmp_path)
    calibration_path = write_calibration(
        dataset_path,
        manifest_path,
        price_categories=("camilan_olahan", "lainnya"),
    )
    service = CatalogPricingService(
        dataset_path,
        manifest_path,
        calibration_path,
        min_score=0.0,
    )

    evidence = asyncio.run(service.find_comparables(metadata(), CategoryCode.LAINNYA))
    decision = align_market_price(
        viable_floor=10_000,
        evidence=evidence,
        today=date(2026, 8, 20),
    )

    assert evidence is not None
    assert evidence.comparable_count == 2
    assert evidence.confidence_score is None
    assert decision.confidence_score is None
    assert decision.recommended is None


def test_catalog_does_not_fabricate_evidence_for_unmatched_query(tmp_path) -> None:
    dataset_path, manifest_path = write_catalog(tmp_path)
    service = CatalogPricingService(dataset_path, manifest_path, min_score=0.0)

    evidence = asyncio.run(
        service.find_comparables(
            metadata("Produk yang sama sekali tidak ada"),
            CategoryCode.LAINNYA,
        )
    )

    assert evidence is None


def test_market_evidence_is_restricted_to_the_selected_category(tmp_path) -> None:
    dataset_path, manifest_path = write_catalog(tmp_path)
    service = CatalogPricingService(dataset_path, manifest_path, min_score=0.0)

    evidence = asyncio.run(service.find_comparables(metadata(), CategoryCode.LAINNYA))

    assert evidence is not None
    assert evidence.comparable_count == 2


def test_missing_required_column_is_not_ready_without_path_leak(tmp_path) -> None:
    dataset_path, manifest_path = write_catalog(tmp_path, include_category=False)
    service = CatalogPricingService(dataset_path, manifest_path)

    readiness = service.readiness()
    assert readiness.ready is False
    assert readiness.startable is False
    assert str(dataset_path) not in readiness.model_dump_json()

    with pytest.raises(ApiError) as raised:
        asyncio.run(service.find_comparables(metadata(), CategoryCode.CAMILAN_OLAHAN))
    assert raised.value.status_code == 503
    assert raised.value.code == "MARKET_CATALOG_NOT_READY"
    assert str(dataset_path) not in str(raised.value)
