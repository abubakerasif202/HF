import type { ContentPage } from "./site-data";
import { hfServiceAreaRecords } from "./hf-service-areas";

/**
 * One source for breadcrumb labels so the visible trail (Breadcrumbs component)
 * and the BreadcrumbList structured data always name each level identically.
 */
export type Crumb = { label: string; href?: string };

export const sectionCrumbs: Record<"services" | "areas" | "interstate" | "guides", Crumb> = {
  services: { label: "Services", href: "/services" },
  areas: { label: "Service Areas", href: "/areas" },
  interstate: { label: "Interstate Routes", href: "/interstate" },
  guides: { label: "Moving Guides", href: "/guides" },
};

export const staticCrumbLabels: Record<"about" | "contact" | "pricing" | "adelaide" | "privacy" | "terms", string> = {
  about: "About",
  contact: "Contact",
  pricing: "Pricing",
  adelaide: "Adelaide Removalists",
  privacy: "Privacy",
  terms: "Website Terms",
};

export const homeCrumb: Crumb = { label: "Home", href: "/" };

/** BreadcrumbList for JSON-LD; the last crumb is the current page at `currentUrl`. */
export function breadcrumbSchema(trail: Crumb[], absolute: (path: string) => string, currentUrl: string) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: trail.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.label,
      item: index === trail.length - 1 ? currentUrl : absolute(crumb.href ?? "/"),
    })),
  };
}


const sectionForKind: Record<ContentPage["kind"], keyof typeof sectionCrumbs> = {
  service: "services",
  area: "areas",
  route: "interstate",
  guide: "guides",
};

/** Home / Section / [Region hub] / Page — used by detail pages and their schema. */
export function contentTrail(page: ContentPage): Crumb[] {
  const trail: Crumb[] = [homeCrumb, sectionCrumbs[sectionForKind[page.kind]]];
  if (page.kind === "area") {
    const record = hfServiceAreaRecords.find((item) => item.slug === page.slug);
    const region = record ? hfServiceAreaRecords.find((item) => item.name === record.region) : undefined;
    if (record && region && region.slug !== record.slug) trail.push({ label: record.region, href: `/areas/${region.slug}` });
  }
  trail.push({ label: page.eyebrow });
  return trail;
}
