import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(process.cwd()),
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
  // One canonical host: www.hfremovalsadelaide.com.au. Every other hostname that
  // can reach this deployment redirects here permanently (308) with the path
  // preserved, so search engines never see a competing copy. Matching is on exact
  // host, so per-branch preview URLs and localhost are untouched.
  //
  // DNS is not part of the repo: each host below still needs a record pointing at
  // Vercel, and to be added to the Vercel project, for its redirect to be reachable.
  async redirects() {
    return [
      // the duplicate .com domain
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.hfremovalsadelaide.com" }],
        destination: "https://www.hfremovalsadelaide.com.au/:path*",
        permanent: true,
      },
      {
        source: "/:path*",
        has: [{ type: "host", value: "hfremovalsadelaide.com" }],
        destination: "https://www.hfremovalsadelaide.com.au/:path*",
        permanent: true,
      },
      // apex of the canonical domain -> www
      {
        source: "/:path*",
        has: [{ type: "host", value: "hfremovalsadelaide.com.au" }],
        destination: "https://www.hfremovalsadelaide.com.au/:path*",
        permanent: true,
      },
      // the superseded Vercel production alias
      {
        source: "/:path*",
        has: [{ type: "host", value: "hf-removals-adelaide.vercel.app" }],
        destination: "https://www.hfremovalsadelaide.com.au/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
