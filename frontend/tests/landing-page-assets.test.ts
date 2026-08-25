import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

const landingPage = new URL(
  "../components/landing/LandingPage.tsx",
  import.meta.url,
);

const assets = [
  {
    path: "/assets/lapakin/hero/lapakin-hero-ai.svg",
    minimumDesktopWidth: 602,
    transparentArtboard: true,
  },
  {
    path: "/assets/lapakin/process/01-full-pipeline.svg",
    minimumDesktopWidth: 840,
    transparentArtboard: false,
  },
  {
    path: "/assets/lapakin/process/02-input.svg",
    minimumDesktopWidth: 800,
    transparentArtboard: false,
  },
  {
    path: "/assets/lapakin/process/03-ai-models.svg",
    minimumDesktopWidth: 856,
    transparentArtboard: false,
  },
  {
    path: "/assets/lapakin/process/04-output.svg",
    minimumDesktopWidth: 800,
    transparentArtboard: false,
  },
] as const;

const legibilityMinimums = {
  body: 16,
  helper: 14,
  caption: 12,
  title: 18,
  heading: 32,
} as const;

const darkCardText = new Set(["#ffffff", "#fff", "#e0eaf1", "#b9d9ee", "#f99404"]);

function viewBoxWidth(svg: string) {
  const match = svg.match(/viewBox="[^" ]+ [^" ]+ ([^" ]+) [^"]+"/);
  if (!match) throw new Error("SVG must declare a four-value viewBox");
  return Number(match[1]);
}

function visibleText(svg: string) {
  return [...svg.matchAll(/<text\b([^>]*)>/g)].map(([, attributes]) => {
    const category = attributes.match(/data-legibility="([^"]+)"/)?.[1];
    const fontSize = attributes.match(/font-size="([^"]+)"/)?.[1];
    const fill = attributes.match(/fill="([^"]+)"/)?.[1]?.toLowerCase();
    return { category, fontSize: Number(fontSize), fill };
  });
}

function channel(value: string) {
  return Number.parseInt(value, 16) / 255;
}

