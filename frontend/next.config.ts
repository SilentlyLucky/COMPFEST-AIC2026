import type { NextConfig } from "next";

const backendInternalUrl = (process.env.BACKEND_INTERNAL_URL || "http://127.0.0.1:8012").replace(
  /\/$/,
  "",
);

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/v1/:path*",
        destination: `${backendInternalUrl}/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
