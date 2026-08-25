import { Check, ClipboardCheck, ImagePlus, Sparkles } from "lucide-react";

const STEPS = [
  { label: "Foto & fakta", description: "Isi detail produk", icon: ImagePlus },
  {
    label: "Hasil & keyakinan",
    description: "Periksa rekomendasi",
    icon: Sparkles,
  },
  { label: "Salin", description: "Pindahkan ke lapak", icon: ClipboardCheck },
] as const;

export function StepProgress({ currentStep }: { currentStep: 1 | 2 | 3 }) {
  return (
    <nav aria-label="Tahap pembuatan listing">
      <ol className="hidden items-center md:flex">
        {STEPS.map(({ label, description, icon: Icon }, index) => {
          const number = index + 1;
          const active = number === currentStep;
          const complete = number < currentStep;
          return (
            <li
              key={label}
              className="flex min-w-0 flex-1 items-center"
              aria-current={active ? "step" : undefined}
              aria-label={`${number}. ${label}: ${active ? "sedang dikerjakan" : complete ? "selesai" : "belum dimulai"}`}
            >
              <div
                className={`flex min-h-11 min-w-0 items-center gap-2 ${active || complete ? "text-ink" : "text-ink-muted"}`}
              >
                <span
                  className={`grid size-10 shrink-0 place-items-center rounded-full border ${
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : complete
                        ? "border-brand bg-brand-soft text-brand"
                        : "border-line bg-surface text-ink-muted"
                  }`}
                >
                  {complete ? (
                    <Check className="size-5" aria-hidden="true" />
                  ) : (
                    <Icon className="size-5" aria-hidden="true" />
                  )}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{number}. {label}</span>
                  <span className="sr-only">{description}</span>
                </span>
              </div>
              {number < STEPS.length && (
                <span
                  className={`mx-3 h-px min-w-4 flex-1 ${complete ? "bg-brand" : "bg-line"}`}
                  aria-hidden="true"
                />
              )}
            </li>
          );
        })}
      </ol>
      <div className="md:hidden">
        <p className="text-sm font-semibold text-ink">
          {currentStep} dari 3 · {STEPS[currentStep - 1].label}
        </p>
        <div
          className="mt-2 h-1 overflow-hidden rounded-full bg-soft-canvas"
          aria-hidden="true"
        >
          <div
            className="h-full bg-brand transition-[width] duration-200 motion-reduce:transition-none"
            style={{ width: `${(currentStep / 3) * 100}%` }}
          />
        </div>
      </div>
    </nav>
  );
}
