"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { AlertCircle, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CopyListing } from "./CopyListing";
import { ListingForm } from "./ListingForm";
import { ListingResult } from "./ListingResult";
import { StepProgress } from "./StepProgress";
import { generateListing, ListingApiError } from "@/lib/listing-api";
import type {
  CategoryCode,
  GenerateListingResponse,
} from "@/lib/listing-types";
import {
  INITIAL_FORM_VALUES,
  firstInvalidField,
  validateImage,
  validateListing,
  type FieldErrors,
  type ListingField,
  type ListingFormValues,
} from "@/lib/listing-validation";

type WizardStep = 1 | 2 | 3;
const PROCESSING_LIMIT_MS = 45_000;
const CLIENT_ABORT_GRACE_MS = 2_000;
const PROGRESS_MESSAGES = [
  "Memeriksa foto",
  "Menyusun listing",
  "Membandingkan harga",
] as const;
const DETAIL_FIELDS: ListingField[] = [
  "productType",
  "brand",
  "variant",
  "size",
  "materialOrIngredients",
];
const PRICING_FIELDS: ListingField[] = [
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

const API_FIELD_MAP: Record<string, ListingField> = {
  image: "image",
  product_type: "productType",
  platform: "platform",
  market_region_code: "marketRegionCode",
  production_cost_idr: "productionCost",
  brand: "brand",
  variant: "variant",
  size: "size",
  material_or_ingredients: "materialOrIngredients",
  packaging_cost_idr: "packagingCost",
  other_cost_idr: "otherCost",
  target_margin_pct: "targetMargin",
  platform_fee_pct: "platformFee",
  pricing: "targetMargin",
  total_hpp_idr: "productionCost",
  purchase_unit: "purchaseUnit",
  purchase_quantity: "purchaseQuantity",
  sale_content: "saleContent",
  sale_unit: "saleUnit",
  output_unit_count: "outputUnitCount",
  output_unit_label: "outputUnitLabel",
  colors: "colors",
  sizes: "sizes",
  hpp_per_size_idr: "hppPerSize",
  grades: "grades",
  hpp_per_grade_idr: "hppPerGrade",
  annual_turnover_idr: "annualTurnover",
  vat_registered: "vatRegistered",
};

const HPP_FIELD_SEGMENTS = ["hpp_per_size_idr", "hpp_per_grade_idr"] as const;
const API_FIELD_SEGMENT_ORDER = [
  ...HPP_FIELD_SEGMENTS,
  ...Object.keys(API_FIELD_MAP).filter(
    (segment) => segment !== "pricing" && !HPP_FIELD_SEGMENTS.includes(segment as (typeof HPP_FIELD_SEGMENTS)[number]),
  ),
];
const TAX_FIELD_SEGMENTS = new Set(["annual_turnover_idr", "vat_registered"]);

const PRICING_TAX_ERROR_PATTERNS = {
  annualTurnover: /(?:annual[\s_-]*turnover|turnover|omzet|pajak|tax)/i,
  vatRegistered: /(?:vat|ppn|pkp)/i,
} as const;

function mappedFieldsForSegments(segments: string[]): ListingField[] {
  return [...new Set(segments.map((segment) => API_FIELD_MAP[segment]))];
}

function mappedFieldsInPath(field: string): ListingField[] {
  const pathSegments = new Set(field.split("."));
  return mappedFieldsForSegments(
    API_FIELD_SEGMENT_ORDER.filter((segment) => pathSegments.has(segment)),
  );
}

function mappedFieldsInPricingMessage(message: string): ListingField[] {
  const normalizedMessage = message.toLocaleLowerCase();
  const hppSegments = HPP_FIELD_SEGMENTS.filter((segment) =>
    normalizedMessage.includes(segment),
  );
  if (hppSegments.length > 0) return mappedFieldsForSegments([...hppSegments]);

  const detailSegments = API_FIELD_SEGMENT_ORDER.filter(
    (segment) =>
      !TAX_FIELD_SEGMENTS.has(segment) && normalizedMessage.includes(segment),
  );
  return mappedFieldsForSegments(detailSegments);
}

export function mapApiErrorFields(
  field: string | null,
  message = "",
): ListingField[] {
  if (!field) return [];
  const pathFields = mappedFieldsInPath(field);
  const segment = field.split(".").at(-1);
  if (!segment) return [];

  if (segment === "pricing") {
    const messageFields = mappedFieldsInPricingMessage(message);
    if (messageFields.length > 0) return messageFields;

    const mappedFields: ListingField[] = ["targetMargin"];
    if (PRICING_TAX_ERROR_PATTERNS.annualTurnover.test(message)) {
      mappedFields.push("annualTurnover");
    }
    if (PRICING_TAX_ERROR_PATTERNS.vatRegistered.test(message)) {
      mappedFields.push("vatRegistered");
    }
    return mappedFields;
  }

  return pathFields;
}

function RequestError({
  error,
  onRetry,
}: {
  error: ListingApiError;
  onRetry: () => void;
}) {
  const message =
    error.code === "CLIENT_TIMEOUT" ||
    error.code === "GENERATION_TIMEOUT" ||
    error.status === 504
      ? "Proses memerlukan waktu lebih lama dari biasanya. Coba lagi."
      : error.code === "REQUEST_CANCELLED"
        ? "Proses dibatalkan. Kamu bisa mencoba lagi saat siap."
        : error.field
          ? "Periksa isian yang ditandai, lalu coba lagi."
          : error.retryable
            ? "Belum bisa menyusun listing saat ini. Coba lagi sebentar."
            : "Periksa kembali isianmu, lalu coba lagi.";

  return (
    <div
      role="alert"
      className="border-l-4 border-status-error bg-status-error-soft p-4 sm:p-5"
    >
      <div className="flex items-start gap-4">
        <AlertCircle
          className="mt-1 size-6 shrink-0 text-status-error"
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold text-ink">
            Listing belum berhasil dibuat
          </h2>
          <p className="mt-2 leading-7 text-ink">{message}</p>
          <p className="mt-2 text-sm leading-6 text-ink-muted">
            Drafmu tetap tersimpan.
          </p>
          {error.retryable ? (
            <Button
              type="button"
              variant="outline"
              className="mt-4"
              onClick={onRetry}
            >
              <RotateCcw aria-hidden="true" />
              Coba lagi
            </Button>
          ) : error.field ? (
            <p className="mt-4 text-sm font-medium text-ink">
              Periksa isian yang ditandai sebelum mencoba lagi.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function ListingWizard() {
  const [step, setStep] = useState<WizardStep>(1);
  const [values, setValues] = useState<ListingFormValues>(INITIAL_FORM_VALUES);
  const [image, setImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [requestError, setRequestError] = useState<ListingApiError | null>(
    null,
  );
  const [response, setResponse] = useState<GenerateListingResponse | null>(
    null,
  );
  const [categoryCode, setCategoryCode] = useState<CategoryCode | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [progressIndex, setProgressIndex] = useState(0);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [pricingOpen, setPricingOpen] = useState(false);
  const [fieldToFocus, setFieldToFocus] = useState<ListingField | null>(null);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const stageHeadingRef = useRef<HTMLHeadingElement>(null);
  const previousStepRef = useRef<WizardStep | null>(null);

  useEffect(() => {
    if (previousStepRef.current !== null && previousStepRef.current !== step) {
      stageHeadingRef.current?.focus();
    }
    previousStepRef.current = step;
  }, [step]);

  useEffect(() => {
    if (!isSubmitting) return;
    const intervalId = window.setInterval(() => {
      setProgressIndex((current) => (current + 1) % PROGRESS_MESSAGES.length);
    }, 1_600);
    return () => window.clearInterval(intervalId);
  }, [isSubmitting]);

  useEffect(() => {
    if (!fieldToFocus) return;
    if (DETAIL_FIELDS.includes(fieldToFocus) && !detailsOpen) return;
    if (PRICING_FIELDS.includes(fieldToFocus) && !pricingOpen) return;

    const frameId = window.requestAnimationFrame(() => {
      const control = document.getElementById(fieldToFocus);
      control?.scrollIntoView({ block: "center" });
      control?.focus({ preventScroll: true });
      setFieldToFocus(null);
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [detailsOpen, fieldToFocus, pricingOpen]);

  useEffect(
    () => () => {
      controllerRef.current?.abort("unmount");
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    },
    [],
  );

  function handleFieldChange(field: keyof ListingFormValues, value: string) {
    setValues(
      (current) => ({ ...current, [field]: value }) as ListingFormValues,
    );
    setErrors((current) => ({ ...current, [field]: undefined }));
    setRequestError(null);
  }

  function handleImageChange(file: File | null) {
    const imageError = validateImage(file);
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    const nextPreviewUrl =
      file && !imageError ? URL.createObjectURL(file) : null;
    previewUrlRef.current = nextPreviewUrl;
    setPreviewUrl(nextPreviewUrl);
    setImage(file);
    setErrors((current) => ({ ...current, image: imageError ?? undefined }));
    setRequestError(null);
  }

  function focusField(field: ListingField) {
    if (DETAIL_FIELDS.includes(field)) setDetailsOpen(true);
    if (PRICING_FIELDS.includes(field)) setPricingOpen(true);
    setFieldToFocus(field);
  }

  async function submitListing(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const validation = validateListing(values, image);
    setHasSubmitted(true);
    setErrors(validation.errors);
    setRequestError(null);
    if (!validation.metadata || !image) {
      const firstField = firstInvalidField(validation.errors);
      if (firstField) focusField(firstField);
      return;
    }

    const controller = new AbortController();
    controllerRef.current = controller;
    const timeoutId = window.setTimeout(
      () => controller.abort("timeout"),
      PROCESSING_LIMIT_MS + CLIENT_ABORT_GRACE_MS,
    );
    setProgressIndex(0);
    setIsSubmitting(true);

    try {
      const result = await generateListing(
        image,
        validation.metadata,
        controller.signal,
      );
      setResponse(result);
      setCategoryCode(result.data.listing.category.code);
      setTitle(result.data.listing.title);
      setDescription(result.data.listing.description);
      setStep(2);
    } catch (error) {
      let nextError: ListingApiError;
      if (controller.signal.aborted) {
        const timedOut = controller.signal.reason === "timeout";
        nextError = new ListingApiError(
          timedOut
            ? "Pembuatan listing melewati 45 detik. Isianmu tetap tersimpan untuk dicoba lagi."
            : "Pembuatan listing dibatalkan. Isianmu tetap tersimpan.",
          timedOut ? 504 : 0,
          timedOut ? "CLIENT_TIMEOUT" : "REQUEST_CANCELLED",
          null,
          null,
          true,
        );
      } else if (error instanceof ListingApiError) {
        nextError = error;
      } else {
        nextError = new ListingApiError(
          "Terjadi kendala tak terduga saat membuat listing.",
          500,
          "UNEXPECTED_CLIENT_ERROR",
          null,
          null,
          true,
        );
      }

      const fields = mapApiErrorFields(nextError.field, nextError.message);
      if (fields.length > 0) {
        setErrors((current) => {
          const next = { ...current };
          fields.forEach((field) => {
            next[field] = nextError.message;
          });
          return next;
        });
        focusField(fields[0]);
      }
      setRequestError(nextError);
    } finally {
      window.clearTimeout(timeoutId);
      controllerRef.current = null;
      setIsSubmitting(false);
    }
  }

  function restart() {
    controllerRef.current?.abort("restart");
    setValues(INITIAL_FORM_VALUES);
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = null;
    setPreviewUrl(null);
    setImage(null);
    setErrors({});
    setRequestError(null);
    setResponse(null);
    setCategoryCode(null);
    setTitle("");
    setDescription("");
    setDetailsOpen(false);
    setPricingOpen(false);
    setFieldToFocus(null);
    setHasSubmitted(false);
    setStep(1);
  }

  return (
    <div className="space-y-8 md:space-y-10">
      <StepProgress currentStep={step} />

      <div className="pt-1">
        <h1
          ref={stageHeadingRef}
          tabIndex={-1}
          className={`max-w-5xl text-balance font-semibold leading-[1.06] tracking-[-0.05em] text-ink focus:outline-2 focus:outline-offset-4 focus:outline-brand ${step === 2 ? "text-[clamp(2rem,3.8vw,3rem)]" : "text-[clamp(2rem,3.8vw,4rem)]"}`}
        >
          {step === 1 && "Ceritakan produkmu lewat foto dan fakta."}
          {step === 2 && "Periksa hasil listing"}
          {step === 3 && "Salin hasil ke kanal jualmu."}
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-ink-muted sm:text-lg sm:leading-8">
          {step === 1 &&
            "Cukup isi yang benar-benar kamu tahu. LAPAKIN akan membantu menyusun sisanya."}
          {step === 2 &&
            "Tinjau hasil AI dan ubah jika diperlukan sebelum melanjutkan."}
          {step === 3 &&
            "Gunakan hasil ini sebagai draf. Periksa kembali sebelum menerbitkannya di marketplace."}
        </p>
      </div>

      {requestError && step === 1 && (
        <RequestError
          error={requestError}
          onRetry={() => void submitListing()}
        />
      )}

      {step === 1 && (
        <ListingForm
          values={values}
          previewUrl={previewUrl}
          errors={errors}
          isSubmitting={isSubmitting}
          progressMessage={
            isSubmitting ? PROGRESS_MESSAGES[progressIndex] : null
          }
          detailsOpen={detailsOpen}
          pricingOpen={pricingOpen}
          hasSubmitError={hasSubmitted && Object.keys(errors).length > 0}
          onDetailsOpenChange={setDetailsOpen}
          onPricingOpenChange={setPricingOpen}
          onFieldChange={handleFieldChange}
          onImageChange={handleImageChange}
          onSubmit={submitListing}
          onCancel={() => controllerRef.current?.abort("cancelled")}
        />
      )}
      {step === 2 && response && (
        <ListingResult
          response={response}
          title={title}
          description={description}
          categoryCode={categoryCode ?? response.data.listing.category.code}
          onCategoryChange={setCategoryCode}
          onTitleChange={setTitle}
          onDescriptionChange={setDescription}
          onBack={() => setStep(1)}
          onContinue={() => setStep(3)}
        />
      )}
      {step === 3 && response && (
        <CopyListing
          response={response}
          title={title}
          description={description}
          categoryCode={categoryCode ?? response.data.listing.category.code}
          onBack={() => setStep(2)}
          onRestart={restart}
        />
      )}
    </div>
  );
}
