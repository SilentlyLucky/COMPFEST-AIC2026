import {
  PLATFORMS,
  type ListingMetadata,
  type Platform,
} from "./listing-types";

export const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

const PLATFORM_DEDUCTIONS: Record<
  Platform,
  { commissionPct: number; shippingPct: number; processingIdr: number }
> = {
  tokopedia: { commissionPct: 8, shippingPct: 0, processingIdr: 1_250 },
  shopee: { commissionPct: 10, shippingPct: 6, processingIdr: 1_250 },
  blibli: { commissionPct: 10, shippingPct: 0, processingIdr: 0 },
  umum: { commissionPct: 0, shippingPct: 0, processingIdr: 0 },
};
const ANNUAL_TURNOVER_TAX_THRESHOLD_IDR = 500_000_000;
const ANNUAL_TURNOVER_TAX_PCT = 0.5;
const VAT_PCT = 11;
const MAX_EFFECTIVE_DEDUCTIONS_PCT = 95;

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
  purchaseUnit: string;
  purchaseQuantity: string;
  saleContent: string;
  saleUnit: string;
  outputUnitCount: string;
  outputUnitLabel: string;
  colors: string;
  sizes: string;
  hppPerSize: string;
  grades: string;
  hppPerGrade: string;
  annualTurnover: string;
  vatRegistered: string;
}

export type ListingField = keyof ListingFormValues | "image";
export type FieldErrors = Partial<Record<ListingField, string>>;
export const STEP_ONE_FIELD_ORDER: readonly ListingField[] = [
  "image",
  "platform",
  "marketRegionCode",
  "productionCost",
  "productType",
  "brand",
  "variant",
  "size",
  "materialOrIngredients",
  "packagingCost",
  "otherCost",
  "targetMargin",
  "platformFee",
  "purchaseUnit",
  "purchaseQuantity",
  "saleContent",
  "saleUnit",
  "outputUnitCount",
  "outputUnitLabel",
  "colors",
  "sizes",
  "hppPerSize",
  "grades",
  "hppPerGrade",
  "annualTurnover",
  "vatRegistered",
];

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
  purchaseUnit: "",
  purchaseQuantity: "",
  saleContent: "",
  saleUnit: "",
  outputUnitCount: "",
  outputUnitLabel: "",
  colors: "",
  sizes: "",
  hppPerSize: "",
  grades: "",
  hppPerGrade: "",
  annualTurnover: "0",
  vatRegistered: "false",
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

