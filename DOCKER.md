# Menjalankan LAPAKIN dengan Docker

Prasyarat:

- Docker Engine dan Docker Compose plugin
- NVIDIA Container Toolkit dan driver NVIDIA untuk inference model
- Artefak model dan dataset backend sudah tersedia di folder `backend`

Jalankan dari root project:

```sh
docker compose build
docker compose up -d
```

Frontend tersedia di `http://localhost:3012`. Backend tidak dipublish ke host;
frontend meneruskan request `/v1/*` ke service `backend` melalui network Compose.

Periksa status dan log:

```sh
docker compose ps
docker compose logs -f backend
docker compose logs -f frontend
```

Untuk frontend dengan domain production, set origin CORS sebelum menjalankan:

```sh
export CORS_ALLOWED_ORIGINS="https://app.example.com"
docker compose up -d --build
```

`backend` memakai folder host `./backend` sebagai volume agar model, dataset,
dan perubahan kode tidak perlu disalin ke image. Cache Hugging Face memakai
`./.cache/huggingface` secara default dan dapat diganti dengan `HF_CACHE_DIR`.

