import type {
  ApiErrorPayload,
  GenerateListingResponse,
  ListingMetadata,
} from "@/lib/listing-types";

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000").replace(
  /\/$/,
  "",
);

const FALLBACK_MESSAGES: Record<number, string> = {
  400: "Data permintaan belum bisa dibaca. Periksa kembali isianmu.",
  413: "Ukuran foto melebihi batas 5 MiB.",
  415: "Format foto tidak didukung. Gunakan JPEG, PNG, atau WebP.",
  422: "Ada isian yang belum sesuai. Periksa kolom yang ditandai.",
  429: "Kapasitas analisis sedang penuh. Coba lagi sebentar.",
  500: "Layanan mengalami kendala saat membuat listing.",
  503: "Model atau data harga belum siap. Isianmu tetap tersimpan untuk dicoba lagi.",
  504: "Pembuatan listing melewati 45 detik. Coba lagi dengan foto yang sama.",
};

export class ListingApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly field: string | null,
    readonly requestId: string | null,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "ListingApiError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isErrorPayload(payload: unknown): payload is ApiErrorPayload {
  if (!isRecord(payload) || !isRecord(payload.error) || !isRecord(payload.meta)) return false;

  const error = payload.error;
  const meta = payload.meta;
  return (
    typeof error.code === "string" &&
    typeof error.message === "string" &&
    (error.field === null || typeof error.field === "string") &&
    typeof error.retryable === "boolean" &&
    isRecord(error.details) &&
    typeof meta.request_id === "string" &&
    typeof meta.api_version === "string"
  );
}

function isSuccessPayload(payload: unknown): payload is GenerateListingResponse {
  if (!isRecord(payload) || !isRecord(payload.data) || !isRecord(payload.meta)) return false;

  return Boolean(
    isRecord(payload.data.listing) &&
      isRecord(payload.data.confidence) &&
      Array.isArray(payload.data.warnings) &&
      typeof payload.meta.request_id === "string",
  );
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function generateListing(
  image: File,
  metadata: ListingMetadata,
  signal: AbortSignal,
): Promise<GenerateListingResponse> {
  const body = new FormData();
  body.append("image", image, image.name);
  body.append("metadata", JSON.stringify(metadata));

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/v1/listings/generate`, {
      method: "POST",
      body,
      signal,
    });
  } catch (error) {
    if (signal.aborted) throw error;
    throw new ListingApiError(
      "Tidak dapat terhubung ke backend LAPAKIN. Pastikan API sedang berjalan.",
      0,
      "NETWORK_ERROR",
      null,
      null,
      true,
    );
  }

  const payload = await readJson(response);
  if (!response.ok) {
    if (isErrorPayload(payload)) {
      throw new ListingApiError(
        payload.error.message || FALLBACK_MESSAGES[response.status] || "Layanan tidak dapat menyelesaikan permintaan.",
        response.status,
        payload.error.code,
        payload.error.field,
        payload.meta.request_id,
        payload.error.retryable,
      );
    }
    throw new ListingApiError(
      FALLBACK_MESSAGES[response.status] ?? "Layanan tidak dapat menyelesaikan permintaan.",
      response.status,
      "HTTP_ERROR",
      null,
      response.headers.get("x-request-id"),
      response.status >= 500 || response.status === 429,
    );
  }

  if (!isSuccessPayload(payload)) {
    throw new ListingApiError(
      "Respons backend tidak memiliki struktur yang diharapkan.",
      500,
      "INVALID_RESPONSE",
      null,
      response.headers.get("x-request-id"),
      true,
    );
  }
  return payload;
}
