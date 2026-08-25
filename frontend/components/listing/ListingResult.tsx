"use client";

import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, ChevronDown, Database } from "lucide-react";

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

const VERSION_LABELS = {
  generator_version: "Generator",
  taxonomy_version: "Taksonomi",
  category_model_version: "Model kategori",
  price_model_version: "Model harga",
  price_data_version: "Data harga",
  guardrail_version: "Guardrail",
  calibration_version: "Kalibrasi",
} as const;

const WARNING_MESSAGES: Record<string, string> = {
  PLATFORM_FEE_NOT_PROVIDED:
    "Biaya platform belum diisi, jadi harga belum memperhitungkan potongan platform.",
  PLATFORM_FEE_DEFAULTED:
    "Biaya platform diisi 0%, jadi tarif platform terbaru untuk marketplace ini dipakai otomatis.",
  UNKNOWN_CATEGORY_TARIFF_FALLBACK:
    "Kategori tarif spesifik belum tersedia, jadi tarif kategori Lainnya dipakai sebagai acuan.",
  MARKET_DATA_STALE: "Data harga pasar mungkin sudah berubah. Periksa kembali sebelum menjual.",
  INSUFFICIENT_COMPARABLES: "Produk pembanding belum cukup untuk memberi keyakinan harga yang kuat.",
  COST_ABOVE_MARKET: "Biaya produk berada di atas rentang pasar. Pertimbangkan kembali biaya atau harga jual.",
  MARKET_EVIDENCE_UNAVAILABLE: "Bukti harga pasar belum tersedia, jadi rekomendasi harga dapat kosong.",
  MARKET_SUBTYPE_COMPARABLES_INSUFFICIENT:
    "Contoh produk dengan jenis yang sama sudah ditemukan, tetapi jumlahnya belum cukup untuk rekomendasi harga pasar.",
  MARKET_ATTRIBUTE_COMPARABLES_INSUFFICIENT:
    "Contoh produk dengan atribut yang kamu isi sudah ditemukan, tetapi jumlahnya belum cukup untuk rekomendasi harga pasar.",
  MARKET_VISUAL_QUERY_FALLBACK:
    "Bukti harga dari fakta produk belum cukup, sehingga copy listing dipakai sebagai petunjuk pencarian pembanding.",
  MARKET_CATEGORY_FALLBACK:
    "Bukti harga spesifik belum cukup, sehingga pembanding dari kategori produk dipakai sebagai acuan.",
  UNSUPPORTED_CRITICAL_CLAIM_REMOVED: "Klaim penting yang tidak dapat diverifikasi telah dihapus dari listing.",
};

function warningMessage(code: string): string {
  return WARNING_MESSAGES[code] ?? "Ada catatan hasil yang perlu diperiksa sebelum listing digunakan.";
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
      description: "Kategori, judul, deskripsi, dan rekomendasi harga siap digunakan.",
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
          : `${onlyMissing} perlu dilengkapi sebelum listing siap sepenuhnya.`,
    };
  }
  return {
    missing,
    summary: "Perlu beberapa perbaikan",
    description: `${missing.join(" dan ")} perlu dilengkapi sebelum listing siap digunakan.`,
  };
}

const ZONE_LABELS: Record<PricingDetails["zone"], string> = {
  good: "Sehat",
  fair: "Wajar",
  tight: "Ketat",
  danger: "Berisiko",
};

const COST_LABELS: Record<string, string> = {
  hpp: "HPP per unit",
  platform_commission: "Komisi platform",
  shipping_program: "Program ongkir",
  processing_fee: "Biaya pemrosesan",
  income_tax: "Pajak penghasilan",
  vat: "PPN",
  net_profit: "Laba bersih",
};

