import type { MetadataRoute } from "next";
import { business } from "../lib/site-data";

export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", allow: "/", disallow: ["/api/"] }, sitemap: `${business.domain}/sitemap.xml`, host: business.domain };
}
