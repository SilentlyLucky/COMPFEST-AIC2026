import sys
from contextlib import nullcontext
from decimal import Decimal
from pathlib import Path
from types import SimpleNamespace

import pytest
from ai.listing import inference
from ai.listing.inference import MODEL_PROMPT, REQUIRED_ASSETS, SulinganVlmGenerator
from errors import ApiError
from PIL import Image
from schemas import ListingMetadata, ProcessedImage


def _write_runtime_assets(path) -> None:
    for name in REQUIRED_ASSETS:
        (path / name).touch()


def _install_fake_runtime(monkeypatch) -> None:
    fake_torch = SimpleNamespace(
        cuda=SimpleNamespace(is_available=lambda: True),
    )
    for name, module in (
        ("torch", fake_torch),
        ("transformers", SimpleNamespace()),
        ("peft", SimpleNamespace()),
    ):
        monkeypatch.setitem(sys.modules, name, module)


def test_vlm_prompt_stays_identical_to_the_distilled_training_contract() -> None:
    assert MODEL_PROMPT.format(platform="tokopedia") == (
        "Lihat foto produk ini. Tulis listing untuk platform tokopedia. "
        "Jawab JSON dengan kunci judul dan deskripsi. Jangan sebut ukuran, "
        "berat, garansi, izin, merek, atau khasiat yang tidak terlihat."
    )


def test_configured_but_cold_model_is_startable_not_ready(
    tmp_path, monkeypatch
) -> None:
    _write_runtime_assets(tmp_path)
    _install_fake_runtime(monkeypatch)

    readiness = SulinganVlmGenerator(tmp_path).readiness()

    assert readiness.ready is False
    assert readiness.startable is True
    assert readiness.details == {"loaded": False}


def test_readiness_requires_the_complete_runtime_asset_manifest(tmp_path) -> None:
    for name in REQUIRED_ASSETS[:-1]:
        (tmp_path / name).touch()

    readiness = SulinganVlmGenerator(tmp_path).readiness()

    assert readiness.ready is False
    assert readiness.startable is False
    assert readiness.reason == "model adapter assets are unavailable"
    assert str(tmp_path) not in str(readiness)


def test_readiness_reports_broken_runtime_import_without_leaking_paths(
    tmp_path, monkeypatch
) -> None:
    _write_runtime_assets(tmp_path)

    def import_module(name: str):
        if name == "transformers":
            raise RuntimeError("incompatible optional dependency")
        if name == "torch":
            return SimpleNamespace(cuda=SimpleNamespace(is_available=lambda: True))
        return SimpleNamespace()

    monkeypatch.setattr(inference.importlib, "import_module", import_module)

    readiness = SulinganVlmGenerator(tmp_path).readiness()

    assert readiness.ready is False
    assert readiness.startable is False
    assert readiness.reason == "optional model runtime dependencies are unavailable"
    assert str(tmp_path) not in str(readiness)


class _Encoded(dict):
    def to(self, device):
        self.device = device
        return self


class _Processor:
    def __init__(self, raw_output: str) -> None:
        self.raw_output = raw_output
        self.messages = None
        self.images = None
        self.tokenizer = self

    def apply_chat_template(self, messages, **kwargs):
        self.messages = messages
        assert kwargs == {"tokenize": False, "add_generation_prompt": True}
        return "rendered-prompt"

    def __call__(self, *, text, images, return_tensors):
        assert text == ["rendered-prompt"]
        assert return_tensors == "pt"
        self.images = images
        return _Encoded(input_ids=SimpleNamespace(shape=(1, 3)))

    def decode(self, token_ids, *, skip_special_tokens):
        assert token_ids == [4, 5]
        assert skip_special_tokens is True
        return self.raw_output


class _Model:
    device = "cuda"

    def generate(self, **kwargs):
        assert kwargs["max_new_tokens"] == 220
        assert kwargs["do_sample"] is False
        assert kwargs["input_ids"].shape == (1, 3)
        return [[1, 2, 3, 4, 5]]


def _metadata() -> ListingMetadata:
    return ListingMetadata(
        product_type="Keripik pisang",
        platform="tokopedia",
        market_region_code="ID-JK",
        production_cost_idr=10_000,
        target_margin_pct=Decimal(30),
    )


def _image() -> ProcessedImage:
    return ProcessedImage(
        image=Image.new("RGB", (64, 64)),
        detected_mime="image/png",
        original_width=64,
        original_height=64,
    )


def _loaded_generator(raw_output: str) -> tuple[SulinganVlmGenerator, _Processor]:
    processor = _Processor(raw_output)
    generator = SulinganVlmGenerator(Path("unused"))
    generator._processor = processor
    generator._model = _Model()
    generator._torch = SimpleNamespace(inference_mode=nullcontext)
    return generator, processor


def test_inference_preserves_the_trained_prompt_and_decodes_only_completion() -> None:
    generator, processor = _loaded_generator(
        '{"judul":"Keripik Pisang Renyah","deskripsi":"Keripik pisang renyah untuk camilan keluarga dan teman dalam berbagai suasana."}'
    )

    candidate = generator._infer(_image(), _metadata())

    assert candidate.title == "Keripik Pisang Renyah"
    assert processor.messages[0]["content"][1]["text"] == MODEL_PROMPT.format(
        platform="tokopedia"
    )
    assert processor.images[0].size == (64, 64)


def test_inference_rejects_output_outside_the_distilled_json_contract() -> None:
    generator, _ = _loaded_generator("```json\n{}\n```")

    with pytest.raises(ApiError) as raised:
        generator._infer(_image(), _metadata())

    assert raised.value.code == "MODEL_OUTPUT_INVALID"
