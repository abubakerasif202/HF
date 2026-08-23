import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://hfremovalsadelaide.com.au"),
  title: { default: "HF Removals Adelaide", template: "%s | HF Removals Adelaide" },
  description: "Local, commercial and interstate moving support from HF Removals Adelaide.",
  applicationName: "HF Removals Adelaide",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
  openGraph: { type: "website", locale: "en_AU", siteName: "HF Removals Adelaide", images: [{ url: "/og.webp", width: 1200, height: 630, alt: "HF Removals Adelaide — Moving Made Easy With Us" }] },
  twitter: { card: "summary_large_image", images: ["/og.webp"] },
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
        <link
          rel="preload"
          as="image"
          href="/images/hf-hero-truck-1792.webp"
          type="image/webp"
          imageSrcSet="/images/hf-hero-truck-480.webp 480w, /images/hf-hero-truck-768.webp 768w, /images/hf-hero-truck-1024.webp 1024w, /images/hf-hero-truck-1440.webp 1440w, /images/hf-hero-truck-1792.webp 1792w"
          imageSizes="100vw"
          fetchPriority="high"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}

