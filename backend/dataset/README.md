# Runtime market catalog

The backend reads one immutable, versioned Parquet snapshot at:

```text
backend/dataset/market_catalog.parquet
backend/dataset/market_catalog.manifest.json
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

The manifest must contain an immutable `data_version` and an ISO `data_as_of`
date (`YYYY-MM-DD`). Start from [`manifest.example.json`](manifest.example.json)
when publishing a new snapshot, then record the artifact checksum in deployment
metadata.

The runtime service retrieves lexical neighbors with a small in-memory TF-IDF
index. Missing or invalid artifacts make the readiness endpoint fail. A valid
catalog with no matching products returns insufficient evidence and never a
synthetic market price.
