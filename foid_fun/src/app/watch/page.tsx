// /watch — MIFOID.TV: every published MiFOID episode (newest first) and the
// archive films, each linking to its own /watch/<id> page. Episodes appear
// here at their scheduled publishAt, so the hub never lists a future title.
import type { Metadata } from "next";
import Link from "next/link";
import "@/app/board/placements.css";
import "@/app/watch/watch.css";
import { JsonLd } from "@/components/seo/JsonLd";
import { routeMetadata } from "@/lib/routeMetadata";
import { SITE_URL, SOCIAL_PROFILES, WEBSITE_ID } from "@/lib/site";
import { clockDuration, listWatchVideos, type WatchVideo } from "@/lib/server/videos";

export const dynamic = "force-dynamic";

const TITLE = "MiFOID episodes";
const DESCRIPTION =
  "AI-animated short stories starring MiFOID and the little devil: london, the slushie saga, buenos aires and more. Every episode with its full script, plus the MiFOID films.";

export const metadata: Metadata = routeMetadata({
  title: `${TITLE} | FOID.FUN`,
  absoluteTitle: true,
  description: DESCRIPTION,
  path: "/watch",
  card: "files",
});

// The first row is on screen at load (this page is the link in the social
// bios, so mostly phones): those thumbnails load eagerly, the rest lazily.
const EAGER_CARDS = 4;

function Card({ video, eager = false }: { video: WatchVideo; eager?: boolean }) {
  return (
    <li>
      <Link href={`/watch/${video.id}`} className="placement-card">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={video.thumbPath}
          alt=""
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          width={video.width}
          height={video.height}
        />
        <span className="placement-card__title">{video.title}</span>
        <span className="placement-card__meta">
          {video.seriesLabel ?? ""}
          {video.seriesLabel && video.durationSec ? " · " : ""}
          {video.durationSec ? clockDuration(video.durationSec) : ""}
        </span>
      </Link>
    </li>
  );
}

export default function WatchIndexPage() {
  const videos = listWatchVideos();
  const episodes = videos.filter((v) => v.kind === "episode");
  const films = videos.filter((v) => v.kind === "film");

  return (
    <main className="placement-page watch-page">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          "@id": `${SITE_URL}/watch#collection`,
          name: TITLE,
          description: DESCRIPTION,
          url: `${SITE_URL}/watch`,
          isPartOf: { "@id": WEBSITE_ID },
          mainEntity: {
            "@type": "ItemList",
            numberOfItems: videos.length,
            itemListElement: videos.map((video, i) => ({
              "@type": "ListItem",
              position: i + 1,
              url: `${SITE_URL}/watch/${video.id}`,
              name: video.title,
            })),
          },
        }}
      />

      <article className="vista-window vista-window--terminal placement-window" aria-label={TITLE}>
        <div className="placement-bar">
          <Link
            href="/"
            className="vista-window__control vista-window__control--close placement-bar__close"
            aria-label="Back to FOID"
            title="FOID"
          />
          <span className="placement-bar__name">MIFOID.TV</span>
          <span className="placement-bar__badge">{videos.length}</span>
        </div>

        <div className="placement-scroll" tabIndex={0}>
          <div className="placement-body placement-body--wide">
            <nav className="placement-crumbs" aria-label="Breadcrumb">
              <Link href="/">FOID</Link>
              <span aria-hidden="true">/</span>
              <span aria-current="page">Episodes</span>
            </nav>
            <h1 className="placement-title">{TITLE}</h1>
            <p className="placement-lede">
              ai-animated short stories starring mifoid and the little devil. a new one most days on{" "}
              <a href={SOCIAL_PROFILES.tiktok} target="_blank" rel="noopener">
                tiktok
              </a>{" "}
              and{" "}
              <a href={SOCIAL_PROFILES.instagram} target="_blank" rel="noopener">
                instagram
              </a>
              , @foidfun on both. every episode lives here too, with its full script.
            </p>

            <section className="watch-section" aria-labelledby="watch-episodes">
              <h2 id="watch-episodes">episodes</h2>
              {episodes.length ? (
                <ul className="placement-grid watch-grid watch-grid--portrait">
                  {episodes.map((video, i) => (
                    <Card key={video.id} video={video} eager={i < EAGER_CARDS} />
                  ))}
                </ul>
              ) : (
                <p className="watch-empty">
                  episodes land here the moment they drop. follow{" "}
                  <a href={SOCIAL_PROFILES.tiktok} target="_blank" rel="noopener">
                    @foidfun on tiktok
                  </a>{" "}
                  so you catch the first one.
                </p>
              )}
            </section>

            {films.length > 0 && (
              <section className="watch-section" aria-labelledby="watch-films">
                <h2 id="watch-films">films and loops</h2>
                <ul className="placement-grid watch-grid">
                  {films.map((video, i) => (
                    <Card key={video.id} video={video} eager={episodes.length === 0 && i < EAGER_CARDS} />
                  ))}
                </ul>
              </section>
            )}

            <div className="placement-actions">
              <Link className="placement-button placement-button--primary" href="/files">
                Open FILES.EXE
              </Link>
              <Link className="placement-button" href="/board/placements">
                The meme gallery
              </Link>
              <Link className="placement-button" href="/about/mifoid">
                What is a MiFOID
              </Link>
            </div>
          </div>
        </div>
      </article>
    </main>
  );
}
