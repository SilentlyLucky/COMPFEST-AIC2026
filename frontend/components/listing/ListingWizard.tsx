"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { AlertCircle, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CopyListing } from "./CopyListing";
import { ListingForm } from "./ListingForm";
import { ListingResult } from "./ListingResult";
import { StepProgress } from "./StepProgress";
import { generateListing, ListingApiError } from "@/lib/listing-api";
import type { CategoryCode, GenerateListingResponse } from "@/lib/listing-types";
import {
  INITIAL_FORM_VALUES,
  validateImage,
  validateListing,
  type FieldErrors,
  type ListingField,
  type ListingFormValues,
} from "@/lib/listing-validation";

type WizardStep = 1 | 2 | 3;
const PROCESSING_LIMIT_MS = 45_000;
const CLIENT_ABORT_GRACE_MS = 2_000;
const PROGRESS_MESSAGES = ["Memeriksa foto", "Menyusun listing", "Membandingkan harga"] as const;

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
};

function mapApiField(field: string | null): ListingField | null {
  if (!field) return null;
  const segment = field.split(".").at(-1);
  return segment ? API_FIELD_MAP[segment] ?? null : null;
}

function RequestError({ error, onRetry }: { error: ListingApiError; onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="rounded-[24px] border border-status-error bg-status-error-soft p-5 shadow-[0_16px_40px_rgba(180,35,24,0.08)] sm:p-6"
    >
      <div className="flex items-start gap-4">
        <AlertCircle className="mt-1 size-6 shrink-0 text-status-error" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold text-ink">Listing belum berhasil dibuat</h2>
          <p className="mt-2 leading-7 text-ink">{error.message}</p>
          <p className="mt-3 break-all font-mono text-xs leading-5 text-ink-muted">
            Kode: {error.code}
            {error.requestId ? ` · Request ID: ${error.requestId}` : ""}
          </p>
          {error.retryable ? (
            <Button type="button" variant="outline" className="mt-4" onClick={onRetry}>
              <RotateCcw aria-hidden="true" />
              Coba lagi
            </Button>
          ) : (
            <p className="mt-4 text-sm font-medium text-ink">
              {error.field
                ? "Periksa kolom yang ditandai, lalu perbaiki isian sebelum mencoba lagi."
                : "Periksa kembali isianmu sebelum mengirim permintaan lagi."}
            </p>
          )}
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
  const [requestError, setRequestError] = useState<ListingApiError | null>(null);
  const [response, setResponse] = useState<GenerateListingResponse | null>(null);
  const [categoryCode, setCategoryCode] = useState<CategoryCode | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [progressIndex, setProgressIndex] = useState(0);
  const controllerRef = useRef<AbortController | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const stageHeadingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    stageHeadingRef.current?.focus();
  }, [step]);

  useEffect(() => {
    if (!isSubmitting) return;
    const intervalId = window.setInterval(() => {
      setProgressIndex((current) => (current + 1) % PROGRESS_MESSAGES.length);
    }, 1_600);
    return () => window.clearInterval(intervalId);
  }, [isSubmitting]);

  useEffect(() => {
    const field = mapApiField(requestError?.field ?? null);
    if (!field) return;
    document.getElementById(field)?.focus();
  }, [requestError]);

  useEffect(
    () => () => {
      controllerRef.current?.abort("unmount");
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    },
    [],
  );

  function handleFieldChange(field: keyof ListingFormValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }) as ListingFormValues);
    setErrors((current) => ({ ...current, [field]: undefined }));
    setRequestError(null);
  }

  function handleImageChange(file: File | null) {
    const imageError = validateImage(file);
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    const nextPreviewUrl = file && !imageError ? URL.createObjectURL(file) : null;
    previewUrlRef.current = nextPreviewUrl;
    setPreviewUrl(nextPreviewUrl);
    setImage(file);
    setErrors((current) => ({ ...current, image: imageError ?? undefined }));
    setRequestError(null);
  }

  async function submitListing(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const validation = validateListing(values, image);
    setErrors(validation.errors);
    setRequestError(null);
    if (!validation.metadata || !image) {
      const firstField = Object.keys(validation.errors)[0];
      if (firstField) document.getElementById(firstField)?.focus();
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
      const result = await generateListing(image, validation.metadata, controller.signal);
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

      const field = mapApiField(nextError.field);
      if (field) setErrors((current) => ({ ...current, [field]: nextError.message }));
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
    setStep(1);
  }

  return (
    <div className="space-y-8 md:space-y-10">
      <StepProgress currentStep={step} />

      <div className="pt-1">
        <h1
          ref={stageHeadingRef}
          tabIndex={-1}
          className="max-w-4xl text-balance text-[clamp(2rem,4vw,3rem)] font-semibold leading-[1.06] tracking-[-0.05em] text-ink focus:outline-2 focus:outline-offset-4 focus:outline-brand"
        >
          {step === 1 && "Ceritakan produkmu lewat foto dan fakta."}
          {step === 2 && "Periksa hasil dan tingkat keyakinannya."}
          {step === 3 && "Salin hasil ke kanal jualmu."}
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-ink-muted sm:text-lg sm:leading-8">
          {step === 1 && "Input tidak akan hilang saat backend belum siap atau permintaan perlu dicoba ulang."}
          {step === 2 && "Edit judul dan deskripsi sebelum melanjutkan. Harga dan confidence dapat kosong bila bukti belum cukup."}
          {step === 3 && "Gunakan hasil ini sebagai draf. Periksa kembali sebelum menerbitkannya di marketplace."}
        </p>
      </div>

      {requestError && step === 1 && <RequestError error={requestError} onRetry={() => void submitListing()} />}

      {step === 1 && (
        <ListingForm
          values={values}
          previewUrl={previewUrl}
          errors={errors}
          isSubmitting={isSubmitting}
          progressMessage={isSubmitting ? PROGRESS_MESSAGES[progressIndex] : null}
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
