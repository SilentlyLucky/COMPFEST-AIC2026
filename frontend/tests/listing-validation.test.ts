import { describe, expect, it } from "vitest";

import {
  ALLOWED_IMAGE_TYPES,
  INITIAL_FORM_VALUES,
  MAX_IMAGE_SIZE,
  firstInvalidField,
  hppAmountForLabel,
  parseVariantLabels,
  pruneHppMap,
  updateHppMap,
  validateImage,
  validateListing,
  type ListingFormValues,
} from "../lib/listing-validation";

function makeImage(
  content: BlobPart = "valid-image",
  type = ALLOWED_IMAGE_TYPES[0],
): File {
  return new File([content], "produk.jpg", { type });
}

function validValues(
  overrides: Partial<ListingFormValues> = {},
): ListingFormValues {
  return {
    ...INITIAL_FORM_VALUES,
    productionCost: "25000",
    ...overrides,
  };
}

describe("listing validation", () => {
  it("omits a blank product-type hint while keeping backend-compatible defaults", () => {
    const result = validateListing(
      validValues({ brand: "  Dapur Sari  ", marketRegionCode: "ID-JK" }),
      makeImage(),
    );

    expect(result.errors).toEqual({});
    expect(result.metadata).toEqual({
      platform: "umum",
      market_region_code: "ID-JK",
      production_cost_idr: 25000,
      brand: "Dapur Sari",
      packaging_cost_idr: 0,
      other_cost_idr: 0,
      target_margin_pct: 30,
      platform_fee_pct: 0,
    });
  });

  it("uses safe defaults when optional numeric inputs are cleared while preserving the required region", () => {
    const result = validateListing(
      validValues({
        marketRegionCode: "ID-JB",
        packagingCost: "",
        otherCost: "",
        targetMargin: "",
        platformFee: "",
      }),
      makeImage(),
    );

    expect(result.errors).toEqual({});
    expect(result.metadata).toEqual({
      platform: "umum",
      market_region_code: "ID-JB",
      production_cost_idr: 25000,
      packaging_cost_idr: 0,
      other_cost_idr: 0,
      target_margin_pct: 30,
      platform_fee_pct: 0,
    });
  });

  it("serializes a valid optional product-type hint after trimming", () => {
    const result = validateListing(
      validValues({
        productType: "  Keripik pisang  ",
        marketRegionCode: "ID-JK",
      }),
      makeImage(),
    );

    expect(result.errors).toEqual({});
    expect(result.metadata).toMatchObject({ product_type: "Keripik pisang" });
  });

  it("rejects only supplied product-type hints outside 2–80 characters", () => {
    for (const productType of ["x", "a".repeat(81)]) {
      const result = validateListing(
        validValues({ productType, marketRegionCode: "ID-JK" }),
        makeImage(),
      );

      expect(result.metadata).toBeNull();
      expect(result.errors.productType).toBe(
        "Jenis produk harus berisi 2–80 karakter.",
      );
    }
  });

  it("rejects blank or invalid regions and always serializes a valid region", () => {
    const invalid = validateListing(
      validValues({ marketRegionCode: "ID-jk" }),
      makeImage(),
    );
    expect(invalid.metadata).toBeNull();
    expect(invalid.errors.marketRegionCode).toBe(
      "Pilih kode wilayah pasar yang valid.",
    );

    const blank = validateListing(
      validValues({ marketRegionCode: "  " }),
      makeImage(),
    );
    expect(blank.metadata).toBeNull();
    expect(blank.errors.marketRegionCode).toBe("Pilih wilayah pasar.");

    const valid = validateListing(
      validValues({ marketRegionCode: "ID-JI" }),
      makeImage(),
    );
    expect(valid.metadata).toMatchObject({ market_region_code: "ID-JI" });
  });

  it("prioritizes required workspace errors before invalid optional details", () => {
    const result = validateListing(
      validValues({
        productType: "x",
        marketRegionCode: "",
        productionCost: "",
      }),
      makeImage(),
    );

    expect(result.errors).toMatchObject({
      productType: "Jenis produk harus berisi 2–80 karakter.",
      marketRegionCode: "Pilih wilayah pasar.",
      productionCost: expect.any(String),
    });
    expect(firstInvalidField(result.errors)).toBe("marketRegionCode");
  });

  it("rejects a platform value outside the runtime allowlist", () => {
    const result = validateListing(
      validValues({ platform: "lazada" as ListingFormValues["platform"] }),
      makeImage(),
    );

    expect(result.metadata).toBeNull();
    expect(result.errors.platform).toBe("Pilih platform tujuan yang tersedia.");
  });

  it("rejects missing, zero-byte, wrong-type, and oversized images", () => {
    expect(validateImage(null)).toBe("Pilih satu foto produk.");
    expect(validateImage(makeImage("", "image/jpeg"))).toBe(
      "File foto kosong. Pilih foto yang berisi gambar.",
    );
    expect(validateImage(makeImage("not-an-image", "text/plain"))).toBe(
      "Gunakan file JPEG, PNG, atau WebP.",
    );
    expect(
      validateImage(
        makeImage(new Uint8Array(MAX_IMAGE_SIZE + 1), "image/jpeg"),
      ),
    ).toBe("Ukuran foto maksimal 5 MiB.");
  });

  it("rejects numeric values outside backend bounds", () => {
    const result = validateListing(
      validValues({
        productionCost: "999",
        packagingCost: "-1",
        otherCost: "1000000001",
        targetMargin: "80.1",
        platformFee: "40.1",
      }),
      makeImage(),
    );

    expect(result.metadata).toBeNull();
    expect(result.errors).toMatchObject({
      productionCost: expect.any(String),
      packagingCost: expect.any(String),
      otherCost: expect.any(String),
      targetMargin: expect.any(String),
      platformFee: expect.any(String),
    });
  });

  it("rejects a margin and platform fee total of 95 percent or more", () => {
    const result = validateListing(
      validValues({ targetMargin: "80", platformFee: "15" }),
      makeImage(),
    );

    expect(result.metadata).toBeNull();
    expect(result.errors.targetMargin).toContain("kurang dari 95%");
    expect(result.errors.platformFee).toBe(
      "Kurangi biaya platform atau target margin.",
    );
  });

  it("rejects advanced pricing when default fees, tax, and VAT exceed the margin guard", () => {
    const result = validateListing(
      validValues({
        platform: "shopee",
        marketRegionCode: "ID-JK",
        targetMargin: "80",
        platformFee: "0",
        annualTurnover: "500000000",
        vatRegistered: "true",
      }),
      makeImage(),
    );

    expect(result.metadata).toBeNull();
    expect(result.errors).toMatchObject({
      targetMargin: expect.stringContaining("kurang dari 95%"),
      annualTurnover: expect.stringContaining("pajak UMKM"),
      vatRegistered: expect.stringContaining("PPN"),
    });
    expect(result.errors.targetMargin).toContain("pemrosesan");
  });

  it("uses an explicit platform fee instead of the marketplace default", () => {
    const result = validateListing(
      validValues({
        platform: "tokopedia",
        marketRegionCode: "ID-JK",
        targetMargin: "80",
        platformFee: "2",
        annualTurnover: "500000000",
        vatRegistered: "true",
      }),
      makeImage(),
    );

    expect(result.errors).toEqual({});
    expect(result.metadata?.pricing).toEqual({
      total_hpp_idr: 25000,
      annual_turnover_idr: 500000000,
      vat_registered: true,
    });
  });

  it("keeps a high-margin legacy payload additive while guarding its advanced form", () => {
    const result = validateListing(
      validValues({
        platform: "shopee",
        marketRegionCode: "ID-JK",
        targetMargin: "80",
        platformFee: "0",
      }),
      makeImage(),
    );

    expect(result.errors).toEqual({});
    expect(result.metadata).not.toHaveProperty("pricing");
  });

  it("converts advanced unit details into the additive pricing metadata", () => {
    const result = validateListing(
      validValues({
        marketRegionCode: "ID-JK",
        purchaseUnit: " kg ",
        purchaseQuantity: "3",
        saleContent: "250",
        saleUnit: "g",
        outputUnitLabel: "bag",
        colors: "merah, biru, merah",
        sizes: "250 g, 500 g",
        hppPerSize: "250 g=11000, 500 g=20000",
        grades: "reguler, premium",
        hppPerGrade: "reguler=11000",
        annualTurnover: "600000000",
        vatRegistered: "true",
      }),
      makeImage(),
    );

    expect(result.errors).toEqual({});
    expect(result.metadata?.pricing).toEqual({
      total_hpp_idr: 25000,
      purchase_unit: "kg",
      purchase_quantity: 3,
      sale_content: 250,
      sale_unit: "g",
      output_unit_label: "bag",
      colors: ["merah", "biru"],
      sizes: ["250 g", "500 g"],
      hpp_per_size_idr: { "250 g": 11000, "500 g": 20000 },
      grades: ["reguler", "premium"],
      hpp_per_grade_idr: { reguler: 11000 },
      annual_turnover_idr: 600000000,
      vat_registered: true,
    });
  });

  it("keeps HPP editing label-driven and prunes a removed variation", () => {
    expect(parseVariantLabels(" Premium, premium, Reguler ")).toEqual([
      "Premium",
      "Reguler",
    ]);
    expect(hppAmountForLabel("premium=11000", "Premium")).toBe("11000");
    expect(
      updateHppMap("250 g=11000, 500 g=20000", "250 g", "12000"),
    ).toBe("250 g=12000, 500 g=20000");
    expect(
      pruneHppMap(
        "250 g=12000, 500 g=20000",
        ["250 g"],
        ["250 g", "500 g"],
      ),
    ).toBe("250 g=12000");
  });

  it("rejects incomplete advanced units and invalid HPP maps", () => {
    const incomplete = validateListing(
      validValues({
        marketRegionCode: "ID-JK",
        purchaseUnit: "kg",
        purchaseQuantity: "0",
      }),
      makeImage(),
    );
    expect(incomplete.metadata).toBeNull();
    expect(incomplete.errors.purchaseQuantity).toContain("angka positif");

    const invalidMap = validateListing(
      validValues({
        marketRegionCode: "ID-JK",
        sizes: "250 g",
        hppPerSize: "500 g=20000",
      }),
      makeImage(),
    );
    expect(invalidMap.metadata).toBeNull();
    expect(invalidMap.errors.hppPerSize).toContain("250 g");
    expect(invalidMap.errors.hppPerSize).toContain("Pilihan yang tersedia");
  });

  it("explains when no labels are available for a stale HPP map", () => {
    const result = validateListing(
      validValues({
        marketRegionCode: "ID-JK",
        hppPerSize: "500 g=20000",
      }),
      makeImage(),
    );

    expect(result.metadata).toBeNull();
    expect(result.errors.hppPerSize).toContain(
      "belum ada ukuran yang tersedia",
    );
    expect(result.errors.hppPerSize).not.toContain("variasi terkait");
  });

  it("rejects unsupported sale units and mismatched conversion dimensions", () => {
    const result = validateListing(
      validValues({
        marketRegionCode: "ID-JK",
        purchaseUnit: "kg",
        purchaseQuantity: "1",
        saleContent: "1",
        saleUnit: "pcs",
      }),
      makeImage(),
    );

    expect(result.metadata).toBeNull();
    expect(result.errors.saleUnit).toContain("massa atau volume");
  });

  it("accepts mass-to-mass sale conversion while keeping the sellable label separate", () => {
    const result = validateListing(
      validValues({
        marketRegionCode: "ID-JK",
        purchaseUnit: "kg",
        purchaseQuantity: "1",
        saleContent: "250",
        saleUnit: "g",
        outputUnitLabel: "bag",
      }),
      makeImage(),
    );

    expect(result.errors).toEqual({});
    expect(result.metadata?.pricing).toMatchObject({
      purchase_unit: "kg",
      sale_content: 250,
      sale_unit: "g",
      output_unit_label: "bag",
    });
  });
});
