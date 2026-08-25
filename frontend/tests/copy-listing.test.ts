import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("copy listing category action", () => {
  it("copies the user-facing category label through the shared feedback flow", () => {
    const source = readFileSync(
      resolve(import.meta.dirname, "../components/listing/CopyListing.tsx"),
      "utf8",
    );

    expect(source).toContain("const category = CATEGORY_LABELS[categoryCode]");
    expect(source).toContain('copyText("Kategori", category)');
    expect(source).toContain("Salin kategori");
    expect(source).toContain("`Kategori: ${category}`");
  });
});
