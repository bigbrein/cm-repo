import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Everything behind auth — no point letting crawlers spend budget on
      // pages they can't render anyway, and it keeps demo data out of
      // search results.
      disallow: ["/dashboard", "/upload", "/reports", "/audit-log", "/admin", "/api/"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
