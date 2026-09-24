// MiFOID episodes: data integrity, and the publish schedule that keeps the
// site from running ahead of the social drops.
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { EPISODES, episodeCardPath, episodePosterPath, episodeThumbPath, isEpisodePublished, publishedEpisodes } from "@/content/episodes";
import { EPISODE_DETAILS } from "@/content/episodeDetails";
import { isWatchableId, publishedMediaLibrary } from "@/config/mediaLibrary";
import { getWatchVideo, isoDuration, listWatchVideos } from "@/lib/server/videos";

const BEFORE_LAUNCH = Date.parse("2026-09-25T00:00:00Z");
const AFTER_ALL = Date.parse("2026-10-20T00:00:00Z");

describe("episode data", () => {
  it("has unique, url-safe ids and valid publish times", () => {
    const ids = EPISODES.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const e of EPISODES) {
      expect(e.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(Number.isNaN(Date.parse(e.publishAt))).toBe(false);
      expect(e.publishAt.endsWith("Z")).toBe(true);
    }
  });

  it("gives every episode a description, a transcript, a poster, a thumbnail and a share card", () => {
    for (const e of EPISODES) {
      const details = EPISODE_DETAILS[e.id];
      expect(details, e.id).toBeDefined();
      expect(details.description.length, e.id).toBeGreaterThan(40);
      expect(details.transcript.length, e.id).toBeGreaterThan(3);
      for (const asset of [episodePosterPath(e.id), episodeThumbPath(e.id), episodeCardPath(e.id)]) {
        expect(fs.existsSync(path.join(process.cwd(), "public", asset)), asset).toBe(true);
      }
    }
  });

  it("formats structured-data durations", () => {
    expect(isoDuration(68.3)).toBe("PT1M8S");
    expect(isoDuration(608.8)).toBe("PT10M9S");
    expect(isoDuration(35.7)).toBe("PT36S");
  });
});

describe("publish schedule", () => {
  it("hides every episode before its first post", () => {
    expect(publishedEpisodes(BEFORE_LAUNCH)).toEqual([]);
    expect(listWatchVideos(BEFORE_LAUNCH).some((v) => v.kind === "episode")).toBe(false);
    expect(getWatchVideo("the-devils-day-off", BEFORE_LAUNCH)).toBeNull();
    const library = publishedMediaLibrary(BEFORE_LAUNCH).map((item) => item.id);
    expect(library).not.toContain("the-devils-day-off");
  });

  it("shows an episode from its publish minute, newest first", () => {
    const devil = EPISODES.find((e) => e.id === "the-devils-day-off")!;
    const at = Date.parse(devil.publishAt);
    expect(isEpisodePublished(devil, at - 1)).toBe(false);
    expect(isEpisodePublished(devil, at)).toBe(true);
    const all = publishedEpisodes(AFTER_ALL);
    expect(all).toHaveLength(EPISODES.length);
    expect(all[0].id).toBe("the-cartiers-remain-in-dubai");
    expect(getWatchVideo("the-lawyer", AFTER_ALL)?.seriesLabel).toBe("slushie saga, ep 2");
  });

  it("keeps the archive films watchable regardless of the date", () => {
    const films = listWatchVideos(BEFORE_LAUNCH).filter((v) => v.kind === "film");
    expect(films.length).toBeGreaterThan(5);
    expect(films.every((f) => f.posterPath.endsWith("-poster.jpg"))).toBe(true);
  });

  it("lets the middleware gate agree with the watch pages", () => {
    const at = Date.parse("2026-09-29T00:00:00Z");
    const watchable = new Set(listWatchVideos(at).map((v) => v.id));
    for (const e of EPISODES) expect(isWatchableId(e.id, at), e.id).toBe(watchable.has(e.id));
    expect(isWatchableId("the-devils-day-off", at)).toBe(true);
    expect(isWatchableId("the-lawyer", at)).toBe(false);
    expect(isWatchableId("backrooms-vhs", BEFORE_LAUNCH)).toBe(true);
    expect(isWatchableId("not-a-real-episode", AFTER_ALL)).toBe(false);
    expect(isWatchableId("", AFTER_ALL)).toBe(false);
  });
});
