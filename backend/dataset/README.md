# Runtime market catalog

The backend reads one immutable, versioned Parquet snapshot at:

```text
backend/dataset/market_catalog.parquet
backend/dataset/market_catalog.manifest.json
backend/dataset/market_catalog.calibration.json
```

The actual snapshot is deployment data and is intentionally ignored by Git.
Copy or provision it before starting a worker. Do not download data from the
marketplace or build a catalog during an API request.

Only publish data whose use is permitted for the production environment. Before
publication, remove non-positive prices, duplicate listings, incomparable
bundles/used products, and documented outliers. The runtime deliberately does
not repair an unreviewed source snapshot.

The Parquet file must contain these columns:

| Column | Type | Use |
| --- | --- | --- |
| `title` | string | TF-IDF retrieval text |
| `price` | numeric | IDR market evidence; positive values only |
| `kategori_umkm` | string | weighted category vote |

`scraped_at` and `source` are optional provenance columns. They are accepted by
the loader but the manifest is the authority for freshness and versioning.

The manifest must contain an immutable `data_version`, ISO `data_as_of` date
(`YYYY-MM-DD`), Parquet `row_count`, and lowercase SHA-256 digest. Start from
[`manifest.example.json`](manifest.example.json) when publishing a new snapshot.

The runtime service retrieves lexical neighbors with a small in-memory TF-IDF
index. Missing or invalid artifacts make the readiness endpoint fail. A valid
catalog with no matching products returns insufficient evidence and never a
synthetic market price.

## Confidence calibration

Run the offline builder from `backend/` whenever the catalog or retrieval
parameters change:

```sh
python -m tools.build_catalog_calibration
```

The builder is reproducible and writes sorted JSON without a build timestamp. It
groups rows by normalized title, hashes each group with SHA-256, then assigns
80% of hash buckets to index fitting, 10% to calibration, and 10% to untouched
evaluation. Exact duplicate titles therefore cannot leak across partitions.

Each holdout request is built with the production `ListingMetadata` contract as
`product_type=title[:80]`, then passed through `confirmed_facts()`. The catalog
does not contain brand, variant, size, or ingredient request fields, so those
cannot be evaluated in this baseline. Category confidence is the empirical
correctness rate in an equal-frequency bin of top-category vote share. The bin
mapping is learned only from the calibration partition. Price confidence is the
empirical probability that a held-out listing price falls inside the runtime
P10-P90 interval, grouped by the category selected by the runtime. It is not the
raw TF-IDF similarity.

The checked-in `catalog-baseline-holdout-v2` artifact records:

- 17,119 train rows, 2,253 calibration rows, and 2,217 evaluation rows;
- category evaluation accuracy `0.909337`, macro-F1 `0.875117`, minimum
  per-class recall `0.758065`, ECE `0.012327`, and Brier score `0.063157`;
- price evaluation coverage `0.725346` over 2,170 eligible rows, ECE `0.016249`,
  and Brier score `0.199546`.

Price coverage misses the PRD's proposed 75-85% band for an 80% target. The
runtime therefore exposes the observed category-specific reliability (64-78),
without inflating it to 80. This baseline is an internal random holdout from one
snapshot, not external or temporal validation. It inherits catalog labeling,
marketplace selection, unit/variant, region, seller, and freshness limitations.
All category labels were assigned by heuristic rules rather than independent
human annotation. A provenance audit also found 819 rows from the declared
source train split absent from the runtime catalog and 26 runtime rows absent
from that source split; this artifact evaluates the exact runtime checksum, not
the nominal source file.

At startup the runtime checks the calibration's catalog version, actual Parquet
SHA-256, row count, service version, retrieval parameters, and empirical sample
counts. Missing, invalid, mismatched, or under-supported calibration returns
`score=null`; catalog retrieval itself remains available.
