import { resolve } from "path";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { config } from "dotenv";

// Load .env.local for local dev — on Render, env vars are set directly
config({ path: resolve(__dirname, "..", "..", ".env.local") });

import { fetchEventsSince, getVoteTallies, type LoreboardEvents } from "./goldsky";
import { generateTweet, generateThought } from "./personality";
import { postTweet } from "./twitter";

// ── state ────────────────────────────────────────────────────────
// BOT_STATE_PATH overrides default location (useful for Render Disk)
const STATE_PATH = process.env.BOT_STATE_PATH || resolve(__dirname, "state.json");

type BotState = {
  lastCheckedTimestamp: number;
  tweetsToday: string[];      // ISO timestamps of tweets posted today
  postedEventIds: string[];   // event IDs we already tweeted about
};

function loadState(): { state: BotState; persisted: boolean } {
  try {
    if (!existsSync(STATE_PATH)) {
      return {
        state: { lastCheckedTimestamp: 0, tweetsToday: [], postedEventIds: [] },
        persisted: false,
      };
    }
    return { state: JSON.parse(readFileSync(STATE_PATH, "utf-8")), persisted: true };
  } catch {
    return {
      state: { lastCheckedTimestamp: 0, tweetsToday: [], postedEventIds: [] },
      persisted: false,
    };
  }
}

function saveState(state: BotState) {
  try {
    writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
  } catch (err) {
    console.warn("[foid-bot] could not write state:", (err as Error).message);
  }
}

// ── rate limiting ────────────────────────────────────────────────
const MAX_TWEETS_PER_DAY = 6;
const MIN_INTERVAL_MS = 2 * 60 * 60 * 1000; // 2 hours

function pruneOldTimestamps(timestamps: string[]): string[] {
  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  return timestamps.filter((t) => new Date(t).getTime() > dayAgo);
}

function canTweet(state: BotState): { ok: boolean; reason?: string } {
  const recent = pruneOldTimestamps(state.tweetsToday);
  if (recent.length >= MAX_TWEETS_PER_DAY) {
    return { ok: false, reason: `daily limit reached (${recent.length}/${MAX_TWEETS_PER_DAY})` };
  }
  if (recent.length > 0) {
    const last = new Date(recent[recent.length - 1]).getTime();
    const elapsed = Date.now() - last;
    if (elapsed < MIN_INTERVAL_MS) {
      const mins = Math.round((MIN_INTERVAL_MS - elapsed) / 60_000);
      return { ok: false, reason: `too soon, wait ${mins}m` };
    }
  }
  return { ok: true };
}

// ── event classification ─────────────────────────────────────────
type TweetableEvent = {
  id: string;
  type: "proposal" | "canonization" | "epoch_finalized" | "vote_surge";
  description: string;
};

