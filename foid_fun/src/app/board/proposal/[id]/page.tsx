// /board/proposal/<id> — one Loreboard placement as a real page.
//
// This used to be a 15-word share page that bounced people to the board
// with a script redirect and pointed its canonical at /board, so none of
// the placements could be found in search. It now renders the placement
// itself: the image, an AI-written title, alt text and description
// (src/content/placementCaptions.json), the onchain facts, and links into
// the board. The share card (og:image) and the Farcaster mini app embed are
// unchanged, and "See it on the Loreboard" still replays the placement
// celebration on the board (?celebrate=<id>).
import type { Metadata } from "next";
import Link from "next/link";
import "@/app/board/placements.css";
import { JsonLd } from "@/components/seo/JsonLd";
import { routeMetadata } from "@/lib/routeMetadata";
import {
  listPlacements,
  placedDate,
  placementAlt,
  placementImagePath,
  placementImageUrl,
  placementTitle,
  thumbnailAlt,
  type PlacementSummary,
} from "@/lib/server/placementPages";
import { ORG_ID, SITE_URL, WEBSITE_ID } from "@/lib/site";

type Params = { id: string };

const EXPLORER = "https://fluentscan.xyz";

function parseId(raw: string): number | null {
  return /^\d{1,7}$/.test(raw) ? Number(raw) : null;
}

async function loadPlacement(raw: string): Promise<{
  placement: PlacementSummary | null;
  prev: PlacementSummary | null;
  next: PlacementSummary | null;
  more: PlacementSummary[];
}> {
  const id = parseId(raw);
  if (id === null) return { placement: null, prev: null, next: null, more: [] };
  let all: PlacementSummary[] = [];
  try {
    all = await listPlacements();
  } catch {
    // Indexer and RPC both down: fall back to the bare share page below.
  }
  const index = all.findIndex((p) => p.proposalId === id);
  if (index === -1) return { placement: null, prev: null, next: null, more: [] };
  // Newest first: "previous" is the one placed before this one (older).
  const older = all[index + 1] ?? null;
  const newer = all[index - 1] ?? null;
  const more = all.filter((_, i) => i !== index && !all[i].caption?.sensitive).slice(0, 6);
  return { placement: all[index], prev: older, next: newer, more };
}

function trimTo(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  return `${cut.slice(0, cut.lastIndexOf(" "))}…`;
}

function miniAppEmbed(id: string, ogPath: string): Record<string, string> {
  // Farcaster / Base App embed (audit G3): a cast with this link shows the
  // placement card and a launch button into the board.
  return {
    "fc:miniapp": JSON.stringify({
      version: "1",
      imageUrl: `${SITE_URL}${ogPath}`,
      button: {
        title: "see it on the loreboard",
        action: {
          type: "launch_miniapp",
          name: "FOID",
          url: `${SITE_URL}/board?celebrate=${encodeURIComponent(id)}&miniapp=1`,
          splashImageUrl: `${SITE_URL}/icons/192.png`,
          splashBackgroundColor: "#0e0f2b",
        },
      },
    }),
  };
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const id = params.id;
  const ogPath = `/api/og/placement/${encodeURIComponent(id)}`;
  const { placement } = await loadPlacement(id);
  if (!placement) {
    // Not (yet) on the board: still a working share link, but nothing to index.
    return routeMetadata({
      title: `Proposal #${id} · FOID Loreboard`,
      absoluteTitle: true,
      description: "A FOID Foundation Loreboard proposal, voted on by the community onchain.",
      path: `/board/proposal/${id}`,
      image: ogPath,
      type: "article",
      noindex: true,
      other: miniAppEmbed(id, ogPath),
    });
  }
  const title = placementTitle(placement);
  const description = placement.caption
    ? trimTo(`${placement.caption.description} On the FOID Loreboard, a community-voted onchain canvas.`, 200)
    : `Placement #${placement.proposalId} on the FOID Loreboard, a community-voted onchain canvas.`;
  return routeMetadata({
    title: placement.caption ? `${title} · Loreboard #${placement.proposalId} | FOID.FUN` : `${title} | FOID.FUN`,
    absoluteTitle: true,
    description,
    path: `/board/proposal/${placement.proposalId}`,
    image: ogPath,
    imageAlt: placementAlt(placement),
    type: "article",
    noindex: placement.caption?.sensitive === true,
    other: miniAppEmbed(id, ogPath),
  });
}

