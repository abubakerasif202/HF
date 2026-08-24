import type { Metadata, Viewport } from "next";
import "./globals.css";
import { business } from "../lib/site-data";

export const metadata: Metadata = {
  metadataBase: new URL(business.domain),
  title: { default: "HF Removals Adelaide", template: "%s | HF Removals Adelaide" },
  description: "Local, commercial and interstate moving support from HF Removals Adelaide.",
  applicationName: "HF Removals Adelaide",
  // Was the generic blue starter glyph; these are generated from the HF truck lockup.
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "32x32" },
      { url: "/icon-96.png", sizes: "96x96", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: { type: "website", locale: "en_AU", siteName: "HF Removals Adelaide", title: "HF Removals Adelaide", description: "Local, commercial and interstate moving support from HF Removals Adelaide.", images: [{ url: "/og.webp", width: 1200, height: 630, alt: "HF Removals Adelaide — Moving Made Easy With Us" }] },
  twitter: { card: "summary_large_image", title: "HF Removals Adelaide", description: "Local, commercial and interstate moving support from HF Removals Adelaide.", images: ["/og.webp"] },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#031912" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-AU">
      <head>
        <link rel="preconnect" href="https://maps.googleapis.com" />
        <link rel="preconnect" href="https://maps.gstatic.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://www.google.com" />
      </head>
      <body>{children}</body>
    </html>
  );
}

