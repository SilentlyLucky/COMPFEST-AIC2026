"use client";

import type { ReactNode } from "react";

import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Calculator,
  CheckCircle2,
  ChevronDown,
  ShieldCheck,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatRupiah } from "@/lib/format";
import {
  CATEGORY_CODES,
  CATEGORY_LABELS,
  type CategoryCode,
  type GenerateListingResponse,
  type RecommendationBasis,
  type PricingDetails,
  type VariantPriceDetails,
} from "@/lib/listing-types";

interface ListingResultProps {
  response: GenerateListingResponse;
  title: string;
  description: string;
  categoryCode: CategoryCode;
  onCategoryChange: (value: CategoryCode) => void;
  onTitleChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onBack: () => void;
  onContinue: () => void;
}

const ALIGNMENT_LABELS = {
  within_market: "Selaras dengan pasar",
  above_market: "Di atas rentang pasar",
  insufficient_evidence: "Bukti pasar belum cukup",
} as const;

const WARNING_MESSAGES: Record<string, string> = {
  PLATFORM_FEE_NOT_PROVIDED:
    "Biaya layanan tempat jual belum diisi, jadi harga belum memperhitungkan potongan layanan.",
  PLATFORM_FEE_DEFAULTED:
    "Potongan layanan dihitung otomatis berdasarkan tempat jual dan kategori produk.",
  PPh_FINAL_NOT_APPLIED_OVER_4_8B:
    "Omzet di atas Rp4,8 miliar tidak dihitung dengan tarif PPh Final UMKM 0,5%; periksa kewajiban pajak dengan konsultan.",
  UNKNOWN_CATEGORY_TARIFF_FALLBACK:
    "Kategori tarif spesifik belum tersedia, jadi tarif kategori Lainnya dipakai sebagai acuan.",
  MARKET_DATA_STALE: "Data harga pasar mungkin sudah berubah. Periksa kembali sebelum menjual.",
  INSUFFICIENT_COMPARABLES: "Produk serupa belum cukup untuk memberi keyakinan harga yang kuat.",
  COST_ABOVE_MARKET: "Biaya produk berada di atas rentang pasar. Pertimbangkan kembali biaya atau harga jual.",
  MARKET_EVIDENCE_UNAVAILABLE: "Bukti harga pasar belum tersedia, jadi rekomendasi harga dapat kosong.",
  MARKET_SUBTYPE_COMPARABLES_INSUFFICIENT:
    "Contoh produk dengan jenis yang sama sudah ditemukan, tetapi jumlahnya belum cukup untuk rekomendasi harga pasar.",
  MARKET_ATTRIBUTE_COMPARABLES_INSUFFICIENT:
    "Contoh produk dengan atribut yang kamu isi sudah ditemukan, tetapi jumlahnya belum cukup untuk rekomendasi harga pasar.",
  MARKET_VISUAL_QUERY_FALLBACK:
    "Bukti harga dari informasi produk belum cukup, sehingga deskripsi produk dipakai sebagai petunjuk pencarian produk serupa.",
  MARKET_CATEGORY_FALLBACK:
    "Bukti harga spesifik belum cukup, sehingga produk satu kategori dipakai sebagai acuan.",
  UNSUPPORTED_CRITICAL_CLAIM_REMOVED: "Klaim penting yang tidak dapat diperiksa telah dihapus dari produk.",
};

function warningMessage(code: string): string {
  return WARNING_MESSAGES[code] ?? "Ada catatan hasil yang perlu diperiksa sebelum produk digunakan.";
}

const INSUFFICIENT_PRICE_NARRATIVE_WARNINGS = new Set([
  "INSUFFICIENT_COMPARABLES",
  "MARKET_EVIDENCE_UNAVAILABLE",
  "MARKET_VISUAL_QUERY_FALLBACK",
  "MARKET_CATEGORY_FALLBACK",
  "MARKET_SUBTYPE_COMPARABLES_INSUFFICIENT",
  "MARKET_ATTRIBUTE_COMPARABLES_INSUFFICIENT",
]);

export function visibleWarnings(warnings: string[], priceAvailable: boolean): string[] {
  return priceAvailable
    ? warnings
    : warnings.filter((warning) => !INSUFFICIENT_PRICE_NARRATIVE_WARNINGS.has(warning));
}

export function categoryConfidenceLabel(score: number | null): string {
  if (score === null) return "Perlu diperiksa";
  if (score >= 90) return "Tinggi";
  if (score >= 70) return "Cukup";
  return "Perlu diperiksa";
}

export function priceState(price: GenerateListingResponse["data"]["listing"]["price"]): "available" | "insufficient_market_data" {
  return price.recommended === null ? "insufficient_market_data" : "available";
}

export interface ListingReadiness {
  missing: string[];
  summary: string;
  description: string;
}

