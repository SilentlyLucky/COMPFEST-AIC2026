from schemas import Kategori

KEYWORD_BANK: dict[Kategori, list[str]] = {
    "beauty_and_personal_care": [
        "original",
        "premium",
        "berkualitas",
        "lembut",
        "tahan lama",
        "wangi",
        "alami",
    ],
    "home_and_kitchen": [
        "kokoh",
        "praktis",
        "multifungsi",
        "awet",
        "hemat tempat",
        "berkualitas",
        "original",
    ],
    "grocery_and_gourmet_food": [
        "enak",
        "renyah",
        "original",
        "berkualitas",
        "segar",
        "gurih",
        "premium",
    ],
}

MIN_WORDS = 5
MAX_WORDS = 12


def _split_words(text: str) -> list[str]:
    return text.split()


def _dedupe_consecutive(words: list[str]) -> list[str]:
    result: list[str] = []
    for word in words:
        if result and result[-1].lower() == word.lower():
            continue
        result.append(word)
    return result


def generate_title(kategori: Kategori, nama_dasar: str, varian: str, ukuran: str) -> str:
    candidates = KEYWORD_BANK.get(kategori, [])
    nama_dasar_words = _split_words(nama_dasar)
    varian_words = _split_words(varian)
    ukuran_words = _split_words(ukuran)

    used = {word.lower() for word in (*nama_dasar_words, *varian_words)}
    chosen: list[str] = []

    def word_count(extra_keyword_count: int) -> int:
        return len(nama_dasar_words) + len(varian_words) + extra_keyword_count + len(ukuran_words)

    for keyword in candidates:
        if keyword.lower() in used:
            continue
        if word_count(len(chosen) + 1) > MAX_WORDS:
            break
        chosen.append(keyword)
        used.add(keyword.lower())
        if word_count(len(chosen)) >= MIN_WORDS and len(chosen) >= 2:
            break

    capitalized_keywords = [keyword[:1].upper() + keyword[1:] for keyword in chosen]

    parts = [*nama_dasar_words, *varian_words, *capitalized_keywords, *ukuran_words]

    return " ".join(_dedupe_consecutive(parts))
