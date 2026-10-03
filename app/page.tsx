import type { Metadata } from "next";
import { HomePage } from "./components/Site";
import { business, canonical, entryLocalRate, standardMoveFaqs } from "../lib/site-data";

const homeTitle = "Adelaide Removalists & Movers | HF Removals Adelaide";
const homeDescription = `Adelaide removalists for house, apartment, furniture and office moves, plus interstate routes. From ${entryLocalRate.halfHour}/30 min plus call-out; minimum applies. Request a quote.`;

export const metadata: Metadata = {
  title: { absolute: homeTitle },
  description: homeDescription,
  alternates: { canonical: canonical("/") },
  openGraph: { type: "website", locale: "en_AU", siteName: business.name, title: homeTitle, description: homeDescription, url: canonical("/"), images: [{ url: "/og.webp", width: 1200, height: 630, alt: "HF Removals Adelaide — Moving Made Easy With Us" }] },
  twitter: { card: "summary_large_image", title: homeTitle, description: homeDescription, images: ["/og.webp"] },
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
      logo: `${business.domain}${business.logo}`,
      image: `${business.domain}${business.heroImage}`,
      hasMap: business.googleBusiness.mapEmbedUrl,
      address: {
        "@type": "PostalAddress",
        streetAddress: business.address.street,
        addressLocality: business.address.suburb,
        addressRegion: business.address.state,
        postalCode: business.address.postcode,
        addressCountry: business.address.countryCode,
      },
      // No aggregateRating here on purpose. The Google rating and review count come from the
      // business's Google profile, and Google's review-snippet policy expects
      // aggregateRating to describe reviews this site itself collects. Marking up
      // third-party ratings as first-party risks a manual action. The visible
      // reviews section still cites Google as the source and links to the profile.
      geo: {
        "@type": "GeoCoordinates",
        latitude: business.googleBusiness.coordinates.latitude,
        longitude: business.googleBusiness.coordinates.longitude,
      },
      areaServed: business.areaServed,
      openingHoursSpecification: [
        {
          "@type": "OpeningHoursSpecification",
          dayOfWeek: business.googleBusiness.openingHours.days,
          opens: business.googleBusiness.openingHours.opens,
          closes: business.googleBusiness.openingHours.closes,
        },
      ],
    },
    {
      "@type": "WebSite",
      "@id": `${business.domain}/#website`,
      url: business.domain,
      name: business.name,
      publisher: { "@id": `${business.domain}/#business` },
    },
    {
      "@type": "WebPage",
      "@id": `${business.domain}/#webpage`,
      url: business.domain,
      name: homeTitle,
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

