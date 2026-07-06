-- Lock down board_events: anon can READ, only the server can WRITE.
--
-- Why: board_events (proposal_created / vote_cast / proposal_finalized) drives
-- the board's realtime activity feed. The old policy let anyone holding the
-- public anon key POST rows straight to the Supabase REST API — so activity
-- could be spoofed (fake "proposal finalized" events, etc). Low severity
-- (ephemeral cosmetic feed, no funds/chat/on-chain impact) but still worth
-- closing before public launch.
--
-- After this runs, inserts only work through the service_role key, which
-- src/lib/supabaseServer.ts now prefers (SUPABASE_SERVICE_ROLE_KEY, server-only)
-- and which bypasses RLS by design. The client-side insertBoardEvent helper in
-- supabase.ts is dead (zero callers) — if ever revived it must go through a
-- server route, not the browser.
--
-- DEPLOY ORDER (do not reorder — the activity feed's writes break otherwise):
--   1. SUPABASE_SERVICE_ROLE_KEY is already set (chat uses it). Confirm it's
--      present in the deployment env (Supabase Dashboard > Settings > API).
--   2. Deploy the app (supabaseServer.ts now prefers the service key).
--   3. Run this file in the Supabase SQL editor.
--
-- Run in: Supabase Dashboard > SQL Editor.

-- Make sure RLS is on (idempotent).
ALTER TABLE public.board_events ENABLE ROW LEVEL SECURITY;

-- Drop any open INSERT policy. Names vary by original setup — the two below
-- cover the common cases; add your project's actual policy name if different
-- (list them first with the SELECT at the bottom).
DROP POLICY IF EXISTS "Authenticated inserts to board_events" ON public.board_events;
DROP POLICY IF EXISTS "Allow public event inserts" ON public.board_events;
DROP POLICY IF EXISTS "Anyone can insert board_events" ON public.board_events;

-- Keep public reads — the activity feed loads history and subscribes to
-- realtime INSERTs with the anon key.
DROP POLICY IF EXISTS "Anyone can read board_events" ON public.board_events;
CREATE POLICY "Anyone can read board_events"
  ON public.board_events
  FOR SELECT
  USING (true);

-- No INSERT / UPDATE / DELETE policies for anon after this: with RLS enabled,
-- no policy = denied. service_role bypasses RLS, so the server emitBoardEvent
-- path keeps working.

-- Verify: this should list ONLY the SELECT policy.
-- SELECT policyname, cmd FROM pg_policies WHERE tablename = 'board_events';
--
-- Verify from outside (should fail with 42501 "row-level security policy"):
-- curl -X POST "$SUPABASE_URL/rest/v1/board_events" \
--   -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY" \
--   -H "Content-Type: application/json" \
--   -d '{"event_type":"proposal_finalized","proposal_id":0}'