export function listingReadiness({
  categoryCode,
  title,
  description,
  hasMarketRecommendation,
}: {
  categoryCode: CategoryCode | null | undefined;
  title: string;
  description: string;
  hasMarketRecommendation: boolean;
}): ListingReadiness {
  const missing = [
    categoryCode ? null : "Kategori",
    title.trim().length > 0 && description.trim().length >= 50 ? null : "Judul & deskripsi",
    hasMarketRecommendation ? null : "Harga",
  ].filter((item): item is string => item !== null);

  if (missing.length === 0) {
    return {
      missing,
      summary: "Siap digunakan",
      description: "Kategori, judul, deskripsi, dan saran harga siap digunakan.",
    };
  }
  if (missing.length === 1) {
    const onlyMissing = missing[0];
    return {
        missing,
        summary: "Siap, dengan 1 hal yang perlu dilengkapi",
        description:
        onlyMissing === "Harga"
          ? "Kategori, judul, dan deskripsi sudah siap digunakan. Harga perlu kamu tentukan sendiri."
          : `${onlyMissing} perlu dilengkapi sebelum produk siap sepenuhnya.`,
    };
  }
  return {
      missing,
      summary: "Perlu beberapa perbaikan",
      description: `${missing.join(" dan ")} perlu dilengkapi sebelum produk siap digunakan.`,
  };
}

const ZONE_LABELS: Record<PricingDetails["zone"], string> = {
  good: "Aman",
  fair: "Wajar",
  tight: "Perlu diperhatikan",
  danger: "Berisiko",
};

const RECOMMENDATION_BASIS_LABELS: Record<RecommendationBasis, string> = {
  market_median: "Harga tengah produk serupa",
  floor_plus_15_percent: "Sedikit di atas batas aman",
  floor_plus_20_percent: "Di atas batas aman dengan ruang lebih",
  upper_quartile: "Mendekati harga tinggi produk serupa",
  floor_above_market: "Mengutamakan batas aman",
};

const COST_LABELS: Record<string, string> = {
  hpp: "Modal per unit",
  platform_commission: "Biaya layanan tempat jual",
  shipping_program: "Potongan ongkos kirim",
  processing_fee: "Biaya proses",
  income_tax: "Pajak",
  net_profit: "Perkiraan sisa setelah biaya",
};

const VARIANT_KIND_LABELS: Record<VariantPriceDetails["kind"], string> = {
  color: "Warna",
  size: "Ukuran",
  grade: "Kualitas",
};

function costLabel(key: string): string {
  return (
    COST_LABELS[key] ??
    key
      .split("_")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ")
  );
}

function costRateLabel(key: string, details: PricingDetails): string | null {
  if (key === "platform_commission") {
    return `${formatPercentage(details.platform_commission_pct)} dari harga jual`;
  }
  if (key === "shipping_program") {
    return `${formatPercentage(details.shipping_pct)} dari harga jual`;
  }
  if (key === "income_tax") {
    return `${formatPercentage(details.income_tax_pct)} dari harga jual`;
  }
  return null;
}

function formatPercentage(value: number): string {
  return `${value.toLocaleString("id-ID", {
    maximumFractionDigits: 1,
  })}%`;
}

function PricingTier({
  label,
  value,
}: {
  label: string;
  value: number | null;
}) {
  return (
    <div className="rounded-xl border border-line bg-canvas p-4">
      <dt className="text-sm text-ink-muted">{label}</dt>
      <dd className="mt-2 font-semibold text-ink">
        {value === null ? "Belum tersedia" : formatRupiah(value)}
      </dd>
    </div>
  );
}

