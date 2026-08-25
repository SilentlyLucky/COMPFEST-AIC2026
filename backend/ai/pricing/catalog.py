"""Lazy TF-IDF catalog service for category and market-price evidence."""

from __future__ import annotations

import asyncio
import hashlib
import importlib
import json
import math
import re
import threading
from collections import defaultdict
from collections.abc import Iterable
from dataclasses import dataclass
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Final

try:
    from ai.pricing.market_first import ENGINE_VERSION, price_with_market_first
    from errors import ApiError
    from schemas import (
        CategoryCode,
        CategoryPrediction,
        ListingMetadata,
        MarketComparable,
        MarketEvidence,
        PriceDecision,
        ProcessedImage,
        ServiceReadiness,
    )
except ModuleNotFoundError:  # Allow importing as backend.ai.pricing from repo root.
    from backend.ai.pricing.market_first import ENGINE_VERSION, price_with_market_first
    from backend.errors import ApiError
    from backend.schemas import (
        CategoryCode,
        CategoryPrediction,
        ListingMetadata,
        MarketComparable,
        MarketEvidence,
        PriceDecision,
        ProcessedImage,
        ServiceReadiness,
    )

BACKEND_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_DATASET_PATH = BACKEND_ROOT / "dataset" / "market_catalog.parquet"
DEFAULT_MANIFEST_PATH = BACKEND_ROOT / "dataset" / "market_catalog.manifest.json"
DEFAULT_CALIBRATION_PATH = BACKEND_ROOT / "dataset" / "market_catalog.calibration.json"
SERVICE_VERSION = "tfidf-market-catalog-v1"
CALIBRATION_METHOD = "deterministic_grouped_three_way_holdout_listing_metadata_v2"
CALIBRATION_QUERY_CONTRACT = "product_type_title_prefix_80_only_v1"
REQUIRED_COLUMNS: Final[frozenset[str]] = frozenset({"title", "price", "kategori_umkm"})
STOP_WORDS: Final[frozenset[str]] = frozenset(
    {"dan", "untuk", "yang", "dengan", "atau", "the", "for", "with", "pcs", "set"}
)
TOKEN_PATTERN: Final[re.Pattern[str]] = re.compile(r"[a-z0-9]+")
MIN_EVIDENCE_COUNT = 15
MAX_COMPARABLE_PREVIEW = 8
MAX_COMPARABLE_TITLE_LENGTH = 160
PRODUCT_FAMILY_TOKENS: Final[dict[str, frozenset[str]]] = {
    "tas_tote": frozenset({"tote", "totebag"}),
}
EXPLICIT_ATTRIBUTE_TOKENS: Final[dict[str, frozenset[str]]] = {
    "batik": frozenset({"batik"}),
}
INCOMPATIBLE_FASHION_TOKENS: Final[frozenset[str]] = frozenset(
    {
        "dress",
        "blouse",
        "kemeja",
        "shirt",
        "jaket",
        "jacket",
        "bomber",
        "gamis",
        "rok",
        "celana",
    }
)


class _CatalogError(Exception):
    pass


@dataclass(frozen=True)
class _Manifest:
    data_version: str
    data_as_of: date
    sha256: str | None
    row_count: int | None


@dataclass(frozen=True)
class _Row:
    title: str
    price: int
    category: str


@dataclass(frozen=True)
class _CategoryCalibrationBin:
    upper_bound: float
    sample_count: int
    score: int


@dataclass(frozen=True)
class _CatalogCalibration:
    artifact_version: str
    category_bins: tuple[_CategoryCalibrationBin, ...]
    price_scores: dict[CategoryCode, int]

    def category_score(self, vote_share: float) -> int | None:
        for calibration_bin in self.category_bins:
            if vote_share <= calibration_bin.upper_bound:
                return calibration_bin.score
        return None

    def price_score(self, category: CategoryCode) -> int | None:
        return self.price_scores.get(category)


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
        for word in sorted(set(_tokens(query))):
            for index, count in self._postings.get(word, ()):
                scores[index] += (
                    self._idf[word] * (1 + math.log(count)) / self._lengths[index]
                )
        ranked = sorted(scores.items(), key=lambda item: (-item[1], item[0]))[:limit]
        return [(self._rows[index], score) for index, score in ranked]

    def category_rows(self, category: CategoryCode, limit: int) -> list[tuple[_Row, float]]:
        """Return bounded catalog-order rows when text retrieval has no evidence."""
        return [
            (row, 0.0)
            for row in self._rows
            if row.category == category.value
        ][:limit]

    def constrained_rows(
        self,
        category: CategoryCode,
        family: str | None,
        required_attributes: frozenset[str],
        limit: int,
    ) -> list[tuple[_Row, float]]:
        """Return catalog-order rows satisfying explicit product constraints."""
        return [
            (row, 0.0)
            for row in self._rows
            if row.category == category.value
            and _matches_family(row, family)
            and _matches_attributes(row, required_attributes)
        ][:limit]


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


