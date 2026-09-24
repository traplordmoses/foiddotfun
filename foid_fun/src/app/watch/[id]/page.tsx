// /watch/<id> — one MiFOID video as its own page: the player, the story in
// words (logline, description, the real facts behind it, the full script),
// and VideoObject structured data, so an episode can be found in search and
// cited by AI answer engines, not only watched on TikTok. Episodes appear at
// their scheduled publishAt; until then the route 404s (src/middleware.ts).
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import "@/app/board/placements.css";
import "@/app/watch/watch.css";
import { JsonLd } from "@/components/seo/JsonLd";
import { routeMetadata } from "@/lib/routeMetadata";
import { ORG_ID, SITE_URL, SOCIAL_PROFILES, WEBSITE_ID } from "@/lib/site";
import {
  absoluteUrl,
  clockDuration,
  getWatchVideo,
  isoDuration,
  listWatchVideos,
  type WatchVideo,
} from "@/lib/server/videos";

type Params = { id: string };

// Whatever is watchable at build time is prerendered. An episode that goes
// live later renders on its first request after publishAt, and every page
// regenerates at most once a minute so the "more episodes" lists catch up.
// Unknown and unreleased ids never get here: src/middleware.ts answers
// them with a real 404 (the notFound() calls below are a backstop, and on
// their own they would only produce a soft 404 under the root loading.tsx).
export const revalidate = 60;

export function generateStaticParams(): Params[] {
  return listWatchVideos().map((video) => ({ id: video.id }));
}

function shareTitle(video: WatchVideo): string {
  return video.kind === "episode" ? `${video.title} · mifoid episode | FOID.FUN` : `${video.title} · mifoid | FOID.FUN`;
}

function metaDescription(video: WatchVideo): string {
  const text = video.kind === "episode" ? `${video.logline} ${video.description}` : `${video.description} A MiFOID film from the FOID Foundation archive.`;
  if (text.length <= 200) return text;
  const cut = text.slice(0, 199);
  return `${cut.slice(0, cut.lastIndexOf(" "))}…`;
}

export function generateMetadata({ params }: { params: Params }): Metadata {
  const video = getWatchVideo(params.id);
  if (!video) notFound();
  return routeMetadata({
    title: shareTitle(video),
    absoluteTitle: true,
    description: metaDescription(video),
    path: `/watch/${video.id}`,
    image: video.share.path,
    imageSize: { width: video.share.width, height: video.share.height },
    imageAlt: video.title,
    type: "video.other",
    video: { url: absoluteUrl(video.videoPath), width: video.width, height: video.height },
  });
}

function publishedLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

