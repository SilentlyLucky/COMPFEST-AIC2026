"""Build the baseline holdout calibration artifact for the market catalog.

The split is deterministic and grouped by normalized title so exact duplicate
titles cannot occur in both fitting and holdout partitions. The catalog index is
fit only on the training partition. Calibration probabilities come from the
calibration partition and are audited once on the untouched evaluation partition.
Each holdout query is built through the production ListingMetadata contract with
only ``product_type=title[:80]`` because the catalog has no other request facts.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
from collections import Counter, defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Final

try:
    from ai.pricing.catalog import (
        CALIBRATION_METHOD,
        CALIBRATION_QUERY_CONTRACT,
        DEFAULT_CALIBRATION_PATH,
        DEFAULT_DATASET_PATH,
        DEFAULT_MANIFEST_PATH,
        MIN_EVIDENCE_COUNT,
        SERVICE_VERSION,
        TOKEN_PATTERN,
        _price,
        _quantile,
        _robust_prices,
        _Row,
        _TfIdfIndex,
    )
    from schemas import CategoryCode, ListingMetadata
except ModuleNotFoundError:  # Support `python -m backend.tools...` from repo root.
    from backend.ai.pricing.catalog import (
        CALIBRATION_METHOD,
        CALIBRATION_QUERY_CONTRACT,
        DEFAULT_CALIBRATION_PATH,
        DEFAULT_DATASET_PATH,
        DEFAULT_MANIFEST_PATH,
        MIN_EVIDENCE_COUNT,
        SERVICE_VERSION,
        TOKEN_PATTERN,
        _price,
        _quantile,
        _robust_prices,
        _Row,
        _TfIdfIndex,
    )
    from backend.schemas import CategoryCode, ListingMetadata

FORMAT_VERSION: Final = 1
ARTIFACT_VERSION: Final = "catalog-baseline-holdout-v2"
SPLIT_BUCKETS: Final = 10_000
TRAIN_END: Final = 8_000
CALIBRATION_END: Final = 9_000
DESIRED_CATEGORY_BINS: Final = 10
MIN_CATEGORY_BIN_SAMPLES: Final = 100
MIN_PRICE_GROUP_SAMPLES: Final = 50
MIN_EVALUATION_CLASS_SAMPLES: Final = 50
TARGET_PRICE_COVERAGE: Final = 0.8
VALID_CATEGORIES: Final = frozenset(category.value for category in CategoryCode)


class CalibrationBuildError(RuntimeError):
    pass


@dataclass(frozen=True)
class _Evaluation:
    actual_category: str
    predicted_category: str
    vote_share: float | None
    price_covered: bool | None


def _file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _normalized_title(title: str) -> str:
    return " ".join(TOKEN_PATTERN.findall(title.lower()))


def _split(title: str) -> str:
    normalized = _normalized_title(title)
    bucket = int.from_bytes(
        hashlib.sha256(normalized.encode("utf-8")).digest()[:8], "big"
    ) % SPLIT_BUCKETS
    if bucket < TRAIN_END:
        return "train"
    if bucket < CALIBRATION_END:
        return "calibration"
    return "evaluation"


def _load_rows(dataset_path: Path) -> tuple[tuple[_Row, ...], int]:
    try:
        import pyarrow.parquet as pq

        table = pq.read_table(
            dataset_path, columns=["title", "price", "kategori_umkm"]
        )
    except Exception as exc:  # CLI should report dependency/data failure.
        raise CalibrationBuildError("cannot read the catalog parquet") from exc
    rows: list[_Row] = []
    columns = [
        table.column(name).to_pylist()
        for name in ("title", "price", "kategori_umkm")
    ]
    for title, raw_price, category in zip(*columns, strict=True):
        price = _price(raw_price)
        normalized_title = str(title or "").strip()
        normalized_category = str(category or "").strip()
        if (
            len(normalized_title) < 2
            or price is None
            or normalized_category not in VALID_CATEGORIES
        ):
            raise CalibrationBuildError(
                "catalog contains an invalid title, price, or category"
            )
        rows.append(_Row(normalized_title, price, normalized_category))
    return tuple(rows), table.num_rows


def _load_manifest(manifest_path: Path, dataset_path: Path, row_count: int) -> dict[str, Any]:
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        data_version = manifest["data_version"]
        expected_checksum = manifest["sha256"]
        expected_rows = manifest["row_count"]
    except (OSError, UnicodeError, KeyError, TypeError, json.JSONDecodeError) as exc:
        raise CalibrationBuildError(
            "manifest must contain data_version, sha256, and row_count"
        ) from exc
    checksum = _file_sha256(dataset_path)
    if (
        not isinstance(data_version, str)
        or not data_version.strip()
        or expected_checksum != checksum
        or expected_rows != row_count
    ):
        raise CalibrationBuildError("manifest does not match the catalog parquet")
    return manifest


def _partition(rows: tuple[_Row, ...]) -> dict[str, tuple[_Row, ...]]:
    partitions: dict[str, list[_Row]] = {
        "train": [],
        "calibration": [],
        "evaluation": [],
    }
    title_splits: dict[str, str] = {}
    for row in rows:
        split = _split(row.title)
        normalized = _normalized_title(row.title)
        prior = title_splits.setdefault(normalized, split)
        if prior != split:  # pragma: no cover - deterministic function invariant.
            raise CalibrationBuildError("title group crossed split boundaries")
        partitions[split].append(row)
    if any(not partition for partition in partitions.values()):
        raise CalibrationBuildError("one or more holdout partitions are empty")
    return {name: tuple(partition) for name, partition in partitions.items()}


def _evaluate(
    index: _TfIdfIndex,
    rows: tuple[_Row, ...],
    *,
    retrieval_k: int,
    min_score: float,
) -> list[_Evaluation]:
    output: list[_Evaluation] = []
    for row in rows:
        metadata = ListingMetadata(
            product_type=row.title[:80],
            platform="umum",
            production_cost_idr=1_000,
        )
        query = " ".join(metadata.confirmed_facts())
        neighbors = [
            item for item in index.search(query, retrieval_k) if item[1] >= min_score
        ]
        weights: dict[str, float] = defaultdict(float)
        for neighbor, score in neighbors:
            if neighbor.category in VALID_CATEGORIES:
                weights[neighbor.category] += score
        if not weights:
            output.append(_Evaluation(row.category, CategoryCode.LAINNYA.value, None, None))
            continue
        predicted, winner_weight = min(
            weights.items(), key=lambda item: (-item[1], item[0])
        )
        vote_share = winner_weight / sum(weights.values())
        category_neighbors = [
            neighbor.price
            for neighbor, _ in neighbors
            if neighbor.category == predicted
        ]
        prices = _robust_prices(category_neighbors)
        covered = None
        if len(prices) >= MIN_EVIDENCE_COUNT:
            low = round(_quantile(prices, 0.10))
            high = max(round(_quantile(prices, 0.50)), round(_quantile(prices, 0.90)))
            covered = low <= row.price <= high
        output.append(_Evaluation(row.category, predicted, vote_share, covered))
    return output


def _classification_metrics(samples: list[_Evaluation]) -> dict[str, Any]:
    confusion = Counter(
        (sample.actual_category, sample.predicted_category) for sample in samples
    )
    classes: dict[str, dict[str, float | int]] = {}
    f1_values: list[float] = []
    for category in sorted(VALID_CATEGORIES):
        true_positive = confusion[category, category]
        false_positive = sum(
            confusion[other, category]
            for other in VALID_CATEGORIES
            if other != category
        )
        false_negative = sum(
            confusion[category, other]
            for other in VALID_CATEGORIES
            if other != category
        )
        support = true_positive + false_negative
        precision = (
            true_positive / (true_positive + false_positive)
            if true_positive + false_positive
            else 0.0
        )
        recall = true_positive / support if support else 0.0
        f1 = (
            2 * precision * recall / (precision + recall)
            if precision + recall
            else 0.0
        )
        f1_values.append(f1)
        classes[category] = {
            "support": support,
            "precision": round(precision, 6),
            "recall": round(recall, 6),
            "f1": round(f1, 6),
        }
    correct = sum(sample.actual_category == sample.predicted_category for sample in samples)
    return {
        "sample_count": len(samples),
        "accuracy": round(correct / len(samples), 6),
        "macro_f1": round(sum(f1_values) / len(f1_values), 6),
        "classes": classes,
    }


def _category_bins(samples: list[_Evaluation]) -> list[dict[str, int | float]]:
    calibrated = sorted(
        (
            sample.vote_share,
            sample.actual_category == sample.predicted_category,
        )
        for sample in samples
        if sample.vote_share is not None
    )
    if len(calibrated) < MIN_CATEGORY_BIN_SAMPLES * 2:
        raise CalibrationBuildError("too few category calibration samples")
    target_size = max(
        MIN_CATEGORY_BIN_SAMPLES,
        math.ceil(len(calibrated) / DESIRED_CATEGORY_BINS),
    )
    grouped: list[list[tuple[float, bool]]] = []
    current: list[tuple[float, bool]] = []
    for index, item in enumerate(calibrated):
        current.append(item)
        next_score = calibrated[index + 1][0] if index + 1 < len(calibrated) else None
        if len(current) >= target_size and next_score != item[0]:
            grouped.append(current)
            current = []
    if current:
        if grouped and len(current) < MIN_CATEGORY_BIN_SAMPLES:
            grouped[-1].extend(current)
        else:
            grouped.append(current)
    bins: list[dict[str, int | float]] = []
    for group in grouped:
        correct = sum(item[1] for item in group)
        bins.append(
            {
                "upper_bound": group[-1][0],
                "sample_count": len(group),
                "correct_count": correct,
                "empirical_probability": round(correct / len(group), 6),
                "score": round(100 * correct / len(group)),
            }
        )
    bins[-1]["upper_bound"] = 1.0
    return bins


def _category_score(vote_share: float, bins: list[dict[str, int | float]]) -> int:
    for calibration_bin in bins:
        if vote_share <= float(calibration_bin["upper_bound"]):
            return int(calibration_bin["score"])
    raise CalibrationBuildError("category confidence falls outside calibration bins")


def _reliability_metrics(
    observations: list[tuple[int, bool]],
) -> dict[str, float | int]:
    if not observations:
        raise CalibrationBuildError("no evaluation observations have confidence")
    grouped: dict[int, list[bool]] = defaultdict(list)
    for score, outcome in observations:
        grouped[score].append(outcome)
    ece = sum(
        len(outcomes)
        * abs(score / 100 - sum(outcomes) / len(outcomes))
        for score, outcomes in grouped.items()
    )
    brier = sum((score / 100 - int(outcome)) ** 2 for score, outcome in observations)
    return {
        "sample_count": len(observations),
        "ece": round(ece / len(observations), 6),
        "brier_score": round(brier / len(observations), 6),
    }


def _price_groups(samples: list[_Evaluation]) -> tuple[dict[str, dict[str, int]], int]:
    outcomes: dict[str, list[bool]] = defaultdict(list)
    for sample in samples:
        if sample.price_covered is not None:
            outcomes[sample.predicted_category].append(sample.price_covered)
    groups: dict[str, dict[str, int]] = {}
    omitted = 0
    for category, values in sorted(outcomes.items()):
        if len(values) < MIN_PRICE_GROUP_SAMPLES:
            omitted += len(values)
            continue
        covered = sum(values)
        groups[category] = {
            "sample_count": len(values),
            "covered_count": covered,
            "score": round(100 * covered / len(values)),
        }
    if not groups:
        raise CalibrationBuildError("no price group has sufficient calibration evidence")
    return groups, omitted


def _price_metrics(
    samples: list[_Evaluation], groups: dict[str, dict[str, int]]
) -> dict[str, Any]:
    eligible = [sample for sample in samples if sample.price_covered is not None]
    assigned = [sample for sample in eligible if sample.predicted_category in groups]
    if not eligible or not assigned:
        raise CalibrationBuildError("no price evaluation sample is eligible")
    per_category: dict[str, dict[str, float | int]] = {}
    observations: list[tuple[int, bool]] = []
    for category, group in sorted(groups.items()):
        selected = [
            sample for sample in assigned if sample.predicted_category == category
        ]
        if not selected:
            continue
        covered = sum(bool(sample.price_covered) for sample in selected)
        per_category[category] = {
            "sample_count": len(selected),
            "covered_count": covered,
            "coverage": round(covered / len(selected), 6),
        }
        observations.extend(
            (group["score"], bool(sample.price_covered)) for sample in selected
        )
    covered_total = sum(bool(sample.price_covered) for sample in eligible)
    coverage = covered_total / len(eligible)
    return {
        "eligible_sample_count": len(eligible),
        "assigned_confidence_count": len(assigned),
        "covered_count": covered_total,
        "coverage": round(coverage, 6),
        "meets_target_band_75_to_85_pct": 0.75 <= coverage <= 0.85,
        "reliability": _reliability_metrics(observations),
        "groups": per_category,
    }


def _validate_category_gate(metrics: dict[str, Any]) -> None:
    classes = metrics["classes"]
    minimum_support = min(item["support"] for item in classes.values())
    minimum_recall = min(item["recall"] for item in classes.values())
    if minimum_support < MIN_EVALUATION_CLASS_SAMPLES:
        raise CalibrationBuildError("evaluation class support is insufficient")
    if metrics["macro_f1"] < 0.8 or minimum_recall < 0.65:
        raise CalibrationBuildError("category holdout quality misses the PRD gate")


def build_artifact(
    dataset_path: Path,
    manifest_path: Path,
    *,
    retrieval_k: int = 50,
    min_score: float = 2.0,
) -> dict[str, Any]:
    rows, row_count = _load_rows(dataset_path)
    manifest = _load_manifest(manifest_path, dataset_path, row_count)
    partitions = _partition(rows)
    index = _TfIdfIndex(partitions["train"])
    calibration = _evaluate(
        index,
        partitions["calibration"],
        retrieval_k=retrieval_k,
        min_score=min_score,
    )
    evaluation = _evaluate(
        index,
        partitions["evaluation"],
        retrieval_k=retrieval_k,
        min_score=min_score,
    )

    bins = _category_bins(calibration)
    category_evaluation = _classification_metrics(evaluation)
    category_observations = [
        (
            _category_score(sample.vote_share, bins),
            sample.actual_category == sample.predicted_category,
        )
        for sample in evaluation
        if sample.vote_share is not None
    ]
    category_reliability = _reliability_metrics(category_observations)
    _validate_category_gate(category_evaluation)
    if category_reliability["ece"] > 0.08:
        raise CalibrationBuildError("category calibration misses the PRD ECE gate")

    price_groups, omitted_price_samples = _price_groups(calibration)
    price_evaluation = _price_metrics(evaluation, price_groups)
    calibration_price_total = sum(
        group["sample_count"] for group in price_groups.values()
    )
    unique_groups = {
        split: len({_normalized_title(row.title) for row in partition})
        for split, partition in partitions.items()
    }
    return {
        "format_version": FORMAT_VERSION,
        "artifact_version": ARTIFACT_VERSION,
        "method": CALIBRATION_METHOD,
        "catalog": {
            "data_version": manifest["data_version"],
            "data_as_of": manifest["data_as_of"],
            "sha256": manifest["sha256"],
            "row_count": row_count,
            "source_split": manifest.get("source_split"),
        },
        "split": {
            "group_key": "sha256(normalized_title)",
            "hash_algorithm": "sha256-first-8-bytes-mod-10000",
            "buckets": SPLIT_BUCKETS,
            "ranges": {
                "train": [0, TRAIN_END],
                "calibration": [TRAIN_END, CALIBRATION_END],
                "evaluation": [CALIBRATION_END, SPLIT_BUCKETS],
            },
            "row_counts": {
                split: len(partition) for split, partition in partitions.items()
            },
            "group_counts": unique_groups,
        },
        "runtime": {
            "service_version": SERVICE_VERSION,
            "retrieval_k": retrieval_k,
            "min_score": min_score,
            "minimum_evidence_count": MIN_EVIDENCE_COUNT,
            "price_quantiles": [0.1, 0.9],
            "holdout_query_contract": CALIBRATION_QUERY_CONTRACT,
        },
        "category": {
            "method": "equal_frequency_binned_empirical_correctness",
            "feature": "top_category_vote_share",
            "minimum_bin_samples": MIN_CATEGORY_BIN_SAMPLES,
            "calibration_sample_count": sum(
                int(calibration_bin["sample_count"]) for calibration_bin in bins
            ),
            "calibration_no_evidence_count": sum(
                sample.vote_share is None for sample in calibration
            ),
            "bins": bins,
            "evaluation": {
                **category_evaluation,
                "calibration_reliability": category_reliability,
            },
            "prd_gate": {
                "macro_f1_min": 0.8,
                "per_class_recall_min": 0.65,
                "ece_max": 0.08,
                "passed": True,
            },
        },
        "price": {
            "method": "empirical_p10_p90_interval_coverage_by_predicted_category",
            "target_coverage": TARGET_PRICE_COVERAGE,
            "minimum_group_samples": MIN_PRICE_GROUP_SAMPLES,
            "calibration_eligible_count": calibration_price_total,
            "calibration_omitted_count": omitted_price_samples,
            "groups": price_groups,
            "evaluation": price_evaluation,
        },
        "limitations": [
            "Baseline internal holdout from one catalog snapshot; not an external or temporal validation set.",
            "Labels and reference prices inherit source-catalog quality and marketplace selection bias.",
            "Lexical retrieval does not normalize product units, variants, region, seller, or listing age.",
            "Scores are valid only for the exact catalog checksum and runtime retrieval parameters recorded here.",
            "All category labels in this catalog were assigned by heuristic rules, not independently human-labeled ground truth.",
            "Provenance audit found 819 source-train rows absent from the runtime catalog and 26 runtime rows absent from that source split.",
            "Holdout queries model only production product_type using the first 80 title characters; optional brand, variant, size, and ingredients are unavailable in this catalog.",
        ],
    }


def _arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dataset", type=Path, default=DEFAULT_DATASET_PATH)
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST_PATH)
    parser.add_argument("--output", type=Path, default=DEFAULT_CALIBRATION_PATH)
    parser.add_argument("--retrieval-k", type=int, default=50)
    parser.add_argument("--min-score", type=float, default=2.0)
    return parser.parse_args()


def main() -> None:
    arguments = _arguments()
    if arguments.retrieval_k < MIN_EVIDENCE_COUNT or arguments.min_score < 0:
        raise SystemExit("invalid runtime retrieval parameters")
    try:
        artifact = build_artifact(
            arguments.dataset,
            arguments.manifest,
            retrieval_k=arguments.retrieval_k,
            min_score=arguments.min_score,
        )
    except CalibrationBuildError as exc:
        raise SystemExit(str(exc)) from exc
    arguments.output.parent.mkdir(parents=True, exist_ok=True)
    arguments.output.write_text(
        json.dumps(artifact, indent=2, sort_keys=True, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    summary = {
        "artifact_version": artifact["artifact_version"],
        "category": artifact["category"]["evaluation"],
        "price": artifact["price"]["evaluation"],
    }
    print(json.dumps(summary, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
