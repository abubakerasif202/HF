import type { Metadata } from "next";
import { HomePage } from "./components/Site";
import { business, canonical, standardMoveFaqs } from "../lib/site-data";

export const metadata: Metadata = {
  title: { absolute: "Adelaide Removalists | 4.9★ Rated Local & Interstate | HF Removals" },
  description: "Adelaide's top-rated removalists from $74/30min with $1M transit insurance. Professional residential, apartment, office, and interstate moving services. Free quote!",
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
      image: `${business.domain}${business.heroImage}`,
      priceRange: "$$",
      hasMap: business.googleBusiness.mapEmbedUrl,
      address: {
        "@type": "PostalAddress",
        streetAddress: "20 Prunus Ave",
        addressLocality: "Elizabeth Vale",
        addressRegion: "SA",
        postalCode: "5112",
        addressCountry: "AU",
      },
      geo: {
        "@type": "GeoCoordinates",
        latitude: -34.7578,
        longitude: 138.6834,
      },
      areaServed: [
        "Adelaide Metro",
        "Adelaide CBD",
        "Elizabeth Vale",
        "Elizabeth",
        "Salisbury",
        "Blakeview",
        "Gawler",
        "Marion",
        "Norwood",
        "Glenelg",
        "South Australia",
      ],
      openingHoursSpecification: [
        {
          "@type": "OpeningHoursSpecification",
          dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
          opens: "00:00",
          closes: "23:59",
        },
      ],
    },
    {
      "@type": "WebPage",
      "@id": `${business.domain}/#webpage`,
      url: business.domain,
      name: "Adelaide Removalists | HF Removals Adelaide",
      about: { "@id": `${business.domain}/#business` },
    },
    {
      "@type": "FAQPage",
      "@id": `${business.domain}/#faq`,
      mainEntity: standardMoveFaqs.map((faq) => ({
        "@type": "Question",
        name: faq.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: faq.answer,
        },
      })),
    },
  ],
};

export default function Home() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      <HomePage />
    </>
  );
}
