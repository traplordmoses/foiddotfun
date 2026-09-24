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
  type?: "website" | "article" | "video.other";
  /** Playable file for og:video (with og:type video.other). */
  video?: { url: string; width: number; height: number };
  /** Share image size when it isn't the 1200x630 card (e.g. a 9:16 poster). */
  imageSize?: { width: number; height: number };
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
      images: [
        {
          url: image,
          width: input.imageSize?.width ?? 1200,
          height: input.imageSize?.height ?? 630,
          alt: input.imageAlt ?? input.title,
        },
      ],
      ...(input.video
        ? { videos: [{ url: input.video.url, width: input.video.width, height: input.video.height, type: "video/mp4" }] }
        : {}),
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
