from schemas import Kategori

DESCRIPTION_TEMPLATES: dict[Kategori, list[str]] = {
    "home_and_kitchen": [
        "Produk rumah tangga dengan desain praktis, cocok untuk kebutuhan sehari-hari di dapur maupun ruang keluarga.",
        "Perlengkapan rumah tangga berkualitas dengan bahan kokoh, mudah dibersihkan dan tahan lama.",
        "Alat rumah tangga multifungsi yang hemat tempat dan nyaman digunakan setiap hari.",
    ],
    "beauty_and_personal_care": [
        "Produk perawatan diri dengan formula lembut di kulit, cocok untuk pemakaian sehari-hari.",
        "Produk kecantikan dengan kandungan berkualitas, membantu menjaga kesehatan dan penampilan kulit.",
        "Produk perawatan tubuh dengan aroma menyegarkan dan tekstur nyaman saat digunakan.",
    ],
    "grocery_and_gourmet_food": [
        "Produk makanan dengan cita rasa khas, diolah dari bahan pilihan untuk kualitas terbaik.",
        "Camilan dan bahan makanan berkualitas, cocok dinikmati kapan saja bersama keluarga.",
        "Produk pangan dengan rasa autentik, dikemas rapi untuk menjaga kesegaran.",
    ],
}