function ExplainabilityStep({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-line bg-canvas p-4">
      <div className="flex items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
          <Icon className="size-4" aria-hidden="true" />
        </span>
        <h6 className="text-sm font-semibold text-ink">{title}</h6>
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function PriceRange({
  details,
  recommended,
}: {
  details: PricingDetails;
  recommended: number;
}) {
  const marketLower = Math.min(details.market_p25_idr, details.market_p75_idr);
  const marketUpper = Math.max(details.market_p25_idr, details.market_p75_idr);
  const scaleMin = Math.min(
    details.minimum_price_idr,
    marketLower,
    details.market_median_idr,
  );
  const scaleMax = Math.max(
    details.premium_price_idr,
    marketUpper,
    details.market_median_idr,
    recommended,
  );
  const scaleSpan = Math.max(scaleMax - scaleMin, 1);
  const position = (value: number) =>
    Math.min(100, Math.max(0, ((value - scaleMin) / scaleSpan) * 100));
  const marketStart = position(marketLower);
  const marketEnd = position(marketUpper);
  const marketWidth = Math.max(0, marketEnd - marketStart);
  const marketRangeLabel = details.market_quartiles_available
    ? "Rentang umum P25–P75"
    : "Kisaran harga produk serupa";
  const lowerMarkerLabel = details.market_quartiles_available ? "P25 (Persentil)" : "batas bawah";
  const upperMarkerLabel = details.market_quartiles_available ? "P75 (Persentil)" : "batas atas";
  const markers = [
    {
      key: "safe",
      value: details.minimum_price_idr,
      markerClassName: "size-4 border-2 border-surface bg-ink-muted shadow-sm",
    },
    {
      key: "p25",
      value: details.market_p25_idr,
      markerClassName: "size-3 border-2 border-surface bg-brand/70 shadow-sm",
    },
    {
      key: "median",
      value: details.market_median_idr,
      markerClassName: "size-4 border-2 border-surface bg-brand shadow-sm",
    },
    {
      key: "p75",
      value: details.market_p75_idr,
      markerClassName: "size-3 border-2 border-surface bg-brand/70 shadow-sm",
    },
    {
      key: "recommended",
      value: recommended,
      markerClassName: "size-5 border-4 border-surface bg-status-success shadow-md",
    },
  ];
  const positionedMarkers = markers.map((marker) => ({
    ...marker,
    position: position(marker.value),
  }));
  // Only move labels when their projected columns are genuinely too close.
  // A wide 18% buffer made ordinary points such as safe price and P25 look disconnected.
  const markerCollisionGap = 5;
  const annotatedMarkers = positionedMarkers.reduce<
    Array<(typeof positionedMarkers)[number] & { lane: number }>
  >((placed, marker) => {
    let lane = 0;
    while (placed.some((other) => other.lane === lane && Math.abs(other.position - marker.position) < markerCollisionGap)) {
      lane += 1;
    }
    placed.push({ ...marker, lane });
    return placed;
  }, []);
  const annotationLanes = Math.max(...annotatedMarkers.map((marker) => marker.lane), 0) + 1;
  const annotationHeight = `${annotationLanes * 3.25 + 0.75}rem`;

  return (
    <section aria-labelledby="price-range-heading" className="mt-6 rounded-2xl border border-line bg-canvas p-4 sm:p-5">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h5 id="price-range-heading" className="text-base font-semibold text-ink">
            Posisi harga terhadap pasar
          </h5>
          <p className="mt-1 text-sm leading-6 text-ink-muted">
            {details.market_quartiles_available
              ? `${marketRangeLabel}: ${formatRupiah(marketLower)} – ${formatRupiah(marketUpper)}. Setengah produk serupa berada di dalam rentang ini.`
              : `${marketRangeLabel}: ${formatRupiah(marketLower)} – ${formatRupiah(marketUpper)}.`}
          </p>
        </div>
        <span className="text-xs font-medium text-ink-muted">Semakin ke kanan, harga semakin tinggi</span>
      </div>

      <div className="relative mt-6" style={{ paddingBottom: annotationHeight }}>
        <div
          className="relative h-3 rounded-full bg-line/70"
          role="img"
          aria-label={`Batas aman ${formatRupiah(details.minimum_price_idr)}; ${lowerMarkerLabel} ${formatRupiah(details.market_p25_idr)}; median ${formatRupiah(details.market_median_idr)}; ${upperMarkerLabel} ${formatRupiah(details.market_p75_idr)}; rekomendasi ${formatRupiah(recommended)}`}
        >
          <div
            className="absolute inset-y-0 rounded-full bg-brand/25"
            style={{ left: `${marketStart}%`, width: `${marketWidth}%` }}
          />
          {positionedMarkers.map(({ key, position: markerPosition, markerClassName }) => (
            <span
              key={key}
              className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full ${markerClassName}`}
              style={{ left: `${markerPosition}%` }}
              aria-hidden="true"
            />
          ))}
        </div>

        {annotatedMarkers.map(({ key, value, position: markerPosition, lane }) => (
          <div
            key={`${key}-annotation`}
            className="absolute w-24 -translate-x-1/2 text-center sm:w-28"
            style={{ left: `${markerPosition}%`, top: `${0.9 + lane * 3.25}rem` }}
          >
            <span className="mx-auto block h-3 w-px bg-line" aria-hidden="true" />
            <strong className={`mt-0.5 block text-xs leading-5 ${key === "recommended" ? "text-status-success" : "text-ink"}`}>
              {formatRupiah(value)}
            </strong>
          </div>
        ))}
      </div>

      <ul aria-label="Keterangan titik harga" className="mt-4 grid gap-x-6 gap-y-2 border-t border-line/70 pt-4 text-xs leading-5 text-ink-muted sm:grid-cols-2 lg:grid-cols-4">
        <li className="flex items-start gap-2">
          <span className="mt-1 size-3 shrink-0 rounded-full bg-ink-muted" aria-hidden="true" />
          <span>Batas aman</span>
        </li>
        <li className="flex items-start gap-2 lg:col-span-2">
          <span className="mt-1 size-3 shrink-0 rounded-full bg-brand/70" aria-hidden="true" />
          <span>P25 (Persentil) – P75 (Persentil): rentang umum</span>
        </li>
        <li className="flex items-start gap-2">
          <span className="mt-1 size-3 shrink-0 rounded-full bg-brand" aria-hidden="true" />
          <span>Median: harga tengah</span>
        </li>
        <li className="flex items-start gap-2">
          <span className="mt-1 size-3 shrink-0 rounded-full bg-status-success" aria-hidden="true" />
          <span>Rekomendasi harga</span>
        </li>
      </ul>
    </section>
  );
}

function VariantPriceRow({ variant }: { variant: VariantPriceDetails }) {
  return (
    <li className="rounded-xl border border-line bg-canvas p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="font-medium text-ink">{variant.label}</p>
          <p className="mt-1 text-sm text-ink-muted">
            {VARIANT_KIND_LABELS[variant.kind]} · modal per unit {formatRupiah(variant.hpp_per_unit_idr)}
          </p>
        </div>
        <p className="shrink-0 text-sm font-medium text-ink">
          Selisih dari modal {formatPercentage(variant.margin_pct)}
        </p>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-ink-muted">Batas aman</dt>
          <dd className="mt-1 font-medium text-ink">{formatRupiah(variant.minimum_price_idr)}</dd>
        </div>
        <div>
          <dt className="text-ink-muted">Harga bersaing</dt>
          <dd className="mt-1 font-medium text-ink">{formatRupiah(variant.aggressive_price_idr)}</dd>
        </div>
        <div>
          <dt className="text-ink-muted">Rekomendasi</dt>
          <dd className="mt-1 font-medium text-ink">{formatRupiah(variant.recommended_price_idr)}</dd>
        </div>
        <div>
          <dt className="text-ink-muted">Harga premium</dt>
          <dd className="mt-1 font-medium text-ink">{formatRupiah(variant.premium_price_idr)}</dd>
        </div>
      </dl>
      <p className="mt-3 text-sm leading-6 text-ink-muted">{variant.note}</p>
    </li>
  );
}

function PricingDetailsCard({
  details,
  recommended,
  comparableCount,
  dataAsOf,
}: {
  details: PricingDetails;
  recommended: number | null;
  comparableCount: number;
  dataAsOf: string | null;
}) {
  const variantGroups = (['color', 'size', 'grade'] as const)
    .map((kind) => ({
      kind,
      variants: details.variant_prices.filter((variant) => variant.kind === kind),
    }))
    .filter(({ variants }) => variants.length > 0);
  const recommendedPrice = recommended ?? details.minimum_price_idr;
  const basisLabel = RECOMMENDATION_BASIS_LABELS[details.recommendation_basis];
  const lowerMarketLabel = details.market_quartiles_available
    ? "P25 · awal rentang umum"
    : "Batas bawah rentang";
  const upperMarketLabel = details.market_quartiles_available
    ? "P75 · akhir rentang umum"
    : "Batas atas rentang";

  return (
    <div className="mt-8 border-t border-line/70 pt-6" aria-labelledby="pricing-details-heading">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h4 id="pricing-details-heading" className="text-lg font-semibold text-ink">
            Rincian harga
          </h4>
          <p className="mt-1 text-sm leading-6 text-ink-muted">
            Satuan jual: {details.sale_unit}. Rincian ini dihitung dari modal, biaya lain, dan harga produk serupa.
          </p>
        </div>
        <span className="w-fit rounded-lg bg-brand-soft px-3 py-2 text-sm font-medium text-ink">
          Biaya {ZONE_LABELS[details.zone]}
        </span>
      </div>

      <section aria-labelledby="why-price-heading" className="mt-5 rounded-2xl border border-brand/20 bg-brand-soft/45 p-5">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-surface text-brand">
            <ShieldCheck className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-brand">Kenapa harga ini?</p>
            <h5 id="why-price-heading" className="mt-1 text-base font-semibold text-ink">
              {basisLabel}
            </h5>
          </div>
        </div>
        <p className="mt-4 leading-7 text-ink">{details.explanation}</p>
      </section>

      <section aria-labelledby="price-logic-heading" className="mt-6">
        <div className="flex items-start gap-3">
          <Calculator className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden="true" />
          <div>
            <h5 id="price-logic-heading" className="text-base font-semibold text-ink">
              Bagaimana harga ini terbentuk?
            </h5>
            <p className="mt-1 text-sm leading-6 text-ink-muted">
              Tiga lapis pertimbangan ini menjelaskan hubungan antara biaya produk dan kondisi pasar.
            </p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          <ExplainabilityStep icon={Calculator} title="1. Modal dan keuntungan">
            <dl className="space-y-2 text-sm">
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-ink-muted">Modal per unit</dt>
                <dd className="font-medium text-ink">{formatRupiah(details.hpp_per_unit_idr)}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-ink-muted">Target keuntungan</dt>
                <dd className="font-medium text-ink">{formatPercentage(details.target_margin_pct)}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3 border-t border-line pt-2">
                <dt className="font-medium text-ink">Batas aman</dt>
                <dd className="font-semibold text-ink">{formatRupiah(details.minimum_price_idr)}</dd>
              </div>
            </dl>
          </ExplainabilityStep>

          <ExplainabilityStep icon={BarChart3} title="2. Harga produk serupa">
            <dl className="space-y-2 text-sm">
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-ink-muted">{lowerMarketLabel}</dt>
                <dd className="font-medium text-ink">{formatRupiah(details.market_p25_idr)}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-ink-muted">Median · harga tengah</dt>
                <dd className="font-medium text-ink">{formatRupiah(details.market_median_idr)}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-ink-muted">{upperMarketLabel}</dt>
                <dd className="font-medium text-ink">{formatRupiah(details.market_p75_idr)}</dd>
              </div>
              <p className="border-t border-line pt-2 text-xs leading-5 text-ink-muted">
                {comparableCount} produk serupa · diperbarui {dataAsOf ?? "tanggal tidak tersedia"}
                {details.market_confidence_score === null
                  ? ""
                  : ` · tingkat keyakinan ${formatPercentage(details.market_confidence_score)}`}
              </p>
            </dl>
          </ExplainabilityStep>

          <ExplainabilityStep icon={TrendingUp} title="3. Harga yang disarankan">
            <dl className="space-y-2 text-sm">
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-ink-muted">Dasar saran</dt>
                <dd className="text-right font-medium text-ink">{basisLabel}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3 border-t border-line pt-2">
                <dt className="font-medium text-ink">Harga jual</dt>
                <dd className="font-semibold text-status-success">{formatRupiah(recommendedPrice)}</dd>
              </div>
              <p className="border-t border-line pt-2 text-xs leading-5 text-ink-muted">
                Harga ini masih menutup modal dan biaya yang diperhitungkan.
              </p>
            </dl>
          </ExplainabilityStep>
        </div>
      </section>

      <PriceRange details={details} recommended={recommendedPrice} />

      <dl className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-line bg-canvas p-4">
          <dt className="text-sm text-ink-muted">Target keuntungan</dt>
          <dd className="mt-2 font-semibold text-ink">{formatPercentage(details.target_margin_pct)}</dd>
          <p className="mt-1 text-xs leading-5 text-ink-muted">Bagian keuntungan dari harga jual</p>
        </div>
        <div className="rounded-xl border border-line bg-canvas p-4">
          <dt className="text-sm text-ink-muted">Selisih dari modal</dt>
          <dd className="mt-2 font-semibold text-ink">{formatPercentage(details.margin_pct)}</dd>
          <p className="mt-1 text-xs leading-5 text-ink-muted">Kenaikan harga dibanding modal</p>
        </div>
        <div className="rounded-xl border border-line bg-canvas p-4">
          <dt className="text-sm text-ink-muted">Perkiraan keuntungan bersih</dt>
          <dd className="mt-2 font-semibold text-ink">{formatPercentage(details.net_margin_pct)}</dd>
          <p className="mt-1 text-xs leading-5 text-ink-muted">Setelah biaya yang diperhitungkan</p>
        </div>
        <div className="rounded-xl border border-line bg-canvas p-4">
          <dt className="text-sm text-ink-muted">Kondisi biaya</dt>
          <dd className="mt-2 font-semibold text-ink">{ZONE_LABELS[details.zone]}</dd>
          <p className="mt-1 text-xs leading-5 text-ink-muted">Perbandingan batas aman dengan harga serupa</p>
        </div>
      </dl>

      <dl className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <PricingTier label="Batas aman" value={details.minimum_price_idr} />
        <PricingTier label="Harga bersaing" value={details.aggressive_price_idr} />
        <PricingTier label="Rekomendasi" value={recommended} />
        <PricingTier label="Harga premium" value={details.premium_price_idr} />
      </dl>

      <section aria-labelledby="cost-breakdown-heading" className="mt-6">
        <h5 id="cost-breakdown-heading" className="text-base font-semibold text-ink">
          Biaya yang diperhitungkan
        </h5>
        <dl className="mt-3 grid gap-x-6 gap-y-3 sm:grid-cols-2">
          {Object.entries(details.cost_breakdown_idr).map(([key, value]) => (
            <div key={key} className="flex items-baseline justify-between gap-4 border-b border-line/70 py-2">
              <dt className="min-w-0 text-sm text-ink-muted">
                {costLabel(key)}
                {costRateLabel(key, details) && (
                  <span className="mt-1 block text-xs text-ink-muted/80">{costRateLabel(key, details)}</span>
                )}
              </dt>
              <dd className="shrink-0 text-right text-sm font-medium text-ink">{formatRupiah(value)}</dd>
            </div>
          ))}
        </dl>
      </section>

      {variantGroups.length > 0 && (
        <section aria-labelledby="variant-prices-heading" className="mt-6">
          <h5 id="variant-prices-heading" className="text-base font-semibold text-ink">
            Harga per variasi
          </h5>
          <div className="mt-4 space-y-5">
            {variantGroups.map(({ kind, variants }) => (
              <div key={kind}>
                <h6 className="text-sm font-medium text-ink-muted">{VARIANT_KIND_LABELS[kind]}</h6>
                <ul className="mt-2 space-y-3">
                  {variants.map((variant) => (
                    <VariantPriceRow key={`${variant.kind}-${variant.label}`} variant={variant} />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

    </div>
  );
}

function CatalogVariationSuggestions({ suggestions }: { suggestions: string[] }) {
  if (suggestions.length === 0) return null;

  return (
    <section
      aria-labelledby="suggested-variations-heading"
      className="self-start rounded-[24px] border border-brand/20 bg-brand-soft/35 p-5 sm:p-6 lg:col-span-4"
    >
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-surface text-brand" aria-hidden="true">
          <TrendingUp className="size-5" />
        </span>
        <div>
          <h3 id="suggested-variations-heading" className="text-lg font-semibold text-ink">
            Saran variasi produk
          </h3>
          <p className="mt-2 text-sm leading-6 text-ink-muted">
            Pilihan yang sering muncul pada produk serupa. Menambahkannya dapat memberi informasi tambahan agar saran kategori dan harga lebih sesuai.
          </p>
        </div>
      </div>
      <ul className="mt-5 space-y-3 text-sm leading-6 text-ink">
        {suggestions.map((suggestion) => (
          <li key={suggestion} className="rounded-xl border border-brand/15 bg-surface p-3">
            {suggestion}
          </li>
        ))}
      </ul>
    </section>
  );
}

function ComparablePreview({
  comparableCount,
  comparables,
  dataAsOf,
}: {
  comparableCount: number;
  comparables: NonNullable<GenerateListingResponse["data"]["listing"]["price"]["comparable_preview"]>;
  dataAsOf: string | null;
}) {
  if (comparables.length === 0) return null;

  return (
    <details className="mt-6 border-t border-line pt-4">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 font-medium text-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand">
        Contoh produk serupa
        <ChevronDown className="size-5 text-ink-muted" aria-hidden="true" />
      </summary>
      <p className="mt-3 text-sm leading-6 text-ink-muted">
        Contoh dari {comparableCount} produk serupa, diperbarui {dataAsOf ?? "tanggal tidak tersedia"}. Produk di bawah ini menjadi pembanding dan belum tentu sama persis.
      </p>
      <ul className="mt-3 divide-y divide-line rounded-xl border border-line bg-canvas" aria-label="Contoh produk serupa">
        {comparables.map((comparable, index) => (
          <li key={`${comparable.title}-${index}`} className="flex items-start justify-between gap-4 p-3 text-sm">
            <span className="min-w-0 text-ink">{comparable.title}</span>
            <span className="shrink-0 font-medium text-ink">{formatRupiah(comparable.price)}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}

function PriceResult({ response, onBack }: { response: GenerateListingResponse; onBack: () => void }) {
  const price = response.data.listing.price;
  const state = priceState(price);
  const hasInsufficientSubtypeEvidence = response.data.warnings.includes(
    "MARKET_SUBTYPE_COMPARABLES_INSUFFICIENT",
  );
  const hasInsufficientAttributeEvidence = response.data.warnings.includes(
    "MARKET_ATTRIBUTE_COMPARABLES_INSUFFICIENT",
  );

  return (
    <section aria-labelledby="price-heading" className="rounded-[24px] border border-line bg-surface p-5 sm:p-6">
      <p className="text-sm font-medium text-ink">Rekomendasi harga</p>
      {state === "available" ? (
        <>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h2 id="price-heading" className="text-3xl font-semibold tracking-[-0.04em] text-ink">
              {formatRupiah(price.recommended!)}
            </h2>
            <span className="rounded-lg bg-brand-soft px-3 py-2 text-sm font-medium text-ink">
              {ALIGNMENT_LABELS[price.alignment]}
            </span>
          </div>
          {price.market_interval && (
            <div className="mt-6 border-t border-line pt-4">
              <p className="text-sm text-ink-muted">Kisaran harga produk serupa</p>
              <p className="mt-1 font-semibold text-ink">
                {formatRupiah(price.market_interval.low)} – {formatRupiah(price.market_interval.high)}
              </p>
            </div>
          )}
          <p className="mt-4 text-sm leading-6 text-ink-muted">
            Kami melihat {price.comparable_count} produk serupa dengan kategori dan ciri yang mirip.
          </p>
          <div className="mt-6 border-t border-line pt-4">
            <p className="text-sm text-ink-muted">Batas aman dari informasi produk</p>
            <p className="mt-1 font-semibold text-ink">{formatRupiah(price.viable_floor)}</p>
            <p className="mt-1 text-sm leading-6 text-ink-muted">Ini batas aman, bukan saran harga pasar.</p>
          </div>
        </>
      ) : (
        <>
          <h2 id="price-heading" className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-ink">
            Belum ada cukup produk serupa
          </h2>
          <p className="mt-3 text-sm leading-6 text-ink-muted">
            Kami belum menemukan cukup produk yang mirip untuk memberikan saran harga yang dapat dipercaya.
          </p>
          {hasInsufficientSubtypeEvidence && (
            <p className="mt-3 text-sm leading-6 text-ink-muted">
              {warningMessage("MARKET_SUBTYPE_COMPARABLES_INSUFFICIENT")}
            </p>
          )}
          {hasInsufficientAttributeEvidence && (
            <p className="mt-3 text-sm leading-6 text-ink-muted">
              {warningMessage("MARKET_ATTRIBUTE_COMPARABLES_INSUFFICIENT")}
            </p>
          )}
          <p className="mt-5 text-sm font-medium text-ink">{price.comparable_count} produk serupa ditemukan</p>
          <Button type="button" variant="outline" className="mt-4" onClick={onBack}>
            Edit informasi produk
          </Button>
          <div className="mt-6 border-t border-line pt-4">
            <p className="text-sm text-ink-muted">Batas aman dari informasi produk</p>
            <p className="mt-1 font-semibold text-ink">{formatRupiah(price.viable_floor)}</p>
            <p className="mt-1 text-sm leading-6 text-ink-muted">Ini batas aman, bukan saran harga pasar.</p>
          </div>
        </>
      )}
      <ComparablePreview
        comparableCount={price.comparable_count}
        comparables={price.comparable_preview ?? []}
        dataAsOf={price.data_as_of}
      />
      {state === "available" && price.pricing_details && (
        <details open className="mt-6 border-t border-line pt-4">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 font-medium text-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand">
            Lihat alasan harga ini
            <ChevronDown className="size-5 text-ink-muted" aria-hidden="true" />
          </summary>
          <PricingDetailsCard
            details={price.pricing_details}
            recommended={price.recommended}
            comparableCount={price.comparable_count}
            dataAsOf={price.data_as_of}
          />
        </details>
      )}
    </section>
  );
}

export function ListingResult({
  response,
  title,
  description,
  categoryCode,
  onCategoryChange,
  onTitleChange,
  onDescriptionChange,
  onBack,
  onContinue,
}: ListingResultProps) {
  const confidence = response.data.confidence;
  const validCopy = title.trim().length > 0 && description.trim().length >= 50;
  const predictedCategoryCode = response.data.listing.category.code;
  const categoryChanged = categoryCode !== predictedCategoryCode;
  const categoryLabel = categoryConfidenceLabel(confidence.category.score);
  const categoryStatusClass = confidence.category.score !== null && confidence.category.score >= 90
    ? "text-status-success bg-status-success/10"
    : "text-status-warning bg-status-warning-soft";
  const priceAvailable = priceState(response.data.listing.price) === "available";
  const readiness = listingReadiness({
    categoryCode,
    title,
    description,
    hasMarketRecommendation: priceAvailable,
  });
  const displayWarnings = visibleWarnings(response.data.warnings, priceAvailable);
  const catalogSuggestions = response.data.listing.price.pricing_details?.suggested_variations ?? [];

  return (
    <div className="space-y-6 pb-24">
      <div className="space-y-6">
        <section aria-labelledby="copy-heading" className="rounded-[24px] border border-line bg-surface p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-ink-muted">Kategori</p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <h2 id="copy-heading" className="text-2xl font-semibold tracking-[-0.03em] text-ink">
                  {CATEGORY_LABELS[categoryCode]}
                </h2>
                <span className={`rounded-lg px-3 py-2 text-sm font-medium ${categoryStatusClass}`}>
                  {confidence.category.score === null ? categoryLabel : `${confidence.category.score}% · ${categoryLabel}`}
                </span>
              </div>
            </div>
          </div>
          <p className="mt-3 text-sm leading-6 text-ink-muted">
            {categoryChanged
              ? `Kategori telah kamu ubah dari saran AI. Saran awal AI: ${CATEGORY_LABELS[predictedCategoryCode]}${confidence.category.score === null ? "." : ` · ${confidence.category.score}% yakin.`}`
              : `AI menyarankan kategori ini dengan keyakinan ${confidence.category.score === null ? "yang perlu diperiksa" : `${confidence.category.score}%`}.`}
          </p>

          <div className="mt-5 max-w-xl">
            <Label htmlFor="category-correction">Ubah kategori</Label>
            <select
              id="category-correction"
              className="form-select mt-2 min-h-11"
              value={categoryCode}
              onChange={(event) => onCategoryChange(event.target.value as CategoryCode)}
              aria-describedby="category-correction-help"
            >
              {CATEGORY_CODES.map((code) => (
                <option key={code} value={code}>{CATEGORY_LABELS[code]}</option>
              ))}
            </select>
            <p id="category-correction-help" className="mt-2 text-sm leading-6 text-ink-muted">
              Keyakinan kategori tetap berasal dari saran awal AI.
            </p>
          </div>

          <div className="mt-6 space-y-5 border-t border-line pt-6">
            <div>
              <div className="flex items-center justify-between gap-4">
            <Label htmlFor="result-title">Judul produk</Label>
                <span className="text-xs text-ink-muted">{title.length}/120</span>
              </div>
              <Input
                id="result-title"
                className="mt-2"
                value={title}
                maxLength={120}
                onChange={(event) => onTitleChange(event.target.value)}
                aria-invalid={!title.trim()}
                aria-describedby={!title.trim() ? "title-result-error" : "copy-grounding"}
              />
              {!title.trim() ? (
                <p id="title-result-error" className="mt-2 text-sm text-status-error">Judul tidak boleh kosong.</p>
              ) : null}
            </div>
            <div>
              <div className="flex items-center justify-between gap-4">
                <Label htmlFor="result-description">Deskripsi produk</Label>
                <span className="text-xs text-ink-muted">{description.length}/600</span>
              </div>
              <Textarea
                id="result-description"
                className="mt-2 min-h-28 max-h-80 resize-y"
                value={description}
                maxLength={600}
                onChange={(event) => onDescriptionChange(event.target.value)}
                aria-invalid={description.trim().length < 50}
                aria-describedby={description.trim().length < 50 ? "description-result-error" : "copy-grounding"}
              />
              {description.trim().length < 50 ? (
                <p id="description-result-error" className="mt-2 text-sm text-status-error">Deskripsi perlu berisi minimal 50 karakter.</p>
              ) : null}
            </div>
            <p id="copy-grounding" className={`flex items-center gap-2 text-sm ${confidence.generation.status === "available" ? "text-status-success" : "text-status-warning"}`}>
              <CheckCircle2 className="size-4" aria-hidden="true" />
              {confidence.generation.status === "available" ? "Didukung fakta" : "Perlu diperiksa"}
            </p>
          </div>
        </section>

        <PriceResult response={response} onBack={onBack} />

        <div className="grid gap-6 lg:grid-cols-12">
        <section
          aria-labelledby="confidence-heading"
          className={`rounded-[24px] border border-line bg-surface p-5 sm:p-6 ${catalogSuggestions.length > 0 ? "lg:col-span-8" : "lg:col-span-12"}`}
        >
          <h2 id="confidence-heading" className="text-xl font-semibold tracking-[-0.02em] text-ink">Seberapa yakin hasil ini?</h2>
          <dl className="mt-4 divide-y divide-line">
            <div className="grid gap-1 py-4 sm:grid-cols-[minmax(10rem,0.8fr)_minmax(11rem,1fr)_minmax(0,1.5fr)] sm:items-center">
              <dt className="font-medium text-ink">Kategori</dt>
              <dd className={`font-medium ${confidence.category.score !== null && confidence.category.score >= 90 ? "text-status-success" : "text-status-warning"}`}>
                {confidence.category.score === null ? "Perlu diperiksa" : `${confidence.category.score}% · ${categoryLabel}`}
              </dd>
              <dd className="text-sm leading-6 text-ink-muted">Berdasarkan foto dan informasi produk.</dd>
            </div>
            <div className="grid gap-1 py-4 sm:grid-cols-[minmax(10rem,0.8fr)_minmax(11rem,1fr)_minmax(0,1.5fr)] sm:items-center">
              <dt className="font-medium text-ink">Judul & deskripsi</dt>
              <dd className={confidence.generation.status === "available" ? "font-medium text-status-success" : "font-medium text-status-warning"}>
                {confidence.generation.status === "available" ? "Didukung fakta" : "Perlu diperiksa"}
              </dd>
              <dd className="text-sm leading-6 text-ink-muted">Informasi didukung input yang kamu berikan.</dd>
            </div>
            <div className="grid gap-1 py-4 sm:grid-cols-[minmax(10rem,0.8fr)_minmax(11rem,1fr)_minmax(0,1.5fr)] sm:items-center">
              <dt className="font-medium text-ink">Harga</dt>
              <dd className={priceAvailable ? "font-medium text-status-success" : "font-medium text-status-warning"}>
                {priceAvailable ? "Rekomendasi tersedia" : "Belum cukup data"}
              </dd>
              <dd className="text-sm leading-6 text-ink-muted">
                {priceAvailable ? "Berdasarkan produk pasar yang serupa." : "Belum ada cukup produk pasar yang mirip."}
              </dd>
            </div>
          </dl>

          <section aria-labelledby="readiness-heading" className="mt-5 rounded-2xl border border-line bg-canvas p-4">
            <h3 id="readiness-heading" className="text-sm font-medium text-ink">Kesiapan produk</h3>
            <p className="mt-1 font-semibold text-ink">{readiness.summary}</p>
            <p className="mt-1 text-sm leading-6 text-ink-muted">{readiness.description}</p>
            {readiness.missing.length > 0 && (
              <p className="mt-3 text-sm font-medium text-status-warning">Perlu dilengkapi: {readiness.missing.join(", ")}</p>
            )}
          </section>

          {displayWarnings.length > 0 && (
            <section role="alert" aria-labelledby="warnings-heading" className="mt-5 rounded-2xl border border-status-warning bg-status-warning-soft p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 size-5 shrink-0 text-status-warning" aria-hidden="true" />
                <div>
                  <h3 id="warnings-heading" className="font-medium text-ink">Hal yang perlu diperiksa</h3>
                  <ul className="mt-1 space-y-1 text-sm leading-6 text-ink-muted">
                    {displayWarnings.map((warning, index) => <li key={`${warning}-${index}`}>{warningMessage(warning)}</li>)}
                  </ul>
                  <Button type="button" variant="outline" className="mt-3" onClick={onBack}>Edit informasi produk</Button>
                </div>
              </div>
            </section>
          )}
        </section>

        <CatalogVariationSuggestions suggestions={catalogSuggestions} />
        </div>
      </div>

      <footer className="sticky bottom-0 z-10 -mx-1 flex flex-col-reverse gap-3 border-t border-line bg-background/95 px-1 py-4 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <Button type="button" variant="outline" onClick={onBack}>
          <ArrowLeft aria-hidden="true" />
          Edit informasi produk
        </Button>
        <Button type="button" size="lg" disabled={!validCopy} onClick={onContinue}>
          Tinjau & salin
          <ArrowRight aria-hidden="true" />
        </Button>
      </footer>
    </div>
  );
}
