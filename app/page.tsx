import type { Metadata } from "next";
import { HomePage } from "./components/Site";
import { business, canonical } from "../lib/site-data";

export const metadata: Metadata = {
  title: { absolute: "Adelaide Removalists | HF Removals Adelaide" },
  description: "Plan local, commercial and interstate moves with HF Removals Adelaide. View supplied rates, packing support and request a quote.",
  alternates: { canonical: canonical("/") },
};

const schema = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "MovingCompany",
      "@id": `${business.domain}/#business`,
      name: business.name,
      legalName: business.legalName,
      url: business.domain,
      telephone: business.phones[0].display,
      email: business.emails[0],
      address: { "@type": "PostalAddress", streetAddress: "20 Prunus Ave", addressLocality: "Elizabeth Vale", addressRegion: "SA", postalCode: "5112", addressCountry: "AU" },
      areaServed: ["Adelaide Metro", "Elizabeth Vale", "Elizabeth", "Salisbury", "Blakeview", "Gawler", "South Australian regional areas"],
    },
    { "@type": "WebPage", "@id": `${business.domain}/#webpage`, url: business.domain, name: "Adelaide Removalists | HF Removals Adelaide", about: { "@id": `${business.domain}/#business` } },
  ],
};

export default function Home() {
  return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} /><HomePage /></>;
}
