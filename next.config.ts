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
  async redirects() {
    return [
      {
        source: "/about-us",
        destination: "https://www.hfremovalsadelaide.com.au/about",
        permanent: true,
      },
      {
        source: "/contact-us",
        destination: "https://www.hfremovalsadelaide.com.au/contact",
        permanent: true,
      },
      {
        source: "/interstate-removal-services",
        destination: "https://www.hfremovalsadelaide.com.au/services/interstate-removals",
        permanent: true,
      },
      {
        source: "/blog",
        destination: "https://www.hfremovalsadelaide.com.au/guides",
        permanent: true,
      },
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.hfremovalsadelaide.com" }],
        destination: "https://www.hfremovalsadelaide.com.au/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
