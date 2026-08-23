"use client";

import { useState } from "react";
import { ArrowLeft, Check, Copy, RefreshCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatRupiah } from "@/lib/format";
import { CATEGORY_LABELS, type CategoryCode, type GenerateListingResponse } from "@/lib/listing-types";

interface CopyListingProps {
  response: GenerateListingResponse;
  title: string;
  description: string;
  categoryCode: CategoryCode;
  onBack: () => void;
  onRestart: () => void;
}

export function CopyListing({ response, title, description, categoryCode, onBack, onRestart }: CopyListingProps) {
  const [status, setStatus] = useState("");
  const price = response.data.listing.price.recommended;

  async function copyText(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setStatus(`${label} tersalin.`);
    } catch {
      setStatus(`Tidak dapat menyalin ${label.toLowerCase()}. Pilih teks dan salin secara manual.`);
    }
  }

  const allContent = [
    title,
    description,
    `Kategori: ${CATEGORY_LABELS[categoryCode]}`,
    `Rekomendasi harga: ${price === null ? "Belum tersedia" : formatRupiah(price)}`,
  ].join("\n\n");

  return (
    <div className="space-y-8">
      <section className="rounded-[24px] border border-line bg-surface p-5 sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-brand">Listing siap disalin</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-ink">
              Pindahkan hasil ke lapakmu
            </h2>
          </div>
          <Check className="size-8 text-status-success" aria-hidden="true" />
        </div>

        <div className="mt-8 space-y-5">
          <article className="rounded-2xl border border-line bg-canvas p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <h3 className="text-sm font-medium text-ink-muted">Judul</h3>
                <p className="mt-3 break-words text-lg font-semibold text-ink">{title}</p>
              </div>
              <Button type="button" variant="outline" onClick={() => copyText("Judul", title)}>
                <Copy aria-hidden="true" />
                Salin judul
              </Button>
            </div>
          </article>

          <article className="rounded-2xl border border-line bg-canvas p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <h3 className="text-sm font-medium text-ink-muted">Deskripsi</h3>
                <p className="mt-3 whitespace-pre-wrap break-words leading-7 text-ink">{description}</p>
              </div>
              <Button type="button" variant="outline" onClick={() => copyText("Deskripsi", description)}>
                <Copy aria-hidden="true" />
                Salin deskripsi
              </Button>
            </div>
          </article>

          <article className="grid gap-4 rounded-2xl border border-line bg-canvas p-5 sm:grid-cols-2">
            <div>
              <h3 className="text-sm font-medium text-ink-muted">Kategori</h3>
              <p className="mt-2 font-semibold text-ink">{CATEGORY_LABELS[categoryCode]}</p>
            </div>
            <div className="min-w-0">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-sm font-medium text-ink-muted">Rekomendasi harga</h3>
                  <p className="mt-2 font-semibold text-ink">
                    {price === null ? "Belum tersedia" : formatRupiah(price)}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  disabled={price === null}
                  aria-describedby={price === null ? "price-copy-unavailable" : undefined}
                  onClick={() => price !== null && void copyText("Harga", formatRupiah(price))}
                >
                  <Copy aria-hidden="true" />
                  Salin harga
                </Button>
              </div>
              {price === null && (
                <p id="price-copy-unavailable" className="mt-3 text-sm leading-6 text-ink-muted">
                  Harga rekomendasi belum tersedia, jadi tidak ada angka untuk disalin.
                </p>
              )}
            </div>
          </article>
        </div>

        <p className="mt-5 min-h-6 text-sm text-brand" aria-live="polite">{status}</p>
        <Button type="button" size="lg" className="mt-3 w-full sm:w-auto" onClick={() => copyText("Semua hasil", allContent)}>
          <Copy aria-hidden="true" />
          Salin semua hasil
        </Button>
      </section>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        <Button type="button" variant="outline" onClick={onBack}>
          <ArrowLeft aria-hidden="true" />
          Periksa lagi
        </Button>
        <Button type="button" variant="outline" onClick={onRestart}>
          <RefreshCcw aria-hidden="true" />
          Buat listing baru
        </Button>
      </div>
    </div>
  );
}
