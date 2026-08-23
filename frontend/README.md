# LAPAKIN Frontend

Frontend Next.js untuk membuat listing UMKM dari foto, fakta produk, dan komponen biaya.

## Menjalankan lokal

Backend FastAPI perlu berjalan di `http://localhost:8000`. Jika alamatnya berbeda, buat
`frontend/.env.local`:

```dotenv
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

Jalankan frontend dari folder ini:

```bash
npx next dev
```

Buka `http://localhost:3000`. Landing tersedia di `/` dan wizard di `/buat-listing`.

## Verifikasi

```bash
npx tsc --noEmit
npx eslint .
npx next build
```

Client mengirim `multipart/form-data` langsung ke `POST /v1/listings/generate`. Field
`metadata` dikirim sebagai JSON dan browser menentukan boundary multipart secara otomatis.
