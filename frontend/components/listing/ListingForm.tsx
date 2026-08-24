"use client";

import {
  useState,
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
} from "react";
import { ChevronDown, FileImage, LoaderCircle, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type {
  FieldErrors,
  ListingField,
  ListingFormValues,
} from "@/lib/listing-validation";

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
  detailsOpen: boolean;
  pricingOpen: boolean;
  hasSubmitError: boolean;
  onDetailsOpenChange: (open: boolean) => void;
  onPricingOpenChange: (open: boolean) => void;
  onFieldChange: (field: keyof ListingFormValues, value: string) => void;
  onImageChange: (file: File | null) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
}

function FieldError({
  field,
  errors,
}: {
  field: ListingField;
  errors: FieldErrors;
}) {
  if (!errors[field]) return null;
  return (
    <p
      id={`${field}-error`}
      role="alert"
      className="mt-2 text-sm leading-6 text-status-error"
    >
      {errors[field]}
    </p>
  );
}

function errorProps(
  field: ListingField,
  errors: FieldErrors,
  describedBy?: string,
) {
  const describedByIds = [
    describedBy,
    errors[field] ? `${field}-error` : undefined,
  ]
    .filter(Boolean)
    .join(" ");
  return {
    "aria-invalid": errors[field] ? true : undefined,
    "aria-describedby": describedByIds || undefined,
  };
}

function MoneyInput({
  field,
  label,
  value,
  errors,
  disabled,
  min,
  required = false,
  onChange,
}: {
  field: Extract<
    ListingField,
    "productionCost" | "packagingCost" | "otherCost"
  >;
  label: string;
  value: string;
  errors: FieldErrors;
  disabled: boolean;
  min: number;
  required?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <Label htmlFor={field}>{label}</Label>
      <div className="relative mt-3">
        <span
          className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-sm font-medium text-ink-muted"
          aria-hidden="true"
        >
          Rp
        </span>
        <Input
          id={field}
          type="number"
          inputMode="numeric"
          min={min}
          max={1_000_000_000}
          step={1}
          className="rounded-[12px] bg-[#FBFCFE] pl-10"
          value={value}
          disabled={disabled}
          required={required}
          aria-required={required || undefined}
          onChange={(event) => onChange(event.target.value)}
          {...errorProps(field, errors)}
        />
      </div>
      <FieldError field={field} errors={errors} />
    </div>
  );
}

function PercentInput({
  field,
  label,
  value,
  errors,
  disabled,
  max,
  onChange,
}: {
  field: Extract<ListingField, "targetMargin" | "platformFee">;
  label: string;
  value: string;
  errors: FieldErrors;
  disabled: boolean;
  max: number;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <Label htmlFor={field}>{label}</Label>
      <div className="relative mt-3">
        <Input
          id={field}
          type="number"
          inputMode="decimal"
          min={0}
          max={max}
          step="0.1"
          className="rounded-[12px] bg-[#FBFCFE] pr-10"
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          {...errorProps(field, errors)}
        />
        <span
          className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-sm font-medium text-ink-muted"
          aria-hidden="true"
        >
          %
        </span>
      </div>
      <FieldError field={field} errors={errors} />
    </div>
  );
}

