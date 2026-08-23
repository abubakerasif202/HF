import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DetailPage, ListingPage, StaticPage } from "../components/Site";
import { business, canonical, findContentPage, indexablePaths } from "../../lib/site-data";

type Props = { params: Promise<{ slug: string[] }> };

const staticPages: Record<string, { type: "about" | "contact" | "pricing" | "adelaide" | "privacy" | "terms"; title: string; description: string; schema: string }> = {
  about: { type: "about", title: "About", description: "Meet Muhammad Rasheed and learn about HF Removals Adelaide's practical approach to moving support.", schema: "AboutPage" },
  contact: { type: "contact", title: "Contact", description: "Call, email or request a quote from HF Removals Adelaide.", schema: "ContactPage" },
  pricing: { type: "pricing", title: "Removalist Pricing", description: "View supplied Adelaide local rates and interstate per-cubic-metre reference pricing.", schema: "WebPage" },
  "adelaide-removalists": { type: "adelaide", title: "Adelaide Removalists", description: "A practical hub for Adelaide removal services, pricing, packing and move planning.", schema: "WebPage" },
  privacy: { type: "privacy", title: "Privacy", description: "How HF Removals Adelaide handles website enquiry information.", schema: "WebPage" },
  terms: { type: "terms", title: "Website Terms", description: "General website, pricing and insurance wording terms for HF Removals Adelaide.", schema: "WebPage" },
};

const listingPages: Record<string, { kind: "services" | "areas" | "interstate" | "guides"; title: string; description: string }> = {
  services: { kind: "services", title: "Removal Services", description: "Residential, commercial, interstate, backloading and packing services from HF Removals Adelaide." },
  areas: { kind: "areas", title: "Adelaide Service Areas", description: "Move planning information for listed HF Removals Adelaide service areas." },
  interstate: { kind: "interstate", title: "Interstate Removal Routes", description: "Adelaide interstate route reference rates and practical volume planning." },
  guides: { kind: "guides", title: "Moving Guides", description: "Practical moving, packing, pricing, apartment, office and interstate guides." },
};

function pathFor(parts: string[]) { return `/${parts.join("/")}`; }
function contentTitle(page: NonNullable<ReturnType<typeof findContentPage>>) {
  if (page.kind === "area") return `${page.eyebrow.replace(/ removals| moving support/i, "")} Removalists`;
  if (page.kind === "service") return `${page.eyebrow} Adelaide`;
  return page.title;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const path = pathFor(slug);
  if (slug.length === 1 && staticPages[slug[0]]) {
    const page = staticPages[slug[0]];
    return { title: page.title, description: page.description, alternates: { canonical: canonical(path) } };
  }
  if (slug.length === 1 && listingPages[slug[0]]) {
    const page = listingPages[slug[0]];
    return { title: page.title, description: page.description, alternates: { canonical: canonical(path) } };
  }
  const page = findContentPage(slug);
  if (!page) return {};
  const title = contentTitle(page);
  return { title, description: page.description, alternates: { canonical: canonical(path) }, openGraph: { title, description: page.description, url: canonical(path) } };
}

export function generateStaticParams() {
  return indexablePaths.filter((path) => path !== "/").map((path) => ({ slug: path.split("/").filter(Boolean) }));
}

export default async function ContentRoute({ params }: Props) {
  const { slug } = await params;
  const path = pathFor(slug);
  if (slug.length === 1 && staticPages[slug[0]]) {
    const page = staticPages[slug[0]];
    const schema = { "@context": "https://schema.org", "@type": page.schema, "@id": `${canonical(path)}#webpage`, url: canonical(path), name: page.title, about: { "@id": `${business.domain}/#business` } };
    return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} /><StaticPage type={page.type} /></>;
  }
  if (slug.length === 1 && listingPages[slug[0]]) return <ListingPage kind={listingPages[slug[0]].kind} />;
  const page = findContentPage(slug);
  if (!page) notFound();
  const group = slug[0];
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      page.kind === "guide"
        ? { "@type": "Article", headline: page.title, description: page.description, mainEntityOfPage: canonical(path), publisher: { "@id": `${business.domain}/#business` } }
        : { "@type": "Service", name: page.eyebrow, description: page.description, url: canonical(path), provider: { "@id": `${business.domain}/#business` }, ...(page.kind === "area" ? { areaServed: page.eyebrow.replace(/ removals| moving support/i, "") } : {}) },
      { "@type": "BreadcrumbList", itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: business.domain },
        { "@type": "ListItem", position: 2, name: group, item: canonical(`/${group}`) },
        { "@type": "ListItem", position: 3, name: page.eyebrow, item: canonical(path) },
      ] },
    ],
  };
  return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} /><DetailPage page={page} /></>;
}
