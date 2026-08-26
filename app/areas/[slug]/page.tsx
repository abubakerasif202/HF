import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DetailPage } from "../../components/Site";
import { business, canonical } from "../../../lib/site-data";
import { hfServiceAreaRecords, hfServiceAreas } from "../../../lib/hf-service-areas";

type Props = { params: Promise<{ slug: string }> };

const pageBySlug = new Map(hfServiceAreas.map((page) => [page.slug, page]));
const recordBySlug = new Map(hfServiceAreaRecords.map((record) => [record.slug, record]));

export function generateStaticParams() {
  return hfServiceAreas.map((page) => ({ slug: page.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = pageBySlug.get(slug);
  const record = recordBySlug.get(slug);
  if (!page || !record) return {};

  const path = `/areas/${slug}`;
  const title = `${record.name} Removalists`;
  return {
    title,
    description: page.description,
    alternates: { canonical: canonical(path) },
    openGraph: {
      type: "website",
      locale: "en_AU",
      siteName: business.name,
      title,
      description: page.description,
      url: canonical(path),
      images: [{ url: "/og.webp", width: 1200, height: 630, alt: "HF Removals Adelaide — Moving Made Easy With Us" }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: page.description,
      images: ["/og.webp"],
    },
  };
}

export default async function ServiceAreaPage({ params }: Props) {
  const { slug } = await params;
  const page = pageBySlug.get(slug);
  const record = recordBySlug.get(slug);
  if (!page || !record) notFound();

  const path = `/areas/${slug}`;
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Service",
        "@id": `${canonical(path)}#service`,
        name: `${record.name} removalists`,
        description: page.description,
        url: canonical(path),
        provider: { "@id": `${business.domain}/#business` },
        areaServed: {
          "@type": "Place",
          name: `${record.name}, South Australia`,
        },
        serviceType: "Removalist and moving service",
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: business.domain },
          { "@type": "ListItem", position: 2, name: "Service Areas", item: canonical("/areas") },
          { "@type": "ListItem", position: 3, name: record.name, item: canonical(path) },
        ],
      },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      <DetailPage page={page} />
    </>
  );
}
