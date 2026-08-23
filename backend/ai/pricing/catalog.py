"""Lazy TF-IDF catalog service for category and market-price evidence."""

from __future__ import annotations

import asyncio
import importlib
import json
import math
import re
import threading
from collections import defaultdict
from dataclasses import dataclass
from datetime import UTC, date, datetime
from pathlib import Path
from typing import Final

try:
    from errors import ApiError
    from schemas import (
        CategoryCode,
        CategoryPrediction,
        ListingMetadata,
        MarketEvidence,
        ProcessedImage,
        ServiceReadiness,
    )
except ModuleNotFoundError:  # Allow importing as backend.ai.pricing from repo root.
    from backend.errors import ApiError
    from backend.schemas import (
        CategoryCode,
        CategoryPrediction,
        ListingMetadata,
        MarketEvidence,
        ProcessedImage,
        ServiceReadiness,
    )

BACKEND_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_DATASET_PATH = BACKEND_ROOT / "dataset" / "market_catalog.parquet"
DEFAULT_MANIFEST_PATH = BACKEND_ROOT / "dataset" / "market_catalog.manifest.json"
REQUIRED_COLUMNS: Final[frozenset[str]] = frozenset(
    {"title", "price", "kategori_umkm"}
)
STOP_WORDS: Final[frozenset[str]] = frozenset(
    {"dan", "untuk", "yang", "dengan", "atau", "the", "for", "with", "pcs", "set"}
)
TOKEN_PATTERN: Final[re.Pattern[str]] = re.compile(r"[a-z0-9]+")
MIN_EVIDENCE_COUNT = 15


class _CatalogError(Exception):
    pass


@dataclass(frozen=True)
class _Manifest:
    data_version: str
    data_as_of: date


@dataclass(frozen=True)
class _Row:
    title: str
    price: int
    category: str


def _tokens(text: str) -> list[str]:
    return [
        word
        for word in TOKEN_PATTERN.findall(str(text).lower())
        if len(word) >= 3 and word not in STOP_WORDS
    ]


class _TfIdfIndex:
    def __init__(self, rows: tuple[_Row, ...]) -> None:
        self._rows = rows
        postings: dict[str, list[tuple[int, int]]] = defaultdict(list)
        lengths: list[float] = []
        for index, row in enumerate(rows):
            words = _tokens(row.title)
            lengths.append(math.sqrt(len(words)) or 1.0)
            counts: dict[str, int] = defaultdict(int)
            for word in words:
                counts[word] += 1
            for word, count in counts.items():
                postings[word].append((index, count))
        self._postings = postings
        self._lengths = lengths
        self._idf = {
            word: math.log(1 + len(rows) / len(items))
            for word, items in postings.items()
        }

    def search(self, query: str, limit: int) -> list[tuple[_Row, float]]:
        scores: dict[int, float] = defaultdict(float)
        for word in set(_tokens(query)):
            for index, count in self._postings.get(word, ()):
                scores[index] += (
                    self._idf[word] * (1 + math.log(count)) / self._lengths[index]
                )
        ranked = sorted(scores.items(), key=lambda item: (-item[1], item[0]))[:limit]
        return [(self._rows[index], score) for index, score in ranked]


def _quantile(values: list[int], probability: float) -> float:
    ordered = sorted(values)
    position = probability * (len(ordered) - 1)
    lower = int(position)
    upper = min(lower + 1, len(ordered) - 1)
    return ordered[lower] + (ordered[upper] - ordered[lower]) * (position - lower)


def _robust_prices(values: list[int]) -> list[int]:
    if len(values) < 4:
        return sorted(values)
    ordered = sorted(values)
    q1, q3 = _quantile(ordered, 0.25), _quantile(ordered, 0.75)
    iqr = q3 - q1
    if iqr == 0:
        kept = [value for value in ordered if value == q1]
    else:
        kept = [value for value in ordered if q1 - 1.5 * iqr <= value <= q3 + 1.5 * iqr]
    return kept or ordered


def _price(value: object) -> int | None:
    if value is None or isinstance(value, bool):
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    if not math.isfinite(number) or number <= 0:
        return None
    rounded = round(number)
    return rounded if rounded > 0 else None


