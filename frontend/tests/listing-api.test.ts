import { afterEach, describe, expect, it, vi } from "vitest";

import { generateListing, ListingApiError } from "../lib/listing-api";
import type { GenerateListingResponse, ListingMetadata } from "../lib/listing-types";

const metadata: ListingMetadata = {
  product_type: "Keripik pisang",
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
});

describe("listing API contract", () => {
  it("sends multipart FormData without manually setting Content-Type and parses success", async () => {
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