function shortAddress(address: string): string {
  return address.length > 10 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address;
}

export default async function PlacementPage({ params }: { params: Params }) {
  const { placement, prev, next, more } = await loadPlacement(params.id);

  if (!placement) {
    const id = parseId(params.id);
    return (
      <main className="placement-page">
        <article className="vista-window vista-window--terminal placement-window placement-window--short" aria-label="Proposal">
          <div className="placement-bar">
            <Link href="/board" className="vista-window__control vista-window__control--close placement-bar__close" aria-label="Back to the Loreboard" title="Loreboard" />
            <span className="placement-bar__name">PROPOSAL_{id ?? "?"}.EXE</span>
          </div>
          <div className="placement-scroll">
            <div className="placement-body">
              <h1 className="placement-title">{id === null ? "Unknown proposal" : `Proposal #${id} isn't on the board yet`}</h1>
              <p className="placement-lede">
                It may still be in its 72-hour vote, or the community may have passed on it. Every approved placement stays on the Loreboard for good.
              </p>
              <div className="placement-actions">
                {id !== null && (
                  <Link className="placement-button placement-button--primary" href={`/vote/${id}`}>
                    See the vote
                  </Link>
                )}
                <Link className="placement-button" href="/board">
                  Open the Loreboard
                </Link>
                <Link className="placement-button" href="/board/placements">
                  Browse every placement
                </Link>
              </div>
            </div>
          </div>
        </article>
      </main>
    );
  }

  const id = placement.proposalId;
  const url = `${SITE_URL}/board/proposal/${id}`;
  const title = placementTitle(placement);
  const date = placedDate(placement);
  const ratio = placement.w && placement.h ? `${placement.w} / ${placement.h}` : "1 / 1";
  const widthCells = Math.round(placement.w / 32);
  const heightCells = Math.round(placement.h / 32);

  return (
    <main className="placement-page">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "ImageObject",
              "@id": `${url}#image`,
              name: title,
              caption: placement.caption?.alt ?? title,
              description: placement.caption?.description,
              contentUrl: placementImageUrl(placement.cid, 640),
              thumbnailUrl: placementImageUrl(placement.cid, 192),
              url,
              ...(date ? { uploadDate: date } : {}),
              ...(placement.caption?.tags.length ? { keywords: placement.caption.tags.join(", ") } : {}),
              isPartOf: { "@id": WEBSITE_ID },
              publisher: { "@id": ORG_ID },
              creditText: "FOID Loreboard",
            },
            {
              "@type": "BreadcrumbList",
              itemListElement: [
                { "@type": "ListItem", position: 1, name: "FOID Foundation", item: `${SITE_URL}/` },
                { "@type": "ListItem", position: 2, name: "Loreboard", item: `${SITE_URL}/board` },
                { "@type": "ListItem", position: 3, name: "Placements", item: `${SITE_URL}/board/placements` },
                { "@type": "ListItem", position: 4, name: title, item: url },
              ],
            },
          ],
        }}
      />

      <article className="vista-window vista-window--terminal placement-window" aria-label={title}>
        <div className="placement-bar">
          <Link
            href="/board/placements"
            className="vista-window__control vista-window__control--close placement-bar__close"
            aria-label="Back to every placement"
            title="All placements"
          />
          <span className="placement-bar__name">PLACEMENT_{id}.PNG</span>
          <span className="placement-bar__badge">#{id}</span>
        </div>

        <div className="placement-scroll" tabIndex={0}>
          <div className="placement-body">
            <nav className="placement-crumbs" aria-label="Breadcrumb">
              <Link href="/">FOID</Link>
              <span aria-hidden="true">/</span>
              <Link href="/board">Loreboard</Link>
              <span aria-hidden="true">/</span>
              <Link href="/board/placements">Placements</Link>
              <span aria-hidden="true">/</span>
              <span aria-current="page">#{id}</span>
            </nav>

            <h1 className="placement-title">{title}</h1>

            <figure className="placement-figure" style={{ aspectRatio: ratio }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={placementImagePath(placement.cid, 640)}
                srcSet={`${placementImagePath(placement.cid, 320)} 640w, ${placementImagePath(placement.cid, 640)} 1280w`}
                sizes="(max-width: 800px) calc(100vw - 56px), 700px"
                alt={placementAlt(placement)}
                width={placement.w || 640}
                height={placement.h || 640}
                // @ts-expect-error fetchpriority is a standard attribute React 18's types lack.
                fetchpriority="high"
                decoding="async"
              />
            </figure>
            {placement.caption && <p className="placement-lede">{placement.caption.description}</p>}

            <dl className="placement-facts">
              {date && (
                <div>
                  <dt>Placed</dt>
                  <dd>
                    <time dateTime={date}>{date}</time>
                  </dd>
                </div>
              )}
              <div>
                <dt>Size</dt>
                <dd>
                  {widthCells} × {heightCells} cells ({placement.cells} cells)
                </dd>
              </div>
              <div>
                <dt>Community vote</dt>
                <dd>
                  {placement.yesVotes} for, {placement.noVotes} against (streak-weighted)
                </dd>
              </div>
              {placement.owner && (
                <div>
                  <dt>Placed by</dt>
                  <dd>
                    <a href={`${EXPLORER}/address/${placement.owner}`} rel="nofollow noopener" target="_blank">
                      {shortAddress(placement.owner)}
                    </a>
                  </dd>
                </div>
              )}
              <div>
                <dt>Stored on IPFS</dt>
                <dd className="placement-facts__cid">{placement.cid}</dd>
              </div>
            </dl>

            {placement.caption && placement.caption.tags.length > 0 && (
              <ul className="placement-tags" aria-label="Tags">
                {placement.caption.tags.map((tag) => (
                  <li key={tag}>{tag}</li>
                ))}
              </ul>
            )}

            <div className="placement-actions">
              <Link className="placement-button placement-button--primary" href={`/board?celebrate=${id}`}>
                See it on the Loreboard
              </Link>
              <Link className="placement-button" href="/vote">
                Vote on what&apos;s next
              </Link>
              <Link className="placement-button" href="/vote/submit">
                Propose your own
              </Link>
            </div>

            <nav className="placement-neighbors" aria-label="More placements">
              {prev ? (
                <Link href={`/board/proposal/${prev.proposalId}`} rel="prev">
                  <span aria-hidden="true">‹ </span>
                  {placementTitle(prev)}
                </Link>
              ) : (
                <span />
              )}
              {next ? (
                <Link href={`/board/proposal/${next.proposalId}`} rel="next">
                  {placementTitle(next)}
                  <span aria-hidden="true"> ›</span>
                </Link>
              ) : (
                <span />
              )}
            </nav>

            {more.length > 0 && (
              <section className="placement-more" aria-labelledby="placement-more-heading">
                <h2 id="placement-more-heading">More from the Loreboard</h2>
                <ul className="placement-grid">
                  {more.map((p) => (
                    <li key={p.proposalId}>
                      <Link href={`/board/proposal/${p.proposalId}`} className="placement-card">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={placementImagePath(p.cid, 192)} alt={thumbnailAlt(p)} loading="lazy" decoding="async" width={192} height={192} />
                        <span className="placement-card__title">{placementTitle(p)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
                <p className="placement-more__all">
                  <Link href="/board/placements">Browse every placement</Link>
                </p>
              </section>
            )}
          </div>
        </div>
      </article>
    </main>
  );
}
