"use client";

import { AlertTriangle, ArrowLeft, ArrowRight, Database, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatDateId, formatRupiah } from "@/lib/format";
import {
  CATEGORY_CODES,
  CATEGORY_LABELS,
  type CategoryCode,
  type ConfidenceField,
  type GenerateListingResponse,
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
  MARKET_DATA_STALE: "Data harga pasar mungkin sudah berubah. Periksa kembali sebelum menjual.",
  INSUFFICIENT_COMPARABLES: "Produk pembanding belum cukup untuk memberi keyakinan harga yang kuat.",
  COST_ABOVE_MARKET: "Biaya produk berada di atas rentang pasar. Pertimbangkan kembali biaya atau harga jual.",
  MARKET_EVIDENCE_UNAVAILABLE: "Bukti harga pasar belum tersedia, jadi rekomendasi harga dapat kosong.",
  UNSUPPORTED_CRITICAL_CLAIM_REMOVED: "Klaim penting yang tidak dapat diverifikasi telah dihapus dari listing.",
};

function warningMessage(code: string): string {
  return WARNING_MESSAGES[code] ?? "Ada catatan hasil yang perlu diperiksa sebelum listing digunakan.";
}

function confidenceNeedsReview(value: ConfidenceField): boolean {
  return value.score === null || value.band === "low" || value.status === "insufficient_evidence";
}

function clampPercentage(value: number): number {
  return Math.min(100, Math.max(0, value));
}

function ConfidenceCard({ label, value }: { label: string; value: ConfidenceField }) {
  const bandClass =
    value.band === "high"
      ? "text-status-success"
      : value.band === "medium"
        ? "text-status-warning"
        : value.band === "low"
          ? "text-status-error"
          : "text-ink-muted";

  return (
    <article className="rounded-2xl border border-line bg-canvas p-5">
      <p className="text-sm font-medium text-ink-muted">{label}</p>
      <p className={`mt-3 text-2xl font-semibold ${bandClass}`}>
        {value.score === null ? "Belum cukup data" : `${value.score}%`}
      </p>
      <p className="mt-2 break-words text-xs leading-5 text-ink-muted">Metode: {value.method}</p>
    </article>
  );
}

