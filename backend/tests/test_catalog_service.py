import asyncio
import hashlib
import json
from datetime import date
from pathlib import Path

import pyarrow as pa
import pyarrow.parquet as pq
import pytest

from ai.pricing import CatalogPricingService
from errors import ApiError
from pricing import align_market_price
from schemas import CategoryCode, ListingMetadata


def write_catalog(tmp_path: Path, *, include_category: bool = True) -> tuple[Path, Path]:
    titles = [
        f"Keripik pisang renyah original camilan {index}"
        for index in range(20)
    ]
    columns: dict[str, pa.Array] = {
        "title": pa.array(titles),
        "price": pa.array([18_000 + index * 500 for index in range(20)]),
    }
    if include_category:
        columns["kategori_umkm"] = pa.array(
            ["camilan_olahan"] * 18 + ["lainnya"] * 2
        )
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
    assert evidence.data_as_of == date(2026, 8, 20)
    assert evidence.confidence_score is None
    assert category.code == CategoryCode.CAMILAN_OLAHAN
    # TF-IDF vote is useful for routing but is not a calibrated probability.
    assert category.score is None
    assert category.evidence_terms == ("Keripik pisang renyah",)
    assert service.data_version == "catalog-test-v1"
    assert service.readiness().ready is True


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


def test_price_confidence_is_null_for_category_without_holdout_support(tmp_path) -> None:
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

    evidence = asyncio.run(
        service.find_comparables(metadata(), CategoryCode.LAINNYA)
    )

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
        asyncio.run(
            service.find_comparables(metadata(), CategoryCode.CAMILAN_OLAHAN)
        )
    assert raised.value.status_code == 503
    assert raised.value.code == "MARKET_CATALOG_NOT_READY"
    assert str(dataset_path) not in str(raised.value)
