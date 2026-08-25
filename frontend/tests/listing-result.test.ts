import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/ui/button", () => ({ Button: "button" }));
vi.mock("@/components/ui/input", () => ({ Input: "input" }));
vi.mock("@/components/ui/label", () => ({ Label: "label" }));
vi.mock("@/components/ui/textarea", () => ({ Textarea: "textarea" }));
vi.mock("@/lib/format", () => ({ formatRupiah: (value: number) => `Rp${value}` }));
vi.mock("@/lib/listing-types", () => ({
  CATEGORY_CODES: ["camilan_olahan"],
  CATEGORY_LABELS: { camilan_olahan: "Camilan Olahan" },
}));

import {
  categoryConfidenceLabel,
  listingReadiness,
  priceState,
  visibleWarnings,
} from "../components/listing/ListingResult";
import type { GenerateListingResponse } from "../lib/listing-types";

const price = (recommended: number | null) =>
  ({
    currency: "IDR",
    recommended,
    market_interval: null,
    viable_floor: 14_000,
    alignment: "insufficient_evidence",
    comparable_count: 0,
    data_as_of: null,
  }) as GenerateListingResponse["data"]["listing"]["price"];

describe("listing result seller-facing states", () => {
  it("uses the agreed category confidence labels at each threshold", () => {
    expect(categoryConfidenceLabel(90)).toBe("Tinggi");
    expect(categoryConfidenceLabel(70)).toBe("Cukup");
    expect(categoryConfidenceLabel(69)).toBe("Perlu diperiksa");
    expect(categoryConfidenceLabel(null)).toBe("Perlu diperiksa");
  });

  it("uses market recommendation availability rather than confidence to determine price state", () => {
    expect(priceState(price(18_000))).toBe("available");
    expect(priceState(price(null))).toBe("insufficient_market_data");
  });

  it("retains market fallback caveats when price is available and suppresses them in the insufficient-data narrative", () => {
    const warnings = [
      "MARKET_VISUAL_QUERY_FALLBACK",
      "MARKET_CATEGORY_FALLBACK",
      "MARKET_DATA_STALE",
    ];

    expect(visibleWarnings(warnings, true)).toEqual(warnings);
    expect(visibleWarnings(warnings, false)).toEqual(["MARKET_DATA_STALE"]);
  });

  it("reports readiness from category, valid copy, and a market recommendation", () => {
    expect(
      listingReadiness({
        categoryCode: "camilan_olahan",
        title: "Keripik pisang",
        description: "Keripik pisang renyah untuk camilan sehari-hari dengan rasa pisang alami.",
        hasMarketRecommendation: true,
      }),
    ).toMatchObject({ missing: [], summary: "Siap digunakan" });

    expect(
      listingReadiness({
        categoryCode: "camilan_olahan",
        title: "Keripik pisang",
        description: "Keripik pisang renyah untuk camilan sehari-hari dengan rasa pisang alami.",
        hasMarketRecommendation: false,
      }),
    ).toMatchObject({
      missing: ["Harga"],
      summary: "Siap, dengan 1 hal yang perlu dilengkapi",
      description: "Kategori, judul, dan deskripsi sudah siap digunakan. Harga perlu kamu tentukan sendiri.",
    });

    expect(
      listingReadiness({
        categoryCode: null,
        title: "",
        description: "Terlalu pendek.",
        hasMarketRecommendation: false,
      }),
    ).toMatchObject({
      missing: ["Kategori", "Judul & deskripsi", "Harga"],
      summary: "Perlu beberapa perbaikan",
    });
  });

  it("keeps technical and pricing detail disclosures out of the primary flow", () => {
    const source = readFileSync(
      resolve(import.meta.dirname, "../components/listing/ListingResult.tsx"),
      "utf8",
    );

    expect(source).toContain("Detail teknis hasil");
    expect(source).toContain("Lihat rincian perhitungan harga");
    expect(source).toContain("Belum ada cukup produk pembanding");
    expect(source).toContain("Contoh produk pembanding dari katalog");
    expect(source).toContain("MARKET_SUBTYPE_COMPARABLES_INSUFFICIENT");
    expect(source).toContain("MARKET_ATTRIBUTE_COMPARABLES_INSUFFICIENT");
    expect(source).toContain("Tinjau & salin");
    expect(source).not.toContain("Metode:");
    expect(source).toContain('className="group self-start rounded-[24px]');
  });
});
