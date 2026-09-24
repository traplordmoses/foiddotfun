import type { MetadataRoute } from "next";

// /robots.txt used to 404 to the HTML not-found page. Crawlers get the
// public routes; API handlers, the boot screen and per-wallet pages stay out.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        // /api/og/ serves the share-card images. Twitterbot honours
        // robots.txt for image URLs too, so blocking all of /api/ left X
        // cards without a picture. The longer rule wins over "/api/".
        allow: ["/", "/api/og/"],
        disallow: ["/api/", "/enter", "/dashboard"],
      },
    ],
    sitemap: ["https://foid.fun/sitemap.xml", "https://foid.fun/sitemap-placements.xml"],
    host: "https://foid.fun",
  };
}
