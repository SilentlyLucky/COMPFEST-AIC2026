# Graph Report - frontend  (2026-08-25)

## Corpus Check
- 38 files · ~106,067 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 293 nodes · 454 edges · 20 communities (16 shown, 4 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 1 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- ListingResult.tsx
- listing-validation.ts
- devDependencies
- compilerOptions
- ListingWizard.tsx
- LandingPage.tsx
- components.json
- dependencies
- listing-api.ts
- landing-page-assets.test.ts
- layout.tsx
- LAPAKIN Frontend
- next.config.ts
- AGENTS.md
- eslint.config.mjs
- postcss.config.mjs
- ListingForm.tsx

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 16 edges
2. `validateListing()` - 13 edges
3. `formatRupiah()` - 11 edges
4. `cn()` - 11 edges
5. `Button()` - 9 edges
6. `GenerateListingResponse` - 9 edges
7. `generateListing()` - 7 edges
8. `CategoryCode` - 7 edges
9. `include` - 7 edges
10. `tailwind` - 6 edges

## Surprising Connections (you probably didn't know these)
- `PriceTape()` --calls--> `formatRupiah()`  [EXTRACTED]
  components/landing/PriceTape.tsx → lib/format.ts
- `ListingFormProps` --references--> `ListingFormValues`  [EXTRACTED]
  components/listing/ListingForm.tsx → lib/listing-validation.ts
- `PricingTier()` --calls--> `formatRupiah()`  [EXTRACTED]
  components/listing/ListingResult.tsx → lib/format.ts
- `ComparablePreview()` --calls--> `formatRupiah()`  [EXTRACTED]
  components/listing/ListingResult.tsx → lib/format.ts
- `Button()` --calls--> `cn()`  [EXTRACTED]
  components/ui/button.tsx → lib/utils.ts

## Import Cycles
- None detected.

## Communities (20 total, 4 thin omitted)

### Community 0 - "ListingResult.tsx"
Cohesion: 0.08
Nodes (39): PriceTape(), CopyListing(), CopyListingProps, ALIGNMENT_LABELS, categoryConfidenceLabel(), ComparablePreview(), COST_LABELS, costLabel() (+31 more)

### Community 1 - "listing-validation.ts"
Cohesion: 0.14
Nodes (28): Platform, ALLOWED_IMAGE_TYPES, canonicalizeHppMap(), firstInvalidField(), hppAmountForLabel(), hppEntryLabel(), INITIAL_FORM_VALUES, ListingFormValues (+20 more)

### Community 2 - "devDependencies"
Cohesion: 0.07
Nodes (28): eslint, eslint-config-next, devDependencies, eslint, eslint-config-next, tailwindcss, @tailwindcss/postcss, @types/node (+20 more)

### Community 3 - "compilerOptions"
Cohesion: 0.07
Nodes (28): dom, dom.iterable, esnext, **/*.mts, .next/dev/types/**/*.ts, next-env.d.ts, .next/types/**/*.ts, node_modules (+20 more)

### Community 4 - "ListingWizard.tsx"
Cohesion: 0.12
Nodes (18): metadata, API_FIELD_MAP, API_FIELD_SEGMENT_ORDER, DETAIL_FIELDS, HPP_FIELD_SEGMENTS, ListingWizard(), mapApiErrorFields(), mappedFieldsForSegments() (+10 more)

### Community 5 - "LandingPage.tsx"
Cohesion: 0.22
Nodes (7): LandingMotion(), LandingNavigation(), links, LandingPage(), PROCESS_STEPS, Button(), buttonVariants

### Community 6 - "components.json"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 7 - "dependencies"
Cohesion: 0.10
Nodes (21): @base-ui/react, class-variance-authority, clsx, gsap, @gsap/react, lucide-react, next, dependencies (+13 more)

### Community 8 - "listing-api.ts"
Cohesion: 0.18
Nodes (14): API_BASE_URL, FALLBACK_MESSAGES, firstValidationMessage(), generateListing(), isErrorPayload(), isRecord(), isSuccessPayload(), ListingApiError (+6 more)

### Community 9 - "landing-page-assets.test.ts"
Cohesion: 0.24
Nodes (8): assets, channel(), contrastRatio(), darkCardText, expandedHex(), landingPage, legibilityMinimums, luminance()

### Community 10 - "layout.tsx"
Cohesion: 0.40
Nodes (3): geistMono, geistSans, metadata

### Community 11 - "LAPAKIN Frontend"
Cohesion: 0.50
Nodes (3): LAPAKIN Frontend, Menjalankan lokal, Verifikasi

### Community 19 - "ListingForm.tsx"
Cohesion: 0.14
Nodes (17): errorProps(), formatHppInput(), ListingForm(), ListingFormProps, MoneyInput(), PercentInput(), PLATFORMS, REGIONS (+9 more)

## Knowledge Gaps
- **119 isolated node(s):** `metadata`, `geistSans`, `geistMono`, `metadata`, `$schema` (+114 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Button()` connect `LandingPage.tsx` to `ListingResult.tsx`, `ListingForm.tsx`, `ListingWizard.tsx`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **Why does `dependencies` connect `dependencies` to `devDependencies`?**
  _High betweenness centrality (0.018) - this node is a cross-community bridge._
- **What connects `metadata`, `geistSans`, `geistMono` to the rest of the system?**
  _119 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `ListingResult.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.08048103607770583 - nodes in this community are weakly interconnected._
- **Should `listing-validation.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.1350806451612903 - nodes in this community are weakly interconnected._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.06896551724137931 - nodes in this community are weakly interconnected._
- **Should `compilerOptions` be split into smaller, more focused modules?**
  _Cohesion score 0.06896551724137931 - nodes in this community are weakly interconnected._