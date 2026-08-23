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

      media.add(
        "(min-width: 1024px) and (min-height: 704px) and (prefers-reduced-motion: no-preference)",
        () => {
          gsap.utils.toArray<HTMLElement>("[data-stack-card]").forEach((card) => {
            gsap.fromTo(
              card,
              { y: 32, scale: 0.99 },
              {
                y: 0,
                scale: 1,
                ease: "none",
                scrollTrigger: {
                  trigger: card,
                  start: "top 88%",
                  end: "top 58%",
                  scrub: 0.5,
                  invalidateOnRefresh: true,
                },
              },
            );
          });
        },
      );

      media.add(
        "(min-width: 768px) and (prefers-reduced-motion: no-preference)",
        () => {
          gsap.utils.toArray<HTMLElement>("[data-feature-visual]").forEach((visual) => {
            gsap.fromTo(
              visual,
              { y: 24, scale: 0.86, opacity: 0.45 },
              {
                y: 0,
                scale: 1,
                opacity: 1,
                duration: 0.8,
                ease: "power2.out",
                scrollTrigger: {
                  trigger: visual,
                  start: "top 88%",
                  toggleActions: "play none none none",
                  once: true,
                },
              },
            );
          });

          gsap.utils.toArray<SVGPathElement>("[data-feature-flow-line]").forEach((line) => {
            gsap.fromTo(
              line,
              { strokeDashoffset: 1 },
              {
                strokeDashoffset: 0,
                duration: 1,
                ease: "power2.out",
                scrollTrigger: {
                  trigger: line,
                  start: "top 88%",
                  toggleActions: "play none none none",
                  once: true,
                },
              },
            );
          });
        },
      );

      media.add(
        "(min-width: 768px) and (prefers-reduced-motion: no-preference)",
        () => {
          const heroImage = root.current?.querySelector<HTMLElement>("[data-motion-image]");

          if (!heroImage) return;

          gsap.fromTo(
            heroImage,
            { y: 0, scale: 1 },
            {
              y: -32,
              scale: 1.04,
              ease: "none",
              scrollTrigger: {
                trigger: heroImage,
                start: "top 84%",
                end: "bottom 24%",
                scrub: 0.6,
                invalidateOnRefresh: true,
              },
            },
          );
        },
      );

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
