import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { LandingMotion } from "./LandingMotion";
import { LandingNavigation } from "./LandingNavigation";

function ProblemGeometry() {
  return (
    <svg
      aria-hidden="true"
      className="absolute inset-0 h-full w-full text-brand"
      viewBox="0 0 900 260"
      fill="none"
      preserveAspectRatio="none"
    >
      <path
        data-draw-line
        data-problem-path
        d="M-40 208C190 208 174 64 398 64C598 64 615 180 940 180"
        pathLength="1"
        stroke="currentColor"
        strokeDasharray="1"
        strokeOpacity=".35"
        strokeWidth="2"
      />
      <circle cx="200" cy="138" r="5" fill="#F99404" />
      <circle
        data-problem-marker
        cx="398"
        cy="64"
        r="7"
        fill="currentColor"
      />
      <circle cx="630" cy="154" r="5" fill="#F99404" />
    </svg>
  );
}

const PROCESS_STEPS = [
  {
    id: "pipeline",
    eyebrow: "Pipeline",
    title: "Satu alur yang menyiapkan lapakmu.",
    body: "LAPAKIN mengubah foto dan data produk menjadi hasil listing yang menarik.",
    asset: "/assets/lapakin/process/01-full-pipeline.svg",
    alt: "Alur LAPAKIN dari foto dan fakta produk hingga draft listing.",
    width: 1180,
    height: 640,
    desktopImageClass: "xl:w-[105%] xl:-translate-x-[5%]",
    details: [],
  },
  {
    id: "models",
    eyebrow: "AI Model",
    title: "Di balik layar, tiga model bekerja bersama.",
    body: "Qwen menyusun judul dan deskripsi, OpenCLIP membantu menentukan kategori produk, sementara TF-IDF mencocokkan produk dengan referensi harga pasar.",
    asset: "/assets/lapakin/process/03-ai-models.svg",
    alt: "Tiga model AI LAPAKIN untuk judul dan deskripsi, produk pembanding, serta harga pasar.",
    width: 1280,
    height: 720,
    desktopImageClass: "xl:w-full",
    details: [
      "Qwen2.5-VL-3B-Instruct + LoRA untuk judul dan deskripsi.",
      "OpenCLIP ViT-B-32 + LAION2B untuk kandidat produk pembanding.",
      "TF-IDF Catalog untuk harga pasar dan pembanding.",
    ],
  },
  {
    id: "output",
    eyebrow: "Hasil Akhir",
    title: "Satu hasil yang siap kamu cek dan pakai.",
    body: "Kamu akan menerima draft listing yang berisi judul, kategori, deskripsi, rekomendasi harga, dan tingkat keyakinan prediksi.",
    asset: "/assets/lapakin/process/04-output.svg",
    alt: "Draft listing berisi judul, kategori, deskripsi, rekomendasi harga, dan tingkat keyakinan prediksi.",
    width: 950,
    height: 540,
    desktopImageClass: "xl:w-full",
    details: [],
  },
] as const;

