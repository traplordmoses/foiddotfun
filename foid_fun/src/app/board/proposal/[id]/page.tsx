// /src/app/board/proposal/[id]/page.tsx
// Thin share page. Purpose is to expose og:image + twitter:image metadata
// pointing at /api/og/placement/[id] so Farcaster, X, iMessage all get a
// rich preview. Human traffic is bounced to /board?celebrate=<id> via a
// client redirect — a server redirect() would strip the <meta> tags that
// crawlers need before they follow anything. ?celebrate= replays the
// PlacementCelebration so the recipient lands on a moment, not just a board.

import type { Metadata } from "next";

type Params = { id: string };

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const id = params.id;
  const ogPath = `/api/og/placement/${encodeURIComponent(id)}`;
  const title = `Proposal #${id} — FOID Loreboard`;
  const description =
    "A FOID Foundation loreboard proposal — placed onchain, voted on by the community.";
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "article",
      images: [
        {
          url: ogPath,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogPath],
    },
  };
}

export default function ProposalSharePage({ params }: { params: Params }) {
  const target = `/board?celebrate=${encodeURIComponent(params.id)}`;
  return (
    <div
      style={{
        minHeight: "60vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#74ffeb",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        fontSize: 14,
        letterSpacing: 2,
      }}
    >
      <script
        dangerouslySetInnerHTML={{
          __html: `setTimeout(function(){location.replace(${JSON.stringify(
            target
          )})},40);`,
        }}
      />
      <noscript>
        <a href={target} style={{ color: "#74ffeb" }}>
          Open board →
        </a>
      </noscript>
      opening board…
    </div>
  );
}
