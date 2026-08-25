"use client";

import { useRef, type ReactNode } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { MotionPathPlugin } from "gsap/MotionPathPlugin";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(useGSAP, MotionPathPlugin, ScrollTrigger);

export function LandingMotion({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  useGSAP(
    () => {
      const media = gsap.matchMedia();
      media.add("(prefers-reduced-motion: no-preference)", () => {
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
        gsap.utils.toArray<HTMLElement>("[data-process-copy]").forEach((copy) =>
          gsap.from(copy, {
            y: 18,
            opacity: 0.84,
            ease: "none",
            scrollTrigger: {
              trigger: copy,
              start: "top 88%",
              end: "top 58%",
              scrub: 0.4,
            },
          }),
        );
        gsap.utils
          .toArray<HTMLElement>("[data-process-image]")
          .forEach((image) =>
            gsap.from(image, {
              y: 20,
              opacity: 0.86,
              scale: 0.99,
              ease: "none",
              scrollTrigger: {
                trigger: image,
                start: "top 88%",
                end: "top 58%",
                scrub: 0.45,
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
        const problemSection = root.current?.querySelector<HTMLElement>("#masalah");
        const problemPath = problemSection?.querySelector<SVGPathElement>(
          "[data-problem-path]",
        );
        const problemMarker = problemSection?.querySelector<SVGCircleElement>(
          "[data-problem-marker]",
        );

        if (problemSection && problemPath && problemMarker) {
          gsap.to(problemMarker, {
            motionPath: {
              path: problemPath,
              align: problemPath,
              alignOrigin: [0.5, 0.5],
              start: 0,
              end: 1,
            },
            ease: "none",
            scrollTrigger: {
              trigger: problemSection,
              start: "top bottom",
              end: "bottom top",
              scrub: true,
              invalidateOnRefresh: true,
            },
          });
        }
      });
      return () => media.revert();
    },
    { scope: root },
  );
  return (
    <div ref={root} className="w-full max-w-full">
      {children}
    </div>
  );
}
