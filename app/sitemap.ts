import type { MetadataRoute } from "next";
import { canonical, indexablePaths } from "../lib/site-data";

export default function sitemap(): MetadataRoute.Sitemap {
  return indexablePaths.map((path) => ({ url: canonical(path), changeFrequency: path === "/" ? "weekly" : "monthly", priority: path === "/" ? 1 : path.split("/").filter(Boolean).length === 1 ? 0.8 : 0.65 }));
}
