export const PLATFORMS = ["tokopedia", "shopee", "blibli", "umum"] as const;
export type Platform = (typeof PLATFORMS)[number];

export const CATEGORY_CODES = [
  "fashion_perawatan",
  "kriya_rumah",
  "pokok_tani",
  "minuman_herbal",
  "bumbu_masak",
  "camilan_olahan",
  "lainnya",
] as const;
export type CategoryCode = (typeof CATEGORY_CODES)[number];

export const CATEGORY_LABELS: Record<CategoryCode, string> = {
  fashion_perawatan: "Fashion & Perawatan",
  kriya_rumah: "Kriya & Rumah",
  pokok_tani: "Produk Pokok & Hasil Tani",
  minuman_herbal: "Minuman & Herbal",
  bumbu_masak: "Bumbu Masak",
  camilan_olahan: "Camilan Olahan",
  lainnya: "Lainnya",
};

export type PriceAlignment = "within_market" | "above_market" | "insufficient_evidence";

export interface ListingMetadata {
  product_type: string;
  platform: Platform;
  market_region_code?: string;
  production_cost_idr: number;
  brand?: string;
  variant?: string;
  size?: string;
  material_or_ingredients?: string;
  packaging_cost_idr: number;
  other_cost_idr: number;
  target_margin_pct: number;
  platform_fee_pct: number;
}

export interface MarketInterval {
  low: number;
  high: number;
  target_coverage: number;
}

export interface ConfidenceField {
  score: number | null;
  band: "low" | "medium" | "high" | null;
  method: string;
  status: "available" | "insufficient_evidence";
}

export interface ListingResponseMeta {
  request_id: string;
  api_version: "v1";
  generator_version: string | null;
  taxonomy_version: string | null;
  category_model_version: string | null;
  price_model_version: string | null;
  price_data_version: string | null;
  guardrail_version: string | null;
  calibration_version: string | null;
}

export interface GenerateListingResponse {
  data: {
    listing: {
      title: string;
      description: string;
      category: {
        code: CategoryCode;
        label: string;
      };
      price: {
        currency: "IDR";
        recommended: number | null;
        market_interval: MarketInterval | null;
        viable_floor: number;
        alignment: PriceAlignment;
        comparable_count: number;
        data_as_of: string | null;
      };
    };
    confidence: {
      category: ConfidenceField;
      price: ConfidenceField;
      generation: ConfidenceField;
      overall: ConfidenceField;
    };
    warnings: string[];
  };
  meta: ListingResponseMeta;
  error: null;
}

export interface ApiErrorPayload {
  data: null;
  meta: {
    request_id: string;
    api_version: "v1";
  };
  error: {
    code: string;
    message: string;
    field: string | null;
    retryable: boolean;
    details: Record<string, unknown>;
  };
}
