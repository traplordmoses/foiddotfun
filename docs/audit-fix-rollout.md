# FOID audit fixes: review and rollout

These changes address the frontend and backend audit against `cbae20829b7be6e052ee9c5ba91a02de94f2c0ec`. Smart contracts and their deployed addresses are unchanged. Apply the database prerequisites below before deploying the application.

## User-visible changes

- Entry loads independently of the wallet/application provider tree, navigates after the entry cookie is written, tolerates unavailable audio, and offers a direct recovery link. The desktop opens with useful Board, Prayer, and About actions instead of an empty welcome surface.
- The mobile prayer composer occupies a scrollable area above the dock. It follows the visual viewport when a keyboard opens; short screens scroll the supporting material so the input remains reachable.
- AI processing is disclosed before sending a message. Local feeling memory requires an explicit opt-in. Earlier automatically granted consent is not inherited. Opting out clears that device's journal.
- Production error messages are visible. Voting waits for a successful receipt before showing confirmation. A rejected or partially successful batch keeps remaining choices. Pending transaction hashes survive a reload and have a read-only status check; they are not automatically resubmitted.
- Board and Vote retain recent valid data during refresh failures, with a visible stale state. Vote history has a cursor and older-page control. Owner views follow owner-specific history rather than silently missing older proposals after global pagination.
- Closed vote cards separate unique voters from weighted support and explain quorum, overlap, approval, or pending finalization. Mobile board items open on tap, have keyboard controls and names, and offer a list alternative. Desktop-to-phone navigation preserves the focused app. About accepts direct document links.

## Backend changes

- RPC: explicit wallet-compatible allowlist; 256 KiB input, 20 calls per batch, 4 MiB response, 12-second upstream deadline, 16 concurrent requests per process, global 6,000 and per-identity 600 calls/minute. Log ranges are limited to 100,000 blocks, including requests using `latest`. Forwarded IP identity is a coarse additional bucket, not authentication.
- Shared request budgets use an atomic, service-role-only Supabase function. Production fails closed when these budgets are unavailable. Local development uses a bounded in-memory substitute.
- AI: validated input fields, one JSON completion for the second-turn reflection and prayer, 20-second provider timeout, no SDK retries, bounded browser requests, stable session signing in production, shared session/global budgets. Current global generation cap is 120 calls/minute and per-identity cap is 10. These caps protect cost; they are not bot authentication.
- IPFS: restrict responses to recognized PNG/JPEG/GIF/WebP/AVIF bytes with a sandboxed response policy (HTML and SVG are rejected); enforce 10 MiB while streaming, keep the 30-second deadline through body consumption, coalesce matching requests, cap concurrent misses at eight, normalize transform dimensions, and retain the existing 64 MiB cache budget. Manifest gateway requests have a shared 12-second fetch budget and bounded bodies. Goldsky also uses bounded body consumption.
- Proposals: block-height and indexing-error checks, complete active data plus paginated closed data, bounded multicall fallback, indexed page-specific metadata reads, and recent stale snapshots during outages. The tolerated indexer lag is 64 blocks. Cold RPC fallback is capped at 1,000 proposal reads or 2,000 placements; larger datasets require a working indexer rather than an unlimited request-time scan. Finalized fallback records are periodically refreshed.
- Proposal metadata uses shared Supabase storage in production; SQLite is a development fallback. Other existing Supabase migrations are preserved. This does not mean every legacy SQLite table has been migrated.
- Liveness uses V8's actual heap limit, RSS and external memory. `/api/ready` checks RPC, required storage tables, and prayer configuration; it is a dependency check, not a full wallet/AI end-to-end test.
- Finalization cron now fails on HTTP errors, failed proposal results, and manifest errors. Incomplete proposal/weight reads fail before submitting transactions instead of silently skipping records or inventing zero weights.

## Required before deployment

1. Confirm the production chain configuration, deployment commit, Render plan and memory limit, existing `DB_PATH`, and which legacy tables still receive writes. Do not infer those settings from the public blueprint. Keep the current production deployment until the candidate has passed staging.
2. Apply `foid_fun/sql/request_budgets.sql` and `foid_fun/sql/proposal_metadata.sql` in the intended Supabase project. Keep the service-role key server-only. Verify the function is present and executable by `service_role`; do not add public RLS policies.
3. If the live SQLite file contains proposal metadata, quiesce its writers, take a backup, migrate and verify it before changing the running application. The migration script is dry-run by default, refuses a missing source, refuses to overwrite a backup, preserves existing destination rows, and compares every migrated record. Run from `foid_fun` with the deployment environment already configured:

   ```sh
   pnpm exec tsx scripts/migrate-proposal-metadata.ts
   pnpm exec tsx scripts/migrate-proposal-metadata.ts --apply --backup=/absolute/new-backup.sqlite
   ```

   Set `DB_PATH` to the existing database. Keep the backup off the ephemeral application filesystem and demonstrate restoration in staging. If the source table is empty, record that evidence instead of assuming there is nothing to migrate.
4. Verify `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, a stable `MOMMY_SESSION_SECRET` (or the existing CRON secret fallback), `OPENAI_API_KEY`, the chosen model, RPC, and Goldsky configuration. Set `INSTANCE_MEMORY_LIMIT_MB` to the actual container limit if RSS warnings should use it. Retain the existing finalizer operator secret, RPC and `FOID_APP_URL` configuration.
5. Build under the repository's declared Node 20 runtime using the lockfile. Run typecheck, lint, unit/coverage, and browser tests. New browser cases cover cold entry with unavailable audio, both phone sizes, default-off memory consent, and visual viewport contraction. The CI workflow now includes these and the existing core-navigation tests.
6. In staging, exercise the actual wallet connector: rejection, successful vote receipt, a reverted vote, a receipt timeout, partial batch, account switch, reload with a pending receipt, and read-only status recovery. No real wallet or production transaction was used during local validation.
7. Check `/api/ready`, both proposal endpoints, IPFS, a full two-turn prayer, and owner history. Restart staging and confirm metadata survives. Measure real-phone keyboard behavior on iOS Safari and Android Chrome. Confirm AI retention settings match the published wording.
8. Deploy only after review. Apply additive database changes first, then application code and the cron command. Configure actual monitoring for cron failures, last successful completion, oldest overdue proposal, RPC/indexer errors and field Web Vitals. Those production dashboards and alerts were not accessible here. Verify operator concurrency/nonce handling before enabling multiple finalizers.

## Rollback and limits

Revert application code to the recorded base commit if needed; keep the additive Supabase tables and SQLite backup. Do not blindly reverse migrations or discard new metadata written after rollout. Reconcile data before restoring an older writer. Backups and production restoration have not been proven by this local review.

The existing Lighthouse thresholds remain unchanged until measured against the deployed candidate. Route-level Web Vitals now include viewport and focused-app context. Font preload/preconnect work is reduced and entry providers are isolated, but build size is not a measured Core Web Vitals improvement. A real field-data comparison is still required. The existing image-tag and hook-dependency lint warnings need separate targeted review; changing all of them mechanically would risk unrelated behavior.
