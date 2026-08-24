import Link from "next/link";
import { ArrowRight, Check, Copy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { LandingMotion } from "./LandingMotion";
import { LandingNavigation } from "./LandingNavigation";
import { PriceTape } from "./PriceTape";

function HeroArtifact() {
  return (
    <div aria-hidden="true" className="mx-auto w-full max-w-[520px] text-brand">
      <svg
        className="h-auto w-full overflow-visible"
        viewBox="0 0 520 510"
        fill="none"
      >
        <path
          data-draw-line
          d="M58 102C150 102 137 206 242 206C337 206 333 345 458 345"
          pathLength="1"
          stroke="currentColor"
          strokeDasharray="1"
          strokeWidth="3"
        />
        <path
          d="M242 206V382"
          stroke="currentColor"
          strokeOpacity=".24"
          strokeWidth="2"
        />
        <rect
          x="30"
          y="54"
          width="112"
          height="144"
          rx="20"
          fill="currentColor"
          fillOpacity=".08"
          stroke="currentColor"
          strokeOpacity=".34"
          strokeWidth="2"
        />
        <rect
          x="49"
          y="75"
          width="74"
          height="83"
          rx="12"
          fill="currentColor"
          fillOpacity=".12"
        />
        <path
          d="M57 142L75 118L89 132L101 119L117 142"
          stroke="currentColor"
          strokeOpacity=".65"
          strokeWidth="2"
        />
        <path
          d="M72 120C72 103 82 94 96 94C110 94 119 103 119 120V144H72V120Z"
          fill="currentColor"
          fillOpacity=".22"
        />
        <circle cx="242" cy="206" r="18" fill="#F99404" />
        <circle data-marker-travel cx="242" cy="206" r="7" fill="#00295D" />
        <g stroke="currentColor" strokeWidth="2">
          <circle cx="333" cy="286" r="38" fill="white" />
          <path d="M313 286H353M333 266V306" strokeLinecap="round" />
          <circle cx="383" cy="345" r="8" fill="currentColor" />
          <circle cx="458" cy="345" r="12" fill="#F99404" />
        </g>
        <path d="M306 430H436V465H306z" fill="#00295D" />
        <path
          d="M327 449H397"
          stroke="white"
          strokeOpacity=".7"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          d="M414 449L421 456L435 440"
          stroke="#F99404"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="58" cy="102" r="8" fill="#00295D" />
        <circle cx="458" cy="345" r="25" fill="#F99404" fillOpacity=".14" />
      </svg>
    </div>
  );
}

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
        d="M-40 208C190 208 174 64 398 64C598 64 615 180 940 180"
        pathLength="1"
        stroke="currentColor"
        strokeDasharray="1"
        strokeOpacity=".35"
        strokeWidth="2"
      />
      <circle cx="200" cy="138" r="5" fill="#F99404" />
      <circle cx="398" cy="64" r="7" fill="currentColor" />
      <circle cx="630" cy="154" r="5" fill="#F99404" />
    </svg>
  );
}

function PhotoArtifact() {
  return (
    <svg
      aria-hidden="true"
      className="h-auto w-full max-w-[420px] text-brand"
      viewBox="0 0 420 270"
      fill="none"
    >
      <rect
        x="28"
        y="34"
        width="140"
        height="188"
        rx="22"
        fill="currentColor"
        fillOpacity=".08"
        stroke="currentColor"
        strokeOpacity=".3"
        strokeWidth="2"
      />
      <path
        d="M52 179L83 139L108 162L128 143L151 179"
        stroke="currentColor"
        strokeOpacity=".55"
        strokeWidth="2"
      />
      <path
        d="M73 143C73 117 87 103 108 103C129 103 143 117 143 143V181H73V143Z"
        fill="currentColor"
        fillOpacity=".18"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        data-draw-line
        d="M169 129C226 129 210 65 274 65C328 65 309 188 386 188"
        pathLength="1"
        stroke="currentColor"
        strokeDasharray="1"
        strokeWidth="2"
      />
      <circle cx="274" cy="65" r="7" fill="#F99404" />
      <circle cx="330" cy="139" r="7" fill="currentColor" />
      <circle cx="386" cy="188" r="7" fill="#F99404" />
    </svg>
  );
}

