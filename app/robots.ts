import { MetadataRoute } from "next";
import { business } from "../lib/site-data";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/book", "/booking/", "/admin", "/admin/", "/api/"],
    },
    sitemap: `${business.domain}/sitemap.xml`,
  };
}
