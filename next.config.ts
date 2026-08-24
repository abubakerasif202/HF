import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(process.cwd()),
  },
  // One canonical host. The apex domain and the Vercel alias both redirect here
  // permanently (308) so search engines only ever index www.hfremovalsadelaide.com.
  // Vercel serves these at the edge; the apex still needs a DNS record pointing at
  // Vercel for the redirect to be reachable at all.
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "hfremovalsadelaide.com" }],
        destination: "https://www.hfremovalsadelaide.com/:path*",
        permanent: true,
      },
      {
        source: "/:path*",
        has: [{ type: "host", value: "hf-removals-adelaide.vercel.app" }],
        destination: "https://www.hfremovalsadelaide.com/:path*",
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
        ],
      },
    ];
  },
};

export default nextConfig;