const VARIANT_KIND_LABELS: Record<VariantPriceDetails["kind"], string> = {
  color: "Warna",
  size: "Ukuran",
  grade: "Grade",
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

function VariantPriceRow({ variant }: { variant: VariantPriceDetails }) {
  return (
    <li className="rounded-xl border border-line bg-canvas p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="font-medium text-ink">{variant.label}</p>
          <p className="mt-1 text-sm text-ink-muted">
            {VARIANT_KIND_LABELS[variant.kind]} · HPP {formatRupiah(variant.hpp_per_unit_idr)}
          </p>
        </div>
        <p className="shrink-0 text-sm font-medium text-ink">
          Margin {formatPercentage(variant.margin_pct)}
        </p>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-ink-muted">Minimum</dt>
          <dd className="mt-1 font-medium text-ink">{formatRupiah(variant.minimum_price_idr)}</dd>
        </div>
        <div>
          <dt className="text-ink-muted">Agresif</dt>
          <dd className="mt-1 font-medium text-ink">{formatRupiah(variant.aggressive_price_idr)}</dd>
        </div>
        <div>
          <dt className="text-ink-muted">Rekomendasi</dt>
          <dd className="mt-1 font-medium text-ink">{formatRupiah(variant.recommended_price_idr)}</dd>
        </div>
        <div>
          <dt className="text-ink-muted">Premium</dt>
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
}: {
  details: PricingDetails;
  recommended: number | null;
}) {
  const variantGroups = (['color', 'size', 'grade'] as const)
    .map((kind) => ({
      kind,
      variants: details.variant_prices.filter((variant) => variant.kind === kind),
    }))
    .filter(({ variants }) => variants.length > 0);

  return (
    <div className="mt-8 border-t border-line/70 pt-6" aria-labelledby="pricing-details-heading">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h4 id="pricing-details-heading" className="text-lg font-semibold text-ink">
            Rincian harga
          </h4>
          <p className="mt-1 text-sm leading-6 text-ink-muted">
            Per unit jual: {details.sale_unit}. Rincian ini tersedia karena backend memiliki bukti harga dan biaya yang cukup.
          </p>
        </div>
        <span className="w-fit rounded-lg bg-brand-soft px-3 py-2 text-sm font-medium text-ink">
          Zona {ZONE_LABELS[details.zone]}
        </span>
      </div>

      <dl className="mt-5 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-line bg-canvas p-4">
          <dt className="text-sm text-ink-muted">HPP per unit jual</dt>
          <dd className="mt-2 font-semibold text-ink">{formatRupiah(details.hpp_per_unit_idr)}</dd>
        </div>
        <div className="rounded-xl border border-line bg-canvas p-4">
          <dt className="text-sm text-ink-muted">Margin terhitung</dt>
          <dd className="mt-2 font-semibold text-ink">{formatPercentage(details.margin_pct)}</dd>
        </div>
        <div className="rounded-xl border border-line bg-canvas p-4">
          <dt className="text-sm text-ink-muted">Status biaya</dt>
          <dd className="mt-2 font-semibold text-ink">{ZONE_LABELS[details.zone]}</dd>
        </div>
      </dl>

      <dl className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <PricingTier label="Minimum" value={details.minimum_price_idr} />
        <PricingTier label="Agresif" value={details.aggressive_price_idr} />
        <PricingTier label="Rekomendasi" value={recommended} />
        <PricingTier label="Premium" value={details.premium_price_idr} />
      </dl>

      <section aria-labelledby="cost-breakdown-heading" className="mt-6">
        <h5 id="cost-breakdown-heading" className="text-base font-semibold text-ink">
          Rincian biaya
        </h5>
        <dl className="mt-3 grid gap-x-6 gap-y-3 sm:grid-cols-2">
          {Object.entries(details.cost_breakdown_idr).map(([key, value]) => (
            <div key={key} className="flex items-baseline justify-between gap-4 border-b border-line/70 py-2">
              <dt className="text-sm text-ink-muted">{costLabel(key)}</dt>
              <dd className="text-right text-sm font-medium text-ink">{formatRupiah(value)}</dd>
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

      {details.suggested_variations.length > 0 && (
        <section aria-labelledby="suggested-variations-heading" className="mt-6">
          <h5 id="suggested-variations-heading" className="text-base font-semibold text-ink">
            Saran variasi dari katalog
          </h5>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-ink">
            {details.suggested_variations.map((suggestion) => (
              <li key={suggestion}>{suggestion}</li>
            ))}
          </ul>
        </section>
      )}

      <p className="mt-6 leading-7 text-ink">{details.explanation}</p>
      <p className="mt-3 text-xs leading-5 text-ink-muted">
        Mesin perhitungan: <span className="font-mono">{details.engine_version}</span>
      </p>
    </div>
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
        Contoh produk pembanding dari katalog
        <ChevronDown className="size-5 text-ink-muted" aria-hidden="true" />
      </summary>
      <p className="mt-3 text-sm leading-6 text-ink-muted">
        Sampel dari {comparableCount} produk pembanding pada data {dataAsOf ?? "tanggal tidak tersedia"}; tidak semua baris adalah kecocokan persis.
      </p>
      <ul className="mt-3 divide-y divide-line rounded-xl border border-line bg-canvas" aria-label="Contoh produk pembanding">
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
              <p className="text-sm text-ink-muted">Rentang pasar</p>
              <p className="mt-1 font-semibold text-ink">
                {formatRupiah(price.market_interval.low)} – {formatRupiah(price.market_interval.high)}
              </p>
            </div>
          )}
          <p className="mt-4 text-sm leading-6 text-ink-muted">
            Berdasarkan {price.comparable_count} produk pembanding dengan kategori dan karakteristik serupa.
          </p>
          <div className="mt-6 border-t border-line pt-4">
            <p className="text-sm text-ink-muted">Batas harga berdasarkan informasi produk</p>
            <p className="mt-1 font-semibold text-ink">{formatRupiah(price.viable_floor)}</p>
            <p className="mt-1 text-sm leading-6 text-ink-muted">Nilai ini bukan rekomendasi harga pasar.</p>
          </div>
        </>
      ) : (
        <>
          <h2 id="price-heading" className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-ink">
            Belum ada cukup produk pembanding
          </h2>
          <p className="mt-3 text-sm leading-6 text-ink-muted">
            Kami belum menemukan produk pasar yang cukup mirip untuk memberikan rekomendasi harga yang dapat dipercaya.
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
          <p className="mt-5 text-sm font-medium text-ink">{price.comparable_count} produk pembanding</p>
          <Button type="button" variant="outline" className="mt-4" onClick={onBack}>
            Edit informasi produk
          </Button>
          <div className="mt-6 border-t border-line pt-4">
            <p className="text-sm text-ink-muted">Batas harga berdasarkan informasi produk</p>
            <p className="mt-1 font-semibold text-ink">{formatRupiah(price.viable_floor)}</p>
            <p className="mt-1 text-sm leading-6 text-ink-muted">Nilai ini bukan rekomendasi harga pasar.</p>
          </div>
        </>
      )}
      <ComparablePreview
        comparableCount={price.comparable_count}
        comparables={price.comparable_preview ?? []}
        dataAsOf={price.data_as_of}
      />
      {state === "available" && price.pricing_details && (
        <details className="mt-6 border-t border-line pt-4">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 font-medium text-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand">
            Lihat rincian perhitungan harga
            <ChevronDown className="size-5 text-ink-muted" aria-hidden="true" />
          </summary>
          <PricingDetailsCard details={price.pricing_details} recommended={price.recommended} />
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
  const versions = Object.entries(VERSION_LABELS)
    .map(([key, label]) => [label, response.meta[key as keyof typeof VERSION_LABELS]] as const);
  const hasVersions = versions.some(([, value]) => Boolean(value));
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

  return (
    <div className="space-y-6 pb-24">
      <div className="grid gap-6 lg:grid-cols-12">
        <section aria-labelledby="copy-heading" className="rounded-[24px] border border-line bg-surface p-5 sm:p-6 lg:col-span-8">
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
                <Label htmlFor="result-title">Judul listing</Label>
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
                <Label htmlFor="result-description">Deskripsi listing</Label>
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

        <div className="lg:col-span-4"><PriceResult response={response} onBack={onBack} /></div>

        <section aria-labelledby="confidence-heading" className="rounded-[24px] border border-line bg-surface p-5 sm:p-6 lg:col-span-8">
          <h2 id="confidence-heading" className="text-xl font-semibold tracking-[-0.02em] text-ink">Keyakinan hasil</h2>
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
            <h3 id="readiness-heading" className="text-sm font-medium text-ink">Kesiapan listing</h3>
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

        <details className="group self-start rounded-[24px] border border-line bg-canvas p-5 sm:p-6 lg:col-span-4">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 font-medium text-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand">
            <span className="flex items-center gap-2"><Database className="size-5 text-brand" aria-hidden="true" />Detail teknis hasil</span>
            <ChevronDown
              className="size-5 text-ink-muted transition-transform group-open:rotate-180 motion-reduce:transition-none"
              aria-hidden="true"
            />
          </summary>
          <div className="mt-4 border-t border-line pt-4">
            <dl className="space-y-4">
              <div>
                <dt className="text-sm text-ink-muted">Request ID</dt>
                <dd className="mt-1 break-all font-mono text-xs text-ink">{response.meta.request_id}</dd>
              </div>
              {hasVersions ? versions.map(([label, value]) => value ? (
                <div key={label}>
                  <dt className="text-sm text-ink-muted">{label}</dt>
                  <dd className="mt-1 break-all font-mono text-xs text-ink">{value}</dd>
                </div>
              ) : null) : <p className="text-sm text-ink-muted">Versi model belum disertakan oleh backend.</p>}
            </dl>
          </div>
        </details>
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