export default function WatchPage({ params }: { params: Params }) {
  const video = getWatchVideo(params.id);
  if (!video) notFound();

  const all = listWatchVideos();
  const url = `${SITE_URL}/watch/${video.id}`;
  const portrait = video.height > video.width;
  const seriesSiblings = video.seriesId
    ? all.filter((v) => v.seriesId === video.seriesId).sort((a, b) => (a.seriesNumber ?? 0) - (b.seriesNumber ?? 0))
    : [];
  const more = all.filter((v) => v.id !== video.id && v.kind === video.kind).slice(0, 6);
  const details = video.details;

  return (
    <main className="placement-page watch-page">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "VideoObject",
              "@id": `${url}#video`,
              name: video.title,
              description: video.kind === "episode" ? `${video.logline} ${video.description}` : video.description || video.title,
              thumbnailUrl: [...new Set([video.posterPath, video.share.path])].map(absoluteUrl),
              uploadDate: video.publishedAt,
              ...(video.durationSec ? { duration: isoDuration(video.durationSec) } : {}),
              contentUrl: absoluteUrl(video.videoPath),
              url,
              width: video.width,
              height: video.height,
              inLanguage: "en",
              genre: "AI animation",
              keywords: video.tags.join(", "),
              ...(details?.transcript.length ? { transcript: details.transcript.join(" ") } : {}),
              isPartOf: video.seriesName
                ? [{ "@id": WEBSITE_ID }, { "@type": "CreativeWorkSeries", name: `mifoid: ${video.seriesName}` }]
                : { "@id": WEBSITE_ID },
              creator: { "@id": ORG_ID },
              publisher: { "@id": ORG_ID },
              isAccessibleForFree: true,
            },
            {
              "@type": "BreadcrumbList",
              itemListElement: [
                { "@type": "ListItem", position: 1, name: "FOID Foundation", item: `${SITE_URL}/` },
                { "@type": "ListItem", position: 2, name: "MiFOID episodes", item: `${SITE_URL}/watch` },
                { "@type": "ListItem", position: 3, name: video.title, item: url },
              ],
            },
          ],
        }}
      />

      <article className="vista-window vista-window--terminal placement-window" aria-label={video.title}>
        <div className="placement-bar">
          <Link
            href="/watch"
            className="vista-window__control vista-window__control--close placement-bar__close"
            aria-label="Back to all episodes"
            title="All episodes"
          />
          <span className="placement-bar__name">MIFOID.TV — {video.id.toUpperCase()}.MP4</span>
          {video.durationSec ? <span className="placement-bar__badge">{clockDuration(video.durationSec)}</span> : null}
        </div>

        <div className="placement-scroll" tabIndex={0}>
          <div className="placement-body placement-body--wide">
            <nav className="placement-crumbs" aria-label="Breadcrumb">
              <Link href="/">FOID</Link>
              <span aria-hidden="true">/</span>
              <Link href="/watch">Episodes</Link>
              <span aria-hidden="true">/</span>
              <span aria-current="page">{video.title}</span>
            </nav>

            <div className={`watch-layout${portrait ? "" : " watch-layout--wide"}`}>
              <figure className="watch-player" style={{ aspectRatio: `${video.width} / ${video.height}` }}>
                <video
                  controls
                  playsInline
                  preload="metadata"
                  poster={video.posterPath}
                  width={video.width}
                  height={video.height}
                  aria-label={`${video.title}, ${video.kind === "episode" ? "mifoid episode" : "mifoid film"}`}
                >
                  <source src={video.videoSrc} type="video/mp4" />
                  {video.videoPath !== video.videoSrc ? <source src={video.videoPath} type="video/mp4" /> : null}
                </video>
              </figure>

              <div className="watch-meta">
                {video.seriesLabel ? <p className="watch-series">{video.seriesLabel}</p> : null}
                <h1 className="placement-title watch-title">{video.title}</h1>
                <p className="watch-logline">{video.logline}</p>
                {video.kind === "episode" && video.description ? <p className="placement-lede">{video.description}</p> : null}

                <dl className="placement-facts">
                  <div>
                    <dt>{video.kind === "episode" ? "Released" : "Added"}</dt>
                    <dd>
                      <time dateTime={video.publishedAt}>{publishedLabel(video.publishedAt)}</time>
                    </dd>
                  </div>
                  {video.durationSec ? (
                    <div>
                      <dt>Runtime</dt>
                      <dd>{clockDuration(video.durationSec)}</dd>
                    </div>
                  ) : null}
                  {details?.place ? (
                    <div>
                      <dt>Where</dt>
                      <dd>{details.place}</dd>
                    </div>
                  ) : null}
                  <div>
                    <dt>Made with</dt>
                    <dd>ai animation, by foid foundation</dd>
                  </div>
                </dl>

                <ul className="placement-tags" aria-label="Tags">
                  {video.tags.map((tag) => (
                    <li key={tag}>{tag}</li>
                  ))}
                </ul>

                {seriesSiblings.length > 1 && (
                  <nav className="watch-series-nav" aria-label={`${video.seriesName} episodes`}>
                    {seriesSiblings.map((sibling) =>
                      sibling.id === video.id ? (
                        <span key={sibling.id} aria-current="page">
                          {sibling.seriesLabel}: {sibling.title}
                        </span>
                      ) : (
                        <Link key={sibling.id} href={`/watch/${sibling.id}`}>
                          {sibling.seriesLabel}: {sibling.title}
                        </Link>
                      ),
                    )}
                  </nav>
                )}

                <div className="placement-actions">
                  <a className="placement-button placement-button--primary" href={SOCIAL_PROFILES.tiktok} target="_blank" rel="noopener">
                    Follow on TikTok
                  </a>
                  <a className="placement-button" href={SOCIAL_PROFILES.instagram} target="_blank" rel="noopener">
                    Instagram
                  </a>
                  <Link className="placement-button" href="/pray">
                    Pray with Foid Mommy
                  </Link>
                </div>
              </div>
            </div>

            {details && details.facts.length > 0 && (
              <section className="watch-section" aria-labelledby="watch-facts">
                <h2 id="watch-facts">true things in this episode</h2>
                <ul className="watch-facts">
                  {details.facts.map((fact) => (
                    <li key={fact}>{fact}</li>
                  ))}
                </ul>
              </section>
            )}

            {details && details.transcript.length > 0 && (
              <section className="watch-section" aria-labelledby="watch-transcript">
                <h2 id="watch-transcript">transcript</h2>
                <div className="watch-transcript">
                  {details.transcript.map((line, i) => (
                    <p key={i}>{line}</p>
                  ))}
                </div>
              </section>
            )}

            {details?.featuresRealBrands && (
              <p className="watch-note">
                independent fan fiction. not affiliated with or endorsed by any business shown.
              </p>
            )}

            {more.length > 0 && (
              <section className="placement-more" aria-labelledby="watch-more">
                <h2 id="watch-more">{video.kind === "episode" ? "More episodes" : "More films"}</h2>
                <ul className={`placement-grid watch-grid${video.kind === "episode" ? " watch-grid--portrait" : ""}`}>
                  {more.map((other) => (
                    <li key={other.id}>
                      <Link href={`/watch/${other.id}`} className="placement-card">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={other.thumbPath} alt="" loading="lazy" decoding="async" width={other.width} height={other.height} />
                        <span className="placement-card__title">{other.title}</span>
                        <span className="placement-card__meta">{other.seriesLabel ?? (other.durationSec ? clockDuration(other.durationSec) : "")}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
                <p className="placement-more__all">
                  <Link href="/watch">Every episode and film</Link>
                </p>
              </section>
            )}
          </div>
        </div>
      </article>
    </main>
  );
}
