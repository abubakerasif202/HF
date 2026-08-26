import { MetadataRoute } from "next";
import { business, indexablePaths } from "../lib/site-data";
import { hfServiceAreas } from "../lib/hf-service-areas";

export default function sitemap(): MetadataRoute.Sitemap {
  const paths = [
    ...indexablePaths,
    ...hfServiceAreas.map((page) => `/areas/${page.slug}`),
  ];

  return [...new Set(paths)].map((path) => ({
    url: `${business.domain}${path === "/" ? "" : path}`,
  }));
}
