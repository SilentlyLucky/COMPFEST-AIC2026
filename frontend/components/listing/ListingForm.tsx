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
import {
  hppAmountForLabel,
  parseVariantLabels,
  pruneHppMap,
  updateHppMap,
  type FieldErrors,
  type ListingField,
  type ListingFormValues,
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

type AdvancedField = Extract<
  ListingField,
  | "purchaseUnit"
  | "purchaseQuantity"
  | "saleContent"
  | "saleUnit"
  | "outputUnitCount"
  | "outputUnitLabel"
  | "colors"
  | "sizes"
  | "hppPerSize"
  | "grades"
  | "hppPerGrade"
  | "annualTurnover"
>;

function AdvancedInput({
  field,
  label,
  value,
  errors,
  disabled,
  help,
  placeholder,
  type = "text",
  inputMode,
  min,
  max,
  step,
  onChange,
}: {
  field: AdvancedField;
  label: string;
  value: string;
  errors: FieldErrors;
  disabled: boolean;
  help?: string;
  placeholder?: string;
  type?: "text" | "number";
  inputMode?: "decimal" | "numeric";
  min?: number;
  max?: number;
  step?: number | "any";
  onChange: (value: string) => void;
}) {
  const helpId = help ? `${field}-help` : undefined;
  return (
    <div>
      <Label htmlFor={field}>{label}</Label>
      <Input
        id={field}
        type={type}
        inputMode={inputMode}
        min={min}
        max={max}
        step={step}
        className="mt-3 rounded-[12px] bg-[#FBFCFE]"
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        {...errorProps(field, errors, helpId)}
      />
      {help && (
        <p id={helpId} className="mt-2 text-sm leading-6 text-ink-muted">
          {help}
        </p>
      )}
      <FieldError field={field} errors={errors} />
    </div>
  );
}

type HppField = Extract<ListingField, "hppPerSize" | "hppPerGrade">;
type VariationField = Extract<ListingField, "sizes" | "grades">;

function HppFieldGroup({
  field,
  labelField,
  labelValue,
  value,
  errors,
  disabled,
  onChange,
}: {
  field: HppField;
  labelField: VariationField;
  labelValue: string;
  value: string;
  errors: FieldErrors;
  disabled: boolean;
  onChange: (label: string, value: string) => void;
}) {
  const labels = parseVariantLabels(labelValue);
  const labelType = labelField === "sizes" ? "ukuran" : "grade";
  const heading = `HPP per ${labelType}`;
  const helpId = `${field}-help`;

  return (
    <fieldset
      id={field}
      tabIndex={-1}
      className="rounded-xl border border-line/70 bg-soft-canvas/60 p-4 focus:outline-2 focus:outline-offset-4 focus:outline-brand sm:col-span-2"
      {...errorProps(field, errors, helpId)}
    >
      <legend className="px-1 text-base font-semibold text-ink">{heading}</legend>
      <p id={helpId} className="mt-2 text-sm leading-6 text-ink-muted">
        Isi HPP dalam rupiah untuk setiap {labelType} yang kamu tambahkan.
      </p>
      {labels.length > 0 ? (
        <div className="mt-4 space-y-3">
          {labels.map((label, index) => {
            const inputId = `${field}-${index}`;
            return (
              <div
                key={`${label}-${index}`}
                className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(10rem,14rem)] sm:items-center sm:gap-3"
              >
                <Label htmlFor={inputId} className="min-h-11 break-words">
                  {label}
                </Label>
                <div className="relative">
                  <span
                    className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-sm font-medium text-ink-muted"
                    aria-hidden="true"
                  >
                    Rp
                  </span>
                  <Input
                    id={inputId}
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={1_000_000_000}
                    step={1}
                    className="pl-10"
                    value={hppAmountForLabel(value, label)}
                    disabled={disabled}
                    aria-invalid={errors[field] ? true : undefined}
                    aria-describedby={errors[field] ? `${field}-error` : undefined}
                    onChange={(event) => onChange(label, event.target.value)}
                  />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="mt-4 rounded-xl border border-dashed border-line bg-surface px-4 py-3 text-sm leading-6 text-ink-muted">
          Tambahkan {labelType} di atas, lalu kolom harga HPP akan muncul otomatis.
        </p>
      )}
      <FieldError field={field} errors={errors} />
    </fieldset>
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

  function handleVariationChange(
    field: VariationField,
    hppField: HppField,
    value: string,
  ) {
    const previousLabels = parseVariantLabels(values[field]);
    const nextLabels = parseVariantLabels(value);
    const nextHppValue = pruneHppMap(
      values[hppField],
      nextLabels,
      previousLabels,
    );
    onFieldChange(field, value);
    if (nextHppValue !== values[hppField]) {
      onFieldChange(hppField, nextHppValue);
    }
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

      <section aria-labelledby="details-heading" className={`rounded-2xl border border-[#E1EAF1] ${detailsOpen ? "bg-surface" : "bg-[#F8FBFD]"} p-4 sm:p-5`}>
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

      <section aria-labelledby="pricing-heading" className={`rounded-2xl border border-[#E1EAF1] ${pricingOpen ? "bg-surface" : "bg-[#F8FBFD]"} p-4 sm:p-5`}>
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
                    Tarif platform terbaru akan diterapkan otomatis jika dibiarkan 0%.
                  </p>
                )}
            </div>
            <div className="sm:col-span-2 border-t border-line/70 pt-6">
              <h3 className="text-base font-semibold text-ink">
                Detail satuan &amp; variasi (opsional)
              </h3>
              <p className="mt-2 text-sm leading-6 text-ink-muted">
                Tanpa detail, biaya produksi dianggap sebagai biaya per unit. Jika kamu mengisi basis batch atau satuan, biaya produksi di atas dikirim sebagai total HPP dan backend mengubahnya menjadi HPP per unit jual.
              </p>
            </div>
            <AdvancedInput
              field="purchaseUnit"
              label="Unit pembelian atau batch"
              value={values.purchaseUnit}
              errors={errors}
              disabled={isSubmitting}
              placeholder="Contoh: kg"
              help="Isi bersama jumlah pembelian, misalnya 3 kg."
              onChange={(value) => onFieldChange("purchaseUnit", value)}
            />
            <AdvancedInput
              field="purchaseQuantity"
              label="Jumlah pembelian"
              value={values.purchaseQuantity}
              errors={errors}
              disabled={isSubmitting}
              type="number"
              inputMode="decimal"
              min={0.01}
              step="any"
              placeholder="Contoh: 3"
              onChange={(value) => onFieldChange("purchaseQuantity", value)}
            />
            <AdvancedInput
              field="saleContent"
              label="Isi per unit jual"
              value={values.saleContent}
              errors={errors}
              disabled={isSubmitting}
              type="number"
              inputMode="decimal"
              min={0.01}
              step="any"
              placeholder="Contoh: 250"
              onChange={(value) => onFieldChange("saleContent", value)}
            />
            <AdvancedInput
              field="saleUnit"
              label="Unit isi jual"
              value={values.saleUnit}
              errors={errors}
              disabled={isSubmitting}
              placeholder="Contoh: g, ml, kg, l"
              help="Dipakai untuk konversi isi; gunakan unit massa atau volume."
              onChange={(value) => onFieldChange("saleUnit", value)}
            />
            <AdvancedInput
              field="outputUnitCount"
              label="Jumlah unit keluaran"
              value={values.outputUnitCount}
              errors={errors}
              disabled={isSubmitting}
              type="number"
              inputMode="decimal"
              min={0.01}
              step="any"
              placeholder="Contoh: 12"
              help="Boleh diisi tanpa unit pembelian jika jumlah hasil sudah diketahui."
              onChange={(value) => onFieldChange("outputUnitCount", value)}
            />
            <AdvancedInput
              field="outputUnitLabel"
              label="Label unit keluaran"
              value={values.outputUnitLabel}
              errors={errors}
              disabled={isSubmitting}
              placeholder="Contoh: botol, bungkus, bag"
              help="Nama unit jual yang tampil di hasil; boleh berupa label produk."
              onChange={(value) => onFieldChange("outputUnitLabel", value)}
            />
            <AdvancedInput
              field="colors"
              label="Warna"
              value={values.colors}
              errors={errors}
              disabled={isSubmitting}
              placeholder="Contoh: merah, biru"
              help="Pisahkan dengan koma; label duplikat akan dirapikan."
              onChange={(value) => onFieldChange("colors", value)}
            />
            <AdvancedInput
              field="sizes"
              label="Ukuran"
              value={values.sizes}
              errors={errors}
              disabled={isSubmitting}
              placeholder="Contoh: 250 g, 500 g"
              help="Pisahkan beberapa ukuran dengan koma, misalnya 250 g, 500 g."
              onChange={(value) =>
                handleVariationChange("sizes", "hppPerSize", value)
              }
            />
            <HppFieldGroup
              field="hppPerSize"
              labelField="sizes"
              labelValue={values.sizes}
              value={values.hppPerSize}
              errors={errors}
              disabled={isSubmitting}
              onChange={(label, value) =>
                onFieldChange(
                  "hppPerSize",
                  updateHppMap(values.hppPerSize, label, value),
                )
              }
            />
            <AdvancedInput
              field="grades"
              label="Grade atau kelas"
              value={values.grades}
              errors={errors}
              disabled={isSubmitting}
              placeholder="Contoh: reguler, premium"
              help="Pisahkan beberapa grade dengan koma, misalnya reguler, premium."
              onChange={(value) =>
                handleVariationChange("grades", "hppPerGrade", value)
              }
            />
            <HppFieldGroup
              field="hppPerGrade"
              labelField="grades"
              labelValue={values.grades}
              value={values.hppPerGrade}
              errors={errors}
              disabled={isSubmitting}
              onChange={(label, value) =>
                onFieldChange(
                  "hppPerGrade",
                  updateHppMap(values.hppPerGrade, label, value),
                )
              }
            />
            <AdvancedInput
              field="annualTurnover"
              label="Omzet tahunan (Rp)"
              value={values.annualTurnover}
              errors={errors}
              disabled={isSubmitting}
              type="number"
              inputMode="numeric"
              min={0}
              max={100_000_000_000}
              step={1}
              placeholder="Contoh: 600000000"
              help="Opsional; dipakai untuk memperhitungkan pajak UMKM bila relevan."
              onChange={(value) => onFieldChange("annualTurnover", value)}
            />
            <div className="sm:col-span-2">
              <Label
                htmlFor="vatRegistered"
                className="min-h-11 cursor-pointer rounded-xl px-1"
              >
                <input
                  id="vatRegistered"
                  type="checkbox"
                  className="size-5 accent-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                  checked={values.vatRegistered === "true"}
                  disabled={isSubmitting}
                  onChange={(event) =>
                    onFieldChange(
                      "vatRegistered",
                      event.target.checked ? "true" : "false",
                    )
                  }
                  {...errorProps("vatRegistered", errors)}
                />
                <span>Usaha terdaftar PKP / dikenai PPN</span>
              </Label>
              <p className="mt-2 text-sm leading-6 text-ink-muted">
                Centang jika status pajak ini perlu diperhitungkan dalam harga.
              </p>
              <FieldError field="vatRegistered" errors={errors} />
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