class CatalogPricingService:
    """Shared lazy catalog implementation of category and market protocols."""

    version = "tfidf-market-catalog-v1"

    def __init__(
        self,
        dataset_path: Path | None = None,
        manifest_path: Path | None = None,
        *,
        retrieval_k: int = 50,
        min_score: float = 2.0,
    ) -> None:
        self._dataset_path = Path(dataset_path or DEFAULT_DATASET_PATH)
        self._manifest_path = Path(manifest_path or DEFAULT_MANIFEST_PATH)
        self._retrieval_k = max(retrieval_k, MIN_EVIDENCE_COUNT)
        self._min_score = max(min_score, 0.0)
        self._lock = threading.Lock()
        self._index: _TfIdfIndex | None = None
        self._manifest: _Manifest | None = None
        self._load_error = False

    @property
    def data_version(self) -> str:
        if self._manifest:
            return self._manifest.data_version
        try:
            self._manifest = self._validate()
        except _CatalogError:
            return "unavailable"
        return self._manifest.data_version

    def readiness(self) -> ServiceReadiness:
        if self._load_error:
            return ServiceReadiness(ready=False, reason="market catalog initialization failed")
        if self._index:
            return ServiceReadiness(ready=True, startable=True, details={"loaded": True})
        try:
            self._manifest = self._validate()
        except _CatalogError:
            return ServiceReadiness(ready=False, reason="market catalog artifacts are unavailable")
        return ServiceReadiness(
            ready=False,
            startable=True,
            reason="market catalog is configured but not warm",
            details={"loaded": False},
        )

    async def classify(self, image: ProcessedImage, metadata: ListingMetadata) -> CategoryPrediction:
        del image
        try:
            neighbors = await asyncio.to_thread(self._retrieve, metadata)
        except ApiError:
            raise
        except Exception:  # noqa: BLE001 - hide artifact details at the API boundary.
            raise self._not_ready(category=True) from None
        weights: dict[CategoryCode, float] = defaultdict(float)
        for row, score in neighbors:
            try:
                weights[CategoryCode(row.category)] += score
            except ValueError:
                continue
        if not weights:
            return CategoryPrediction(code=CategoryCode.LAINNYA, score=None)
        winner, _ = min(weights.items(), key=lambda item: (-item[1], item[0].value))
        return CategoryPrediction(
            code=winner,
            score=None,
            evidence_terms=tuple(metadata.confirmed_facts()[:5]),
        )

    async def find_comparables(
        self, metadata: ListingMetadata, category: CategoryCode
    ) -> MarketEvidence | None:
        try:
            neighbors = await asyncio.to_thread(self._retrieve, metadata)
        except ApiError:
            raise
        except Exception:  # noqa: BLE001 - hide artifact details at the API boundary.
            raise self._not_ready(category=False) from None
        category_neighbors = [
            (row, score) for row, score in neighbors if row.category == category.value
        ]
        if not category_neighbors or self._manifest is None:
            return None
        prices = _robust_prices([row.price for row, _ in category_neighbors])
        if not prices:
            return None
        low = max(1, round(_quantile(prices, 0.10)))
        median = max(1, round(_quantile(prices, 0.50)))
        high = max(median, round(_quantile(prices, 0.90)))
        return MarketEvidence(
            median=median,
            low=low,
            high=high,
            comparable_count=len(prices),
            data_as_of=self._manifest.data_as_of,
            confidence_score=None,
        )

    def _retrieve(self, metadata: ListingMetadata) -> list[tuple[_Row, float]]:
        self._ensure_loaded()
        if self._index is None:  # pragma: no cover - guarded by _ensure_loaded.
            raise self._not_ready(category=False)
        query = " ".join(metadata.confirmed_facts())
        return [
            item
            for item in self._index.search(query, self._retrieval_k)
            if item[1] >= self._min_score
        ]

    def _ensure_loaded(self) -> None:
        if self._index:
            return
        if self._load_error:
            raise self._not_ready(category=False)
        with self._lock:
            if self._index:
                return
            if self._load_error:
                raise self._not_ready(category=False)
            try:
                self._manifest = self._validate()
                rows = self._read_rows()
                if not rows:
                    raise _CatalogError
                self._index = _TfIdfIndex(rows)
            except Exception:  # noqa: BLE001 - translate all loader failures.
                self._load_error = True
                raise self._not_ready(category=False) from None

    def _validate(self) -> _Manifest:
        if not self._dataset_path.is_file() or not self._manifest_path.is_file():
            raise _CatalogError
        manifest = self._read_manifest()
        try:
            schema = self._parquet().read_schema(self._dataset_path)
        except Exception:  # noqa: BLE001 - dependency-specific failure.
            raise _CatalogError from None
        if not REQUIRED_COLUMNS.issubset(set(schema.names)):
            raise _CatalogError
        return manifest

    def _read_manifest(self) -> _Manifest:
        try:
            payload = json.loads(self._manifest_path.read_text(encoding="utf-8"))
            version, raw_date = payload["data_version"], payload["data_as_of"]
            parsed = date.fromisoformat(raw_date)
        except (
            OSError,
            UnicodeError,
            KeyError,
            TypeError,
            ValueError,
            json.JSONDecodeError,
        ):
            raise _CatalogError from None
        if (
            not isinstance(version, str)
            or not version.strip()
            or parsed.isoformat() != raw_date
            or parsed > datetime.now(UTC).date()
        ):
            raise _CatalogError
        return _Manifest(version.strip(), parsed)

    def _read_rows(self) -> tuple[_Row, ...]:
        try:
            table = self._parquet().read_table(
                self._dataset_path, columns=["title", "price", "kategori_umkm"]
            )
            columns = [
                table.column(name).to_pylist()
                for name in ("title", "price", "kategori_umkm")
            ]
        except Exception:  # noqa: BLE001 - dependency-specific failure.
            raise _CatalogError from None
        rows = []
        for title, raw_price, category in zip(*columns, strict=True):
            value = _price(raw_price)
            if title is not None and value is not None:
                rows.append(_Row(str(title).strip(), value, str(category or "").strip()))
        return tuple(row for row in rows if row.title)

    @staticmethod
    def _parquet():
        try:
            return importlib.import_module("pyarrow.parquet")
        except Exception:  # noqa: BLE001 - optional dependency.
            raise _CatalogError from None

    @staticmethod
    def _not_ready(*, category: bool) -> ApiError:
        return ApiError(
            status_code=503,
            code="CATEGORY_MODEL_NOT_READY" if category else "MARKET_CATALOG_NOT_READY",
            message="Kategori produk belum siap." if category else "Data harga pasar belum siap.",
            retryable=True,
        )


__all__ = ["CatalogPricingService"]
