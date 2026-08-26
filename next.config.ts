import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Handle legacy trailing-slash variants in the redirect table so they reach
  // their canonical replacement directly instead of first normalising the URL.
  skipTrailingSlashRedirect: true,
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
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data:",
              "font-src 'self'",
              "connect-src 'self' https://api.web3forms.com",
              "form-action 'self' https://api.web3forms.com",
              "frame-src 'none'",
              "object-src 'none'",
              "base-uri 'self'",
            ].join("; "),
          },
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
        source: "/about-us/",
        destination: "https://www.hfremovalsadelaide.com.au/about",
        permanent: true,
      },
      {
        source: "/contact-us",
        destination: "https://www.hfremovalsadelaide.com.au/contact",
        permanent: true,
      },
      {
        source: "/contact-us/",
        destination: "https://www.hfremovalsadelaide.com.au/contact",
        permanent: true,
      },
      {
        source: "/interstate-removal-services",
        destination: "https://www.hfremovalsadelaide.com.au/services/interstate-removals",
        permanent: true,
      },
      {
        source: "/interstate-removal-services/",
        destination: "https://www.hfremovalsadelaide.com.au/services/interstate-removals",
        permanent: true,
      },
      {
        source: "/blog",
        destination: "https://www.hfremovalsadelaide.com.au/guides",
        permanent: true,
      },
      {
        source: "/blog/",
        destination: "https://www.hfremovalsadelaide.com.au/guides",
        permanent: true,
      },
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.hfremovalsadelaide.com" }],
        destination: "https://www.hfremovalsadelaide.com.au/:path*",
        permanent: true,
      },
      {
        source: "/:path*",
        has: [{ type: "host", value: "hfremovalsadelaide.com.au" }],
        destination: "https://www.hfremovalsadelaide.com.au/:path*",
        permanent: true,
      },
      {
        source: "/:path*",
        has: [{ type: "host", value: "hfremovalsadelaide.com" }],
        destination: "https://www.hfremovalsadelaide.com.au/:path*",
        permanent: true,
      },
      {
        source: "/:path+/",
        destination: "/:path+",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
