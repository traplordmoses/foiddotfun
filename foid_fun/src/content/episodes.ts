// src/content/episodes.ts
// MiFOID episodes: the narrated AI-animated shorts from the launch schedule
// (mifoid_studio/out/schedule/launch_schedule.md). Each one appears on the
// site at the moment it first posts on TikTok, Instagram or X (`publishAt`),
// so the site never runs ahead of the drop.
//
// Light fields only: this file ships to the browser (FILES.EXE lists the
// episodes). Descriptions, facts and transcripts live in episodeDetails.ts,
// which only server pages import.
//
// Media: web encodes live in public/media/episodes/ (720x1280 H.264,
// +faststart), committed like the rest of public/media. Players load them
// from R2 (NEXT_PUBLIC_MEDIA_BASE) and fall back to the app origin until
// scripts/sync-media-r2.sh has copied a new file up. Posters (-poster.jpg),
// thumbnails (-thumb.jpg) and share cards (-card.jpg) always serve from the
// app origin. The CDN
// caches /media for a year, so a re-encode needs a new file name.

export type EpisodeSeries = {
  id: string;
  /** Lowercase, as it appears in the captions ("london", "slushie saga"). */
  name: string;
  number: number;
};

export type EpisodeSummary = {
  /** URL slug: /watch/<id>. Also the media file stem. */
  id: string;
  title: string;
  series?: EpisodeSeries;
  /** First public post, ISO UTC. Hidden on the site until then. */
  publishAt: string;
  /** One-line hook, from the post caption. */
  logline: string;
  durationSec: number;
  width: number;
  height: number;
  tags: string[];
};

// Launch slots are 17:00 New York (21:00 UTC in EDT), London episodes
// 14:00 New York (18:00 UTC).
export const EPISODES: EpisodeSummary[] = [
  {
    id: "the-devils-day-off",
    title: "the devil's day off",
    series: { id: "devil", name: "the devil", number: 1 },
    publishAt: "2026-09-26T21:00:00Z",
    logline: "the little devil took a day off. they were at every table.",
    durationSec: 68.3,
    width: 720,
    height: 1280,
    tags: ["mifoid", "manitoba", "winnipeg", "honey dill", "lowpoly"],
  },
  {
    id: "the-sauce-under-london",
    title: "the sauce under london",
    series: { id: "london", name: "london", number: 1 },
    publishAt: "2026-09-28T18:00:00Z",
    logline: "she ordered extra hot at nando's. she saw all of london.",
    durationSec: 106.7,
    width: 720,
    height: 1280,
    tags: ["mifoid", "london", "nando's", "the tube", "lowpoly"],
  },
  {
    id: "beans-on-toast",
    title: "beans on toast",
    series: { id: "london", name: "london", number: 2 },
    publishAt: "2026-09-30T18:00:00Z",
    logline: "the little devil clocked the american in 0.5 seconds.",
    durationSec: 85.7,
    width: 720,
    height: 1280,
    tags: ["mifoid", "london", "greggs", "beans on toast", "full english"],
  },
  {
    id: "the-machine-says-no",
    title: "the machine says no",
    series: { id: "slushie", name: "slushie saga", number: 1 },
    publishAt: "2026-10-02T21:00:00Z",
    logline: "the slushie machine said no. she drank it anyway.",
    durationSec: 35.7,
    width: 720,
    height: 1280,
    tags: ["mifoid", "slushie", "brainrot", "liminal space", "lowpoly"],
  },
  {
    id: "the-lawyer",
    title: "the lawyer",
    series: { id: "slushie", name: "slushie saga", number: 2 },
    publishAt: "2026-10-04T21:00:00Z",
    logline: "she brought a lawyer. the slushie machine still said no.",
    durationSec: 51.5,
    width: 720,
    height: 1280,
    tags: ["mifoid", "slushie", "brainrot", "liminal space", "lowpoly"],
  },
  {
    id: "the-gelato-misunderstanding",
    title: "the gelato misunderstanding",
    series: { id: "buenos-aires", name: "buenos aires", number: 1 },
    publishAt: "2026-10-06T21:00:00Z",
    logline: "he asked her out. she thought he meant gelato.",
    durationSec: 95.2,
    width: 720,
    height: 1280,
    tags: ["mifoid", "buenos aires", "gelato", "dulce de leche", "lowpoly"],
  },
  {
    // The calendar has this on Fri 9 Oct (X), the caption notes say Wed 7
    // Oct; the later date keeps the site from posting it first.
    id: "the-cartiers-remain-in-dubai",
    title: "the cartiers remain in dubai",
    publishAt: "2026-10-09T21:00:00Z",
    logline: "the smoke opened a door. my cartiers are still in dubai.",
    durationSec: 62.6,
    width: 720,
    height: 1280,
    tags: ["mifoid", "dubai", "lowpoly", "ai animation"],
  },
];

/** Server-only escape hatch for local QA of unreleased episodes. Never set
 *  it in production. */
function previewAll(): boolean {
  return typeof window === "undefined" && process.env.FOID_PREVIEW_UNPUBLISHED === "1";
}

export function isEpisodePublished(episode: Pick<EpisodeSummary, "publishAt">, now: number = Date.now()): boolean {
  return previewAll() || Date.parse(episode.publishAt) <= now;
}

export function publishedEpisodes(now: number = Date.now()): EpisodeSummary[] {
  return EPISODES.filter((e) => isEpisodePublished(e, now)).sort(
    (a, b) => Date.parse(b.publishAt) - Date.parse(a.publishAt),
  );
}

export function episodeVideoPath(id: string): string {
  return `/media/episodes/${id}.mp4`;
}

export function episodePosterPath(id: string): string {
  return `/media/episodes/${id}-poster.jpg`;
}

export function episodeThumbPath(id: string): string {
  return `/media/episodes/${id}-thumb.jpg`;
}

/** 1200x630 share card: the 9:16 poster centered on a blurred copy of
 *  itself, so X's landscape crop never cuts the frame. */
export function episodeCardPath(id: string): string {
  return `/media/episodes/${id}-card.jpg`;
}

/** "london, part 1" / "slushie saga, ep 2" / "the devil, ep 1". */
export function seriesLabel(series: EpisodeSeries): string {
  return series.id === "london" ? `${series.name}, part ${series.number}` : `${series.name}, ep ${series.number}`;
}