export function LandingPage() {
  return (
    <LandingMotion>
      <LandingNavigation />
      <main>
        <section className="overflow-hidden bg-canvas px-5 pb-20 pt-28 sm:px-6 md:pb-32 md:pt-32">
          <div className="mx-auto grid max-w-7xl items-center gap-12 xl:grid-cols-[1.05fr_0.95fr] xl:gap-6">
            <div className="min-w-0">
              <p className="text-sm font-semibold tracking-[.08em] text-ink">
                ASISTEN LISTING UNTUK UMKM
              </p>
              <h1 className="mt-6 max-w-4xl text-[clamp(2.5rem,12vw,3.25rem)] font-semibold leading-[.99] tracking-[-.045em] text-ink sm:text-[clamp(3.25rem,5.5vw,6rem)] xl:text-[clamp(3rem,3.5vw,3.25rem)]">
                <span className="block xl:whitespace-nowrap">Dari foto produk,</span>
                <span className="block xl:whitespace-nowrap">jadi listing yang siap dipakai.</span>
              </h1>
              <p className="mt-8 max-w-2xl text-lg leading-8 text-ink-muted">
                LAPAKIN membantu menyusun judul, deskripsi, kategori, hingga rekomendasi harga dari informasi produkmu.
              </p>
              <div className="mt-10 flex flex-col items-stretch gap-4 sm:flex-row sm:items-center">
                <Button
                  render={<Link href="/buat-listing" />}
                  nativeButton={false}
                  size="lg"
                  className="sm:w-auto"
                >
                  Buat listing <ArrowRight aria-hidden="true" />
                </Button>
                <a
                  href="#cara-kerja"
                  className="inline-flex min-h-11 items-center justify-center px-2 font-medium text-link underline decoration-link/35 decoration-2 underline-offset-8 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-link"
                >
                  Lihat cara kerja
                </a>
              </div>
            </div>
            <div className="min-w-0 xl:-translate-y-6">
              <figure className="w-full">
                <img
                  src="/assets/lapakin/hero/lapakin-hero-ai.svg"
                  alt="Alur LAPAKIN dari foto produk, melalui AI, menjadi listing siap ditinjau."
                  width={1160}
                  height={650}
                  loading="eager"
                  fetchPriority="high"
                  decoding="async"
                  className="h-auto w-full xl:w-[105%] xl:max-w-[820px] xl:-translate-x-[4%]"
                />
              </figure>
            </div>
          </div>
        </section>
        <section
          id="masalah"
          className="relative overflow-hidden bg-soft-canvas px-5 py-20 sm:px-6 md:py-32"
        >
          <ProblemGeometry />
          <div className="relative mx-auto max-w-7xl">
            <div className="max-w-3xl">
              <p className="text-sm font-semibold tracking-[.08em] text-ink">
                YANG SERING MEMPERLAMBAT
              </p>
              <h2 className="mt-5 text-balance text-[clamp(2.25rem,4vw,3.75rem)] font-semibold leading-[1.04] tracking-[-.04em] text-ink">
                Menjual seharusnya tidak dimulai dari menebak.
              </h2>
            </div>
            <ul className="mt-16 grid gap-10 md:grid-cols-3">
              <li className="border-t border-line pt-5">
                <h3 className="text-xl font-semibold text-ink">
                  Foto belum menjadi kata
                </h3>
                <p className="mt-3 leading-7 text-ink-muted">
                  Detail produk masih tersebar di kepala, chat, dan catatan.
                </p>
              </li>
              <li className="border-t border-line pt-5">
                <h3 className="text-xl font-semibold text-ink">
                  Harga terasa spekulatif
                </h3>
                <p className="mt-3 leading-7 text-ink-muted">
                  Pasar perlu dibaca tanpa mengabaikan biaya sendiri.
                </p>
              </li>
              <li className="border-t border-line pt-5">
                <h3 className="text-xl font-semibold text-ink">
                  Hasil sulit ditinjau
                </h3>
                <p className="mt-3 leading-7 text-ink-muted">
                  Copy perlu bisa dicek dan disesuaikan sebelum dipasang.
                </p>
              </li>
            </ul>
          </div>
        </section>
        <section
          id="cara-kerja"
          className="bg-canvas px-5 py-12 sm:px-6 md:py-20"
        >
          <div className="mx-auto max-w-7xl">
            <div className="max-w-3xl">
              <p className="text-sm font-semibold tracking-[.08em] text-link">
                CARA KERJA
              </p>
              <h2 className="mt-5 whitespace-nowrap text-[clamp(2rem,4vw,4rem)] font-semibold leading-[1.04] tracking-[-.04em] text-ink">
                Cara LAPAKIN menyusun listingmu
              </h2>
            </div>
            <div className="mt-4 space-y-24 md:mt-8 md:space-y-32">
              {PROCESS_STEPS.map((step, index) => (
                <article
                  key={step.id}
                  id={step.id === "output" ? "hasil" : undefined}
                  data-stack-card
                  className="landing-feature relative z-10 grid min-w-0 items-center gap-10 bg-canvas border-t border-line pt-10 xl:grid-cols-12 xl:gap-16 xl:pt-14"
                >
                  <div
                    className={`xl:col-span-4 ${index % 2 ? "xl:order-2 xl:col-start-9" : ""}`}
                    data-process-copy
                  >
                    <p className="text-sm font-semibold tracking-[.08em] text-link">
                      {step.eyebrow}
                    </p>
                    <h3 className="mt-5 text-[clamp(1.5rem,2.2vw,2.25rem)] font-semibold leading-[1.12] tracking-[-.035em] text-ink">
                      {step.title}
                    </h3>
                    <p className="mt-5 max-w-xl text-lg leading-8 text-ink-muted">
                      {step.body}
                    </p>
                    {step.details.length > 0 && (
                      <ul className="sr-only">
                        {step.details.map((detail) => (
                          <li key={detail}>{detail}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div
                    data-process-image
                    data-model-process-image={step.id === "models" ? true : undefined}
                    className={`flex min-w-0 items-center justify-center ${step.id === "models" ? "xl:min-h-[400px]" : "xl:min-h-80"} ${index % 2 ? "xl:order-1 xl:col-span-8" : "xl:col-span-8"}`}
                  >
                    <figure className="w-full">
                      <img
                        src={step.asset}
                        alt={step.alt}
                        width={step.width}
                        height={step.height}
                        loading="lazy"
                        decoding="async"
                        className={`h-auto w-full ${step.id === "models" ? "max-w-none" : "mx-auto max-w-5xl"} ${step.desktopImageClass}`}
                      />
                    </figure>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
        <section className="bg-ink px-5 py-20 text-white sm:px-6 md:py-32">
          <div className="mx-auto max-w-7xl">
              <h2 className="max-w-7xl text-balance text-[clamp(2.5rem,5vw,5.5rem)] font-semibold leading-[1] tracking-[-.045em]">
                Produknya sudah siap, Listingnya Belum?
            </h2>
            <p className="mt-7 max-w-2xl text-lg leading-8 text-white/72">
              Mulai dari satu foto dan beberapa informasi produk. Sisanya kami bantu susun.
            </p>
            <Button
              render={<Link href="/buat-listing" />}
              nativeButton={false}
              size="lg"
              className="mt-10 bg-white text-ink hover:bg-white/90 hover:text-ink"
            >
              Buat listing <ArrowRight aria-hidden="true" />
            </Button>
          </div>
        </section>
      </main>
      <footer className="border-t border-white/15 bg-ink px-5 py-10 text-sm text-white/65 sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p>LAPAKIN membantu UMKM menyiapkan listing dalam seketika.</p>
          <Link
            className="min-h-11 content-center text-white hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand"
            href="/buat-listing"
          >
            Buat listing
          </Link>
        </div>
      </footer>
    </LandingMotion>
  );
}
