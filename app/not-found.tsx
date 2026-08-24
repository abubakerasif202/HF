import type { Metadata } from "next";
import { SiteFrame } from "./components/Site";

export const metadata: Metadata = { title: "Page not found", robots: { index: false, follow: true } };

export default function NotFound() {
  return <SiteFrame><section className="inner-hero not-found"><div className="container"><p className="eyebrow">404 — page not found</p><h1>This page has moved on.</h1><p>Return home or open the moving services overview.</p><div className="hero-actions"><a className="button button-ruby" href="/">Back home</a><a className="button button-outline" href="/services">View services</a></div></div></section></SiteFrame>;
}