function PriceResult({ response }: { response: GenerateListingResponse }) {
  const price = response.data.listing.price;
  const interval = price.market_interval;
  const visualValues = interval
    ? [
        price.viable_floor,
        interval.low,
        interval.high,
        ...(price.recommended === null ? [] : [price.recommended]),
      ]
    : [];
  const visualMinimum = visualValues.length > 0 ? Math.min(...visualValues) : 0;
  const visualRange = visualValues.length > 0 ? Math.max(Math.max(...visualValues) - visualMinimum, 1) : 1;
  const visualPosition = (value: number) =>
    clampPercentage(((value - visualMinimum) / visualRange) * 100);
  const intervalStart = interval ? visualPosition(interval.low) : 0;
  const intervalEnd = interval ? visualPosition(interval.high) : 0;

  return (
    <section aria-labelledby="price-heading" className="rounded-[24px] border border-line bg-surface p-5 sm:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium text-ink">Rekomendasi harga</p>
          <h3 id="price-heading" className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-ink sm:text-4xl">
            {price.recommended === null ? "Belum tersedia" : formatRupiah(price.recommended)}
          </h3>
        </div>
        <span className="w-fit rounded-lg bg-brand-soft px-3 py-2 text-sm font-medium text-ink">
          {ALIGNMENT_LABELS[price.alignment]}
        </span>
      </div>

      {interval && (
        <div className="relative mt-8 h-8" aria-hidden="true">
          <div className="absolute inset-x-0 top-3 h-3 rounded-full bg-ink/10" />
          <div
            className="absolute top-3 h-3 rounded-full bg-brand/32"
            style={{
              left: `${intervalStart}%`,
              width: `${Math.max(intervalEnd - intervalStart, 0)}%`,
            }}
          />
          <span
            className="absolute top-0 h-8 w-1 -translate-x-1/2 rounded-full bg-status-warning"
            style={{ left: `${visualPosition(price.viable_floor)}%` }}
          />
          {price.recommended !== null && (
            <span
              className="absolute top-0 h-8 w-1 -translate-x-1/2 rounded-full bg-brand"
              style={{ left: `${visualPosition(price.recommended)}%` }}
            />
          )}
        </div>
      )}
      <dl className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="text-sm text-ink-muted">Rentang pasar</dt>
          <dd className="mt-2 font-semibold text-ink">
            {price.market_interval
              ? `${formatRupiah(price.market_interval.low)} – ${formatRupiah(price.market_interval.high)}`
              : "Belum tersedia"}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-ink-muted">Batas harga layak</dt>
          <dd className="mt-2 font-semibold text-ink">{formatRupiah(price.viable_floor)}</dd>
        </div>
        <div>
          <dt className="text-sm text-ink-muted">Produk pembanding</dt>
          <dd className="mt-2 font-semibold text-ink">{price.comparable_count}</dd>
        </div>
        <div>
          <dt className="text-sm text-ink-muted">Data diperbarui</dt>
          <dd className="mt-2 font-semibold text-ink">{formatDateId(price.data_as_of)}</dd>
        </div>
      </dl>
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
  const confidenceReasons = [
    confidenceNeedsReview(confidence.category) ? "Bukti kategori belum cukup." : null,
    confidenceNeedsReview(confidence.price) ? "Bukti harga pasar belum cukup." : null,
    confidenceNeedsReview(confidence.generation) ? "Bukti untuk penyusunan copy belum cukup." : null,
    confidenceNeedsReview(confidence.overall) ? "Skor keseluruhan masih rendah atau belum tersedia." : null,
  ].filter((reason): reason is string => Boolean(reason));
  const needsConfidenceReview = confidenceReasons.length > 0;

  return (
    <div className="space-y-8">
      <section aria-labelledby="copy-heading" className="rounded-[24px] border border-line bg-surface p-5 sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-medium text-ink">Kategori terpilih</p>
            <h2 id="copy-heading" className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-ink">
              {CATEGORY_LABELS[categoryCode]}
            </h2>
            <p className="mt-2 font-mono text-xs text-ink-muted">{categoryCode}</p>
          </div>
          <ShieldCheck className="size-8 text-brand" aria-hidden="true" />
        </div>

        <div className="mt-8 max-w-xl">
          <Label htmlFor="category-correction">Periksa atau koreksi kategori</Label>
          <select
            id="category-correction"
            className="form-select mt-3"
            value={categoryCode}
            onChange={(event) => onCategoryChange(event.target.value as CategoryCode)}
            aria-describedby="category-correction-help"
          >
            {CATEGORY_CODES.map((code) => (
              <option key={code} value={code}>
                {CATEGORY_LABELS[code]}
              </option>
            ))}
          </select>
          <p id="category-correction-help" className="mt-2 text-sm leading-6 text-ink-muted">
            Prediksi awal model: {CATEGORY_LABELS[predictedCategoryCode]}. Confidence kategori tetap mencerminkan prediksi awal, bukan koreksi ini.
          </p>
        </div>

        <div className="mt-8 space-y-6">
          <div>
            <Label htmlFor="result-title">Judul listing</Label>
            <Input
              id="result-title"
              className="mt-3"
              value={title}
              maxLength={120}
              onChange={(event) => onTitleChange(event.target.value)}
              aria-invalid={!title.trim()}
              aria-describedby={!title.trim() ? "title-result-error" : undefined}
            />
            {!title.trim() && <p id="title-result-error" className="mt-2 text-sm text-status-error">Judul tidak boleh kosong.</p>}
          </div>
          <div>
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="result-description">Deskripsi listing</Label>
              <span className="text-xs text-ink-muted">{description.length}/600</span>
            </div>
            <Textarea
              id="result-description"
              className="mt-3 min-h-48"
              value={description}
              maxLength={600}
              onChange={(event) => onDescriptionChange(event.target.value)}
              aria-invalid={description.trim().length < 50}
              aria-describedby={description.trim().length < 50 ? "description-result-error" : undefined}
            />
            {description.trim().length < 50 && (
              <p id="description-result-error" className="mt-2 text-sm text-status-error">
                Deskripsi perlu berisi minimal 50 karakter.
              </p>
            )}
          </div>
        </div>
      </section>

      <PriceResult response={response} />

      {needsConfidenceReview && (
        <section
          role="alert"
          aria-labelledby="confidence-review-heading"
          className="rounded-[24px] border border-status-warning bg-status-warning-soft p-5 sm:p-8"
        >
          <div className="flex items-start gap-4">
            <AlertTriangle className="mt-1 size-6 shrink-0 text-status-warning" aria-hidden="true" />
            <div className="min-w-0">
              <h2 id="confidence-review-heading" className="text-lg font-semibold text-ink">
                Saran ini perlu diperiksa
              </h2>
              <p className="mt-2 leading-7 text-ink">
                Beberapa bagian hasil belum didukung bukti yang cukup untuk langsung digunakan.
              </p>
              <ul className="mt-3 list-disc space-y-1 pl-5 leading-7 text-ink">
                {confidenceReasons.map((reason) => <li key={reason}>{reason}</li>)}
              </ul>
              <Button type="button" variant="outline" className="mt-5" onClick={onBack}>
                Perbaiki fakta
              </Button>
            </div>
          </div>
        </section>
      )}

      <section aria-labelledby="confidence-heading" className="rounded-[24px] border border-line bg-surface p-5 sm:p-8">
        <h2 id="confidence-heading" className="text-2xl font-semibold tracking-[-0.03em] text-ink">
          Confidence hasil
        </h2>
        <p className="mt-3 max-w-3xl leading-7 text-ink-muted">
          Confidence menunjukkan kekuatan bukti pada setiap bagian, bukan jaminan hasil jual. Jika kategori kamu koreksi, nilainya tetap menjelaskan prediksi awal model.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <ConfidenceCard label="Kategori" value={confidence.category} />
          <ConfidenceCard label="Harga" value={confidence.price} />
          <ConfidenceCard label="Penyusunan copy" value={confidence.generation} />
          <ConfidenceCard label="Keseluruhan" value={confidence.overall} />
        </div>
      </section>

      {response.data.warnings.length > 0 && (
        <section aria-labelledby="warnings-heading" className="rounded-[24px] border border-status-warning bg-status-warning-soft p-5 sm:p-8">
          <div className="flex items-start gap-4">
            <AlertTriangle className="mt-1 size-6 shrink-0 text-status-warning" aria-hidden="true" />
            <div>
              <h2 id="warnings-heading" className="text-lg font-semibold text-ink">Hal yang perlu diperiksa</h2>
              <ul className="mt-4 list-disc space-y-2 pl-5 leading-7 text-ink">
                {response.data.warnings.map((warning, index) => (
                  <li key={`${warning}-${index}`}>{warningMessage(warning)}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      )}

      <section aria-labelledby="provenance-heading" className="rounded-[24px] border border-line bg-canvas p-5 sm:p-8">
        <div className="flex items-start gap-4">
          <Database className="mt-1 size-6 shrink-0 text-brand" aria-hidden="true" />
          <div className="min-w-0">
            <h2 id="provenance-heading" className="text-lg font-semibold text-ink">Sumber versi hasil</h2>
            <p className="mt-2 break-all font-mono text-xs leading-5 text-ink-muted">
              Request ID: {response.meta.request_id}
            </p>
            {hasVersions ? (
              <dl className="mt-5 grid gap-4 sm:grid-cols-2">
                {versions.map(([label, value]) => value ? (
                  <div key={label}>
                    <dt className="text-sm text-ink-muted">{label}</dt>
                    <dd className="mt-1 break-all font-mono text-xs text-ink">{value}</dd>
                  </div>
                ) : null)}
              </dl>
            ) : (
              <p className="mt-4 text-sm text-ink-muted">Versi model belum disertakan oleh backend.</p>
            )}
          </div>
        </div>
      </section>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        <Button type="button" variant="outline" onClick={onBack}>
          <ArrowLeft aria-hidden="true" />
          Ubah fakta
        </Button>
        <Button type="button" size="lg" disabled={!validCopy} onClick={onContinue}>
          Lanjut ke salin
          <ArrowRight aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
