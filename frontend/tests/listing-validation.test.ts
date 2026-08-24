import { describe, expect, it } from "vitest";

import {
  ALLOWED_IMAGE_TYPES,
  INITIAL_FORM_VALUES,
  MAX_IMAGE_SIZE,
  firstInvalidField,
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
});
