import type { MetadataRoute } from "next";
import { ABOUT_DOCS } from "@/content/aboutDocs";
import { SITE_URL } from "@/lib/site";

// App routes carry no lastModified: they change continuously and a date
// that moves on every deploy tells crawlers nothing. Docs use their real
// updatedAt. Loreboard placement pages live in /sitemap-placements.xml.
const APP_ROUTES: Array<{ path: string; changeFrequency: "hourly" | "daily" | "weekly" | "monthly"; priority: number }> = [
  { path: "/", changeFrequency: "daily", priority: 1 },
  { path: "/board", changeFrequency: "hourly", priority: 0.9 },
  { path: "/pray", changeFrequency: "daily", priority: 0.9 },
  { path: "/vote", changeFrequency: "hourly", priority: 0.8 },
  { path: "/about", changeFrequency: "monthly", priority: 0.7 },
  { path: "/mifoid", changeFrequency: "weekly", priority: 0.6 },
  { path: "/files", changeFrequency: "weekly", priority: 0.4 },
];

const KEY_DOCS = new Set(["readme", "getting-started", "faq", "loreboard", "prayer"]);

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    ...APP_ROUTES.map((route) => ({
      url: `${SITE_URL}${route.path}`,
      changeFrequency: route.changeFrequency,
      priority: route.priority,
    })),
    ...ABOUT_DOCS.map((doc) => ({
      url: `${SITE_URL}/about/${doc.id}`,
      lastModified: doc.updatedAt,
      changeFrequency: "monthly" as const,
      priority: KEY_DOCS.has(doc.id) ? 0.8 : 0.6,
    })),
  ];
}
