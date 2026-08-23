import { PLATFORMS, type ListingMetadata, type Platform } from "./listing-types";

export const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

export interface ListingFormValues {
  productType: string;
  platform: Platform;
  marketRegionCode: string;
  productionCost: string;
  brand: string;
  variant: string;
  size: string;
  materialOrIngredients: string;
  packagingCost: string;
  otherCost: string;
  targetMargin: string;
  platformFee: string;
}

export type ListingField = keyof ListingFormValues | "image";
export type FieldErrors = Partial<Record<ListingField, string>>;

export const INITIAL_FORM_VALUES: ListingFormValues = {
  productType: "",
  platform: "umum",
  marketRegionCode: "",
  productionCost: "",
  brand: "",
  variant: "",
  size: "",
  materialOrIngredients: "",
  packagingCost: "0",
  otherCost: "0",
  targetMargin: "30",
  platformFee: "0",
};

function parseInteger(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

function parsePercentage(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function validateOptionalText(
  value: string,
  field: ListingField,
  errors: FieldErrors,
): void {
  if (value.trim().length > 120) {
    errors[field] = "Maksimal 120 karakter.";
  }
}

export function validateImage(file: File | null): string | null {
  if (!file) return "Pilih satu foto produk.";
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return "Gunakan file JPEG, PNG, atau WebP.";
  }
  if (file.size === 0) {
    return "File foto kosong. Pilih foto yang berisi gambar.";
  }
  if (file.size > MAX_IMAGE_SIZE) {
    return "Ukuran foto maksimal 5 MiB.";
  }
  return null;
}

export function validateListing(
  values: ListingFormValues,
  image: File | null,
): { errors: FieldErrors; metadata: ListingMetadata | null } {
  const errors: FieldErrors = {};
  const productType = values.productType.trim();
  const productionCost = parseInteger(values.productionCost);
  const packagingCost = values.packagingCost.trim() ? parseInteger(values.packagingCost) : 0;
  const otherCost = values.otherCost.trim() ? parseInteger(values.otherCost) : 0;
  const targetMargin = values.targetMargin.trim() ? parsePercentage(values.targetMargin) : 30;
  const platformFee = values.platformFee.trim() ? parsePercentage(values.platformFee) : 0;
  const marketRegionCode = values.marketRegionCode.trim();

  const imageError = validateImage(image);
  if (imageError) errors.image = imageError;

  if (productType.length < 2 || productType.length > 80) {
    errors.productType = "Isi jenis produk sebanyak 2–80 karakter.";
  }
  if (!PLATFORMS.includes(values.platform as Platform)) {
    errors.platform = "Pilih platform tujuan yang tersedia.";
  }
  if (marketRegionCode && !/^ID-[A-Z]{2}$/.test(marketRegionCode)) {
    errors.marketRegionCode = "Pilih kode wilayah pasar yang valid.";
  }
  if (productionCost === null || productionCost < 1_000 || productionCost > 1_000_000_000) {
    errors.productionCost = "Biaya produksi harus berupa rupiah bulat antara 1.000 dan 1 miliar.";
  }
  if (packagingCost === null || packagingCost < 0 || packagingCost > 1_000_000_000) {
    errors.packagingCost = "Biaya kemasan harus berupa rupiah bulat antara 0 dan 1 miliar.";
  }
  if (otherCost === null || otherCost < 0 || otherCost > 1_000_000_000) {
    errors.otherCost = "Biaya lain harus berupa rupiah bulat antara 0 dan 1 miliar.";
  }
  if (targetMargin === null || targetMargin < 0 || targetMargin > 80) {
    errors.targetMargin = "Target margin harus berada di antara 0% dan 80%.";
  }
  if (platformFee === null || platformFee < 0 || platformFee > 40) {
    errors.platformFee = "Biaya platform harus berada di antara 0% dan 40%.";
  }
  if (targetMargin !== null && platformFee !== null && targetMargin + platformFee >= 95) {
    errors.targetMargin = "Jumlah margin dan biaya platform harus kurang dari 95%.";
    errors.platformFee = "Kurangi biaya platform atau target margin.";
  }

  validateOptionalText(values.brand, "brand", errors);
  validateOptionalText(values.variant, "variant", errors);
  validateOptionalText(values.size, "size", errors);
  validateOptionalText(values.materialOrIngredients, "materialOrIngredients", errors);

  if (Object.keys(errors).length > 0 || !image) {
    return { errors, metadata: null };
  }

  const metadata: ListingMetadata = {
    product_type: productType,
    platform: values.platform,
    production_cost_idr: productionCost!,
    packaging_cost_idr: packagingCost!,
    other_cost_idr: otherCost!,
    target_margin_pct: targetMargin!,
    platform_fee_pct: platformFee!,
  };

  if (marketRegionCode) metadata.market_region_code = marketRegionCode;

  const optionalValues: Array<[keyof ListingMetadata, string]> = [
    ["brand", values.brand],
    ["variant", values.variant],
    ["size", values.size],
    ["material_or_ingredients", values.materialOrIngredients],
  ];
  optionalValues.forEach(([key, value]) => {
    if (value.trim()) Object.assign(metadata, { [key]: value.trim() });
  });

  return { errors, metadata };
}
