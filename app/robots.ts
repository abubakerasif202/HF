import { MetadataRoute } from "next";
import { business } from "../lib/site-data";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Booking pages emit noindex and must remain crawlable so search engines
      // can process that directive. Keep private/admin and API paths blocked.
      disallow: ["/admin", "/admin/", "/api/"],
    },
    sitemap: `${business.domain}/sitemap.xml`,
  };
}
