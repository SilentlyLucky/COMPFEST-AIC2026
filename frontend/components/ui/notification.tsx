"use client";

import { AlertCircle, CheckCircle2, Info, TriangleAlert, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { cn } from "../../lib/utils";

type NotificationVariant = "success" | "error" | "warning" | "info";

const variantStyles: Record<NotificationVariant, { icon: typeof Info; tone: string; accent: string }> = {
  success: { icon: CheckCircle2, tone: "bg-[#f0fdf4] text-[#166534]", accent: "bg-[#22c55e]" },
  error: { icon: AlertCircle, tone: "bg-status-error-soft text-status-error", accent: "bg-status-error" },
  warning: { icon: TriangleAlert, tone: "bg-status-warning-soft text-status-warning", accent: "bg-amber" },
  info: { icon: Info, tone: "bg-brand-soft text-link", accent: "bg-brand" },
};

export function Notification({
  title,
  message,
  variant = "info",
  action,
  onDismiss,
  autoDismissMs,
  showAccent = true,
  className,
}: {
  title: string;
  message?: string;
  variant?: NotificationVariant;
  action?: ReactNode;
  onDismiss?: () => void;
  autoDismissMs?: number;
  showAccent?: boolean;
  className?: string;
}) {
  const { icon: Icon, tone, accent } = variantStyles[variant];
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    if (!autoDismissMs || !onDismiss) return;

    const fadeOutTimer = window.setTimeout(() => setIsLeaving(true), autoDismissMs);
    const dismissTimer = window.setTimeout(onDismiss, autoDismissMs + 240);

    return () => {
      window.clearTimeout(fadeOutTimer);
      window.clearTimeout(dismissTimer);
    };
  }, [autoDismissMs, onDismiss]);

  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      className={cn(
        "relative flex w-full max-w-[min(28rem,calc(100vw-2rem))] items-start gap-3 overflow-hidden rounded-2xl border border-white/80 bg-white/95 p-4 text-left shadow-[0_18px_50px_-20px_rgba(0,41,93,0.45)] backdrop-blur-xl motion-safe:animate-[notification-in_320ms_cubic-bezier(.22,1,.36,1)]",
        isLeaving && "motion-safe:animate-[notification-out_240ms_ease-in_forwards]",
        className,
      )}
    >
      {showAccent && (
        <span className={cn("absolute inset-y-0 left-0 w-1", accent)} aria-hidden="true" />
      )}
      <span className={cn("mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl", tone)}>
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold leading-6 text-ink">{title}</p>
        {message && <p className="mt-1 text-sm leading-6 text-ink-muted">{message}</p>}
        {action && <div className="mt-3 flex flex-wrap gap-2">{action}</div>}
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Tutup notifikasi"
          className="-mr-1 -mt-1 flex size-9 shrink-0 items-center justify-center rounded-xl text-ink-muted transition-colors hover:bg-soft-canvas hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

export function NotificationViewport({ children }: { children: ReactNode }) {
  return <div className="pointer-events-none fixed inset-x-0 bottom-5 z-50 flex justify-center px-4 sm:bottom-8 sm:justify-end sm:px-8 [&>*]:pointer-events-auto">{children}</div>;
}
