"use client";

import type { ChangeEvent, FormEvent } from "react";
import { Camera, CircleDollarSign, ImageUp, LoaderCircle, Package, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { FieldErrors, ListingField, ListingFormValues } from "@/lib/listing-validation";

const PLATFORMS = [
  ["umum", "Umum"],
  ["tokopedia", "Tokopedia"],
  ["shopee", "Shopee"],
  ["blibli", "Blibli"],
] as const;

const REGIONS = [
  ["ID-JK", "DKI Jakarta"],
  ["ID-JB", "Jawa Barat"],
  ["ID-JT", "Jawa Tengah"],
  ["ID-JI", "Jawa Timur"],
  ["ID-YO", "DI Yogyakarta"],
  ["ID-BT", "Banten"],
  ["ID-BA", "Bali"],
  ["ID-SU", "Sumatera Utara"],
  ["ID-SS", "Sumatera Selatan"],
] as const;

interface ListingFormProps {
  values: ListingFormValues;
  previewUrl: string | null;
  errors: FieldErrors;
  isSubmitting: boolean;
  progressMessage: string | null;
  onFieldChange: (field: keyof ListingFormValues, value: string) => void;
  onImageChange: (file: File | null) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
}

function FieldError({ field, errors }: { field: ListingField; errors: FieldErrors }) {
  if (!errors[field]) return null;
  return (
    <p id={`${field}-error`} role="alert" className="mt-2 text-sm leading-6 text-status-error">
      {errors[field]}
    </p>
  );
}

function errorProps(field: ListingField, errors: FieldErrors, describedBy?: string) {
  const describedByIds = [describedBy, errors[field] ? `${field}-error` : undefined]
    .filter(Boolean)
    .join(" ");

  return {
    "aria-invalid": Boolean(errors[field]),
    "aria-describedby": describedByIds || undefined,
  };
}

export function ListingForm({
  values,
  previewUrl,
  errors,
  isSubmitting,
  progressMessage,
  onFieldChange,
  onImageChange,
  onSubmit,
  onCancel,
}: ListingFormProps) {
  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    onImageChange(event.target.files?.[0] ?? null);
  }

  return (
    <form onSubmit={onSubmit} noValidate aria-busy={isSubmitting} className="space-y-6 md:space-y-8">
      <section
        aria-labelledby="foto-heading"
        className="overflow-hidden rounded-[28px] border border-line/70 bg-surface shadow-[0_24px_64px_rgba(16,37,28,0.08)]"
      >
        <div className="flex items-start gap-4 border-b border-line/60 px-5 py-5 sm:px-8 sm:py-6 lg:px-10">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand">
            <Camera className="size-6" aria-hidden="true" />
          </span>
          <div className="max-w-2xl">
            <h2 id="foto-heading" className="text-xl font-semibold tracking-[-0.03em] text-ink sm:text-2xl">
              Foto produk
            </h2>
            <p className="mt-2 leading-7 text-ink-muted">
              Gunakan satu foto utama yang terang. Format JPEG, PNG, atau WebP dengan ukuran maksimal 5 MiB.
            </p>
          </div>
        </div>

        <div className="p-5 sm:p-8 lg:p-10">
          <Label
            htmlFor="image"
            className={`group relative flex min-h-72 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-[24px] border-2 border-dashed p-6 text-center transition-colors sm:min-h-80 ${
              errors.image
                ? "border-status-error bg-status-error-soft"
                : "border-brand/32 bg-brand-soft/40 hover:border-brand hover:bg-brand-soft/70"
            } focus-within:border-brand focus-within:ring-4 focus-within:ring-brand`}
          >
            <Input
              id="image"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="absolute inset-0 z-10 size-full cursor-pointer opacity-0"
              onChange={handleFileChange}
              disabled={isSubmitting}
              required
              aria-required="true"
              {...errorProps("image", errors)}
            />
            {previewUrl ? (
              // Object URLs are browser-local previews and cannot be optimized by next/image.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewUrl} alt="Pratinjau foto produk" className="absolute inset-0 size-full object-cover" />
            ) : (
              <>
                <span className="grid size-16 place-items-center rounded-2xl bg-surface text-brand shadow-[0_12px_32px_rgba(16,37,28,0.12)]">
                  <ImageUp className="size-7" aria-hidden="true" />
                </span>
                <span className="mt-5 text-lg font-semibold text-ink">Pilih foto produk</span>
                <span className="mt-2 max-w-sm text-sm leading-6 text-ink-muted">JPEG, PNG, atau WebP hingga 5 MiB</span>
              </>
            )}
            {previewUrl && (
              <span className="absolute bottom-4 left-4 rounded-lg bg-ink/88 px-3 py-2 text-sm text-white">
                Ganti foto
              </span>
            )}
          </Label>
          <FieldError field="image" errors={errors} />
        </div>
      </section>

      <section
        aria-labelledby="facts-heading"
        className="overflow-hidden rounded-[28px] border border-line/70 bg-surface shadow-[0_24px_64px_rgba(16,37,28,0.08)]"
      >
        <div className="flex items-start gap-4 border-b border-line/60 px-5 py-5 sm:px-8 sm:py-6 lg:px-10">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand">
            <Package className="size-6" aria-hidden="true" />
          </span>
          <div className="max-w-2xl">
            <h2 id="facts-heading" className="text-xl font-semibold tracking-[-0.03em] text-ink sm:text-2xl">
              Fakta produk dan pasar
            </h2>
            <p className="mt-2 leading-7 text-ink-muted">
              Isi hanya informasi yang benar-benar kamu ketahui. Kolom bertanda wajib diperlukan untuk membuat hasil.
            </p>
          </div>
        </div>

        <div className="grid gap-x-6 gap-y-7 p-5 sm:p-8 md:grid-cols-2 lg:p-10">
          <div className="md:col-span-2">
            <Label htmlFor="productType">Jenis produk <span aria-hidden="true">*</span></Label>
            <Input
              id="productType"
              className="mt-3"
              value={values.productType}
              maxLength={80}
              placeholder="Contoh: keripik pisang cokelat"
              disabled={isSubmitting}
              required
              aria-required="true"
              onChange={(event) => onFieldChange("productType", event.target.value)}
              {...errorProps("productType", errors)}
            />
            <FieldError field="productType" errors={errors} />
          </div>

          <div>
            <Label htmlFor="platform">Platform tujuan <span aria-hidden="true">*</span></Label>
            <select
              id="platform"
              className="form-select mt-3"
              value={values.platform}
              disabled={isSubmitting}
              required
              aria-required="true"
              onChange={(event) => onFieldChange("platform", event.target.value)}
              {...errorProps("platform", errors)}
            >
              {PLATFORMS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <FieldError field="platform" errors={errors} />
          </div>

          <div>
            <Label htmlFor="marketRegionCode">Wilayah pasar</Label>
            <select
              id="marketRegionCode"
              className="form-select mt-3"
              value={values.marketRegionCode}
              disabled={isSubmitting}
              onChange={(event) => onFieldChange("marketRegionCode", event.target.value)}
              {...errorProps("marketRegionCode", errors, "marketRegionCode-help")}
            >
              <option value="">Tidak ditentukan</option>
              {REGIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <p id="marketRegionCode-help" className="mt-2 text-sm leading-6 text-ink-muted">
              Jika dipilih, wilayah disimpan untuk perbandingan regional di masa depan. Saat ini wilayah belum memengaruhi rekomendasi.
            </p>
            <FieldError field="marketRegionCode" errors={errors} />
          </div>

          <div>
            <Label htmlFor="brand">Merek</Label>
            <Input
              id="brand"
              className="mt-3"
              value={values.brand}
              maxLength={120}
              placeholder="Contoh: Dapur Bu Sari"
              disabled={isSubmitting}
              onChange={(event) => onFieldChange("brand", event.target.value)}
              {...errorProps("brand", errors)}
            />
            <FieldError field="brand" errors={errors} />
          </div>

          <div>
            <Label htmlFor="variant">Varian</Label>
            <Input
              id="variant"
              className="mt-3"
              value={values.variant}
              maxLength={120}
              placeholder="Contoh: cokelat"
              disabled={isSubmitting}
              onChange={(event) => onFieldChange("variant", event.target.value)}
              {...errorProps("variant", errors)}
            />
            <FieldError field="variant" errors={errors} />
          </div>

          <div>
            <Label htmlFor="size">Ukuran atau isi</Label>
            <Input
              id="size"
              className="mt-3"
              value={values.size}
              maxLength={120}
              placeholder="Contoh: 200 g"
              disabled={isSubmitting}
              onChange={(event) => onFieldChange("size", event.target.value)}
              {...errorProps("size", errors)}
            />
            <FieldError field="size" errors={errors} />
          </div>

          <div>
            <Label htmlFor="materialOrIngredients">Bahan atau komposisi</Label>
            <Input
              id="materialOrIngredients"
              className="mt-3"
              value={values.materialOrIngredients}
              maxLength={120}
              placeholder="Contoh: pisang kepok, cokelat"
              disabled={isSubmitting}
              onChange={(event) => onFieldChange("materialOrIngredients", event.target.value)}
              {...errorProps("materialOrIngredients", errors)}
            />
            <FieldError field="materialOrIngredients" errors={errors} />
          </div>
        </div>
      </section>

      <section
        aria-labelledby="cost-heading"
        className="overflow-hidden rounded-[28px] border border-line/70 bg-surface shadow-[0_24px_64px_rgba(16,37,28,0.08)]"
      >
        <div className="flex items-start gap-4 border-b border-line/60 px-5 py-5 sm:px-8 sm:py-6 lg:px-10">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand">
            <CircleDollarSign className="size-6" aria-hidden="true" />
          </span>
          <div className="max-w-2xl">
            <h2 id="cost-heading" className="text-xl font-semibold tracking-[-0.03em] text-ink sm:text-2xl">
              Biaya dan target
            </h2>
            <p className="mt-2 leading-7 text-ink-muted">
              Masukkan biaya untuk satu unit yang dijual. Margin dan potongan dihitung dari harga jual.
            </p>
          </div>
        </div>

        <div className="grid gap-x-6 gap-y-7 p-5 sm:p-8 md:grid-cols-2 lg:p-10">
          <div>
            <Label htmlFor="productionCost">Biaya produksi per unit terjual <span aria-hidden="true">*</span></Label>
            <Input
              id="productionCost"
              type="number"
              inputMode="numeric"
              min={1000}
              max={1_000_000_000}
              step={1}
              className="mt-3"
              value={values.productionCost}
              placeholder="Contoh: 25000"
              disabled={isSubmitting}
              required
              aria-required="true"
              onChange={(event) => onFieldChange("productionCost", event.target.value)}
              {...errorProps("productionCost", errors)}
            />
            <FieldError field="productionCost" errors={errors} />
          </div>

          <div>
            <Label htmlFor="packagingCost">Biaya kemasan per unit terjual</Label>
            <Input
              id="packagingCost"
              type="number"
              inputMode="numeric"
              min={0}
              max={1_000_000_000}
              step={1}
              className="mt-3"
              value={values.packagingCost}
              disabled={isSubmitting}
              onChange={(event) => onFieldChange("packagingCost", event.target.value)}
              {...errorProps("packagingCost", errors)}
            />
            <FieldError field="packagingCost" errors={errors} />
          </div>

          <div>
            <Label htmlFor="otherCost">Biaya lain per unit terjual</Label>
            <Input
              id="otherCost"
              type="number"
              inputMode="numeric"
              min={0}
              max={1_000_000_000}
              step={1}
              className="mt-3"
              value={values.otherCost}
              disabled={isSubmitting}
              onChange={(event) => onFieldChange("otherCost", event.target.value)}
              {...errorProps("otherCost", errors)}
            />
            <FieldError field="otherCost" errors={errors} />
          </div>

          <div>
            <Label htmlFor="targetMargin">Target margin (%)</Label>
            <Input
              id="targetMargin"
              type="number"
              inputMode="decimal"
              min={0}
              max={80}
              step="0.1"
              placeholder="30"
              className="mt-3"
              value={values.targetMargin}
              disabled={isSubmitting}
              onChange={(event) => onFieldChange("targetMargin", event.target.value)}
              {...errorProps("targetMargin", errors, "targetMargin-help")}
            />
            <p id="targetMargin-help" className="mt-2 text-sm leading-6 text-ink-muted">
              Persentase laba dari harga jual. Jika dikosongkan, LAPAKIN memakai 30%.
            </p>
            <FieldError field="targetMargin" errors={errors} />
          </div>

          <div>
            <Label htmlFor="platformFee">Biaya platform (%)</Label>
            <Input
              id="platformFee"
              type="number"
              inputMode="decimal"
              min={0}
              max={40}
              step="0.1"
              placeholder="0"
              className="mt-3"
              value={values.platformFee}
              disabled={isSubmitting}
              onChange={(event) => onFieldChange("platformFee", event.target.value)}
              {...errorProps("platformFee", errors, "platformFee-help")}
            />
            <p id="platformFee-help" className="mt-2 text-sm leading-6 text-ink-muted">
              Total potongan platform per transaksi. Jika dikosongkan, nilainya 0%.
            </p>
            <FieldError field="platformFee" errors={errors} />
            {values.platform !== "umum" && Number(values.platformFee || 0) === 0 && (
              <p className="mt-2 text-sm leading-6 text-status-warning" role="note">
                Platform tujuan dapat mengenakan potongan, tetapi biaya platform masih 0%. Harga mungkin belum memperhitungkan potongan ini.
              </p>
            )}
          </div>
        </div>
      </section>

      <div className="flex flex-col-reverse gap-3 rounded-[24px] border border-line/70 bg-surface p-4 shadow-[0_16px_48px_rgba(16,37,28,0.08)] sm:flex-row sm:items-center sm:justify-end sm:p-5">
        {isSubmitting && (
          <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={onCancel}>
            <X aria-hidden="true" />
            Batalkan
          </Button>
        )}
        {isSubmitting && progressMessage && (
          <p className="flex min-h-11 flex-1 items-center text-sm font-medium text-ink" role="status" aria-live="polite" aria-atomic="true">
            <span className="mr-3 inline-block size-2 animate-pulse rounded-full bg-brand" aria-hidden="true" />
            {progressMessage}
          </p>
        )}
        <Button
          type="submit"
          size="lg"
          className="w-full shadow-[0_12px_28px_rgba(47,111,87,0.24)] sm:w-auto sm:min-w-48"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <LoaderCircle className="animate-spin" aria-hidden="true" />
              Menyusun listing
            </>
          ) : (
            "Buat listing"
          )}
        </Button>
      </div>
    </form>
  );
}