def _model_harga_quartile_prices(values: list[int]) -> list[int]:
    """Match model_harga's inclusive 5th–95th percentile price filtering."""
    ordered = sorted(values)
    if len(ordered) < 4:
        return ordered
    p05, p95 = _quantile(ordered, 0.05), _quantile(ordered, 0.95)
    return [price for price in ordered if p05 <= price <= p95]


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

    version = SERVICE_VERSION
    pricing_version = ENGINE_VERSION

    def __init__(
        self,
        dataset_path: Path | None = None,
        manifest_path: Path | None = None,
        calibration_path: Path | None = None,
        *,
        retrieval_k: int = 50,
        min_score: float = 2.0,
    ) -> None:
        self._dataset_path = Path(dataset_path or DEFAULT_DATASET_PATH)
        self._manifest_path = Path(manifest_path or DEFAULT_MANIFEST_PATH)
        self._calibration_path = Path(calibration_path or DEFAULT_CALIBRATION_PATH)
        self._retrieval_k = max(retrieval_k, MIN_EVIDENCE_COUNT)
        self._min_score = max(min_score, 0.0)
        self._lock = threading.Lock()
        self._index: _TfIdfIndex | None = None
        self._manifest: _Manifest | None = None
        self._calibration: _CatalogCalibration | None = None
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

    @property
    def calibration_version(self) -> str | None:
        return (
            self._calibration.artifact_version
            if self._calibration is not None
            else None
        )

    def readiness(self) -> ServiceReadiness:
        if self._load_error:
            return ServiceReadiness(
                ready=False, reason="market catalog initialization failed"
            )
        if self._index:
            return ServiceReadiness(
                ready=True, startable=True, details={"loaded": True}
            )
        try:
            self._manifest = self._validate()
        except _CatalogError:
            return ServiceReadiness(
                ready=False, reason="market catalog artifacts are unavailable"
            )
        return ServiceReadiness(
            ready=False,
            startable=True,
            reason="market catalog is configured but not warm",
            details={"loaded": False},
        )

    async def warmup(self) -> None:
        """Build the catalog index before the API accepts traffic."""
        await asyncio.to_thread(self._ensure_loaded)

    async def classify(
        self, image: ProcessedImage, metadata: ListingMetadata
    ) -> CategoryPrediction:
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
        winner, winner_weight = min(
            weights.items(), key=lambda item: (-item[1], item[0].value)
        )
        vote_share = winner_weight / sum(weights.values())
        return CategoryPrediction(
            code=winner,
            score=(
                self._calibration.category_score(vote_share)
                if self._calibration is not None
                else None
            ),
            evidence_terms=tuple(metadata.confirmed_facts()[:5]),
        )

    async def find_comparables(
        self,
        metadata: ListingMetadata,
        category: CategoryCode,
        *,
        visual_query: str | None = None,
    ) -> MarketEvidence | None:
        try:
            evidence, _, _ = await asyncio.to_thread(
                self._market_evidence_with_fallback,
                metadata,
                category,
                visual_query,
            )
        except ApiError:
            raise
        except Exception:  # noqa: BLE001 - hide artifact details at the API boundary.
            raise self._not_ready(category=False) from None
        return evidence

    async def price_market_first_from_catalog(
        self,
        metadata: ListingMetadata,
        category: CategoryCode,
        *,
        visual_query: str | None = None,
    ) -> PriceDecision:
        """Retrieve once, then price with matching evidence and title signals."""
        try:
            evidence, category_neighbors, fallback_warnings = await asyncio.to_thread(
                self._market_evidence_with_fallback,
                metadata,
                category,
                visual_query,
            )
        except ApiError:
            raise
        except Exception:  # noqa: BLE001 - hide artifact details at the API boundary.
            raise self._not_ready(category=False) from None
        decision = self.price_market_first(
            metadata,
            category,
            evidence,
            comparable_titles=(row.title for row, _ in category_neighbors),
        )
        return decision.model_copy(
            update={
                "comparable_preview": _comparable_preview(category_neighbors),
                "warnings": tuple(
                    dict.fromkeys((*fallback_warnings, *decision.warnings))
                )
            }
        )

    def _market_evidence_with_fallback(
        self,
        metadata: ListingMetadata,
        category: CategoryCode,
        visual_query: str | None,
    ) -> tuple[MarketEvidence | None, list[tuple[_Row, float]], tuple[str, ...]]:
        """Prefer matching text evidence, with a safe lexical subtype gate."""
        confirmed_facts = metadata.confirmed_facts()
        family = _infer_product_family(confirmed_facts, visual_query)
        required_attributes = _explicit_attributes(confirmed_facts)
        primary_neighbors = self._category_neighbors(
            self._retrieve(metadata),
            category,
            family=family,
            required_attributes=required_attributes,
        )
        primary_evidence = self._market_evidence(primary_neighbors, category)
        if self._has_enough_comparables(primary_evidence):
            return primary_evidence, primary_neighbors, ()

        warnings: list[str] = []
        if visual_query and visual_query.strip():
            warnings.append("MARKET_VISUAL_QUERY_FALLBACK")
            visual_neighbors = self._category_neighbors(
                self._retrieve_query(visual_query),
                category,
                family=family,
                required_attributes=required_attributes,
            )
            visual_evidence = self._market_evidence(visual_neighbors, category)
            if self._has_enough_comparables(visual_evidence):
                return visual_evidence, visual_neighbors, tuple(warnings)

        warnings.append("MARKET_CATEGORY_FALLBACK")
        category_neighbors = (
            self._constrained_rows(category, family, required_attributes)
            if family is not None or required_attributes
            else self._category_rows(category)
        )
        category_evidence = self._market_evidence(category_neighbors, category)
        if not self._has_enough_comparables(category_evidence):
            if family is not None:
                warnings.append("MARKET_SUBTYPE_COMPARABLES_INSUFFICIENT")
            if required_attributes:
                warnings.append("MARKET_ATTRIBUTE_COMPARABLES_INSUFFICIENT")
            if family is not None or required_attributes:
                return category_evidence, category_neighbors, tuple(warnings)
            return primary_evidence, primary_neighbors, tuple(warnings)
        return (
            category_evidence,
            category_neighbors,
            tuple(warnings),
        )

    @staticmethod
    def _has_enough_comparables(evidence: MarketEvidence | None) -> bool:
        return evidence is not None and evidence.comparable_count >= MIN_EVIDENCE_COUNT

    @staticmethod
    def _category_neighbors(
        neighbors: Iterable[tuple[_Row, float]],
        category: CategoryCode,
        *,
        family: str | None = None,
        required_attributes: frozenset[str] = frozenset(),
    ) -> list[tuple[_Row, float]]:
        return [
            (row, score)
            for row, score in neighbors
            if row.category == category.value
            and _matches_family(row, family)
            and _matches_attributes(row, required_attributes)
        ]

    def _market_evidence(
        self,
        category_neighbors: list[tuple[_Row, float]],
        category: CategoryCode,
    ) -> MarketEvidence | None:
        if not category_neighbors or self._manifest is None:
            return None
        public_prices = _robust_prices([row.price for row, _ in category_neighbors])
        quartile_prices = _model_harga_quartile_prices(
            [row.price for row, _ in category_neighbors]
        )
        if not public_prices or not quartile_prices:
            return None
        low = max(1, round(_quantile(public_prices, 0.10)))
        median = max(1, round(_quantile(public_prices, 0.50)))
        high = max(median, round(_quantile(public_prices, 0.90)))
        p25 = max(1, round(_quantile(quartile_prices, 0.25)))
        p50 = max(1, round(_quantile(quartile_prices, 0.50)))
        p75 = max(p50, round(_quantile(quartile_prices, 0.75)))
        return MarketEvidence(
            median=median,
            low=low,
            high=high,
            p25=p25,
            p50=p50,
            p75=p75,
            comparable_count=len(public_prices),
            data_as_of=self._manifest.data_as_of,
            confidence_score=(
                self._calibration.price_score(category)
                if self._calibration is not None
                and len(public_prices) >= MIN_EVIDENCE_COUNT
                else None
            ),
        )

    def price_market_first(
        self,
        metadata: ListingMetadata,
        category: CategoryCode,
        evidence: MarketEvidence | None,
        *,
        comparable_titles: Iterable[str] = (),
    ) -> PriceDecision:
        """Apply the adapter to evidence and titles retrieved by the caller."""
        return price_with_market_first(
            metadata,
            category,
            evidence,
            comparable_titles=comparable_titles,
        )

    def _retrieve(self, metadata: ListingMetadata) -> list[tuple[_Row, float]]:
        return self._retrieve_query(" ".join(metadata.confirmed_facts()))

    def _retrieve_query(self, query: str) -> list[tuple[_Row, float]]:
        self._ensure_loaded()
        if self._index is None:  # pragma: no cover - guarded by _ensure_loaded.
            raise self._not_ready(category=False)
        return [
            item
            for item in self._index.search(query, self._retrieval_k)
            if item[1] >= self._min_score
        ]

    def _category_rows(self, category: CategoryCode) -> list[tuple[_Row, float]]:
        self._ensure_loaded()
        if self._index is None:  # pragma: no cover - guarded by _ensure_loaded.
            raise self._not_ready(category=False)
        return self._index.category_rows(category, self._retrieval_k)

    def _constrained_rows(
        self,
        category: CategoryCode,
        family: str | None,
        required_attributes: frozenset[str],
    ) -> list[tuple[_Row, float]]:
        self._ensure_loaded()
        if self._index is None:  # pragma: no cover - guarded by _ensure_loaded.
            raise self._not_ready(category=False)
        return self._index.constrained_rows(
            category, family, required_attributes, self._retrieval_k
        )

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
                self._calibration = self._read_calibration(len(rows))
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
            checksum = payload.get("sha256")
            row_count = payload.get("row_count")
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
            or parsed > datetime.now(timezone.utc).date()
            or (
                checksum is not None
                and (
                    not isinstance(checksum, str)
                    or re.fullmatch(r"[0-9a-f]{64}", checksum) is None
                )
            )
            or (
                row_count is not None
                and (
                    isinstance(row_count, bool)
                    or not isinstance(row_count, int)
                    or row_count <= 0
                )
            )
        ):
            raise _CatalogError
        return _Manifest(version.strip(), parsed, checksum, row_count)

    def _read_calibration(self, row_count: int) -> _CatalogCalibration | None:
        if self._manifest is None or not self._calibration_path.is_file():
            return None
        if self._manifest.sha256 is None or self._manifest.row_count is None:
            return None
        try:
            actual_checksum = _file_sha256(self._dataset_path)
            payload = json.loads(self._calibration_path.read_text(encoding="utf-8"))
            catalog = payload["catalog"]
            runtime = payload["runtime"]
            category = payload["category"]
            price = payload["price"]
            if (
                payload["format_version"] != 1
                or payload["method"] != CALIBRATION_METHOD
                or catalog["data_version"] != self._manifest.data_version
                or catalog["sha256"] != self._manifest.sha256
                or catalog["sha256"] != actual_checksum
                or catalog["row_count"] != self._manifest.row_count
                or catalog["row_count"] != row_count
                or runtime["service_version"] != self.version
                or runtime["retrieval_k"] != self._retrieval_k
                or not math.isclose(
                    float(runtime["min_score"]), self._min_score, abs_tol=1e-12
                )
                or runtime["minimum_evidence_count"] != MIN_EVIDENCE_COUNT
                or runtime["price_quantiles"] != [0.1, 0.9]
                or runtime["holdout_query_contract"] != CALIBRATION_QUERY_CONTRACT
            ):
                return None
            artifact_version = payload["artifact_version"]
            if not isinstance(artifact_version, str) or not artifact_version.strip():
                return None
            category_bins = _read_category_calibration(category)
            price_scores = _read_price_calibration(price)
        except Exception:  # noqa: BLE001 - optional calibration must fail closed.
            return None
        return _CatalogCalibration(
            artifact_version=artifact_version.strip(),
            category_bins=category_bins,
            price_scores=price_scores,
        )

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
                rows.append(
                    _Row(str(title).strip(), value, str(category or "").strip())
                )
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
            message="Kategori produk belum siap."
            if category
            else "Data harga pasar belum siap.",
            retryable=True,
        )


