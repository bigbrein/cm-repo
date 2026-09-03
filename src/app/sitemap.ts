import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// Only the public, unauthenticated routes — everything under (app) needs a
// session to render at all, so there's nothing for a crawler to index there.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE_URL, changeFrequency: "monthly", priority: 1 },
    { url: `${SITE_URL}/login`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/register`, changeFrequency: "yearly", priority: 0.3 },
  ];
}
