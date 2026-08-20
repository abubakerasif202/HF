import { SiteFrame } from "./components/Site";

export default function NotFound() {
  return <SiteFrame><section className="inner-hero not-found"><div className="container"><p className="eyebrow">404 — page not found</p><h1>This page has moved on.</h1><p>Return home or open the moving services overview.</p><div className="hero-actions"><a className="button button-gold" href="/">Back home</a><a className="button button-outline" href="/services">View services</a></div></div></section></SiteFrame>;
}
