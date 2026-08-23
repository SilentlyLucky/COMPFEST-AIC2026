import asyncio
import json
from datetime import date
from pathlib import Path

import pyarrow as pa
import pyarrow.parquet as pq
import pytest
from ai.pricing import CatalogPricingService
from errors import ApiError
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


def test_catalog_loads_once_and_returns_category_and_market_evidence(tmp_path) -> None:
    dataset_path, manifest_path = write_catalog(tmp_path)
    service = CatalogPricingService(dataset_path, manifest_path, min_score=0.0)

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
