# foid_bot — ARCHIVED

This automated X bot is **archived** as of 2026-05-15. The source still lives
here so it can be revived later, but the Render cron job has been removed.

## What it did

- Polled the loreboard Goldsky subgraph every 30 minutes for new proposals,
  vote surges, and (intended) epoch finalizations / canonizations.
- Generated tweets in an "oracle of the grid" voice via OpenAI gpt-4o-mini
  (see `src/personality.ts`).
- Posted to X via `twitter-api-v2` (`src/twitter.ts`) and cross-posted to
  Moltbook (`src/moltbook.ts`).

## Why archived

We're focusing on user-initiated sharing for now (see
`src/lib/shareTemplates.ts` + `PlacementCelebration.tsx` +
`NotificationInbox.tsx`). The automated voice can come back once the manual
flow is dialed in.

## Known issues to fix before reviving

1. **`epochFinalizations` is referenced but never fetched.**
   `src/index.ts:108` iterates `events.epochFinalizations`, but
   `src/goldsky.ts` only returns `proposals` and `votes`. At runtime this
   throws `TypeError: events.epochFinalizations is not iterable`. Either
   add the field to the GraphQL query and the `LoreboardEvents` type, or
   drop that loop.

2. **Canonization events are never produced.** The priority dict in
   `src/index.ts:223` lists `canonization` as the highest-priority event,
   but `classifyEvents` never emits one. The subgraph data is there (the
   `Proposal` type has `finalized` and `approved` fields) — query for
   finalized+approved proposals to drive canonization tweets.

3. **State persistence on Render is ephemeral.** Free-tier cron has no
   persistent disk, so `state.json` writes are lost between runs and the
   `postedEventIds` dedup is best-effort. Either mount a Render Disk or
   move state to Supabase before re-enabling rate limits.

## To revive

1. Fix the issues above (or accept them).
2. Add the cron service back to `render.yaml` (see git history for the
   exact block — search for `foid-x-bot`).
3. Re-set the env vars in the Render dashboard: `X_API_KEY`,
   `X_API_SECRET`, `X_ACCESS_TOKEN`, `X_ACCESS_SECRET`, `OPENAI_API_KEY`,
   `GOLDSKY_LOREBOARD_URL`, optionally `MOLTBOOK_API_KEY` and
   `BOT_STATE_PATH`.
4. Test locally first: `cd foid_fun && npx tsx foid_bot/src/index.ts`.

## Manual test

`foid_bot/test_post.ts` posts a hardcoded tweet ("the loreboard is
watching.") — useful for verifying credentials before re-deploying.
