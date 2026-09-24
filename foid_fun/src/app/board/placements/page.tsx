// /board/placements — every Loreboard placement as a browsable grid, newest
// first, each linking to its own page. The hub that makes the placement
// pages discoverable (and a plain scrolling gallery for anyone who'd rather
// not pan the canvas).
import type { Metadata } from "next";
import Link from "next/link";
import "@/app/board/placements.css";
import { JsonLd } from "@/components/seo/JsonLd";
import { routeMetadata } from "@/lib/routeMetadata";
import {
  listPlacements,
  placedDate,
  placementImagePath,
  placementTitle,
  thumbnailAlt,
  type PlacementSummary,
} from "@/lib/server/placementPages";
import { SITE_URL, WEBSITE_ID } from "@/lib/site";

const TITLE = "Every meme on the Loreboard";
const DESCRIPTION =
  "Browse every placement on the FOID Loreboard, the community-voted onchain canvas: memes, 3D renders and internet art, each approved by streak-weighted vote.";

export const metadata: Metadata = routeMetadata({
  title: `${TITLE} | FOID.FUN`,
  absoluteTitle: true,
  description: DESCRIPTION,
  path: "/board/placements",
  card: "board",
});

export default async function PlacementsPage() {
  let placements: PlacementSummary[] = [];
  try {
    placements = await listPlacements();
  } catch {
    // Indexer and RPC both down: render the empty state below.
  }

  return (
    <main className="placement-page">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          "@id": `${SITE_URL}/board/placements#collection`,
          name: TITLE,
          description: DESCRIPTION,
          url: `${SITE_URL}/board/placements`,
          isPartOf: { "@id": WEBSITE_ID },
          mainEntity: {
            "@type": "ItemList",
            numberOfItems: placements.length,
            itemListElement: placements.map((p, i) => ({
              "@type": "ListItem",
              position: i + 1,
              url: `${SITE_URL}/board/proposal/${p.proposalId}`,
              name: placementTitle(p),
            })),
          },
        }}
      />

      <article className="vista-window vista-window--terminal placement-window" aria-label={TITLE}>
        <div className="placement-bar">
          <Link
            href="/board"
            className="vista-window__control vista-window__control--close placement-bar__close"
            aria-label="Back to the Loreboard"
            title="Loreboard"
          />
          <span className="placement-bar__name">LOREBOARD_GALLERY</span>
          <span className="placement-bar__badge">{placements.length}</span>
        </div>

        <div className="placement-scroll" tabIndex={0}>
          <div className="placement-body placement-body--wide">
            <nav className="placement-crumbs" aria-label="Breadcrumb">
              <Link href="/">FOID</Link>
              <span aria-hidden="true">/</span>
              <Link href="/board">Loreboard</Link>
              <span aria-hidden="true">/</span>
              <span aria-current="page">Placements</span>
            </nav>
            <h1 className="placement-title">{TITLE}</h1>
            <p className="placement-lede">
              The Loreboard is a canvas that only the community can change. Anyone can propose an image for 0.001 ETH, the community votes for 72 hours with prayer-streak weighted votes, and what passes stays onchain for good. Newest first.
            </p>

            {placements.length === 0 ? (
              <p className="placement-lede">The placement list is unavailable right now. The Loreboard itself is at <Link href="/board">/board</Link>.</p>
            ) : (
              <ul className="placement-grid placement-grid--gallery">
                {placements.map((p, i) => (
                  <li key={p.proposalId}>
                    <Link href={`/board/proposal/${p.proposalId}`} className="placement-card">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={placementImagePath(p.cid, 192)}
                        alt={thumbnailAlt(p)}
                        loading={i < 12 ? "eager" : "lazy"}
                        decoding="async"
                        width={192}
                        height={192}
                      />
                      <span className="placement-card__title">{placementTitle(p)}</span>
                      <span className="placement-card__meta">
                        #{p.proposalId}
                        {placedDate(p) ? ` · ${placedDate(p)}` : ""}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}

            <div className="placement-actions">
              <Link className="placement-button placement-button--primary" href="/board">
                Open the canvas
              </Link>
              <Link className="placement-button" href="/vote/submit">
                Propose your own
              </Link>
              <Link className="placement-button" href="/about/loreboard">
                How the Loreboard works
              </Link>
            </div>
          </div>
        </div>
      </article>
    </main>
  );
}