function shortenAddress(addr: string): string {
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

async function classifyEvents(
  events: LoreboardEvents,
  postedIds: Set<string>
): Promise<TweetableEvent[]> {
  const tweetable: TweetableEvent[] = [];

  // new proposals
  for (const p of events.proposals) {
    const eventId = `proposal:${p.id}`;
    if (postedIds.has(eventId)) continue;
    const cells = Number(p.w) * Number(p.h);
    tweetable.push({
      id: eventId,
      type: "proposal",
      description: `new proposal on the loreboard. ${shortenAddress(p.bidder)} wants ${cells} cell${cells > 1 ? "s" : ""} at (${p.x},${p.y}) in epoch ${p.epoch}.`,
    });
  }

  // epoch finalizations
  for (const e of events.epochFinalizations) {
    const eventId = `epoch:${e.id}`;
    if (postedIds.has(eventId)) continue;
    tweetable.push({
      id: eventId,
      type: "epoch_finalized",
      description: `epoch ${e.epochId} just finalized on the loreboard. the votes are tallied. whatever survived is now permanent.`,
    });
  }

  // vote surges (aggregate by placement)
  const votesByPlacement = new Map<string, number>();
  for (const v of events.votes) {
    const count = (votesByPlacement.get(v.placementId) ?? 0) + 1;
    votesByPlacement.set(v.placementId, count);
  }

  // only tweet about placements with 5+ votes since last check
  const hotPlacements = [...votesByPlacement.entries()].filter(([, count]) => count >= 5);
  if (hotPlacements.length > 0) {
    const placementIds = hotPlacements.map(([id]) => id);
    const tallies = await getVoteTallies(placementIds);

    for (const [placementId, recentCount] of hotPlacements) {
      const eventId = `votes:${placementId}:${Math.floor(Date.now() / 3600000)}`;
      if (postedIds.has(eventId)) continue;
      const tally = tallies.get(placementId);
      const tallyStr = tally ? `${tally.yes} for, ${tally.no} against` : `${recentCount} new votes`;
      tweetable.push({
        id: eventId,
        type: "vote_surge",
        description: `a placement on the loreboard is getting attention. ${tallyStr}. people have opinions.`,
      });
    }
  }

  return tweetable;
}

// ── thought themes ──────────────────────────────────────────────
const THOUGHT_THEMES = [
  "board philosophy",
  "prayer ritual",
  "permanence",
  "consensus",
  "internet culture",
  "grid dynamics",
  "the tension between chaos and order",
];

function pickRandomTheme(): string {
  return THOUGHT_THEMES[Math.floor(Math.random() * THOUGHT_THEMES.length)];
}

// ── main ─────────────────────────────────────────────────────────
// On Render cron (no persistent state), use shorter lookback to avoid
// re-tweeting events from previous runs. 35 min covers the 30-min cron
// interval with buffer. Thought mode uses random probability instead of
// time-since-last-tweet (which we can't know without state).
const CRON_LOOKBACK_SEC = 35 * 60;         // 35 min
const DEFAULT_LOOKBACK_SEC = 6 * 3600;     // 6 hours
const THOUGHT_PROBABILITY = 0.08;          // ~3-4 thought tweets/day on 30-min cron

async function run() {
  console.log("[foid-bot] starting...");

  const { state, persisted } = loadState();
  state.tweetsToday = pruneOldTimestamps(state.tweetsToday);

  if (!persisted) {
    console.log("[foid-bot] no persistent state (ephemeral mode)");
  }

  // With persistent state, enforce rate limits. Without it, the cron
  // interval (30 min) is the only spacing — skip the canTweet check.
  if (persisted) {
    const { ok, reason } = canTweet(state);
    if (!ok) {
      console.log(`[foid-bot] skipping: ${reason}`);
      saveState(state);
      return;
    }
  }

  const lookback = persisted ? DEFAULT_LOOKBACK_SEC : CRON_LOOKBACK_SEC;
  const since = state.lastCheckedTimestamp || Math.floor(Date.now() / 1000) - lookback;
  console.log(`[foid-bot] fetching events since ${new Date(since * 1000).toISOString()}`);

  let events: LoreboardEvents;
  try {
    events = await fetchEventsSince(since);
  } catch (err) {
    console.error("[foid-bot] goldsky fetch failed:", err);
    return;
  }

  console.log(
    `[foid-bot] found: ${events.proposals.length} proposals, ${events.votes.length} votes, ${events.epochFinalizations.length} epoch finalizations`
  );

  const postedIds = new Set(state.postedEventIds);
  let tweetable = await classifyEvents(events, postedIds);

  // determine mode: event or thought
  let mode: "event" | "thought";
  let tweetText: string;
  let eventId: string;

  if (tweetable.length > 0) {
    // EVENT MODE — pick the most interesting event
    mode = "event";
    const priority: Record<string, number> = {
      canonization: 0,
      epoch_finalized: 1,
      vote_surge: 2,
      proposal: 3,
    };
    tweetable.sort((a, b) => (priority[a.type] ?? 99) - (priority[b.type] ?? 99));
    const event = tweetable[0];
    eventId = event.id;

    console.log(`[foid-bot] EVENT MODE: [${event.type}] ${event.description}`);

    try {
      tweetText = await generateTweet(event.description);
    } catch (err) {
      console.error("[foid-bot] openai generation failed:", err);
      return;
    }
  } else {
    // THOUGHT MODE
    if (!persisted) {
      // Ephemeral state (Render cron): use random probability
      // ~8% chance per 30-min run = ~3-4 thought tweets per day
      if (Math.random() > THOUGHT_PROBABILITY) {
        console.log("[foid-bot] no events, thought roll skipped (ephemeral mode)");
        state.lastCheckedTimestamp = Math.floor(Date.now() / 1000);
        saveState(state);
        return;
      }
    } else {
      // Persistent state: only if 4+ hours since last tweet
      const lastTweet = state.tweetsToday.length > 0
        ? new Date(state.tweetsToday[state.tweetsToday.length - 1]).getTime()
        : 0;
      const hoursSinceLast = (Date.now() - lastTweet) / 3600000;

      if (hoursSinceLast < 4) {
        console.log("[foid-bot] nothing tweetworthy, staying quiet");
        state.lastCheckedTimestamp = Math.floor(Date.now() / 1000);
        saveState(state);
        return;
      }
    }

    mode = "thought";
    const theme = pickRandomTheme();
    eventId = `thought:${Date.now()}`;

    console.log(`[foid-bot] THOUGHT MODE: theme="${theme}"`);

    try {
      tweetText = await generateThought(theme);
    } catch (err) {
      console.error("[foid-bot] openai generation failed:", err);
      return;
    }
  }

  console.log(`[foid-bot] generated tweet [${mode}] (${tweetText.length} chars): ${tweetText}`);

  if (tweetText.length > 280) {
    console.warn("[foid-bot] tweet too long, truncating");
    tweetText = tweetText.slice(0, 277) + "...";
  }

  // post
  try {
    const tweetId = await postTweet(tweetText);
    console.log(`[foid-bot] posted tweet: ${tweetId}`);

    state.tweetsToday.push(new Date().toISOString());
    state.postedEventIds.push(eventId);
    // keep postedEventIds bounded
    if (state.postedEventIds.length > 500) {
      state.postedEventIds = state.postedEventIds.slice(-200);
    }
  } catch (err) {
    console.error("[foid-bot] tweet failed:", err);
  }

  state.lastCheckedTimestamp = Math.floor(Date.now() / 1000);
  saveState(state);
  console.log("[foid-bot] done");
}

run().catch((err) => {
  console.error("[foid-bot] fatal:", err);
  process.exit(1);
});
