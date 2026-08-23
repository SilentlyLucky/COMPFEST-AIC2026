import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Check, ShieldCheck, ShoppingBag } from "lucide-react";

import { ListingWizard } from "@/components/listing/ListingWizard";

export const metadata = {
  title: "Buat listing | LAPAKIN",
  description: "Ubah foto dan fakta produk menjadi listing UMKM yang siap diperiksa.",
};

export default function CreateListingPage() {
  return (
    <main className="min-h-screen bg-canvas px-4 pb-24 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex min-h-20 items-center justify-between gap-4 border-b border-line/70 py-4 sm:min-h-24 sm:py-5">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl px-1 font-medium text-ink transition-colors hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand"
          >
            <ArrowLeft className="size-5" aria-hidden="true" />
            Kembali
          </Link>
          <Link
            href="/"
            className="flex min-h-11 items-center gap-3 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand"
          >
            <span className="grid size-10 place-items-center rounded-xl bg-brand text-white shadow-[0_8px_24px_rgba(47,111,87,0.24)]">
              <ShoppingBag className="size-5" aria-hidden="true" />
            </span>
            <span className="font-semibold tracking-[-0.035em] text-ink">LAPAKIN</span>
          </Link>
        </header>
        <section
          aria-labelledby="privacy-heading"
          className="relative mb-10 overflow-hidden rounded-[28px] border border-brand/24 bg-brand-soft/40 px-5 py-6 shadow-[0_20px_56px_rgba(16,37,28,0.08)] sm:px-8 sm:py-8 lg:min-h-60 lg:px-10 lg:py-9"
        >
          <div className="relative z-10 max-w-4xl lg:pr-72">
            <div className="flex items-start gap-4">
              <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-surface text-brand shadow-[0_8px_28px_rgba(16,37,28,0.10)]">
                <ShieldCheck className="size-6" aria-hidden="true" />
              </span>
              <div>
                <h2 id="privacy-heading" className="text-xl font-semibold tracking-[-0.03em] text-ink sm:text-2xl">
                  Ketahui dulu sebelum mengunggah
                </h2>
              </div>
            </div>
            <ul className="mt-6 grid gap-3 text-sm leading-6 text-ink sm:text-base lg:max-w-3xl">
              <li className="flex items-start gap-3">
                <span className="mt-1 grid size-5 shrink-0 place-items-center rounded-full bg-brand text-white">
                  <Check className="size-3" aria-hidden="true" />
                </span>
                Foto dan fakta produk digunakan untuk menyusun draf listing, kategori, dan estimasi harga.
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1 grid size-5 shrink-0 place-items-center rounded-full bg-brand text-white">
                  <Check className="size-3" aria-hidden="true" />
                </span>
                Foto ini tidak digunakan untuk melatih model tanpa persetujuan terpisah; alur ini tidak meminta persetujuan pelatihan.
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1 grid size-5 shrink-0 place-items-center rounded-full bg-brand text-white">
                  <Check className="size-3" aria-hidden="true" />
                </span>
                Kamu tetap bertanggung jawab memeriksa klaim, harga, dan kepatuhan sebelum menerbitkan listing.
              </li>
            </ul>
          </div>
          <div className="pointer-events-none absolute -bottom-16 right-2 hidden size-80 lg:block" aria-hidden="true">
            <Image
              src="/images/lapakin-copy-result.png"
              alt=""
              fill
              sizes="320px"
              className="object-contain"
            />
          </div>
        </section>
        <ListingWizard />
      </div>
    </main>
  );
}