export function ListingForm({
  values,
  previewUrl,
  errors,
  isSubmitting,
  progressMessage,
  detailsOpen,
  pricingOpen,
  hasSubmitError,
  onDetailsOpenChange,
  onPricingOpenChange,
  onFieldChange,
  onImageChange,
  onSubmit,
  onCancel,
}: ListingFormProps) {
  const [isDragging, setIsDragging] = useState(false);

  function selectFile(file: File | null) {
    if (!isSubmitting) onImageChange(file);
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    selectFile(event.target.files?.[0] ?? null);
    event.target.value = "";
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragging(false);
    selectFile(event.dataTransfer.files?.[0] ?? null);
  }

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      aria-busy={isSubmitting}
      className="space-y-8 pb-28 lg:pb-0"
    >
      <div className="grid gap-8 rounded-[20px] border border-[#DCE5ED] bg-surface p-5 sm:p-7 lg:grid-cols-[minmax(300px,.85fr)_minmax(0,1.15fr)] lg:gap-x-[clamp(2.25rem,5vw,4.5rem)] lg:p-9">
        <section aria-labelledby="foto-heading">
          <div>
            <h2
              id="foto-heading"
              className="text-lg font-semibold tracking-[-0.02em] text-ink"
            >
              Foto produk <span className="text-link">(wajib)</span>
            </h2>
            <p
              id="image-help"
              className="mt-1 text-sm leading-6 text-ink-muted"
            >
              JPEG, PNG, atau WebP · maksimal 5 MB
            </p>
          </div>
          <Label
            htmlFor="image"
            onDragEnter={(event) => {
              event.preventDefault();
              if (!isSubmitting) setIsDragging(true);
            }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`relative mt-4 flex min-h-56 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border p-6 text-center transition-colors motion-reduce:transition-none sm:min-h-64 lg:min-h-80 ${previewUrl ? "border-[#AAB8C7] bg-[#F3F8FC]" : errors.image ? "border-2 border-dashed border-status-error bg-[#FFF8F7]" : isDragging ? "border-2 border-dashed border-brand bg-brand-soft" : "border-2 border-dashed border-[#9AC9E8] bg-[#F3F8FC] hover:border-brand"} focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/28`}
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
              {...errorProps("image", errors, "image-help")}
            />
            {previewUrl ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element -- Object URLs are browser-local previews. */}
                <img
                  src={previewUrl}
                  alt="Pratinjau foto produk"
                  className="absolute inset-0 size-full object-contain p-4"
                />
              </>
            ) : (
              <>
                <FileImage className="size-10 text-brand" aria-hidden="true" />
                <span className="mt-4 font-semibold text-ink">
                  Pilih foto produk
                </span>
                <span className="mt-2 text-sm leading-6 text-ink-muted">
                  atau seret foto ke sini
                </span>
              </>
            )}
            {previewUrl && (
              <span className="absolute bottom-4 left-4 rounded-lg bg-ink px-3 py-2 text-sm font-medium text-white">
                Ganti foto
              </span>
            )}
          </Label>
          {previewUrl && (
            <Button
              type="button"
              variant="ghost"
              className="mt-3 text-status-error"
              onClick={() => selectFile(null)}
              disabled={isSubmitting}
            >
              <Trash2 aria-hidden="true" />
              Hapus foto
            </Button>
          )}
          <FieldError field="image" errors={errors} />
        </section>

        <section
          aria-labelledby="facts-heading"
          className="border-t border-line/70 pt-6 lg:border-t-0 lg:pt-0"
        >
          <div>
            <h2
              id="facts-heading"
              className="text-lg font-semibold tracking-[-0.02em] text-ink"
            >
              Informasi utama
            </h2>
            <p className="mt-1 text-sm leading-6 text-ink-muted">
              Isi informasi dasar yang diperlukan untuk membuat rekomendasi.
            </p>
          </div>
          <div className="mt-6 grid gap-x-6 gap-y-6 sm:grid-cols-2">
            <div>
              <Label htmlFor="platform">
                Platform tujuan <span className="text-link">(wajib)</span>
              </Label>
              <select
                id="platform"
                className="form-select mt-3"
                value={values.platform}
                disabled={isSubmitting}
                required
                aria-required="true"
                onChange={(event) =>
                  onFieldChange("platform", event.target.value)
                }
                {...errorProps("platform", errors)}
              >
                {PLATFORMS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <FieldError field="platform" errors={errors} />
            </div>
            <div>
              <Label htmlFor="marketRegionCode">
                Wilayah pasar <span className="text-link">(wajib)</span>
              </Label>
              <select
                id="marketRegionCode"
                className="form-select mt-3"
                value={values.marketRegionCode}
                disabled={isSubmitting}
                required
                aria-required="true"
                onChange={(event) =>
                  onFieldChange("marketRegionCode", event.target.value)
                }
                {...errorProps("marketRegionCode", errors)}
              >
                <option value="">Pilih wilayah</option>
                {REGIONS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <FieldError field="marketRegionCode" errors={errors} />
            </div>
            <div className="sm:col-span-2">
              <MoneyInput
                field="productionCost"
                label="Biaya produksi per unit (wajib)"
                value={values.productionCost}
                errors={errors}
                disabled={isSubmitting}
                min={1000}
                required
                onChange={(value) => onFieldChange("productionCost", value)}
              />
            </div>
          </div>
        </section>
      </div>

      <section aria-labelledby="details-heading" className="rounded-2xl border border-[#E1EAF1] bg-[#F8FBFD] p-4 sm:p-5">
        <button
          type="button"
          className="flex min-h-11 w-full items-center justify-between gap-4 rounded-xl px-1 text-left font-semibold text-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand"
          aria-expanded={detailsOpen}
          aria-controls="details-content"
          onClick={() => onDetailsOpenChange(!detailsOpen)}
        >
          <span id="details-heading">
            Tambahkan detail produk{" "}
            <span className="ml-2 text-sm font-normal text-ink-muted">
              Opsional
            </span>
          </span>
          <ChevronDown
            className={`size-5 shrink-0 transition-transform motion-reduce:transition-none ${detailsOpen ? "rotate-180" : ""}`}
            aria-hidden="true"
          />
        </button>
        {detailsOpen && (
          <div
            id="details-content"
            className="grid gap-x-6 gap-y-6 pt-4 sm:grid-cols-2"
          >
            <p className="sm:col-span-2 text-sm leading-6 text-ink-muted">
              Tambahkan hanya informasi yang memang kamu ketahui.
            </p>
            <div className="sm:col-span-2">
              <Label htmlFor="productType">Jenis produk</Label>
              <Input
                id="productType"
                className="mt-3 rounded-[12px] bg-[#FBFCFE]"
                value={values.productType}
                maxLength={80}
                placeholder="Contoh: keripik pisang cokelat"
                disabled={isSubmitting}
                onChange={(event) =>
                  onFieldChange("productType", event.target.value)
                }
                {...errorProps("productType", errors, "product-type-help")}
              />
              <p
                id="product-type-help"
                className="mt-2 text-sm leading-6 text-ink-muted"
              >
                Tambahkan jika kamu sudah tahu jenis produknya.
              </p>
              <FieldError field="productType" errors={errors} />
            </div>
            <div>
              <Label htmlFor="brand">Merek</Label>
              <Input
                id="brand"
                className="mt-3 rounded-[12px] bg-[#FBFCFE]"
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
                className="mt-3 rounded-[12px] bg-[#FBFCFE]"
                value={values.variant}
                maxLength={120}
                placeholder="Contoh: cokelat"
                disabled={isSubmitting}
                onChange={(event) =>
                  onFieldChange("variant", event.target.value)
                }
                {...errorProps("variant", errors)}
              />
              <FieldError field="variant" errors={errors} />
            </div>
            <div>
              <Label htmlFor="size">Ukuran atau isi</Label>
              <Input
                id="size"
                className="mt-3 rounded-[12px] bg-[#FBFCFE]"
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
              <Label htmlFor="materialOrIngredients">
                Bahan atau komposisi
              </Label>
              <Input
                id="materialOrIngredients"
                className="mt-3 rounded-[12px] bg-[#FBFCFE]"
                value={values.materialOrIngredients}
                maxLength={120}
                placeholder="Contoh: pisang kepok, cokelat"
                disabled={isSubmitting}
                onChange={(event) =>
                  onFieldChange("materialOrIngredients", event.target.value)
                }
                {...errorProps("materialOrIngredients", errors)}
              />
              <FieldError field="materialOrIngredients" errors={errors} />
            </div>
          </div>
        )}
      </section>

      <section aria-labelledby="pricing-heading" className="rounded-2xl border border-[#E1EAF1] bg-[#F8FBFD] p-4 sm:p-5">
        <button
          type="button"
          className="flex min-h-11 w-full items-center justify-between gap-4 rounded-xl px-1 text-left font-semibold text-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand"
          aria-expanded={pricingOpen}
          aria-controls="pricing-content"
          onClick={() => onPricingOpenChange(!pricingOpen)}
        >
          <span id="pricing-heading">
            Atur biaya &amp; margin{" "}
            <span className="ml-2 text-sm font-normal text-ink-muted">
              Opsional
            </span>
          </span>
          <ChevronDown
            className={`size-5 shrink-0 transition-transform motion-reduce:transition-none ${pricingOpen ? "rotate-180" : ""}`}
            aria-hidden="true"
          />
        </button>
        {pricingOpen && (
          <div
            id="pricing-content"
            className="grid gap-x-6 gap-y-6 pt-4 sm:grid-cols-2"
          >
            <p className="sm:col-span-2 text-sm leading-6 text-ink-muted">
              Sesuaikan jika ada biaya tambahan atau target tertentu.
            </p>
            <MoneyInput
              field="packagingCost"
              label="Biaya kemasan per unit"
              value={values.packagingCost}
              errors={errors}
              disabled={isSubmitting}
              min={0}
              onChange={(value) => onFieldChange("packagingCost", value)}
            />
            <MoneyInput
              field="otherCost"
              label="Biaya lain per unit"
              value={values.otherCost}
              errors={errors}
              disabled={isSubmitting}
              min={0}
              onChange={(value) => onFieldChange("otherCost", value)}
            />
            <PercentInput
              field="targetMargin"
              label="Target margin"
              value={values.targetMargin}
              errors={errors}
              disabled={isSubmitting}
              max={80}
              onChange={(value) => onFieldChange("targetMargin", value)}
            />
            <div>
              <PercentInput
                field="platformFee"
                label="Biaya platform"
                value={values.platformFee}
                errors={errors}
                disabled={isSubmitting}
                max={40}
                onChange={(value) => onFieldChange("platformFee", value)}
              />
              {values.platform !== "umum" &&
                Number(values.platformFee || 0) === 0 && (
                  <p className="mt-2 flex items-center gap-2 text-sm leading-6 text-ink-muted">
                    <span
                      className="size-2 rounded-full bg-amber"
                      aria-hidden="true"
                    />
                    Potongan platform belum dihitung.
                  </p>
                )}
            </div>
          </div>
        )}
      </section>

      <div className="lg:ml-auto lg:w-fit">
        {hasSubmitError && (
          <p role="alert" className="mb-3 text-sm leading-6 text-status-error lg:text-right">
            Lengkapi bagian yang ditandai untuk melanjutkan.
          </p>
        )}
        {isSubmitting && progressMessage && (
          <p className="mb-3 text-sm leading-6 text-ink-muted lg:text-right" role="status">
            {progressMessage}
          </p>
        )}
        <div className="fixed inset-x-0 bottom-0 z-30 flex gap-3 border-t border-[#DCE5ED] bg-surface px-5 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-4 sm:px-8 lg:static lg:inset-auto lg:border-0 lg:bg-transparent lg:p-0">
          {isSubmitting && (
            <Button
              type="button"
              variant="outline"
              className="flex-1 lg:flex-none"
              onClick={onCancel}
            >
              <X aria-hidden="true" />
              Batalkan
            </Button>
          )}
          <Button
            type="submit"
            size="lg"
            className="flex-1 rounded-[12px] lg:flex-none"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <LoaderCircle className="animate-spin" aria-hidden="true" />
                Menyusun
              </>
            ) : (
              "Buat listing"
            )}
          </Button>
        </div>
      </div>
    </form>
  );
}
