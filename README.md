# LAPAKIN

[![Next.js](https://img.shields.io/badge/Next.js-16.3.0-000000?logo=next.js&logoColor=white)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.2.8-149ECA?logo=react&logoColor=white)](https://react.dev/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115%2B-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Python](https://img.shields.io/badge/Python-3.10%2B-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![Docker Compose](https://img.shields.io/badge/Docker%20Compose-ready-2496ED?logo=docker&logoColor=white)](https://docs.docker.com/compose/)
[![CUDA](https://img.shields.io/badge/NVIDIA-CUDA-76B900?logo=nvidia&logoColor=white)](https://developer.nvidia.com/cuda-zone)

LAPAKIN membantu pemilik UMKM membuat draft listing produk dari foto, informasi produk, dan biaya produksi. Hasilnya berupa kategori, judul, deskripsi, rekomendasi harga, alasan perhitungan harga, serta tingkat keyakinan hasil.

## Daftar isi

- [Overview](#overview)
- [Fitur utama](#fitur-utama)
- [Tech stack](#tech-stack)
- [Kebutuhan hardware](#kebutuhan-hardware)
- [Menjalankan dengan Docker](#menjalankan-dengan-docker)
- [Mencoba sample](#mencoba-sample)
- [Flow website](#flow-website)
- [Arsitektur singkat](#arsitektur-singkat)
- [API utama](#api-utama)
- [Struktur project](#struktur-project)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)
- [Catatan dan batasan](#catatan-dan-batasan)
- [Made by](#made-by)

## Overview

### Masalah yang dibantu

Banyak pemilik usaha sudah memiliki produk, tetapi belum memiliki waktu atau pengalaman untuk:

- memilih kategori yang tepat;
- menulis judul dan deskripsi produk;
- menentukan harga yang mempertimbangkan modal dan kondisi pasar;
- memahami alasan di balik rekomendasi harga.

### Fungsi LAPAKIN

LAPAKIN menggabungkan tiga hal dalam satu alur:

1. Model bahasa dan gambar untuk membuat judul serta deskripsi dari informasi produk.
2. Model klasifikasi untuk menyarankan kategori produk.
3. Katalog harga dan perhitungan biaya untuk memberikan kisaran serta rekomendasi harga.

Semua hasil tetap dapat diperiksa dan diedit sebelum disalin untuk digunakan di platform jualan.

## Fitur utama

| Fitur | Fungsi |
| --- | --- |
| Buat listing dari foto | Menghasilkan draft judul dan deskripsi berdasarkan foto serta data produk. |
| Saran kategori | Memberi kategori dan tingkat keyakinan berdasarkan informasi produk dan katalog. |
| Rekomendasi harga | Menggabungkan modal, biaya, target keuntungan, dan harga produk serupa. |
| Penjelasan harga | Menunjukkan batas aman, P25, median, P75, dan harga rekomendasi. |
| Saran variasi produk | Menunjukkan variasi yang sering muncul pada produk serupa agar informasi produk lebih lengkap. |
| Pemeriksaan hasil | Menandai bagian yang perlu diperiksa sebelum produk digunakan. |

## Tech stack

### Software

| Bagian | Teknologi |
| --- | --- |
| Frontend | Next.js 16.3, React 19, TypeScript, Tailwind CSS 4 |
| Komponen UI | Base UI, Lucide React, class-variance-authority |
| Backend API | Python, FastAPI, Uvicorn, Pydantic |
| Model listing | Qwen2.5-VL 3B dengan adapter LoRA dan Transformers |
| Model kategori | OpenCLIP |
| Harga pasar | TF-IDF retrieval |
| Deployment | Docker, Docker Compose, NVIDIA Container Toolkit |

### Kebutuhan hardware

| Komponen | Keterangan |
| --- | --- |
| GPU | GPU NVIDIA dengan dukungan CUDA diperlukan untuk inference listing. |
| VRAM | Adapter pernah dievaluasi pada sekitar 7 GB VRAM. Sediakan ruang tambahan jika menjalankan service lain. |
| CPU | Server Linux x86_64 direkomendasikan untuk deployment. |
| RAM dan storage | Kebutuhan bergantung pada model, cache Hugging Face, dataset Parquet, dan jumlah request bersamaan. |
| Network | Diperlukan saat menyiapkan image Docker atau mengambil dependency. Model production sebaiknya sudah tersedia di cache sebelum service dijalankan. |

## Menjalankan dengan Docker

### Prasyarat

- Docker Engine
- Docker Compose plugin
- Driver NVIDIA yang sesuai
- NVIDIA Container Toolkit
- Artefak model dan dataset backend

Artefak backend yang harus tersedia antara lain:

~~~text
backend/dataset/market_catalog.parquet
backend/dataset/market_catalog.manifest.json
backend/dataset/market_catalog.calibration.json
backend/ai/category/model/category_heads.pt
backend/ai/category/model/openclip_vit_b32_laion2b_s34b_b79k.safetensors
backend/ai/listing/model/adapter_model.safetensors
~~~

Model dasar Qwen juga harus tersedia pada cache Hugging Face. Detail artefak lain dapat dilihat di [backend/README.md](backend/README.md) dan [backend/dataset/README.md](backend/dataset/README.md).

### Menjalankan aplikasi

Jalankan dari root project:

~~~sh
git clone <alamat-repository>
cd AIC
docker compose up -d --build
~~~

Buka halaman berikut di browser:

~~~text
http://localhost:3012
~~~

Wizard pembuatan listing tersedia di:

~~~text
http://localhost:3012/buat-listing
~~~

Periksa status dan log service:

~~~sh
docker compose ps
docker compose logs -f backend
docker compose logs -f frontend
~~~

Backend hanya tersedia di jaringan internal Docker. Frontend meneruskan request API ke backend melalui service backend pada port internal 8012.

### Konfigurasi yang sering digunakan

| Variable | Default | Fungsi |
| --- | --- | --- |
| FRONTEND_PORT | 3012 | Port frontend pada host. |
| HF_CACHE_DIR | ./.cache/huggingface | Lokasi cache model Hugging Face. |
| CORS_ALLOWED_ORIGINS | http://localhost:3012 | Daftar origin frontend yang diizinkan backend. |
| BACKEND_INTERNAL_URL | http://backend:8012 | Alamat backend dari dalam container frontend. |

Contoh:

~~~sh
FRONTEND_PORT=3012 HF_CACHE_DIR=./.cache/huggingface docker compose up -d --build
~~~

Panduan Docker yang lebih rinci tersedia di [DOCKER.md](DOCKER.md).

## Mencoba sample

Cara mencoba melalui website:

1. Buka http://localhost:3012/buat-listing.
2. Upload salah satu gambar yang ingin digenerate.
3. Isi data produk wajib dan opsional jika perlu.
4. Lanjutkan sampai halaman hasil.
5. Periksa kategori, judul, deskripsi, rincian harga, dan saran variasi.

File notes.txt berisi konteks singkat untuk setiap contoh.

## Flow website

Flow utama dibuat berurutan agar pengguna dapat memeriksa hasil di setiap tahap.

~~~text
+---------------------------+
| 1. Foto dan data produk   |
+---------------------------+
              |
+---------------------------+
| 2. Biaya dan target usaha |
+---------------------------+
              |
+---------------------------+
| 3. Kategori dan copy AI   |
+---------------------------+
              |
+---------------------------+
| 4. Bukti harga serupa     |
+---------------------------+
              |
+---------------------------+
| 5. Rekomendasi harga      |
+---------------------------+
              |
+---------------------------+
| 6. Periksa, edit, salin   |
+---------------------------+
~~~

### Penjelasan tiap tahap

| Tahap | Yang dilakukan pengguna | Yang dihasilkan sistem |
| --- | --- | --- |
| Foto dan data | Mengunggah foto serta mengisi informasi produk. | Data awal produk yang akan dianalisis. |
| Biaya dan target | Mengisi modal, biaya tambahan, dan target keuntungan. | Dasar perhitungan batas aman. |
| Kategori dan copy | Memeriksa kategori, judul, dan deskripsi. | Saran kategori, tingkat keyakinan, judul, dan deskripsi. |
| Bukti harga | Menunggu pencarian produk serupa dari katalog. | Kisaran harga, median, dan jumlah produk serupa. |
| Rekomendasi harga | Membaca alasan perhitungan dan memilih apakah akan menggunakannya. | Batas aman, harga bersaing, rekomendasi, dan harga premium. |
| Periksa, edit, salin | Mengedit hasil lalu menyalin draft. | Draft listing yang siap dipakai sebagai dasar publikasi. |

## Arsitektur singkat

~~~text
Browser pengguna
      |
      |
Next.js frontend pada port 3012
      |
      |
FastAPI backend pada jaringan Docker, port 8012
      |
      +------------------+------------------+
      |                  |                  |
  Model listing     Classifier         Katalog harga
  Qwen2.5-VL        OpenCLIP           TF-IDF Parquet
~~~

Backend menggabungkan hasil model, klasifikasi kategori, bukti harga, perhitungan biaya, tingkat keyakinan, peringatan, dan pengaman melalui orchestrator.

## API utama

| Method | Endpoint | Fungsi |
| --- | --- | --- |
| POST | /v1/listings/generate | Menerima foto dan metadata lalu mengembalikan hasil listing. |
| GET | /health/live | Memeriksa apakah proses backend masih hidup. |
| GET | /health/ready | Memeriksa apakah model, classifier, dan katalog siap menerima request. |

Untuk penggunaan langsung tanpa frontend, lihat kontrak request di [backend/schemas.py](backend/schemas.py).

## Struktur project

~~~text
AIC/
  frontend/        Aplikasi Next.js dan halaman wizard.
  backend/         API FastAPI, model, katalog, dan orchestrator.
  docker-compose.yml
  DOCKER.md
  README.md
~~~

## Testing

Frontend:

~~~sh
cd frontend
npx tsc --noEmit
npm run lint
npm test
npm run build
~~~

Backend:

~~~sh
cd backend
python -m pytest tests -q
python -m ruff check .
~~~

Backend test membutuhkan environment Python dan dependency yang sesuai. Lihat [backend/README.md](backend/README.md) untuk pembagian dependency development dan inference.

## Troubleshooting

### Backend unhealthy

Periksa log backend:

~~~sh
docker compose logs --tail=200 backend
~~~

Penyebab umum:

- artefak model belum tersedia;
- dataset katalog atau file calibration tidak cocok;
- cache model belum tersedia;
- driver NVIDIA atau NVIDIA Container Toolkit belum siap;
- VRAM tidak cukup untuk memuat model.

### Frontend tidak dapat terhubung ke backend

Pastikan backend sudah healthy sebelum frontend digunakan:

~~~sh
docker compose ps
docker compose exec backend python3 -c "import urllib.request; print(urllib.request.urlopen('http://127.0.0.1:8012/health/ready').read().decode())"
~~~

Periksa juga BACKEND_INTERNAL_URL dan pastikan frontend dijalankan melalui Docker Compose jika alamatnya memakai http://backend:8012.

### Build terasa lambat

Docker akan memakai cache untuk layer yang tidak berubah. Cache model Hugging Face juga disimpan di HF_CACHE_DIR agar tidak perlu disiapkan ulang setiap kali container dibuat.

## Catatan dan batasan

- Rekomendasi harga adalah acuan, bukan jaminan harga jual atau keuntungan.
- Kualitas hasil bergantung pada foto, data produk, biaya yang dimasukkan, kualitas katalog, dan kesegaran data pasar.
- Model listing membutuhkan GPU NVIDIA dengan CUDA pada konfigurasi production saat ini.
- Katalog harga harus memiliki provenance dan izin penggunaan yang sesuai.
- Data deployment seperti Parquet katalog dan model berukuran besar tidak seharusnya dimasukkan ke commit biasa.
- Informasi yang dihasilkan tetap perlu diperiksa pemilik usaha sebelum dipublikasikan.

## Made by - Saya Suka TIna
| No  | Nama | 
| --- | --- | 
| 1 |  Henry Alifian|
| 2 |  Junathan Richie|
| 3 | Kayla Riza Putri |
| 4 |  Steven Alvin Christian| 
| 5 |  Syahri Banun| 

## Dokumentasi lanjutan

- [Panduan Docker](DOCKER.md)
- [Panduan frontend](frontend/README.md)
- [Panduan backend](backend/README.md)
- [Dokumentasi katalog harga](backend/dataset/README.md)
