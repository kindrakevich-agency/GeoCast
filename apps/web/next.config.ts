import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    optimizePackageImports: ["framer-motion", "@turf/turf"],
  },
  // In dev, proxy /api/* to the live production API so localhost:3000 talks
  // to a real backend. In prod, nginx routes /api to PHP-FPM at the same
  // origin, so no rewrite is needed (and would cause an infinite loop).
  async rewrites() {
    if (process.env.NODE_ENV !== "development") return [];
    return [
      {
        source: "/api/:path*",
        destination: "https://geocast.kindrakevich.com/api/:path*",
      },
    ];
  },
};

export default nextConfig;
