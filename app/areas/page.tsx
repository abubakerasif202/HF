import type { Metadata } from "next";
import { SiteFrame } from "../components/Site";
import { business, canonical } from "../../lib/site-data";
import {
  hfServiceAreaCount,
  hfServiceAreaRecords,
  hfServiceAreas,
  serviceAreaRegionOrder,
  type ServiceAreaRegion,
} from "../../lib/hf-service-areas";

export const metadata: Metadata = {
  title: "Adelaide Service Areas",
  description: `Browse ${hfServiceAreaCount} Adelaide, hills, coastal and regional South Australia locations serviced by HF Removals Adelaide.`,
  alternates: { canonical: canonical("/areas") },
  openGraph: {
    type: "website",
    locale: "en_AU",
    siteName: business.name,
    title: "Adelaide Service Areas",
    description: `Browse ${hfServiceAreaCount} Adelaide, hills, coastal and regional South Australia locations serviced by HF Removals Adelaide.`,
    url: canonical("/areas"),
    images: [{ url: "/og.webp", width: 1200, height: 630, alt: "HF Removals Adelaide — Moving Made Easy With Us" }],
  },
};

const pageBySlug = new Map(hfServiceAreas.map((page) => [page.slug, page]));

const groupedAreas = serviceAreaRegionOrder.map((region) => ({
  region,
  areas: hfServiceAreaRecords
    .filter((area) => area.region === region)
    .sort((a, b) => a.name.localeCompare(b.name)),
}));

const regionDescriptions: Record<ServiceAreaRegion, string> = {
  "Central Adelaide": "CBD, inner-city and city-fringe moving coverage.",
  "Northern Adelaide": "Northern suburbs, growth corridors, estates and family-home moves.",
  "North-Eastern Adelaide": "North-eastern suburbs, foothill approaches and estate access.",
  "Eastern Adelaide": "Eastern suburbs, character homes, townhouses and mixed residential access.",
  "Adelaide Hills": "Hills, sloped driveways, longer carries and outer-metro access.",
  "Western Adelaide": "Western suburbs, port-side areas, homes, units and mixed commercial pockets.",
  "Coastal Adelaide": "Beachside suburbs, apartments, shared access and coastal parking conditions.",
  "Southern Adelaide": "Southern suburbs, townhouses, family homes, garages and storage-linked moves.",
  "Regional SA": "Outer-metro and regional South Australia enquiries connected with Adelaide moves.",
};

export default function AreasPage() {
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": `${canonical("/areas")}#webpage`,
        url: canonical("/areas"),
        name: "HF Removals Adelaide service areas",
        about: { "@id": `${business.domain}/#business` },
      },
      {
        "@type": "ItemList",
        "@id": `${canonical("/areas")}#areas`,
        numberOfItems: hfServiceAreaCount,
        itemListElement: hfServiceAreaRecords.map((area, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: area.name,
          url: canonical(`/areas/${area.slug}`),
        })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: business.domain },
          { "@type": "ListItem", position: 2, name: "Service Areas", item: canonical("/areas") },
        ],
      },
    ],
  };

  return (
    <SiteFrame>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      <section className="inner-hero">
        <div className="inner-orbit" aria-hidden="true" />
        <div className="container inner-hero-grid">
          <div>
            <p className="eyebrow">Adelaide & Regional Coverage</p>
            <h1>HF Removals service areas across Adelaide and South Australia</h1>
            <p>
              Browse {hfServiceAreaCount} local service-area pages covering central, northern, eastern, western,
              coastal and southern Adelaide, the Adelaide Hills and selected regional SA corridors.
            </p>
            <div className="hero-actions">
              <a className="button button-ruby" href="/#quote">Get a free quote <span>→</span></a>
              <a className="button button-outline" href={business.phones[0].href}>Call {business.phones[0].display}</a>
            </div>
          </div>
          <div className="inner-monogram">
            <img
              src={business.logo}
              alt="HF Removals Adelaide logo"
              width={business.logoWidth}
              height={business.logoHeight}
              loading="lazy"
              decoding="async"
            />
          </div>
        </div>
      </section>

      {groupedAreas.map(({ region, areas }) => (
        <section className="section listing-section" key={region} aria-labelledby={`region-${region.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`}>
          <div className="container">
            <div className="section-heading">
              <p className="eyebrow">{region}</p>
              <h2 id={`region-${region.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`}>{region} removalist coverage</h2>
              <p>{regionDescriptions[region]}</p>
            </div>
            <div className="listing-grid">
              {areas.map((area, index) => {
                const page = pageBySlug.get(area.slug);
                return (
                  <a key={area.slug} href={`/areas/${area.slug}`}>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <h3>{area.name} removals</h3>
                    <p>{page?.description ?? `Moving support for ${area.name}, South Australia.`}</p>
                    <b>Explore <i>→</i></b>
                  </a>
                );
              })}
            </div>
          </div>
        </section>
      ))}

      <section className="quote-strip">
        <div className="container">
          <div>
            <p className="eyebrow">Your suburb is covered?</p>
            <h2>Send both addresses and HF will scope the actual move.</h2>
          </div>
          <div className="quote-strip-actions">
            <a className="button button-ruby" href="/#quote">Request Free Quote <span>→</span></a>
            <a className="button button-outline" href={business.phones[0].href}>Call {business.phones[0].display}</a>
          </div>
        </div>
      </section>
    </SiteFrame>
  );
}
