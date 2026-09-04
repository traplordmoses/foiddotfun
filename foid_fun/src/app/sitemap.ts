import type { MetadataRoute } from "next";

// Static routes only. Placement share pages (/board/proposal/[id]) are
// discovered through the links people post; listing every id here would
// mean an RPC call per crawl.
export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://foid.fun";
  const now = new Date();
  return [
    { url: `${base}/`, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${base}/pray`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/board`, lastModified: now, changeFrequency: "hourly", priority: 0.9 },
    { url: `${base}/vote`, lastModified: now, changeFrequency: "hourly", priority: 0.8 },
    { url: `${base}/mifoid`, lastModified: now, changeFrequency: "weekly", priority: 0.6 },
    { url: `${base}/files`, lastModified: now, changeFrequency: "weekly", priority: 0.4 },
    { url: `${base}/about`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
  ];
}
