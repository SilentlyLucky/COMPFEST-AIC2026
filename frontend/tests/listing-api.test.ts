import { afterEach, describe, expect, it, vi } from "vitest";

import { generateListing, ListingApiError } from "../lib/listing-api";
import type { GenerateListingResponse, ListingMetadata } from "../lib/listing-types";

const metadata: ListingMetadata = {
  platform: "umum",
  market_region_code: "ID-JK",
  production_cost_idr: 25000,
  packaging_cost_idr: 0,
  other_cost_idr: 0,
  target_margin_pct: 30,
  platform_fee_pct: 0,
};

const image = new File(["valid-image"], "produk.jpg", { type: "image/jpeg" });

const successPayload: GenerateListingResponse = {
  data: {
    listing: {
      title: "Keripik Pisang Cokelat",
      description:
        "Keripik pisang renyah dengan lapisan cokelat yang cocok untuk camilan keluarga dan oleh-oleh.",
      category: { code: "camilan_olahan", label: "Camilan Olahan" },
      price: {
        currency: "IDR",
        recommended: 32000,
        market_interval: { low: 28000, high: 36000, target_coverage: 0.8 },
        viable_floor: 25000,
        alignment: "within_market",
        comparable_count: 12,
        data_as_of: "2026-08-23",
      },
    },
    confidence: {
      category: { score: 90, band: "high", method: "rules", status: "available" },
      price: { score: 82, band: "high", method: "market", status: "available" },
      generation: { score: 88, band: "high", method: "grounded", status: "available" },
      overall: { score: 86, band: "high", method: "calibrated", status: "available" },
    },
    warnings: [],
  },
  meta: {
    request_id: "req_success",
    api_version: "v1",
    generator_version: null,
    taxonomy_version: null,
    category_model_version: null,
    price_model_version: null,
    price_data_version: null,
    guardrail_version: null,
    calibration_version: null,
  },
  error: null,
};

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("listing API contract", () => {
  it("sends multipart FormData without a blank product-type hint or manual Content-Type", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(successPayload));
    vi.stubGlobal("fetch", fetchMock);

    const result = await generateListing(image, metadata, new AbortController().signal);
    const [url, requestInit] = fetchMock.mock.calls[0]!;
    const body = requestInit?.body;

    expect(url.toString()).toMatch(/\/v1\/listings\/generate$/);
    expect(requestInit?.method).toBe("POST");
    expect(requestInit?.headers).toBeUndefined();
    expect(body).toBeInstanceOf(FormData);
    expect((body as FormData).get("image")).toBeInstanceOf(File);
    expect((body as FormData).get("metadata")).toBe(JSON.stringify(metadata));
    expect(result.meta.request_id).toBe("req_success");
    expect(result.data.listing.category.code).toBe("camilan_olahan");
  });

  it("uses the same-origin API path when no public API override is configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "");
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(successPayload));
    vi.stubGlobal("fetch", fetchMock);

    const { generateListing: generateListingWithDefaultBase } = await import("../lib/listing-api");
    await generateListingWithDefaultBase(image, metadata, new AbortController().signal);

    expect(fetchMock.mock.calls[0]?.[0]).toBe("/v1/listings/generate");
  });

  it("uses the explicit public API override when configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "https://api.example.test/");
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(successPayload));
    vi.stubGlobal("fetch", fetchMock);

    const { generateListing: generateListingWithOverride } = await import("../lib/listing-api");
    await generateListingWithOverride(image, metadata, new AbortController().signal);

    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://api.example.test/v1/listings/generate");
  });

  it("preserves a supplied optional product-type hint in multipart metadata", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(successPayload));
    vi.stubGlobal("fetch", fetchMock);
    const metadataWithHint = { ...metadata, product_type: "Keripik pisang" };

    await generateListing(image, metadataWithHint, new AbortController().signal);

    const body = fetchMock.mock.calls[0]?.[1]?.body as FormData;
    expect(body.get("metadata")).toBe(JSON.stringify(metadataWithHint));
  });

  it("maps server error request_id, field, and retryable values", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse(
        {
          data: null,
          meta: { request_id: "req_invalid", api_version: "v1" },
          error: {
            code: "REQUEST_INVALID",
            message: "Biaya produksi tidak valid.",
            field: "production_cost_idr",
            retryable: false,
            details: { errors: [] },
          },
        },
        422,
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(generateListing(image, metadata, new AbortController().signal)).rejects.toMatchObject({
      status: 422,
      code: "REQUEST_INVALID",
      field: "production_cost_idr",
      requestId: "req_invalid",
      retryable: false,
      message: "Biaya produksi tidak valid.",
    });
  });

  it("prefers a safe nested validation message so pricing tax hints reach the wizard", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse(
        {
          data: null,
          meta: { request_id: "req_pricing_invalid", api_version: "v1" },
          error: {
            code: "METADATA_INVALID",
            message: "Satu atau lebih field metadata tidak valid.",
            field: "pricing",
            retryable: false,
            details: {
              errors: [
                {
                  field: "pricing",
                  message: "PPN dan omzet tahunan membuat potongan efektif terlalu tinggi.",
                  type: "value_error",
                },
              ],
            },
          },
        },
        422,
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(generateListing(image, metadata, new AbortController().signal)).rejects.toMatchObject({
      field: "pricing",
      message: "PPN dan omzet tahunan membuat potongan efektif terlalu tinggi.",
    });
  });

  it("falls back to the top-level message when nested validation details are malformed", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse(
        {
          data: null,
          meta: { request_id: "req_malformed_details", api_version: "v1" },
          error: {
            code: "METADATA_INVALID",
            message: "Metadata tidak valid.",
            field: "pricing",
            retryable: false,
            details: { errors: [{ message: { leaked: "no" } }] },
          },
        },
        422,
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(generateListing(image, metadata, new AbortController().signal)).rejects.toMatchObject({
      message: "Metadata tidak valid.",
    });
  });

  it("uses a safe fallback for malformed error envelopes without a secondary crash", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({ error: { code: "BROKEN", message: "partial" } }, 422),
    );
    vi.stubGlobal("fetch", fetchMock);

    try {
      await generateListing(image, metadata, new AbortController().signal);
      throw new Error("Expected generateListing to reject");
    } catch (error) {
      expect(error).toBeInstanceOf(ListingApiError);
      expect(error).toMatchObject({
        status: 422,
        code: "HTTP_ERROR",
        requestId: null,
        retryable: false,
        message: "Ada isian yang belum sesuai. Periksa kolom yang ditandai.",
      });
    }
  });
});
