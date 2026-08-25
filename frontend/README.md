# LAPAKIN Frontend

Frontend Next.js untuk membuat listing UMKM dari foto, fakta produk, dan komponen biaya.

## Menjalankan lokal

Backend FastAPI perlu berjalan di `http://127.0.0.1:8012`. Secara default browser memanggil
`/v1/*` pada origin frontend yang sama dan Next.js meneruskannya ke backend tersebut, sehingga
deployment tidak memerlukan `NEXT_PUBLIC_API_BASE_URL` atau konfigurasi CORS tambahan.

Jika backend berada di host atau port internal lain, set `BACKEND_INTERNAL_URL` pada environment
proses Next.js (contoh: `http://127.0.0.1:8001`). Untuk deployment dengan API pada origin publik
terpisah, buat `frontend/.env.local`:

```dotenv
NEXT_PUBLIC_API_BASE_URL=http://localhost:8012
```

Jalankan frontend dari folder ini:

```bash
npm run dev
```

Buka `http://localhost:3012`. Landing tersedia di `/` dan wizard di `/buat-listing`.

## Verifikasi

```bash
npx tsc --noEmit
npx eslint .
npx next build
```

Client mengirim `multipart/form-data` langsung ke `POST /v1/listings/generate`. Field
`metadata` dikirim sebagai JSON dan browser menentukan boundary multipart secara otomatis.
