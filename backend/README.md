# LAPAKIN backend

Production runtime for `POST /v1/listings/generate`. The deployable application
is self-contained under `backend/`; it does not import from `model_sulingan/`,
`model_harga/`, or `training/`.

## Runtime components

- `ai/listing/`: Qwen2.5-VL 3B LoRA adapter and inference code for title and
  description. Startup loads the base model `Qwen/Qwen2.5-VL-3B-Instruct`
  from the standard Hugging Face cache at its pinned production revision. The
  snapshot must be provisioned before startup; serving never downloads it.
- `ai/pricing/`: TF-IDF catalog retrieval for category routing and market price
  evidence. Startup builds the index before traffic is accepted.
- `dataset/`: deployment location for the immutable market snapshot and its
  manifest. Follow [`dataset/README.md`](dataset/README.md).
- `orchestrator.py`: combines copy, category, market evidence, cost floor,
  guardrails, confidence, warnings, and response metadata.

The distilled VLM only outputs `judul` and `deskripsi`. Category is therefore
derived from the catalog neighbors, not invented by changing the trained model
prompt. Category and price confidence come from a versioned internal-holdout
calibration artifact, never from the VLM or a direct similarity-to-percentage
conversion. Missing or mismatched calibration fails closed to `null` confidence.

## Install

Create a dedicated Python environment. Install the lightweight API runtime for
tests or non-model tooling:

```sh
python -m pip install -r requirements-dev.txt
```

Install the production model worker dependencies on the CUDA machine:

```sh
python -m pip install -r requirements-model.txt
```

The model worker requires a CUDA GPU; the adapter was evaluated around 7 GB of
VRAM. The versions in `requirements-model.txt` intentionally keep Transformers
below version 5 because incompatible Torch/TorchAO combinations can fail during
import before readiness is evaluated.

`ai/listing/model/adapter_model.safetensors` is about 142 MiB. Store it as a
deployment artifact or with Git LFS; a normal GitHub blob upload exceeds the
standard per-file limit.

## Dataset

Provision these deployment-only files before starting the service:

```text
backend/dataset/market_catalog.parquet
backend/dataset/market_catalog.manifest.json
backend/dataset/market_catalog.calibration.json
```

The Parquet file is intentionally ignored by Git. Do not replace it with the
synthetic demo catalog from `model_harga`. The calibration JSON in this repository
is valid only for the catalog version and SHA-256 checksum recorded inside it.
Rebuild it after publishing a new catalog:

```sh
python -m tools.build_catalog_calibration
```

The builder uses a deterministic, duplicate-title-grouped 80/10/10
train/calibration/evaluation split. See [`dataset/README.md`](dataset/README.md)
for metrics and limitations.

## Run

From the `backend` directory:

```sh
export CORS_ALLOWED_ORIGINS="https://lapakin.example"
python -m uvicorn main:app --host 0.0.0.0 --port 8000
```

`CORS_ALLOWED_ORIGINS` accepts a comma-separated list of complete HTTP(S)
origins. It defaults to `http://localhost:3000` for local development.

Check readiness before sending traffic:

```sh
curl http://localhost:8000/health/ready
```

`/health/live` only shows that the process is alive. Application startup fails
if the CUDA model or versioned catalog cannot warm successfully; after startup,
`/health/ready` confirms that all three service roles are loaded.

## Verify

```sh
python -m pytest tests -q
python -m ruff check .
```
