import type { Metadata } from "next";

// Per-route metadata with a full openGraph/twitter block. Next replaces a
// nested `openGraph` object wholesale instead of merging it with the root
// layout's, so every route that wants its own share card has to restate
// the whole thing; this keeps that in one place.
export function routeMetadata(input: {
  title: string;
  description: string;
  path: string;
  /** Share card from /api/og/card/<card>. */
  card?: string;
  /** Explicit share image path; wins over `card`. */
  image?: string;
  imageAlt?: string;
  /** Use the title as-is instead of the "%s | FOID.FUN" template. */
  absoluteTitle?: boolean;
  type?: "website" | "article";
  /** Keep the page out of search results (still crawlable for links). */
  noindex?: boolean;
  other?: Record<string, string>;
}): Metadata {
  const image = input.image ?? `/api/og/card/${input.card ?? "site"}`;
  const shareTitle = input.absoluteTitle ? input.title : `${input.title} | FOID.FUN`;
  return {
    title: input.absoluteTitle ? { absolute: input.title } : input.title,
    description: input.description,
    alternates: { canonical: input.path },
    ...(input.noindex ? { robots: { index: false, follow: true } } : {}),
    openGraph: {
      title: shareTitle,
      description: input.description,
      url: input.path,
      siteName: "FOID Foundation",
      type: input.type ?? "website",
      locale: "en_US",
      images: [{ url: image, width: 1200, height: 630, alt: input.imageAlt ?? input.title }],
    },
    twitter: {
      card: "summary_large_image",
      site: "@foidfun",
      title: shareTitle,
      description: input.description,
      images: [image],
    },
    ...(input.other ? { other: input.other } : {}),
  };
}