def _file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _strict_int(value: object) -> int:
    if isinstance(value, bool) or not isinstance(value, int):
        raise TypeError
    return value


def _read_category_calibration(
    payload: object,
) -> tuple[_CategoryCalibrationBin, ...]:
    if not isinstance(payload, dict):
        raise TypeError
    minimum = _strict_int(payload["minimum_bin_samples"])
    expected_total = _strict_int(payload["calibration_sample_count"])
    raw_bins = payload["bins"]
    if minimum <= 0 or not isinstance(raw_bins, list) or not raw_bins:
        raise ValueError
    bins: list[_CategoryCalibrationBin] = []
    previous_upper = 0.0
    total = 0
    for item in raw_bins:
        if not isinstance(item, dict):
            raise TypeError
        upper = float(item["upper_bound"])
        sample_count = _strict_int(item["sample_count"])
        correct_count = _strict_int(item["correct_count"])
        score = _strict_int(item["score"])
        if (
            not math.isfinite(upper)
            or not previous_upper < upper <= 1.0
            or sample_count < minimum
            or not 0 <= correct_count <= sample_count
            or score != round(100 * correct_count / sample_count)
        ):
            raise ValueError
        bins.append(_CategoryCalibrationBin(upper, sample_count, score))
        previous_upper = upper
        total += sample_count
    if not math.isclose(previous_upper, 1.0) or total != expected_total:
        raise ValueError
    return tuple(bins)


