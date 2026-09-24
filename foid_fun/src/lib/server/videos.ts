// src/lib/server/videos.ts
// One model for every video with a /watch page: the scheduled MiFOID
// episodes (src/content/episodes.ts + episodeDetails.ts) and the archive
// films already in FILES.EXE (src/config/mediaLibrary.ts). Used by the
// /watch pages and /sitemap-videos.xml. Server-only: it pulls in the
// episode transcripts.
import { isWatchFilm, MEDIA_LIBRARY } from "@/config/mediaLibrary";
import {
  EPISODES,
  episodeCardPath,
  episodePosterPath,
  episodeThumbPath,
  episodeVideoPath,
  isEpisodePublished,
  seriesLabel,
} from "@/content/episodes";
import { EPISODE_DETAILS, type EpisodeDetails } from "@/content/episodeDetails";
import { mediaUrl, originFallback } from "@/lib/mediaBase";
import { SITE_URL } from "@/lib/site";

export type WatchVideo = {
  id: string;
  kind: "episode" | "film";
  title: string;
  /** One-line hook (episodes) or the archive blurb (films). */
  logline: string;
  description: string;
  seriesId?: string;
  seriesName?: string;
  seriesNumber?: number;
  seriesLabel?: string;
  /** ISO datetime: first public post for episodes, date added for films. */
  publishedAt: string;
  durationSec?: number;
  width: number;
  height: number;
  /** Playable source: the R2 URL in production, /media/... locally. */
  videoSrc: string;
  /** The same file on the app origin (committed under public/media). The
   *  players' fallback, and the URL structured data and sitemaps cite,
   *  since it exists from the moment a deploy lands. */
  videoPath: string;
  posterPath: string;
  thumbPath: string;
  /** The link-preview image: a 1200x630 card for 9:16 episodes, the 16:9
   *  poster for films. */
  share: { path: string; width: number; height: number };
  tags: string[];
  details?: EpisodeDetails;
};

function episodeVideos(now: number): WatchVideo[] {
  return EPISODES.filter((episode) => isEpisodePublished(episode, now))
    .sort((a, b) => Date.parse(b.publishAt) - Date.parse(a.publishAt))
    .map((episode) => {
      const details = EPISODE_DETAILS[episode.id];
      return {
        id: episode.id,
        kind: "episode" as const,
        title: episode.title,
        logline: episode.logline,
        description: details?.description ?? episode.logline,
        seriesId: episode.series?.id,
        seriesName: episode.series?.name,
        seriesNumber: episode.series?.number,
        seriesLabel: episode.series ? seriesLabel(episode.series) : undefined,
        publishedAt: episode.publishAt,
        durationSec: episode.durationSec,
        width: episode.width,
        height: episode.height,
        videoSrc: mediaUrl(episodeVideoPath(episode.id)),
        videoPath: episodeVideoPath(episode.id),
        posterPath: episodePosterPath(episode.id),
        thumbPath: episodeThumbPath(episode.id),
        share: { path: episodeCardPath(episode.id), width: 1200, height: 630 },
        tags: episode.tags,
        details,
      };
    });
}

function filmVideos(): WatchVideo[] {
  return MEDIA_LIBRARY.filter(isWatchFilm).map((item) => ({
    id: item.id,
    kind: "film" as const,
    title: item.title,
    logline: item.description ?? item.title,
    description: item.description ?? "",
    publishedAt: `${item.addedAt}T00:00:00Z`,
    durationSec: item.durationSec,
    width: item.width ?? 1280,
    height: item.height ?? 720,
    videoSrc: item.src,
    videoPath: originFallback(item.src) ?? item.src,
    posterPath: item.poster as string,
    thumbPath: item.poster as string,
    share: { path: item.poster as string, width: item.width ?? 1280, height: item.height ?? 720 },
    tags: ["mifoid", "lowpoly", "ai animation"],
  }));
}

/** Everything watchable right now: episodes newest first, then films. */
export function listWatchVideos(now: number = Date.now()): WatchVideo[] {
  return [...episodeVideos(now), ...filmVideos()];
}

export function getWatchVideo(id: string, now: number = Date.now()): WatchVideo | null {
  return listWatchVideos(now).find((video) => video.id === id) ?? null;
}

export function absoluteUrl(pathOrUrl: string): string {
  return /^https?:\/\//i.test(pathOrUrl) ? pathOrUrl : `${SITE_URL}${pathOrUrl}`;
}

/** ISO 8601 duration for structured data: 68.3 -> "PT1M8S". */
export function isoDuration(seconds: number): string {
  const total = Math.max(1, Math.round(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `PT${h ? `${h}H` : ""}${m ? `${m}M` : ""}${s ? `${s}S` : ""}` || "PT0S";
}

/** "1:08" / "10:09". Truncates, like the browser's own player clock. */
export function clockDuration(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const m = Math.floor(total / 60);
  const s = String(total % 60).padStart(2, "0");
  return `${m}:${s}`;
}
