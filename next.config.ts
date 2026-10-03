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
              "script-src 'self' 'unsafe-inline' https://js.stripe.com https://www.googletagmanager.com https://analytics.ahrefs.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https://www.googletagmanager.com https://www.google-analytics.com https://www.google.com.au",
              "font-src 'self'",
              "connect-src 'self' https://api.web3forms.com https://api.stripe.com https://www.googletagmanager.com https://www.google-analytics.com https://analytics.google.com https://www.google.com https://stats.g.doubleclick.net https://analytics.ahrefs.com",
              "form-action 'self' https://api.web3forms.com",
              "frame-src 'self' https://www.google.com https://calendar.google.com https://checkout.stripe.com https://js.stripe.com",
              "object-src 'none'",
              "base-uri 'self'",
            ].join("; "),
          },
        ],
      },
    ];
  },
  async redirects() {
    const alternateHosts = [
      "hfremovalsadelaide.com.au",
      "www.hfremovalsadelaide.com",
      "hfremovalsadelaide.com",
    ];
    const legacyRoutes = [
      { source: "/about-us", destination: "/about" },
      { source: "/about-us/", destination: "/about" },
      { source: "/contact-us", destination: "/contact" },
      { source: "/contact-us/", destination: "/contact" },
      { source: "/interstate-removal-services", destination: "/services/interstate-removals" },
      { source: "/interstate-removal-services/", destination: "/services/interstate-removals" },
      { source: "/blog", destination: "/guides" },
      { source: "/blog/", destination: "/guides" },
    ];

    return [
      // Combine the alias-host and legacy-path rules so HTTPS requests to old
      // host/path pairs reach the final canonical URL in one permanent hop.
      ...alternateHosts.flatMap((host) =>
        legacyRoutes.map(({ source, destination }) => ({
          source,
          has: [{ type: "host" as const, value: host }],
          destination: `https://www.hfremovalsadelaide.com.au${destination}`,
          permanent: true,
        })),
      ),
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
        source: "/:path+/",
        destination: "https://www.hfremovalsadelaide.com.au/:path+",
        permanent: true,
      },
      {
        source: "/",
        has: [{ type: "host", value: "www.hfremovalsadelaide.com" }],
        destination: "https://www.hfremovalsadelaide.com.au/",
        permanent: true,
      },
      {
        source: "/",
        has: [{ type: "host", value: "hfremovalsadelaide.com.au" }],
        destination: "https://www.hfremovalsadelaide.com.au/",
        permanent: true,
      },
      {
        source: "/",
        has: [{ type: "host", value: "hfremovalsadelaide.com" }],
        destination: "https://www.hfremovalsadelaide.com.au/",
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
    ];
  },
};

export default nextConfig;
