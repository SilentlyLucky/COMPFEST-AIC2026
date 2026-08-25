import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("Next API rewrite", () => {
  it("proxies same-origin v1 requests to the default local backend", async () => {
    vi.stubEnv("BACKEND_INTERNAL_URL", "");
    const { default: nextConfig } = await import("../next.config");

    expect(await nextConfig.rewrites?.()).toEqual([
      {
        source: "/v1/:path*",
        destination: "http://127.0.0.1:8012/v1/:path*",
      },
    ]);
  });

  it("allows the internal backend target to be overridden without exposing it publicly", async () => {
    vi.stubEnv("BACKEND_INTERNAL_URL", "http://backend.internal:8010/");
    const { default: nextConfig } = await import("../next.config");

    expect(await nextConfig.rewrites?.()).toEqual([
      {
        source: "/v1/:path*",
        destination: "http://backend.internal:8010/v1/:path*",
      },
    ]);
  });
});
