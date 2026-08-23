import { Check, ClipboardCheck, ImagePlus, Sparkles } from "lucide-react";

const STEPS = [
  { label: "Foto & fakta", description: "Isi detail produk", icon: ImagePlus },
  { label: "Hasil & keyakinan", description: "Periksa rekomendasi", icon: Sparkles },
  { label: "Salin", description: "Pindahkan ke lapak", icon: ClipboardCheck },
] as const;

export function StepProgress({ currentStep }: { currentStep: 1 | 2 | 3 }) {
  return (
    <nav aria-label="Tahap pembuatan listing">
      <ol className="grid gap-3 sm:grid-cols-3">
        {STEPS.map(({ label, description, icon: Icon }, index) => {
          const number = index + 1;
          const active = number === currentStep;
          const complete = number < currentStep;
          return (
            <li
              key={label}
              aria-current={active ? "step" : undefined}
              className={`relative flex min-h-20 items-center gap-4 rounded-2xl border px-4 py-4 transition-colors sm:min-h-24 sm:px-5 ${
                active
                  ? "border-brand bg-surface text-ink shadow-[0_12px_32px_rgba(16,37,28,0.10)]"
                  : complete
                    ? "border-brand/32 bg-brand-soft/70 text-ink"
                    : "border-line/70 bg-surface/64 text-ink-muted"
              }`}
            >
              <span
                className={`grid size-11 shrink-0 place-items-center rounded-xl ${
                  active
                    ? "bg-brand text-white shadow-[0_8px_20px_rgba(47,111,87,0.24)]"
                    : complete
                      ? "bg-surface text-brand"
                      : "bg-canvas text-ink-muted"
                }`}
              >
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className={`block text-sm font-semibold ${active ? "text-ink" : ""}`}>
                  {number}. {label}
                </span>
                <span className="mt-1 block text-xs font-normal leading-5 text-ink-muted">
                  {description}
                </span>
              </span>
              {complete && (
                <span className="absolute right-3 top-3 grid size-5 place-items-center rounded-full bg-brand text-white">
                  <Check className="size-3" aria-hidden="true" />
                  <span className="sr-only">Selesai</span>
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
