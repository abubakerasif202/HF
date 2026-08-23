import { MetadataRoute } from "next";
import { business, indexablePaths } from "../lib/site-data";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return indexablePaths.map((path) => ({
    url: `${business.domain}${path === "/" ? "" : path}`,
    lastModified: now,
    changeFrequency: path === "/" ? "weekly" : path.startsWith("/services") ? "monthly" : "yearly",
    priority: path === "/" ? 1.0 : path.startsWith("/services") ? 0.9 : path.startsWith("/areas") ? 0.8 : 0.7,
  }));
}
