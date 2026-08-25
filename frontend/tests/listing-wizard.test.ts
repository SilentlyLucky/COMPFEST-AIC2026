import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/ui/button", () => ({ Button: "button" }));
vi.mock("@/lib/listing-api", () => ({
  ListingApiError: class ListingApiError extends Error {
    constructor(...args: unknown[]) {
      super(String(args[0] ?? ""));
    }
  },
  generateListing: vi.fn(),
}));
vi.mock("@/lib/listing-validation", () => ({
  INITIAL_FORM_VALUES: {},
  firstInvalidField: vi.fn(),
  validateImage: vi.fn(),
  validateListing: vi.fn(),
}));
vi.mock("../components/listing/CopyListing", () => ({ CopyListing: "div" }));
vi.mock("../components/listing/ListingForm", () => ({ ListingForm: "form" }));
vi.mock("../components/listing/ListingResult", () => ({ ListingResult: "div" }));
vi.mock("../components/listing/StepProgress", () => ({ StepProgress: "div" }));

import { mapApiErrorFields } from "../components/listing/ListingWizard";

describe("listing wizard API error mapping", () => {
  it("keeps generic pricing errors focused on the margin control", () => {
    expect(mapApiErrorFields("pricing", "effective deductions are too high")).toEqual([
      "targetMargin",
    ]);
  });

  it("marks turnover and VAT controls when a generic pricing error names them", () => {
    expect(
      mapApiErrorFields(
        "pricing",
        "PPN dan omzet tahunan membuat potongan efektif terlalu tinggi.",
      ),
    ).toEqual(["targetMargin", "annualTurnover", "vatRegistered"]);
  });

  it("preserves direct nested field mapping for specific pricing errors", () => {
    expect(mapApiErrorFields("pricing.annual_turnover_idr", "invalid value")).toEqual([
      "annualTurnover",
    ]);
    expect(mapApiErrorFields("pricing.vat_registered", "invalid value")).toEqual([
      "vatRegistered",
    ]);
  });

  it("maps variant HPP paths with dynamic labels to their HPP controls", () => {
    expect(
      mapApiErrorFields("pricing.hpp_per_size_idr.250 g", "invalid value"),
    ).toEqual(["hppPerSize"]);
    expect(
      mapApiErrorFields("pricing.hpp_per_grade_idr.premium", "invalid value"),
    ).toEqual(["hppPerGrade"]);
  });

  it("uses HPP message keys before the generic pricing margin fallback", () => {
    expect(
      mapApiErrorFields(
        "pricing",
        "hpp_per_size_idr keys must match supplied sizes",
      ),
    ).toEqual(["hppPerSize"]);
    expect(
      mapApiErrorFields(
        "pricing",
        "hpp_per_grade_idr keys must match supplied grades",
      ),
    ).toEqual(["hppPerGrade"]);
  });
});
