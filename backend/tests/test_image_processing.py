import io

import pytest
from errors import ApiError
from image_processing import process_image_bytes
from PIL import Image


def test_preprocessor_strips_metadata_converts_rgb_and_limits_dimensions() -> None:
    output = io.BytesIO()
    source = Image.new("RGBA", (1200, 600), (1, 2, 3, 100))
    exif = Image.Exif()
    exif[0x010E] = "private description"
    source.save(output, format="WEBP", exif=exif)

    result = process_image_bytes(output.getvalue(), "image/webp")

    assert result.image.mode == "RGB"
    assert result.image.size == (512, 256)
    assert not result.image.getexif()


def test_preprocessor_rejects_animated_images() -> None:
    output = io.BytesIO()
    frames = [Image.new("RGB", (10, 10), color) for color in ("red", "blue")]
    frames[0].save(
        output,
        format="WEBP",
        save_all=True,
        append_images=frames[1:],
        duration=100,
        loop=0,
    )

    with pytest.raises(ApiError) as error:
        process_image_bytes(output.getvalue(), "image/webp")

    assert error.value.code == "IMAGE_ANIMATED_UNSUPPORTED"


def test_preprocessor_rejects_more_than_twenty_megapixels_before_full_decode() -> None:
    output = io.BytesIO()
    Image.new("RGB", (5000, 4001), "white").save(output, format="PNG")

    with pytest.raises(ApiError) as error:
        process_image_bytes(output.getvalue(), "image/png")

    assert error.value.code == "IMAGE_DIMENSIONS_EXCEEDED"