function parsePositiveNumber(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

type UnitDimension = "weight" | "volume";

function unitDimension(value: string): UnitDimension | null {
  switch (value.trim().toLocaleLowerCase()) {
    case "g":
    case "gr":
    case "gram":
    case "kg":
      return "weight";
    case "ml":
    case "l":
    case "lt":
    case "liter":
      return "volume";
    default:
      return null;
  }
}

export function parseVariantLabels(value: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  value.split(",").forEach((item) => {
    const label = item.trim();
    const key = label.toLocaleLowerCase();
    if (label && !seen.has(key)) {
      seen.add(key);
      result.push(label);
    }
  });
  return result;
}

interface ParsedHppMap {
  values: Record<string, number>;
  hasInput: boolean;
  error: boolean;
}

function parseHppMap(value: string): ParsedHppMap {
  const values: Record<string, number> = {};
  let error = false;
  const seen = new Set<string>();
  const entries = value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  entries.forEach((entry) => {
    const separatorIndex = entry.indexOf("=");
    const label = separatorIndex >= 0 ? entry.slice(0, separatorIndex).trim() : "";
    const amount = separatorIndex >= 0 ? entry.slice(separatorIndex + 1).trim() : "";
    const key = label.toLocaleLowerCase();
    const parsedAmount = parseInteger(amount);
    if (
      separatorIndex < 0 ||
      !label ||
      label.length > 32 ||
      seen.has(key) ||
      parsedAmount === null ||
      parsedAmount < 1 ||
      parsedAmount > 1_000_000_000
    ) {
      error = true;
      return;
    }
    seen.add(key);
    values[label] = parsedAmount;
  });

  return { values, hasInput: entries.length > 0, error };
}

function splitHppEntries(value: string): string[] {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function normalizedLabel(value: string): string {
  return value.toLocaleLowerCase();
}

function hppEntryLabel(entry: string): string {
  const separatorIndex = entry.indexOf("=");
  return separatorIndex >= 0 ? entry.slice(0, separatorIndex).trim() : "";
}

export function hppAmountForLabel(value: string, label: string): string {
  const target = normalizedLabel(label);
  const parsed = parseHppMap(value).values;
  const matchingEntry = Object.entries(parsed).find(
    ([entryLabel]) => normalizedLabel(entryLabel) === target,
  );
  return matchingEntry ? String(matchingEntry[1]) : "";
}

export function updateHppMap(
  value: string,
  label: string,
  amount: string,
): string {
  const target = normalizedLabel(label);
  const nextAmount = amount.trim();
  let replaced = false;
  const entries = splitHppEntries(value);
  const nextEntries: string[] = [];

  entries.forEach((entry) => {
    const entryLabel = hppEntryLabel(entry);
    if (!replaced && entryLabel && normalizedLabel(entryLabel) === target) {
      replaced = true;
      if (nextAmount) nextEntries.push(`${label.trim()}=${nextAmount}`);
      return;
    }
    nextEntries.push(entry);
  });

  if (!replaced && nextAmount && label.trim()) {
    nextEntries.push(`${label.trim()}=${nextAmount}`);
  }

  return nextEntries.join(", ");
}

export function pruneHppMap(
  value: string,
  labels: string[],
  previousLabels?: string[],
): string {
  const availableByKey = new Map(
    labels.map((label) => [normalizedLabel(label), label]),
  );
  const removedKeys = new Set(
    (previousLabels ?? []).map((label) => normalizedLabel(label)),
  );

  return splitHppEntries(value)
    .filter((entry) => {
      const entryLabel = hppEntryLabel(entry);
      if (!entryLabel) return true;
      const key = normalizedLabel(entryLabel);
      if (availableByKey.has(key)) return true;
      if (previousLabels) return !removedKeys.has(key);
      return false;
    })
    .map((entry) => {
      const entryLabel = hppEntryLabel(entry);
      const canonicalLabel = availableByKey.get(normalizedLabel(entryLabel));
      if (!canonicalLabel || canonicalLabel === entryLabel) return entry;
      const separatorIndex = entry.indexOf("=");
      return `${canonicalLabel}${entry.slice(separatorIndex)}`;
    })
    .join(", ");
}

function validateCommaList(
  value: string,
  field: Extract<ListingField, "colors" | "sizes" | "grades">,
  errors: FieldErrors,
): string[] {
  const labels = parseVariantLabels(value);
  if (labels.some((label) => label.length > 32) || labels.length > 12) {
    errors[field] = "Masukkan maksimal 12 label, masing-masing 32 karakter.";
  }
  return labels;
}

function validateHppMap(
  value: string,
  field: Extract<ListingField, "hppPerSize" | "hppPerGrade">,
  errors: FieldErrors,
): ParsedHppMap {
  const parsed = parseHppMap(value);
  if (parsed.error) {
    errors[field] =
      "Gunakan pasangan label=HPP positif, misalnya 250 g=11000,500 g=20000.";
  }
  return parsed;
}

function validateMapLabels(
  map: Record<string, number>,
  labels: string[],
  field: Extract<ListingField, "hppPerSize" | "hppPerGrade">,
  errors: FieldErrors,
): void {
  const available = new Set(labels.map((label) => normalizedLabel(label)));
  const invalidLabels = Object.keys(map).filter(
    (label) => !available.has(normalizedLabel(label)),
  );
  if (invalidLabels.length === 0) return;

  const labelType = field === "hppPerSize" ? "ukuran" : "grade";
  const availableOptions = labels.length
    ? labels.join(", ")
    : `belum ada ${labelType} yang tersedia`;
  errors[field] = `Label HPP ${invalidLabels.join(", ")} tidak ada di daftar ${labelType}. Pilihan yang tersedia: ${availableOptions}.`;
}

function canonicalizeHppMap(
  map: Record<string, number>,
  labels: string[],
): Record<string, number> {
  const labelsByKey = new Map(
    labels.map((label) => [normalizedLabel(label), label]),
  );
  return Object.fromEntries(
    Object.entries(map).map(([label, amount]) => [
      labelsByKey.get(normalizedLabel(label)) ?? label,
      amount,
    ]),
  );
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

function validateEffectivePricingDeductions(
  platform: Platform | null,
  targetMargin: number | null,
  platformFee: number | null,
  annualTurnover: number | null,
  vatRegistered: boolean | null,
  errors: FieldErrors,
): void {
  if (
    !platform ||
    targetMargin === null ||
    platformFee === null ||
    annualTurnover === null ||
    vatRegistered === null ||
    errors.targetMargin ||
    errors.platformFee ||
    errors.annualTurnover ||
    errors.vatRegistered
  ) {
    return;
  }

  const deductions = PLATFORM_DEDUCTIONS[platform];
  const commissionPct = platformFee !== 0
    ? platformFee
    : deductions.commissionPct;
  const turnoverTaxPct = annualTurnover >= ANNUAL_TURNOVER_TAX_THRESHOLD_IDR
    ? ANNUAL_TURNOVER_TAX_PCT
    : 0;
  const effectiveDeductions =
    targetMargin +
    commissionPct +
    deductions.shippingPct +
    turnoverTaxPct +
    (vatRegistered ? VAT_PCT : 0);

  if (effectiveDeductions < MAX_EFFECTIVE_DEDUCTIONS_PCT) return;

  const processingHint = deductions.processingIdr > 0
    ? " Biaya pemrosesan tetap ikut dihitung pada harga minimum."
    : "";
  errors.targetMargin =
    `Jumlah margin, komisi platform, program ongkir, pajak, dan PPN harus kurang dari ${MAX_EFFECTIVE_DEDUCTIONS_PCT}%.${processingHint}`;
  if (annualTurnover >= ANNUAL_TURNOVER_TAX_THRESHOLD_IDR) {
    errors.annualTurnover =
      "Turunkan omzet tahunan atau target margin agar pajak UMKM tetap tertampung.";
  }
  if (vatRegistered) {
    errors.vatRegistered =
      "Nonaktifkan PPN atau turunkan target margin agar total potongan tetap di bawah 95%";
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

export function firstInvalidField(errors: FieldErrors): ListingField | null {
  return STEP_ONE_FIELD_ORDER.find((field) => errors[field]) ?? null;
}

export function validateListing(
  values: ListingFormValues,
  image: File | null,
): { errors: FieldErrors; metadata: ListingMetadata | null } {
  const errors: FieldErrors = {};
  const productType = values.productType.trim();
  const productionCost = parseInteger(values.productionCost);
  const packagingCost = values.packagingCost.trim()
    ? parseInteger(values.packagingCost)
    : 0;
  const otherCost = values.otherCost.trim()
    ? parseInteger(values.otherCost)
    : 0;
  const targetMargin = values.targetMargin.trim()
    ? parsePercentage(values.targetMargin)
    : 30;
  const platformFee = values.platformFee.trim()
    ? parsePercentage(values.platformFee)
    : 0;
  const platform = PLATFORMS.includes(values.platform as Platform)
    ? (values.platform as Platform)
    : null;
  const marketRegionCode = values.marketRegionCode.trim();
  const purchaseQuantity = parsePositiveNumber(values.purchaseQuantity);
  const saleContent = parsePositiveNumber(values.saleContent);
  const outputUnitCount = parsePositiveNumber(values.outputUnitCount);
  const annualTurnover = values.annualTurnover.trim()
    ? parseInteger(values.annualTurnover)
    : 0;
  const vatRegistered =
    values.vatRegistered === "true"
      ? true
      : values.vatRegistered === "false"
        ? false
        : null;
  const purchaseUnit = values.purchaseUnit.trim();
  const saleUnit = values.saleUnit.trim();
  const outputUnitLabel = values.outputUnitLabel.trim();
  const colors = validateCommaList(values.colors, "colors", errors);
  const sizes = validateCommaList(values.sizes, "sizes", errors);
  const grades = validateCommaList(values.grades, "grades", errors);
  const hppPerSize = validateHppMap(values.hppPerSize, "hppPerSize", errors);
  const hppPerGrade = validateHppMap(values.hppPerGrade, "hppPerGrade", errors);
  const hasPricingInput = Boolean(
    purchaseUnit ||
      values.purchaseQuantity.trim() ||
      saleUnit ||
      values.saleContent.trim() ||
      values.outputUnitCount.trim() ||
      outputUnitLabel ||
      colors.length ||
      sizes.length ||
      hppPerSize.hasInput ||
      grades.length ||
      hppPerGrade.hasInput ||
      (annualTurnover ?? 0) > 0 ||
      vatRegistered === true,
  );

  const imageError = validateImage(image);
  if (imageError) errors.image = imageError;

  if (productType && (productType.length < 2 || productType.length > 80)) {
    errors.productType = "Jenis produk harus berisi 2–80 karakter.";
  }
  if (!PLATFORMS.includes(values.platform as Platform)) {
    errors.platform = "Pilih platform tujuan yang tersedia.";
  }
  if (!marketRegionCode) {
    errors.marketRegionCode = "Pilih wilayah pasar.";
  } else if (!/^ID-[A-Z]{2}$/.test(marketRegionCode)) {
    errors.marketRegionCode = "Pilih kode wilayah pasar yang valid.";
  }
  if (
    productionCost === null ||
    productionCost < 1_000 ||
    productionCost > 1_000_000_000
  ) {
    errors.productionCost =
      "Biaya produksi harus berupa rupiah bulat antara 1.000 dan 1 miliar.";
  }
  if (
    packagingCost === null ||
    packagingCost < 0 ||
    packagingCost > 1_000_000_000
  ) {
    errors.packagingCost =
      "Biaya kemasan harus berupa rupiah bulat antara 0 dan 1 miliar.";
  }
  if (otherCost === null || otherCost < 0 || otherCost > 1_000_000_000) {
    errors.otherCost =
      "Biaya lain harus berupa rupiah bulat antara 0 dan 1 miliar.";
  }
  if (targetMargin === null || targetMargin < 0 || targetMargin > 80) {
    errors.targetMargin = "Target margin harus berada di antara 0% dan 80%.";
  }
  if (platformFee === null || platformFee < 0 || platformFee > 40) {
    errors.platformFee = "Biaya platform harus berada di antara 0% dan 40%.";
  }
  if (
    targetMargin !== null &&
    platformFee !== null &&
    targetMargin + platformFee >= 95
  ) {
    errors.targetMargin =
      "Jumlah margin dan biaya platform harus kurang dari 95%.";
    errors.platformFee = "Kurangi biaya platform atau target margin.";
  }
  if (hasPricingInput) {
    validateEffectivePricingDeductions(
      platform,
      targetMargin,
      platformFee,
      annualTurnover,
      vatRegistered,
      errors,
    );
  }

  if (purchaseUnit.length > 24) {
    errors.purchaseUnit = "Unit pembelian maksimal 24 karakter.";
  }
  if (values.purchaseQuantity.trim() && purchaseQuantity === null) {
    errors.purchaseQuantity = "Jumlah pembelian harus berupa angka positif.";
  }
  if (Boolean(purchaseUnit) !== Boolean(values.purchaseQuantity.trim())) {
    if (!purchaseUnit) errors.purchaseUnit = "Isi unit pembelian jika jumlah diisi.";
    if (!values.purchaseQuantity.trim()) {
      errors.purchaseQuantity = "Isi jumlah pembelian jika unit diisi.";
    }
  }
  if (saleUnit.length > 24) {
    errors.saleUnit = "Unit penjualan maksimal 24 karakter.";
  }
  if (values.saleContent.trim() && saleContent === null) {
    errors.saleContent = "Isi penjualan harus berupa angka positif.";
  }
  if (Boolean(saleUnit) !== Boolean(values.saleContent.trim())) {
    if (!saleUnit) errors.saleUnit = "Isi unit penjualan jika isi diisi.";
    if (!values.saleContent.trim()) {
      errors.saleContent = "Isi jumlah penjualan jika unit diisi.";
    }
  }
  const saleDimension = saleContent !== null && saleUnit
    ? unitDimension(saleUnit)
    : null;
  if (saleContent !== null && saleUnit && !saleDimension) {
    errors.saleUnit =
      "Unit isi jual harus berupa massa atau volume, misalnya g, ml, kg, atau l.";
  }
  if (saleDimension && purchaseUnit) {
    const purchaseDimension = unitDimension(purchaseUnit);
    if (!purchaseDimension) {
      errors.purchaseUnit =
        "Unit pembelian harus berupa massa atau volume saat isi jual dikonversi.";
    } else if (purchaseDimension !== saleDimension) {
      errors.saleUnit =
        "Dimensi unit pembelian dan unit isi jual harus sama-sama massa atau volume.";
    }
  }
  if (values.outputUnitCount.trim() && outputUnitCount === null) {
    errors.outputUnitCount = "Jumlah unit keluaran harus berupa angka positif.";
  }
  if (outputUnitLabel.length > 32) {
    errors.outputUnitLabel = "Label unit keluaran maksimal 32 karakter.";
  }
  if (values.annualTurnover.trim() && (annualTurnover === null || annualTurnover < 0)) {
    errors.annualTurnover =
      "Omzet tahunan harus berupa rupiah bulat antara 0 dan 100 miliar.";
  } else if (annualTurnover !== null && annualTurnover > 100_000_000_000) {
    errors.annualTurnover =
      "Omzet tahunan harus berupa rupiah bulat antara 0 dan 100 miliar.";
  }
  if (values.vatRegistered !== "true" && values.vatRegistered !== "false") {
    errors.vatRegistered = "Pilih status PKP yang valid.";
  }
  if (hppPerSize.hasInput && !errors.hppPerSize) {
    validateMapLabels(hppPerSize.values, sizes, "hppPerSize", errors);
  }
  if (hppPerGrade.hasInput && !errors.hppPerGrade) {
    validateMapLabels(hppPerGrade.values, grades, "hppPerGrade", errors);
  }

  validateOptionalText(values.brand, "brand", errors);
  validateOptionalText(values.variant, "variant", errors);
  validateOptionalText(values.size, "size", errors);
  validateOptionalText(
    values.materialOrIngredients,
    "materialOrIngredients",
    errors,
  );

  if (Object.keys(errors).length > 0 || !image) {
    return { errors, metadata: null };
  }

  const metadata: ListingMetadata = {
    platform: values.platform,
    market_region_code: marketRegionCode,
    production_cost_idr: productionCost!,
    packaging_cost_idr: packagingCost!,
    other_cost_idr: otherCost!,
    target_margin_pct: targetMargin!,
    platform_fee_pct: platformFee!,
  };

  const optionalValues: Array<[keyof ListingMetadata, string]> = [
    ["brand", values.brand],
    ["variant", values.variant],
    ["size", values.size],
    ["material_or_ingredients", values.materialOrIngredients],
  ];
  optionalValues.forEach(([key, value]) => {
    if (value.trim()) Object.assign(metadata, { [key]: value.trim() });
  });

  if (productType) metadata.product_type = productType;

  if (hasPricingInput) {
    metadata.pricing = { total_hpp_idr: productionCost! };
    if (purchaseUnit) metadata.pricing.purchase_unit = purchaseUnit;
    if (purchaseQuantity !== null) {
      metadata.pricing.purchase_quantity = purchaseQuantity;
    }
    if (saleContent !== null) metadata.pricing.sale_content = saleContent;
    if (saleUnit) metadata.pricing.sale_unit = saleUnit;
    if (outputUnitCount !== null) {
      metadata.pricing.output_unit_count = outputUnitCount;
    }
    if (outputUnitLabel) metadata.pricing.output_unit_label = outputUnitLabel;
    if (colors.length) metadata.pricing.colors = colors;
    if (sizes.length) metadata.pricing.sizes = sizes;
    if (hppPerSize.hasInput) {
      metadata.pricing.hpp_per_size_idr = canonicalizeHppMap(
        hppPerSize.values,
        sizes,
      );
    }
    if (grades.length) metadata.pricing.grades = grades;
    if (hppPerGrade.hasInput) {
      metadata.pricing.hpp_per_grade_idr = canonicalizeHppMap(
        hppPerGrade.values,
        grades,
      );
    }
    if ((annualTurnover ?? 0) > 0) {
      metadata.pricing.annual_turnover_idr = annualTurnover!;
    }
    if (vatRegistered) metadata.pricing.vat_registered = true;
  }

  return { errors, metadata };
}
