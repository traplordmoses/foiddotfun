import type { MetadataRoute } from "next";

// /robots.txt used to 404 to the HTML not-found page. Crawlers get the
// public routes; API handlers, the boot screen and per-wallet pages stay out.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/enter", "/dashboard"],
      },
    ],
    sitemap: "https://foid.fun/sitemap.xml",
    host: "https://foid.fun",
  };
}
