from schemas import Kategori

from .hash import hash_string

BASE_PRICE: dict[Kategori, int] = {
    "home_and_kitchen": 75_000,
    "beauty_and_personal_care": 60_000,
    "grocery_and_gourmet_food": 35_000,
}

SPREAD_PCT = 0.15


def predict_price_range(
    kategori: Kategori,
    rating_avg: float,
    lokasi: str,
    nama_produk: str,
) -> tuple[int, int]:
    base = BASE_PRICE.get(kategori, 50_000)
    variance = hash_string(f"{nama_produk}|{lokasi}") % 100  # 0..99
    clamped_rating = min(max(rating_avg, 1), 5)
    rating_factor = 0.8 + (clamped_rating / 5) * 0.4  # 0.8x..1.2x
    point = base * (0.7 + variance / 100) * rating_factor

    min_price = round(point * (1 - SPREAD_PCT))
    max_price = round(point * (1 + SPREAD_PCT))
    return min_price, max_price