def _read_price_calibration(payload: object) -> dict[CategoryCode, int]:
    if not isinstance(payload, dict):
        raise TypeError
    minimum = _strict_int(payload["minimum_group_samples"])
    expected_total = _strict_int(payload["calibration_eligible_count"])
    groups = payload["groups"]
    if minimum <= 0 or not isinstance(groups, dict) or not groups:
        raise ValueError
    scores: dict[CategoryCode, int] = {}
    total = 0
    for raw_category, item in groups.items():
        category = CategoryCode(raw_category)
        if not isinstance(item, dict):
            raise TypeError
        sample_count = _strict_int(item["sample_count"])
        covered_count = _strict_int(item["covered_count"])
        score = _strict_int(item["score"])
        if (
            sample_count < minimum
            or not 0 <= covered_count <= sample_count
            or score != round(100 * covered_count / sample_count)
        ):
            raise ValueError
        scores[category] = score
        total += sample_count
    if total != expected_total:
        raise ValueError
    return scores


def _infer_product_family(
    confirmed_facts: Iterable[str], visual_query: str | None
) -> str | None:
    """Infer only a small family when a product fact or visual query is explicit."""
    product_text = " ".join(confirmed_facts)
    family = _family_from_text(product_text)
    if family is not None:
        return family
    return _family_from_text(visual_query or "")


