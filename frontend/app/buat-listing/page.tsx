import Link from "next/link";
import Image from "next/image";
import { ArrowLeft } from "lucide-react";

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
            className="flex min-h-11 items-center rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand"
          >
            <Image
              src="/images/Logo_LAPAKIN.png"
              alt="LAPAKIN"
              width={412}
              height={374}
              className="h-12 w-auto object-contain"
            />
          </Link>
        </header>
        <ListingWizard />
      </div>
    </main>
  );
}
