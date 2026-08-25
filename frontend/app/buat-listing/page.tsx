import Link from "next/link";
import { ArrowLeft, ShieldCheck, ShoppingBag } from "lucide-react";

import { ListingWizard } from "@/components/listing/ListingWizard";

export const metadata = {
  title: "Buat listing | LAPAKIN",
  description:
    "Ubah foto dan fakta produk menjadi listing UMKM yang siap diperiksa.",
};

export default function CreateListingPage() {
  return (
    <main className="min-h-screen bg-[#F6F9FC] px-5 pb-28 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-[1200px]">
        <header className="flex min-h-16 items-center justify-between gap-4 border-b border-line/70 py-3">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl px-1 font-medium text-ink transition-colors hover:text-link focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand"
          >
            <ArrowLeft className="size-5" aria-hidden="true" />
            Kembali
          </Link>
          <Link
            href="/"
            className="flex min-h-11 items-center gap-3 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand"
          >
            <span className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground">
              <ShoppingBag className="size-5" aria-hidden="true" />
            </span>
            <span className="font-semibold tracking-[-0.035em] text-ink">
              LAPAKIN
            </span>
          </Link>
        </header>
        <section
          aria-labelledby="privacy-heading"
          className="my-4 border-b border-line/70 py-2 sm:my-5 sm:py-3"
        >
          <div className="flex min-h-11 items-center gap-3">
            <ShieldCheck
              className="size-5 shrink-0 text-brand"
              aria-hidden="true"
            />
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3">
              <h2
                id="privacy-heading"
                className="text-sm font-semibold leading-6 text-ink sm:text-base"
              >
                Fotomu hanya digunakan untuk membantu membuat listing ini.
              </h2>
              <details className="text-sm leading-6 text-ink-muted">
                <summary className="inline-flex min-h-11 cursor-pointer items-center font-medium text-link focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand">
                  Cara data digunakan
                </summary>
                <ul className="mt-3 grid list-disc gap-2 pl-5">
                  <li>
                    Foto dan informasi produk membantu menyusun listing, kategori,
                    dan rekomendasi harga.
                  </li>
                  <li>
                    Foto tidak digunakan untuk pelatihan tanpa opt-in terpisah.
                  </li>
                  <li>
                    Kamu tetap memeriksa hasil sebelum menerbitkan listing.
                  </li>
                </ul>
              </details>
            </div>
          </div>
        </section>
        <ListingWizard />
      </div>
    </main>
  );
}