def _family_from_text(text: str) -> str | None:
    tokens = set(_tokens(text))
    for family, family_tokens in PRODUCT_FAMILY_TOKENS.items():
        if tokens.intersection(family_tokens):
            return family
    return None


def _explicit_attributes(confirmed_facts: Iterable[str]) -> frozenset[str]:
    tokens = set(_tokens(" ".join(confirmed_facts)))
    return frozenset(
        attribute
        for attribute, attribute_tokens in EXPLICIT_ATTRIBUTE_TOKENS.items()
        if tokens.intersection(attribute_tokens)
    )


def _matches_family(row: _Row, family: str | None) -> bool:
    if family is None:
        return True
    tokens = set(_tokens(row.title))
    return bool(tokens.intersection(PRODUCT_FAMILY_TOKENS[family])) and not bool(
        tokens.intersection(INCOMPATIBLE_FASHION_TOKENS)
    )


def _matches_attributes(row: _Row, required_attributes: frozenset[str]) -> bool:
    if not required_attributes:
        return True
    tokens = set(_tokens(row.title))
    return all(
        tokens.intersection(EXPLICIT_ATTRIBUTE_TOKENS[attribute])
        for attribute in required_attributes
    )


def _comparable_preview(
    neighbors: Iterable[tuple[_Row, float]],
) -> tuple[MarketComparable, ...]:
    """Expose a short, normalized source-order sample without retrieval scores."""
    preview: list[MarketComparable] = []
    for row, _ in neighbors:
        title = "".join(
            character for character in row.title if character.isprintable()
        )
        title = " ".join(title.split())[:MAX_COMPARABLE_TITLE_LENGTH].rstrip()
        if title:
            preview.append(MarketComparable(title=title, price=row.price))
        if len(preview) == MAX_COMPARABLE_PREVIEW:
            break
    return tuple(preview)


__all__ = ["CatalogPricingService"]
