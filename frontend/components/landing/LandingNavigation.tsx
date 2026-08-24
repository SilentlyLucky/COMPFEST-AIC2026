"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button";

const links = [
  { href: "#masalah", label: "Masalah" },
  { href: "#cara-kerja", label: "Cara kerja" },
  { href: "#harga", label: "Harga" },
  { href: "#hasil", label: "Hasil" },
];

export function LandingNavigation() {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !open) return;

      setOpen(false);
      requestAnimationFrame(() => triggerRef.current?.focus());
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open]);
  return (
    <header className="relative z-50 bg-canvas px-5 sm:px-6">
      <nav
        aria-label="Navigasi utama"
        className="mx-auto flex min-h-[72px] max-w-7xl items-center justify-between border-b border-line"
      >
        <Link
          href="/"
          className="inline-flex min-h-11 items-center gap-3 font-semibold tracking-[-.04em] text-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-link"
        >
          <span
            aria-hidden="true"
            className="grid size-8 place-items-center bg-ink text-sm text-white"
          >
            L
          </span>
          LAPAKIN
        </Link>
        <div className="hidden items-center gap-7 md:flex">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="inline-flex min-h-11 min-w-11 items-center justify-center text-sm font-medium text-link hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-link"
            >
              {link.label}
            </a>
          ))}
          <Button
            render={<Link href="/buat-listing" />}
            nativeButton={false}
            size="sm"
          >
            Buat listing
          </Button>
        </div>
        <button
          type="button"
          ref={triggerRef}
          aria-expanded={open}
          aria-controls={menuId}
          onClick={() => setOpen((value) => !value)}
          className="grid size-11 place-items-center text-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-link md:hidden"
        >
          <span className="sr-only">{open ? "Tutup menu" : "Buka menu"}</span>
          {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        </button>
      </nav>
      {open && (
        <div
          id={menuId}
          className="border-b border-line bg-canvas pb-5 md:hidden"
        >
          <div className="mx-auto grid max-w-7xl gap-1 px-1">
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="min-h-11 content-center px-1 text-base font-medium text-link hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-link"
              >
                {link.label}
              </a>
            ))}
            <Button
              render={
                <Link href="/buat-listing" onClick={() => setOpen(false)} />
              }
              nativeButton={false}
              size="sm"
              className="mt-3 w-full"
            >
              Buat listing
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}
