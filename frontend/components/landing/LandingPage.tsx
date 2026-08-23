import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";
import { ArrowRight, Check, Copy, ImageUp, ReceiptText, ShieldCheck, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { LandingMotion } from "./LandingMotion";
import { PriceTape } from "./PriceTape";

const RESULT_DECISIONS = [
  {
    visual: "copy",
    label: "Judul & deskripsi",
    title: "Copy yang siap kamu sesuaikan.",
    description: "Judul dan deskripsi disusun dari foto dan fakta produk.",
    proof: "Bisa diedit sebelum disalin.",
  },
  {
    visual: "category",
    label: "Kategori",
    title: "Kategori yang bisa kamu periksa.",
    description: "Saran kategori mengikuti jenis produk dan konteks yang kamu berikan.",
    proof: "Confidence tetap terlihat.",
  },
  {
    visual: "price",
    label: "Harga",
    title: "Harga punya rentang dan batas.",
    description: "Rentang pasar dibandingkan dengan biaya yang kamu masukkan.",
    proof: "Data kurang? Harga tidak dipaksakan.",
  },
] as const;

type DecisionVisualKind = (typeof RESULT_DECISIONS)[number]["visual"];

function DecisionVisual({ kind }: { kind: DecisionVisualKind }) {
  return (
    <div aria-hidden="true" className="relative mt-4 h-56 sm:h-64 lg:h-56 xl:h-64">
      {kind === "copy" && (
        <div className="absolute inset-x-2 top-4 rounded-2xl border border-line bg-canvas p-4 shadow-[0_16px_32px_rgba(16,37,28,0.10)]">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-medium text-ink-muted">Judul listing</span>
            <span className="rounded-md bg-brand-soft px-2 py-1 font-mono text-[10px] text-brand">bisa diedit</span>
          </div>
          <p className="mt-4 max-w-[15rem] text-lg font-semibold leading-6 tracking-[-0.03em] text-ink">
            Tas selempang kulit untuk aktivitas harian
          </p>
          <div className="mt-5 space-y-2">
            <div className="h-2 w-[88%] rounded-full bg-ink/12" />
            <div className="h-2 w-[72%] rounded-full bg-ink/12" />
            <div className="h-2 w-[54%] rounded-full bg-brand/35" />
          </div>
        </div>
      )}
      {kind === "category" && (
        <div className="absolute inset-x-2 top-3 rounded-2xl border border-brand/30 bg-brand-soft/70 p-4 shadow-[0_16px_32px_rgba(16,37,28,0.10)]">
          <p className="text-xs font-medium text-ink-muted">Kategori yang disarankan</p>
          <div className="mt-5 flex items-center justify-between gap-3 rounded-xl border border-brand/20 bg-surface p-3">
            <div>
              <p className="text-lg font-semibold tracking-[-0.03em] text-ink">Tas & aksesori</p>
              <p className="mt-1 font-mono text-[10px] text-ink-muted">fashion_and_accessories</p>
            </div>
            <Check className="size-6 shrink-0 text-brand" aria-hidden="true" />
          </div>
          <div className="mt-4 flex items-center gap-2 text-xs text-brand">
            <span className="size-2 rounded-full bg-brand" />
            Confidence terlihat
          </div>
        </div>
      )}
      {kind === "price" && (
        <div className="absolute inset-x-2 top-8 rounded-2xl border border-line bg-surface p-4 shadow-[0_16px_32px_rgba(16,37,28,0.10)]">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-medium text-ink-muted">Pita harga</p>
            <span className="font-mono text-[10px] text-ink-muted">contoh</span>
          </div>
          <div className="relative mt-6 h-5">
            <div className="absolute inset-x-0 top-2 h-2 rounded-full bg-ink/10" />
            <div className="absolute left-[14%] right-[12%] top-2 h-2 rounded-full bg-brand/30" />
            <span className="absolute left-[12%] top-0 h-5 w-1 rounded-full bg-status-warning" />
            <span className="absolute left-[62%] top-[-4px] h-6 w-1 rounded-full bg-brand" />
          </div>
          <div className="mt-5 grid grid-cols-2 gap-4 text-xs">
            <div>
              <p className="text-ink-muted">Batas biaya</p>
              <p className="mt-1 font-semibold text-ink">Rp72.000</p>
            </div>
            <div>
              <p className="text-ink-muted">Saran</p>
              <p className="mt-1 font-semibold text-brand">Rp108.000</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function HeroPhoto() {
  return (
    <div className="relative min-h-[420px] lg:col-span-5 lg:min-h-[640px]">
      <div className="absolute inset-0 -rotate-3 rounded-[32px] bg-brand/12" aria-hidden="true" />
      <div
        data-motion-image
        className="absolute inset-4 overflow-hidden rounded-[28px] bg-ink shadow-[0_32px_90px_rgba(16,37,28,0.24)] lg:inset-y-0 lg:-left-12 lg:right-0"
      >
        <Image
          src="/images/umkm-produk-lokal.png"
          alt="Pelaku UMKM mengemas camilan lokal di meja kerja"
          fill
          preload
          sizes="(max-width: 1024px) 92vw, 45vw"
          className="object-cover object-center opacity-90 contrast-110"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink/60 via-transparent to-transparent" />
      </div>
      <div className="absolute -bottom-6 left-0 right-8 rounded-2xl border border-white/70 bg-surface/95 p-5 shadow-[0_20px_56px_rgba(16,37,28,0.18)] backdrop-blur md:left-[-48px] lg:right-12">
        <div className="flex items-start gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
            <Sparkles aria-hidden="true" />
          </span>
          <div>
            <p className="font-semibold text-ink">Hasil yang bisa diperiksa</p>
            <p className="mt-1 text-sm leading-6 text-ink-muted">
              Confidence, sumber versi, dan peringatan ikut tampil bersama hasil.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function PhotoFactsVisual() {
  return (
    <div data-feature-visual aria-hidden="true" className="grid h-full content-center gap-3 p-4 sm:grid-cols-2">
      <div className="rounded-2xl border border-white/12 bg-white/8 p-4">
        <ImageUp className="size-6 text-brand-bright" aria-hidden="true" />
        <p className="mt-4 text-sm font-semibold">Foto</p>
        <p className="mt-1 text-xs text-white/64">1 gambar utama</p>
      </div>
      <div className="rounded-2xl border border-white/12 bg-white/8 p-4">
        <ReceiptText className="size-6 text-brand-bright" aria-hidden="true" />
        <p className="mt-4 text-sm font-semibold">Biaya</p>
        <p className="mt-1 font-mono text-xs text-white/64">Rp72.000</p>
      </div>
      <div className="rounded-2xl border border-white/12 bg-white/8 p-4 sm:col-span-2">
        <p className="text-xs font-medium text-white/64">Fakta yang diketahui</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="rounded-md bg-white/12 px-2 py-1 text-xs">Tas kulit</span>
          <span className="rounded-md bg-white/12 px-2 py-1 text-xs">Surabaya</span>
          <span className="rounded-md bg-brand/60 px-2 py-1 text-xs">Tokopedia</span>
        </div>
      </div>
    </div>
  );
}

function ConfidenceVisual() {
  return (
    <div data-feature-visual aria-hidden="true" className="flex h-full flex-col justify-center gap-5 p-5">
      <div className="flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-xl bg-surface text-brand shadow-[0_10px_24px_rgba(16,37,28,0.10)]">
          <ShieldCheck className="size-6" aria-hidden="true" />
        </span>
        <div>
          <p className="text-xs font-medium text-ink-muted">Keyakinan hasil</p>
          <p className="mt-1 text-lg font-semibold text-ink">87% · tinggi</p>
        </div>
      </div>
      <div>
        <div className="flex items-center justify-between gap-3 text-xs text-ink-muted">
          <span>Bukti yang tersedia</span>
          <span className="font-mono text-ink">87 / 100</span>
        </div>
        <div className="mt-3 h-3 rounded-full bg-ink/10">
          <div className="h-3 w-[87%] rounded-full bg-brand" />
        </div>
      </div>
      <p className="border-t border-line pt-4 text-xs leading-5 text-ink-muted">Sumber, versi, dan peringatan ikut terlihat.</p>
    </div>
  );
}

function CopyVisual() {
  return (
    <div data-feature-visual aria-hidden="true" className="flex h-full flex-col justify-center gap-4 p-4">
      <div className="rounded-2xl border border-white/12 bg-white/8 p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-medium text-white/64">Judul listing</p>
          <Copy className="size-4 text-brand-bright" aria-hidden="true" />
        </div>
        <p className="mt-4 text-lg font-semibold leading-6 tracking-[-0.03em]">Tas selempang kulit untuk aktivitas harian</p>
        <div className="mt-4 space-y-2">
          <div className="h-2 w-[86%] rounded-full bg-white/20" />
          <div className="h-2 w-[72%] rounded-full bg-white/20" />
          <div className="h-2 w-[50%] rounded-full bg-brand-bright/70" />
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 text-xs text-white/64">
        <span>Edit sebelum salin</span>
        <span className="rounded-md bg-white/12 px-2 py-1 font-mono">siap diperiksa</span>
      </div>
    </div>
  );
}

function FeatureFlowVisual() {
  return (
    <div
      aria-hidden="true"
      className="relative isolate min-h-[280px] overflow-hidden rounded-[28px] border border-brand/20 bg-canvas p-4 shadow-[0_24px_72px_rgba(16,37,28,0.10)] sm:min-h-[320px]"
    >
      <div className="absolute inset-0 bg-brand/5" />
      <div className="absolute -right-16 -top-16 size-56 rounded-full bg-brand/10 blur-3xl" />
      <div className="absolute inset-0 opacity-30 [background-image:radial-gradient(circle_at_1px_1px,var(--brand)_1px,transparent_1px)] [background-size:16px_16px]" />
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0 h-full w-full text-brand/50"
        viewBox="0 0 400 280"
        fill="none"
        preserveAspectRatio="none"
      >
        <path
          data-feature-flow-line
          d="M72 72 C132 72 142 140 198 140 C254 140 270 208 328 208"
          pathLength={1}
          stroke="currentColor"
          strokeDasharray="1"
          strokeDashoffset="0"
          strokeLinecap="round"
          strokeWidth="2"
        />
      </svg>

      <div className="absolute left-4 top-4 z-10 w-36 rounded-2xl border border-line bg-surface/95 p-4 shadow-[0_12px_32px_rgba(16,37,28,0.10)]">
        <div className="flex items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
            <ReceiptText className="size-4" aria-hidden="true" />
          </span>
          <div>
            <p className="text-xs font-semibold text-ink">Biaya</p>
            <p className="mt-1 font-mono text-[10px] text-ink-muted">Rp62.000</p>
          </div>
        </div>
      </div>

      <div className="absolute left-1/2 top-1/2 z-10 w-40 -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-brand/30 bg-brand-soft/95 p-4 shadow-[0_12px_32px_rgba(16,37,28,0.10)]">
        <div className="flex items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-surface text-brand">
            <ImageUp className="size-4" aria-hidden="true" />
          </span>
          <div>
            <p className="text-xs font-semibold text-ink">Foto produk</p>
            <p className="mt-1 text-[10px] text-ink-muted">Konteks terbaca</p>
          </div>
        </div>
      </div>

      <div className="absolute bottom-4 right-4 z-10 w-36 rounded-2xl border border-brand/30 bg-brand p-4 text-white shadow-[0_12px_32px_rgba(16,37,28,0.16)]">
        <div className="flex items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/15 text-brand-bright">
            <Sparkles className="size-4" aria-hidden="true" />
          </span>
          <div>
            <p className="text-xs font-semibold">Hasil listing</p>
            <p className="mt-1 text-[10px] text-white/72">Siap diperiksa</p>
          </div>
        </div>
      </div>
    </div>
  );
}

const PROCESS_STEPS = [
  {
    title: "Foto & fakta",
    description: "Masukkan foto, detail produk, biaya, platform, dan wilayah pasar.",
    items: ["Foto produk", "Jenis dan wilayah", "Biaya yang diketahui"],
  },
  {
    title: "Hasil & keyakinan",
    description: "Periksa copy, kategori, harga, confidence, dan sumber versi.",
    items: ["Judul dan deskripsi", "Kategori", "Harga dan confidence"],
  },
  {
    title: "Salin",
    description: "Edit hasil akhir, lalu salin bagian yang kamu butuhkan.",
    items: ["Edit hasil", "Salin per bagian", "Pasang di kanal jual"],
  },
] as const;

export function LandingPage() {
  return (
    <LandingMotion>
      <header className="fixed inset-x-0 top-0 z-50 px-4 pt-4">
        <nav
          aria-label="Navigasi utama"
          className="mx-auto flex min-h-14 max-w-7xl items-center justify-between rounded-2xl border border-white/60 bg-surface/90 px-4 shadow-[0_12px_40px_rgba(16,37,28,0.10)] backdrop-blur-xl sm:px-6"
        >
          <Link
            href="/"
            className="flex min-h-11 items-center gap-3 rounded-lg font-semibold tracking-[-0.03em] text-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand"
          >
            <span className="grid size-8 place-items-center rounded-lg bg-brand text-sm text-white">L</span>
            LAPAKIN
          </Link>
          <div className="hidden items-center gap-8 text-sm text-ink-muted md:flex">
            <a className="min-h-11 content-center hover:text-ink" href="#cara-kerja">
              Cara kerja
            </a>
            <a className="min-h-11 content-center hover:text-ink" href="#hasil">
              Isi hasil
            </a>
          </div>
          <Button render={<Link href="/buat-listing" />} nativeButton={false} size="lg">
            Buat listing
            <ArrowRight aria-hidden="true" />
          </Button>
        </nav>
      </header>

      <main>
        <section className="relative isolate flex min-h-[820px] items-center overflow-hidden bg-canvas px-4 pb-24 pt-32 sm:px-6 md:pb-32 md:pt-40">
          <div className="mx-auto grid w-full max-w-7xl items-center gap-16 lg:grid-cols-12 lg:gap-8">
            <div className="relative z-10 lg:col-span-7 lg:pb-24">
              <p className="mb-6 max-w-xl text-base font-medium leading-7 text-brand">
                Asisten listing untuk pelaku UMKM Indonesia
              </p>
              <h1 className="max-w-6xl text-balance text-[clamp(3rem,5vw,5.5rem)] font-semibold leading-[0.98] tracking-[-0.065em] text-ink">
                Dari foto produk, jadi listing yang siap kamu jual.
              </h1>
              <p className="mt-8 max-w-2xl text-lg leading-8 text-ink-muted md:text-xl">
                LAPAKIN merangkai judul, deskripsi, kategori, dan rekomendasi harga dari
                fakta produk serta biaya yang kamu masukkan.
              </p>
              <div className="mt-10 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
                <Button
                  render={<Link href="/buat-listing" />}
                  nativeButton={false}
                  size="lg"
                  className="w-full sm:w-auto"
                >
                  Ubah foto jadi listing
                  <ArrowRight aria-hidden="true" />
                </Button>
                <a
                  href="#cara-kerja"
                  className="inline-flex min-h-11 w-full items-center justify-center rounded-xl px-4 font-medium text-ink underline decoration-brand/50 decoration-2 underline-offset-8 hover:decoration-brand sm:w-auto"
                >
                  Lihat cara kerjanya
                </a>
              </div>
            </div>

            <HeroPhoto />
          </div>
        </section>

        <section id="cara-kerja" className="bg-surface px-4 py-32 sm:px-6 md:py-48">
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-10 lg:grid-cols-12 lg:items-end">
              <div className="lg:col-span-8">
                <p className="text-base font-medium text-brand">Lebih cepat, tetap masuk akal</p>
                <h2 className="mt-5 text-balance text-4xl font-semibold leading-tight tracking-[-0.045em] text-ink md:text-6xl">
                  Satu alur untuk merapikan foto, fakta, dan keputusan harga.
                </h2>
                <p className="mt-6 max-w-xl text-lg leading-8 text-ink-muted">
                  Dari foto sampai harga yang tepat, semuanya terhubung dalam satu alur yang jelas.
                </p>
              </div>
              <div className="lg:col-span-4">
                <FeatureFlowVisual />
              </div>
            </div>

            <div className="mt-16 grid grid-flow-dense gap-4 lg:grid-cols-12 lg:grid-rows-2">
              <article className="group min-h-[360px] overflow-hidden rounded-[28px] border border-white/12 bg-ink p-8 text-white shadow-[0_24px_72px_rgba(16,37,28,0.12)] lg:col-span-7">
                <div className="flex h-full flex-col gap-8 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(200px,0.8fr)] lg:items-center">
                  <div className="order-2 flex h-full flex-col justify-between gap-12 lg:order-1">
                    <ImageUp className="size-8 text-brand-bright" aria-hidden="true" />
                    <div>
                      <h3 className="max-w-xl text-3xl font-semibold tracking-[-0.035em]">
                        Foto membuka konteks. Fakta produk menjaga hasil tetap jujur.
                      </h3>
                      <p className="mt-5 max-w-xl leading-7 text-white/72">
                        Unggah JPEG, PNG, atau WebP. Tambahkan jenis produk, platform, wilayah,
                        serta komponen biaya yang memang kamu ketahui.
                      </p>
                    </div>
                  </div>
                  <div
                    aria-hidden="true"
                    className="relative order-1 min-h-[200px] overflow-hidden rounded-2xl border border-white/12 bg-white/5 sm:min-h-[220px] lg:order-2 lg:min-h-[240px]"
                  >
                    <PhotoFactsVisual />
                  </div>
                </div>
              </article>

              <article className="min-h-[360px] rounded-[28px] border border-line bg-canvas p-8 shadow-[0_24px_72px_rgba(16,37,28,0.10)] lg:col-span-5">
                <p className="text-sm font-medium text-brand">Pita harga LAPAKIN</p>
                <h3 className="mt-4 text-2xl font-semibold tracking-[-0.03em] text-ink">
                  Pasar terlihat. Batas biaya tidak dilupakan.
                </h3>
                <div className="mt-10">
                  <PriceTape />
                </div>
              </article>

              <article className="min-h-[360px] rounded-[28px] border border-line bg-canvas p-8 shadow-[0_24px_72px_rgba(16,37,28,0.10)] lg:col-span-5">
                <div className="flex h-full flex-col gap-8 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(200px,0.8fr)] lg:items-center">
                  <div className="order-2 lg:order-1">
                    <ShieldCheck className="size-8 text-brand" aria-hidden="true" />
                    <h3 className="mt-6 text-2xl font-semibold tracking-[-0.03em] text-ink">
                      Ketidakpastian tidak disembunyikan.
                    </h3>
                    <p className="mt-5 leading-7 text-ink-muted">
                      Saat bukti pasar belum cukup, harga atau confidence dapat tampil kosong dengan
                      penjelasan yang jelas, bukan angka buatan.
                    </p>
                  </div>
                  <div
                    aria-hidden="true"
                    className="relative order-1 min-h-[180px] overflow-hidden rounded-2xl border border-line bg-brand-soft/50 sm:min-h-[200px] lg:order-2 lg:min-h-[220px]"
                  >
                    <ConfidenceVisual />
                  </div>
                </div>
              </article>

              <article className="group relative min-h-[360px] overflow-hidden rounded-[28px] border border-white/12 bg-brand p-8 text-white shadow-[0_24px_72px_rgba(16,37,28,0.12)] lg:col-span-7">
                <div className="flex h-full flex-col gap-8 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(200px,0.8fr)] lg:items-center">
                  <div className="order-2 flex h-full flex-col gap-6 lg:order-1">
                    <Copy className="size-8" aria-hidden="true" />
                    <div className="relative max-w-xl">
                      <h3 className="text-3xl font-semibold tracking-[-0.035em]">
                        Edit seperlunya, lalu salin ke lapakmu.
                      </h3>
                      <p className="mt-5 leading-7 text-white">
                        Hasil tetap menjadi milikmu untuk diperiksa, disesuaikan, dan digunakan pada
                        kanal jual yang kamu pilih.
                      </p>
                    </div>
                  </div>
                  <div
                    aria-hidden="true"
                    className="relative order-1 min-h-[200px] overflow-hidden rounded-2xl border border-white/12 bg-white/5 sm:min-h-[220px] lg:order-2 lg:min-h-[240px]"
                  >
                    <CopyVisual />
                  </div>
                </div>
                <div className="absolute -bottom-16 -right-12 size-72 rounded-full border-[40px] border-white/12" aria-hidden="true" />
              </article>
            </div>
          </div>
        </section>

        <section id="hasil" className="bg-canvas px-4 py-32 sm:px-6 md:py-48">
          <div className="mx-auto max-w-7xl">
            <h2 className="max-w-6xl text-balance text-4xl font-semibold leading-tight tracking-[-0.05em] text-ink md:text-6xl">
              Setiap hasil menjawab satu keputusan penting untuk lapakmu.
            </h2>
            <div className="horizontal-accordion mt-16 flex flex-col gap-3 lg:flex-row">
              {RESULT_DECISIONS.map((decision) => (
                <article
                  key={decision.title}
                  className="accordion-panel flex min-h-[240px] flex-col overflow-hidden rounded-[24px] border border-line bg-surface p-6 sm:min-h-[260px] lg:min-h-[480px] lg:p-8"
                >
                  <p className="text-sm font-medium text-brand">{decision.label}</p>
                  <DecisionVisual kind={decision.visual} />
                  <div className="mt-8 max-w-md">
                    <h3 className="text-2xl font-semibold tracking-[-0.03em] text-ink">
                      {decision.title}
                    </h3>
                    <p className="mt-4 leading-7 text-ink-muted">
                      {decision.description}
                    </p>
                    <div className="mt-6 border-t border-line pt-5">
                      <p className="text-sm leading-6 text-ink">{decision.proof}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            <div className="mt-32 grid gap-8 lg:grid-cols-12 lg:items-start">
              <div className="lg:sticky lg:top-28 lg:col-span-5">
                <p className="text-base font-medium text-brand">Satu proses, tiga tahap</p>
                <h2 className="mt-5 text-4xl font-semibold leading-tight tracking-[-0.045em] text-ink md:text-5xl">
                  Singkat untuk dipakai, lengkap untuk dipercaya.
                </h2>
              </div>
              <div className="space-y-8 lg:col-span-7">
                {PROCESS_STEPS.map((step, index) => (
                  <article
                    key={step.title}
                    data-stack-card
                    style={
                      {
                        "--stack-top": `${112 + index * 72}px`,
                        "--stack-z": index + 1,
                      } as CSSProperties
                    }
                    className="stack-card min-h-[360px] rounded-[28px] border border-line bg-surface p-8 shadow-[0_24px_72px_rgba(16,37,28,0.10)]"
                  >
                    <div className="flex items-center justify-between gap-8">
                      <div className="flex min-w-0 items-center gap-4">
                        <span className="font-mono text-sm text-brand">{String(index + 1).padStart(2, "0")}</span>
                        <h3 className="text-3xl font-semibold tracking-[-0.035em] text-ink">
                          {step.title}
                        </h3>
                      </div>
                      <Check className="size-7 text-brand" aria-hidden="true" />
                    </div>
                    <p className="mt-6 max-w-xl text-lg leading-8 text-ink-muted">{step.description}</p>
                    <div className="mt-6 border-t border-line pt-6">
                      <ul className="grid gap-4">
                        {step.items.map((item) => (
                          <li key={item} className="flex items-center gap-3 text-ink">
                            <Check className="size-5 shrink-0 text-brand" aria-hidden="true" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="bg-ink px-4 py-32 text-white sm:px-6 md:py-48">
          <div className="mx-auto max-w-7xl">
            <div className="max-w-5xl">
              <h2 className="text-balance text-5xl font-semibold leading-[1.02] tracking-[-0.055em] md:text-7xl">
                Produkmu sudah punya cerita. Sekarang lapakkan dengan lebih yakin.
              </h2>
              <p className="mt-8 max-w-2xl text-lg leading-8 text-white/72">
                Siapkan satu foto produk dan angka biaya produksimu. LAPAKIN membantu merapikan
                sisanya dalam satu alur.
              </p>
              <Button
                render={<Link href="/buat-listing" />}
                nativeButton={false}
                size="lg"
                className="mt-10 bg-white text-ink hover:bg-white/88"
              >
                Mulai buat listing
                <ArrowRight aria-hidden="true" />
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/12 bg-ink px-4 py-10 text-sm text-white/64 sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p>LAPAKIN membantu UMKM menyiapkan listing yang dapat diperiksa.</p>
          <Link className="min-h-11 content-center text-white hover:underline" href="/buat-listing">
            Buat listing
          </Link>
        </div>
      </footer>
    </LandingMotion>
  );
}
