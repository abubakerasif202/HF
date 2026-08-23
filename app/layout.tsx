import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://hfremovalsadelaide.com.au"),
  title: { default: "HF Removals Adelaide", template: "%s | HF Removals Adelaide" },
  description: "Local, commercial and interstate moving support from HF Removals Adelaide.",
  applicationName: "HF Removals Adelaide",
  icons: { icon: "/images/hf-logo-transparent.png", shortcut: "/images/hf-logo-transparent.png" },
  openGraph: { type: "website", locale: "en_AU", siteName: "HF Removals Adelaide", images: [{ url: "/og.png", width: 1792, height: 896, alt: "HF Removals Adelaide — Moving Made Easy With Us" }] },
  twitter: { card: "summary_large_image", images: ["/og.png"] },
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

