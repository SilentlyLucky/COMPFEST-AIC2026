#!/usr/bin/env bash

set -euo pipefail

BACKEND_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd -- "$BACKEND_DIR"

PYTHON_BIN="${PYTHON_BIN:-$BACKEND_DIR/.venv/bin/python}"
HOST="${HOST:-0.0.0.0}"
PORT="${PORT:-8012}"
RELOAD="${RELOAD:-0}"
WORKERS="${WORKERS:-1}"

# Keep the pinned Hugging Face snapshot beside the deployment when it exists.
# An explicit HF_HOME from the environment always takes precedence.
PROJECT_HF_HOME="$BACKEND_DIR/../.cache/huggingface"
if [[ -z "${HF_HOME:-}" && -d "$PROJECT_HF_HOME" ]]; then
  export HF_HOME="$PROJECT_HF_HOME"
fi

if [[ ! -x "$PYTHON_BIN" ]]; then
  printf 'Python interpreter tidak ditemukan: %s\n' "$PYTHON_BIN" >&2
  printf 'Buat environment dulu atau set PYTHON_BIN ke interpreter yang benar.\n' >&2
  exit 1
fi

if ! "$PYTHON_BIN" -c 'import uvicorn' >/dev/null 2>&1; then
  printf 'uvicorn belum terpasang pada interpreter: %s\n' "$PYTHON_BIN" >&2
  printf 'Install dependency dengan: %s -m pip install -r requirements.txt\n' "$PYTHON_BIN" >&2
  exit 1
fi

required_files=(
  "dataset/market_catalog.parquet"
  "dataset/market_catalog.manifest.json"
  "dataset/market_catalog.calibration.json"
  "ai/category/model/category_heads.pt"
  "ai/category/model/openclip_vit_b32_laion2b_s34b_b79k.safetensors"
  "ai/listing/model/adapter_config.json"
  "ai/listing/model/adapter_model.safetensors"
  "ai/listing/model/chat_template.jinja"
  "ai/listing/model/processor_config.json"
  "ai/listing/model/tokenizer.json"
  "ai/listing/model/tokenizer_config.json"
)

missing_files=()
for required_file in "${required_files[@]}"; do
  if [[ ! -f "$required_file" ]]; then
    missing_files+=("$required_file")
  fi
done

if ((${#missing_files[@]} > 0)); then
  printf 'Artefak backend belum lengkap:\n' >&2
  printf '  %s\n' "${missing_files[@]}" >&2
  exit 1
fi

case "${RELOAD,,}" in
  1|true|yes|on)
    # Uvicorn reload mode manages its own worker process.
    uvicorn_args=(main:app --host "$HOST" --port "$PORT" --reload)
    ;;
  *)
    uvicorn_args=(main:app --host "$HOST" --port "$PORT" --workers "$WORKERS")
    ;;
esac

exec "$PYTHON_BIN" -m uvicorn "${uvicorn_args[@]}"
