import torch
import pytest
from ai.category import OpenClipCategoryClassifier, build_category_fact_text
from PIL import Image
from schemas import CategoryCode, ListingMetadata, ProcessedImage


def make_metadata(**overrides: object) -> ListingMetadata:
    values: dict[str, object] = {
        "product_type": "Keripik pisang",
        "platform": "tokopedia",
        "market_region_code": "ID-YO",
        "production_cost_idr": 12_000,
        "brand": "Dapur Bu Sari",
        "variant": "cokelat",
        "size": "200 g",
        "material_or_ingredients": "pisang kepok, cokelat",
    }
    values.update(overrides)
    return ListingMetadata.model_validate(values)


def test_category_fact_text_maps_form_fields_to_training_contract() -> None:
    metadata = make_metadata()

    assert build_category_fact_text(metadata) == (
        "jenis produk: Keripik pisang cokelat 200 g pisang kepok, cokelat. "
        "merek: Dapur Bu Sari. kata pencarian: Keripik pisang"
    )


def test_category_fact_text_is_empty_without_user_facts() -> None:
    metadata = make_metadata(
        product_type=None,
        brand=None,
        variant=None,
        size=None,
        material_or_ingredients=None,
    )

    assert build_category_fact_text(metadata) == ""


def test_hybrid_classifier_returns_calibrated_category_score() -> None:
    classifier = OpenClipCategoryClassifier(device="cpu")
    classifier._torch = torch
    classifier._device = "cpu"
    classifier._classes = tuple(sorted(CategoryCode, key=lambda item: item.value))
    classifier._image_temperature = 1.0
    classifier._text_temperature = 1.0
    classifier._hybrid_alpha = 1.925
    classifier._hybrid_temperature = 2.05
    classifier._preprocess = lambda _: torch.zeros(3, 4, 4)
    classifier._tokenizer = lambda texts: torch.ones(len(texts), 3, dtype=torch.long)

    class FakeClip:
        def encode_image(self, _: torch.Tensor) -> torch.Tensor:
            return torch.nn.functional.pad(torch.ones(1, 1), (0, 511), value=0)

        def encode_text(self, _: torch.Tensor) -> torch.Tensor:
            return torch.nn.functional.pad(torch.ones(1, 1), (0, 511), value=0)

    classifier._model = FakeClip()
    classifier._image_head = torch.nn.Linear(512, len(classifier._classes))
    classifier._text_head = torch.nn.Linear(512, len(classifier._classes))
    with torch.no_grad():
        classifier._image_head.weight.zero_()
        classifier._text_head.weight.zero_()
        classifier._image_head.bias.zero_()
        classifier._text_head.bias.zero_()
        classifier._image_head.bias[2] = 4.0
        classifier._text_head.bias[1] = 5.0

    image = Image.new("RGB", (32, 32), "white")
    processed = ProcessedImage(
        image=image,
        detected_mime="image/png",
        original_width=32,
        original_height=32,
    )
    prediction = classifier._infer(processed, make_metadata())

    assert prediction.code is CategoryCode.CAMILAN_OLAHAN
    assert prediction.score is not None
    assert 0 <= prediction.score <= 100
    assert prediction.evidence_terms[:2] == ("Keripik pisang", "Dapur Bu Sari")


def test_hybrid_classifier_uses_image_only_when_product_hint_is_absent() -> None:
    classifier = OpenClipCategoryClassifier(device="cpu")
    classifier._torch = torch
    classifier._device = "cpu"
    classifier._classes = tuple(sorted(CategoryCode, key=lambda item: item.value))
    classifier._image_temperature = 1.0
    classifier._hybrid_alpha = 1.925
    classifier._preprocess = lambda _: torch.zeros(3, 4, 4)
    classifier._tokenizer = lambda _: pytest.fail("text path must not run")

    class FakeClip:
        def encode_image(self, _: torch.Tensor) -> torch.Tensor:
            return torch.nn.functional.pad(torch.ones(1, 1), (0, 511), value=0)

    classifier._model = FakeClip()
    classifier._image_head = torch.nn.Linear(512, len(classifier._classes))
    with torch.no_grad():
        classifier._image_head.weight.zero_()
        classifier._image_head.bias.zero_()
        classifier._image_head.bias[
            classifier._classes.index(CategoryCode.CAMILAN_OLAHAN)
        ] = 4.0

    image = Image.new("RGB", (32, 32), "white")
    processed = ProcessedImage(
        image=image,
        detected_mime="image/png",
        original_width=32,
        original_height=32,
    )
    prediction = classifier._infer(
        processed,
        make_metadata(
            product_type=None,
            brand=None,
            variant=None,
            size=None,
            material_or_ingredients=None,
        ),
    )

    assert prediction.code is CategoryCode.CAMILAN_OLAHAN
    assert prediction.evidence_terms == ()
