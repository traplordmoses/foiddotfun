import type { Metadata } from "next";

// Per-route metadata with a full openGraph/twitter block. Next replaces a
// nested `openGraph` object wholesale instead of merging it with the root
// layout's, so every route that wants its own share card has to restate
// the whole thing; this keeps that in one place.
export function routeMetadata(input: {
  title: string;
  description: string;
  path: string;
  card: string;
  other?: Record<string, string>;
}): Metadata {
  const image = `/api/og/card/${input.card}`;
  return {
    title: input.title,
    description: input.description,
    alternates: { canonical: input.path },
    openGraph: {
      title: `${input.title} | FOID.FUN`,
      description: input.description,
      url: input.path,
      siteName: "FOID Foundation",
      type: "website",
      locale: "en_US",
      images: [{ url: image, width: 1200, height: 630, alt: input.title }],
    },
    twitter: {
      card: "summary_large_image",
      site: "@foidfun",
      title: `${input.title} | FOID.FUN`,
      description: input.description,
      images: [image],
    },
    ...(input.other ? { other: input.other } : {}),
  };
}
