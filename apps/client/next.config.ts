import type { NextConfig } from "next";

const apiURL = process.env.EVALGATE_API_URL || "http://127.0.0.1:8000";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    // Prompt comparisons run A and B sequentially and can exceed the 30s default.
    proxyTimeout: 30 * 60 * 1000,
  },
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${apiURL}/api/v1/:path*`,
      },
      {
        source: "/health",
        destination: `${apiURL}/health`,
      },
    ];
  },
};

export default nextConfig;
