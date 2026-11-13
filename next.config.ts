import type { NextConfig } from "next";
import { apiSecurityHeaders, corsHeaders } from "./src/lib/cors";

const toList = (h: Record<string, string>) =>
  Object.entries(h).map(([key, value]) => ({ key, value }));

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [...toList(corsHeaders), ...toList(apiSecurityHeaders)],
      },
    ];
  },
};

export default nextConfig;
