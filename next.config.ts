import type { NextConfig } from "next";
import { securityHeaders } from "./src/config/security-headers";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders({
          supabaseUrl:
            process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL,
          development: process.env.NODE_ENV === "development",
        }),
      },
    ];
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