function luminance(hex: string) {
  const channels = [hex.slice(1, 3), hex.slice(3, 5), hex.slice(5, 7)].map(channel);
  const linear = channels.map((value) => (
    value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  ));
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function expandedHex(color: string) {
  if (color === "#fff") return "#ffffff";
  return color;
}

function contrastRatio(foreground: string, background: string) {
  const [lighter, darker] = [luminance(expandedHex(foreground)), luminance(background)]
    .sort((left, right) => right - left);
  return (lighter + 0.05) / (darker + 0.05);
}

describe("LAPAKIN landing SVG readability and motion", () => {
  it("keeps the approved external SVGs and stacks the visual layout until xl", async () => {
    const source = await readFile(landingPage, "utf8");

    for (const asset of assets) {
      expect(source).toContain(asset.path);
      const svg = await readFile(
        new URL(`../public${asset.path}`, import.meta.url),
        "utf8",
      );
      expect(svg).toContain('role="img"');
      expect(svg).toMatch(/<title id="title">/);
      expect(svg).toMatch(/<desc id="desc">/);
    }

    expect(source).toContain("xl:grid-cols-[1.05fr_0.95fr]");
    expect(source).toContain("xl:grid-cols-12");
    expect(source).not.toContain("lg:grid-cols-[1.05fr_0.95fr]");
    expect(source).not.toContain("lg:grid-cols-12");
  });

  it("classifies and contrast-checks every visible text node at desktop size", async () => {
    for (const asset of assets) {
      const svg = await readFile(
        new URL(`../public${asset.path}`, import.meta.url),
        "utf8",
      );
      const scale = asset.minimumDesktopWidth / viewBoxWidth(svg);
      const text = visibleText(svg);
      const classified = text.filter(({ category }) => category);

      expect(classified).toHaveLength(text.length);
      for (const { category, fill, fontSize } of text) {
        expect(category).toBeTruthy();
        expect(fill, `${asset.path} text must declare its fill`).toMatch(/^#[\da-f]{3,6}$/);
        expect(fontSize, `${asset.path} text must declare its font size`).toBeGreaterThan(0);
        expect(
          fontSize * scale,
          `${asset.path}: ${category} must remain readable at 1280px`,
        ).toBeGreaterThanOrEqual(legibilityMinimums[category as keyof typeof legibilityMinimums]);

        const background = darkCardText.has(fill!) ? "#0c3d78" : "#ffffff";
        expect(
          contrastRatio(fill!, background),
          `${asset.path}: ${fill} on ${background} must meet AA contrast`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("keeps approved composition bounds at least 48px inside each expanded artboard", async () => {
    for (const asset of assets) {
      const svg = await readFile(
        new URL(`../public${asset.path}`, import.meta.url),
        "utf8",
      );
      const viewBox = svg.match(/viewBox="(-?[\d.]+) (-?[\d.]+) ([\d.]+) ([\d.]+)"/);
      const bounds = svg.match(/data-safe-bounds="([\d.]+) ([\d.]+) ([\d.]+) ([\d.]+)"/);
      expect(viewBox, `${asset.path} must declare an expanded viewBox`).toBeTruthy();
      expect(bounds, `${asset.path} must declare composition-safe bounds`).toBeTruthy();
      const [x, y, width, height] = viewBox!.slice(1).map(Number);
      const [left, top, right, bottom] = bounds!.slice(1).map(Number);
      const margins = [
        left - x,
        top - y,
        x + width - right,
        y + height - bottom,
      ];
      const minimumMargin = Math.min(...margins);
      expect(minimumMargin).toBeGreaterThanOrEqual(48);
      const whiteRects = [...svg.matchAll(/<rect\b([^>]*)\/>/g)]
        .map(([, attributes]) => ({
          attributes,
          fill: attributes.match(/fill="([^"]+)"/)?.[1].toLowerCase(),
          x: Number(attributes.match(/\bx="([^"]+)"/)?.[1] ?? 0),
          y: Number(attributes.match(/\by="([^"]+)"/)?.[1] ?? 0),
          width: Number(attributes.match(/\bwidth="([^"]+)"/)?.[1]),
          height: Number(attributes.match(/\bheight="([^"]+)"/)?.[1]),
        }))
        .filter(({ fill }) => fill === "#fff" || fill === "#ffffff");
      const artboardBackgrounds = whiteRects.filter((rect) => (
        rect.x === x && rect.y === y && rect.width === width && rect.height === height
      ));
      expect(
        artboardBackgrounds,
        `${asset.path} artboard background transparency must match its contract`,
      ).toHaveLength(asset.transparentArtboard ? 0 : 1);
      for (const rect of whiteRects) {
        if (artboardBackgrounds.includes(rect)) continue;
        expect(Math.min(
          rect.x - x,
          rect.y - y,
          x + width - (rect.x + rect.width),
          y + height - (rect.y + rect.height),
        ), `${asset.path} must not retain a near-edge white background`).toBeGreaterThanOrEqual(48);
      }
      for (const [, dx, dy, blur] of svg.matchAll(
        /<feDropShadow dx="(-?[\d.]+)" dy="(-?[\d.]+)" stdDeviation="([\d.]+)"/g,
      )) {
        const practicalExtent = Math.max(Math.abs(Number(dx)), Math.abs(Number(dy)))
          + 3 * Number(blur);
        expect(minimumMargin - practicalExtent).toBeGreaterThanOrEqual(48);
      }
    }
  });

  it("keeps the causal, reduced-motion-safe animation timelines", async () => {
    const [hero, pipeline, input, models] = await Promise.all([
      readFile(new URL("../public/assets/lapakin/hero/lapakin-hero-ai.svg", import.meta.url), "utf8"),
      readFile(new URL("../public/assets/lapakin/process/01-full-pipeline.svg", import.meta.url), "utf8"),
      readFile(new URL("../public/assets/lapakin/process/02-input.svg", import.meta.url), "utf8"),
      readFile(new URL("../public/assets/lapakin/process/03-ai-models.svg", import.meta.url), "utf8"),
    ]);

    expect(hero.match(/<animateMotion/g)).toHaveLength(6);
    expect(hero).toContain('keyTimes="0;.40;.405;1"');
    expect(hero).toContain('keyTimes="0;.535;.54;.80;.805;1"');
    expect(hero).toContain('class="reaction-ring"');
    expect(hero).toContain('class="orb-reactor"');

    expect(pipeline.match(/<animateMotion/g)).toHaveLength(3);
    expect(pipeline.match(/attributeName="stroke-dashoffset"/g)).toHaveLength(6);
    for (const path of ["fp1", "fp2", "fp3"]) expect(pipeline).toContain(`href="#${path}"`);
    expect(pipeline).toContain('class="static"');
    expect(pipeline).toContain('class="anim output-activation"');
    expect(pipeline).toContain('stroke-dasharray:none');

    expect(input.match(/<animateMotion/g)).toHaveLength(2);
    expect(input).toContain('class="anim reaction-ring"');
    expect(input).toContain('keyTimes="0;.16;.18;.42;.46;1"');

    expect(models.match(/<animateMotion/g)).toHaveLength(6);
    for (const path of ["inTop", "inMid", "inBot", "outTop", "outMid", "outBot"]) {
      expect(models).toContain(`<mpath href="#${path}"/>`);
    }
    expect(models).toContain('keyTimes="0;.08;.34;1"');
    expect(models).toContain('keyTimes="0;.48;.66;1"');
    expect(models).toContain('class="anim reaction-ring"');

    for (const svg of [hero, pipeline, input, models]) {
      expect(svg).toContain("prefers-reduced-motion: reduce");
    }
    expect(hero).toContain(".moving-dot");
    for (const svg of [pipeline, input, models]) expect(svg).toContain(".anim");
  });

  it("keeps the output visual free of the removed duplicate result copy", async () => {
    const output = await readFile(
      new URL("../public/assets/lapakin/process/04-output.svg", import.meta.url),
      "utf8",
    );

    expect(output).not.toContain("Hasil yang siap kamu edit dan gunakan");
    expect(output).not.toContain(
      "Satu listing lengkap dengan harga rekomendasi, dan confidence.",
    );
  });
});
