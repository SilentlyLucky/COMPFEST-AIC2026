"use client";

import { useRef, type ReactNode } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(useGSAP, ScrollTrigger);

export function LandingMotion({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  useGSAP(
    () => {
      const media = gsap.matchMedia();
      media.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.utils.toArray<HTMLElement>("[data-price-reveal]").forEach((item) =>
          gsap.from(item, {
            y: 18,
            ease: "none",
            scrollTrigger: {
              trigger: item,
              start: "top 86%",
              end: "top 56%",
              scrub: 0.45,
            },
          }),
        );
        gsap.utils.toArray<HTMLElement>("[data-stack-card]").forEach((card) =>
          gsap.from(card, {
            y: 28,
            opacity: 0.78,
            scale: 0.985,
            scrollTrigger: {
              trigger: card,
              start: "top 88%",
              end: "top 58%",
              scrub: 0.5,
            },
          }),
        );
        gsap.utils.toArray<SVGPathElement>("[data-draw-line]").forEach((line) =>
          gsap.from(line, {
            strokeDashoffset: 1,
            ease: "none",
            scrollTrigger: {
              trigger: line,
              start: "top 88%",
              end: "top 52%",
              scrub: 0.45,
            },
          }),
        );
        gsap.utils
          .toArray<SVGCircleElement>("[data-marker-travel]")
          .forEach((marker) =>
            gsap.from(marker, {
              x: -22,
              opacity: 0.2,
              scrollTrigger: {
                trigger: marker,
                start: "top 88%",
                end: "top 62%",
                scrub: 0.4,
              },
            }),
          );
      });
      return () => media.revert();
    },
    { scope: root },
  );
  return (
    <div ref={root} className="w-full max-w-full overflow-x-clip">
      {children}
    </div>
  );
}
