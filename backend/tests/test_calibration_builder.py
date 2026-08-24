import hashlib
import json
import os
import subprocess
import sys
from pathlib import Path

import pyarrow as pa
import pyarrow.parquet as pq

from schemas import CategoryCode


def test_builder_is_byte_reproducible_across_python_hash_seeds(tmp_path: Path) -> None:
    """A published calibration must not depend on process hash randomization."""
    titles: list[str] = []
    prices: list[int] = []
    categories: list[str] = []
    for category_index, category in enumerate(CategoryCode):
        for row_index in range(800):
            titles.append(
                f"{category.value} produk contoh id{category_index}x{row_index}"
            )
            prices.append(10_000 + category_index * 5_000 + row_index % 50 * 100)
            categories.append(category.value)

    dataset_path = tmp_path / "catalog.parquet"
    manifest_path = tmp_path / "manifest.json"
    pq.write_table(
        pa.table(
            {
                "title": pa.array(titles),
                "price": pa.array(prices),
                "kategori_umkm": pa.array(categories),
            }
        ),
        dataset_path,
    )
    checksum = hashlib.sha256(dataset_path.read_bytes()).hexdigest()
    manifest_path.write_text(
        json.dumps(
            {
                "data_version": "determinism-test-v1",
                "data_as_of": "2026-08-20",
                "row_count": len(titles),
                "sha256": checksum,
            }
        ),
        encoding="utf-8",
    )

    outputs = [tmp_path / "seed-1.json", tmp_path / "seed-2.json"]
    backend_root = Path(__file__).parents[1]
    for seed, output in zip(("1", "2"), outputs, strict=True):
        environment = os.environ.copy()
        environment["PYTHONHASHSEED"] = seed
        result = subprocess.run(
            [
                sys.executable,
                "-m",
                "tools.build_catalog_calibration",
                "--dataset",
                str(dataset_path),
                "--manifest",
                str(manifest_path),
                "--output",
                str(output),
            ],
            cwd=backend_root,
            env=environment,
            capture_output=True,
            text=True,
            check=False,
        )
        assert result.returncode == 0, result.stderr

    assert outputs[0].read_bytes() == outputs[1].read_bytes()