function ConfidenceArtifact() {
  return (
    <svg
      aria-hidden="true"
      className="h-auto w-full max-w-[360px] text-brand"
      viewBox="0 0 360 260"
      fill="none"
    >
      <path
        data-draw-line
        d="M32 54L180 135L328 54M52 213L180 135L308 213"
        pathLength="1"
        stroke="currentColor"
        strokeDasharray="1"
        strokeOpacity=".42"
        strokeWidth="2"
      />
      <circle cx="32" cy="54" r="7" fill="currentColor" />
      <circle cx="328" cy="54" r="7" fill="#F99404" />
      <circle cx="52" cy="213" r="7" fill="#F99404" />
      <circle cx="308" cy="213" r="7" fill="currentColor" />
      <path
        d="M180 77L223 94V132C223 163 203 189 180 202C157 189 137 163 137 132V94L180 77Z"
        fill="#F7F9FC"
        stroke="currentColor"
        strokeWidth="3"
      />
      <path
        d="M160 136L174 150L202 119"
        stroke="#00295D"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ListingArtifact() {
  return (
    <div
      aria-hidden="true"
      className="mx-auto w-full max-w-[430px] border border-line bg-soft-canvas p-6"
    >
      <div className="flex items-start gap-5">
        <svg
          className="h-28 w-24 shrink-0 text-brand"
          viewBox="0 0 96 112"
          fill="none"
        >
          <rect width="96" height="112" fill="currentColor" fillOpacity=".18" />
          <path
            d="M14 88L34 61L49 76L64 60L84 88"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path
            d="M28 63C28 46 36 37 48 37C60 37 68 46 68 63V91H28V63Z"
            fill="currentColor"
            fillOpacity=".3"
          />
        </svg>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between text-xs text-ink-muted">
            <span>Draft listing</span>
            <Copy className="size-4 text-brand" />
          </div>
          <div className="mt-5 h-3 w-full bg-ink/70" />
          <div className="mt-3 h-2 w-4/5 bg-ink/20" />
          <div className="mt-7 flex items-center justify-between">
            <span className="inline-flex items-baseline gap-2">
              <span className="font-mono text-xl text-ink">Rp62.000</span>
              <span className="text-xs font-semibold text-ink-muted">Contoh</span>
            </span>
            <Check className="size-5 text-brand" />
          </div>
        </div>
      </div>
      <div className="mt-6 border-t border-line pt-4 text-sm text-ink-muted">
        Siap diedit dan disalin
      </div>
    </div>
  );
}

const FEATURES = [
  {
    id: "foto",
    title: "Foto membuka konteks. Fakta menjaga hasil tetap jujur.",
    body: "Masukkan foto bersama detail yang benar-benar kamu tahu. LAPAKIN merangkainya tanpa menambah klaim.",
    visual: <PhotoArtifact />,
  },
  {
    id: "harga",
    title: "Harga pasar terlihat, batas biaya tetap terjaga.",
    body: "Lihat rentang pasar dan rekomendasi tanpa melepas kendali atas biaya yang kamu masukkan.",
    visual: <PriceTape />,
  },
  {
    id: "keyakinan",
    title: "Bukti yang kurang tidak disembunyikan.",
    body: "Ketika data belum cukup kuat, hasil memberi ruang untuk memeriksa lagi, bukan memaksakan kepastian.",
    visual: <ConfidenceArtifact />,
  },
  {
    id: "listing",
    title: "Satu hasil yang siap kamu miliki.",
    body: "Tinjau, edit seperlunya, lalu salin bagian yang dibutuhkan ke kanal jualmu.",
    visual: <ListingArtifact />,
  },
] as const;

export function LandingPage() {
  return (
    <LandingMotion>
      <LandingNavigation />
      <main>
        <section className="overflow-hidden bg-canvas px-5 pb-20 pt-28 sm:px-6 md:pb-32 md:pt-32">
          <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-12 lg:gap-8">
            <div className="lg:col-span-7">
              <p className="text-sm font-semibold tracking-[.08em] text-ink">
                ASISTEN LISTING UNTUK UMKM
              </p>
              <h1 className="mt-6 max-w-4xl text-balance text-[clamp(2.5rem,12vw,3.25rem)] font-semibold leading-[.99] tracking-[-.045em] text-ink sm:text-[clamp(3.25rem,5.5vw,6rem)]">
                <span className="sm:hidden">
                  Dari foto, jadi listing siap jual.
                </span>
                <span className="hidden sm:inline">
                  Dari foto produk, jadi listing yang siap kamu jual.
                </span>
              </h1>
              <p className="mt-8 max-w-2xl text-lg leading-8 text-ink-muted">
                Bikin listing jadi lebih cepat. LAPAKIN membantu menyusun judul, deskripsi, kategori, hingga rekomendasi harga dari informasi produkmu.
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
            <div className="lg:col-span-5">
              <HeroArtifact />
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
          className="bg-canvas px-5 py-20 sm:px-6 md:py-36"
        >
          <div className="mx-auto max-w-7xl">
            <div className="max-w-3xl">
              <p className="text-sm font-semibold tracking-[.08em] text-link">
                CARA KERJA
              </p>
              <h2 className="mt-5 text-balance text-[clamp(2.25rem,4vw,3.75rem)] font-semibold leading-[1.04] tracking-[-.04em] text-ink">
                Satu alur yang mengikuti cara kamu menyiapkan lapak.
              </h2>
            </div>
            <div className="mt-20 space-y-24 md:space-y-32">
              {FEATURES.map((feature, index) => (
                <article
                  key={feature.id}
                  data-stack-card
                  className="landing-feature grid items-center gap-10 border-t border-line pt-10 lg:grid-cols-12 lg:gap-16 lg:pt-14"
                >
                  <div
                    className={`lg:col-span-5 ${index % 2 ? "lg:order-2 lg:col-start-8" : ""}`}
                  >
                    <h3 className="text-[clamp(1.5rem,2.2vw,2.25rem)] font-semibold leading-[1.12] tracking-[-.035em] text-ink">
                      {feature.title}
                    </h3>
                    <p className="mt-5 max-w-xl text-lg leading-8 text-ink-muted">
                      {feature.body}
                    </p>
                  </div>
                  <div
                    className={`flex min-h-64 items-center justify-center ${index % 2 ? "lg:order-1 lg:col-span-7" : "lg:col-span-7"}`}
                  >
                    {feature.visual}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
        <section
          id="harga"
          className="bg-soft-canvas px-5 py-20 sm:px-6 md:py-36"
        >
          <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-12 lg:items-center">
            <div className="lg:col-span-5">
              <p className="text-sm font-semibold tracking-[.08em] text-ink">
                DASAR YANG JELAS
              </p>
              <h2
                data-price-reveal
                className="mt-5 text-balance text-[clamp(2.25rem,4vw,3.75rem)] font-semibold leading-[1.04] tracking-[-.04em] text-ink"
              >
                Biaya adalah batas. Bukti pasar memberi arah.
              </h2>
              <p
                data-price-reveal
                className="mt-6 max-w-xl text-lg leading-8 text-ink-muted"
              >
                Keduanya dibaca sebagai hal yang berbeda, supaya rekomendasi
                harga tetap bisa kamu pertanggungjawabkan.
              </p>
            </div>
            <div className="lg:col-span-7 lg:pl-12">
              <PriceTape />
            </div>
          </div>
        </section>
        <section id="hasil" className="bg-canvas px-5 py-20 sm:px-6 md:py-36">
          <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-12 lg:items-center">
            <div className="lg:col-span-5">
              <p className="text-sm font-semibold tracking-[.08em] text-link">
                HASIL AKHIR
              </p>
              <h2 className="mt-5 text-balance text-[clamp(2.25rem,4vw,3.75rem)] font-semibold leading-[1.04] tracking-[-.04em] text-ink">
                Bentuk hasil yang bisa kamu edit dan pakai.
              </h2>
              <p className="mt-6 max-w-xl text-lg leading-8 text-ink-muted">
                Satu listing yang menyatukan judul, deskripsi, kategori, dan
                harga untuk kamu tinjau sebelum disalin.
              </p>
            </div>
            <div className="lg:col-span-7 lg:pl-12">
              <div className="border border-line bg-soft-canvas p-5 sm:p-8">
                <div className="flex items-center justify-between border-b border-line pb-5 text-sm font-medium text-ink">
                  <span>Listing siap ditinjau</span>
                  <span className="inline-flex items-center gap-2 text-ink">
                    <Check className="size-4" aria-hidden="true" /> Dapat diedit
                  </span>
                </div>
                <label htmlFor="listing-output" className="sr-only">
                  Hasil listing yang dapat diedit dan disalin
                </label>
                <textarea
                  id="listing-output"
                  defaultValue={
                    "Tas selempang kulit untuk aktivitas harian\n\nTas kulit dengan ruang praktis untuk kebutuhan harian. Cocok untuk dibawa bekerja atau bepergian."
                  }
                  className="mt-10 min-h-44 w-full resize-y border-0 bg-transparent p-0 text-lg leading-8 font-medium tracking-[-.02em] text-ink outline-none focus-visible:ring-2 focus-visible:ring-link focus-visible:ring-offset-4"
                />
                <div className="mt-10 flex items-center justify-between border-t border-line pt-5">
                  <span className="inline-flex items-baseline gap-2">
                    <span className="font-mono text-xl text-ink">Rp62.000</span>
                    <span className="text-xs font-semibold text-ink-muted">
                      Contoh
                    </span>
                  </span>
                  <span className="inline-flex min-h-11 items-center gap-2 text-ink">
                    <Copy className="size-4" aria-hidden="true" /> Pilih lalu
                    salin
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>
        <section className="bg-ink px-5 py-20 text-white sm:px-6 md:py-32">
          <div className="mx-auto max-w-7xl">
            <h2 className="max-w-4xl text-balance text-[clamp(2.5rem,5vw,5.5rem)] font-semibold leading-[1] tracking-[-.045em]">
              Produkmu sudah punya cerita. Sekarang lapakkan dengan lebih yakin.
            </h2>
            <p className="mt-7 max-w-2xl text-lg leading-8 text-white/72">
              Mulai dari satu foto dan fakta yang kamu pegang.
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
          <p>LAPAKIN membantu UMKM menyiapkan listing yang dapat diperiksa.</p>
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
