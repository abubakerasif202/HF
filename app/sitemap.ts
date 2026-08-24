import { MetadataRoute } from "next";
import { business, indexablePaths } from "../lib/site-data";

export default function sitemap(): MetadataRoute.Sitemap {
  return indexablePaths.map((path) => ({
    url: `${business.domain}${path === "/" ? "" : path}`,
  }));
}
