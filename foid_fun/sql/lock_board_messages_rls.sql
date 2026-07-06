-- Lock down board_messages: anon can READ, only the server can WRITE.
--
-- Why: the old INSERT policy was WITH CHECK (true), so anyone holding the
-- public anon key (i.e. anyone who opens DevTools) could POST rows straight
-- to the Supabase REST API — bypassing the /api/chat/send route's signature
-- check, rate limit, and HTML sanitization entirely.
--
-- After this runs, inserts only work through the service_role key, which
-- bypasses RLS by design and lives server-side only (SUPABASE_SERVICE_ROLE_KEY
-- env var — never NEXT_PUBLIC_*).
--
-- DEPLOY ORDER (do not reorder — chat breaks otherwise):
--   1. Set SUPABASE_SERVICE_ROLE_KEY in the deployment env
--      (Supabase Dashboard > Settings > API > service_role secret).
--   2. Deploy the app (route prefers the service key, falls back to anon).
--   3. Run this file in the Supabase SQL editor.
--
-- Run in: Supabase Dashboard > SQL Editor.

-- Make sure RLS is on (idempotent).
ALTER TABLE public.board_messages ENABLE ROW LEVEL SECURITY;

-- Drop the open INSERT policy (name from the original setup script).
DROP POLICY IF EXISTS "Authenticated inserts to board_messages" ON public.board_messages;

-- Keep public reads — the chat UI loads history and subscribes to realtime
-- INSERTs with the anon key.
DROP POLICY IF EXISTS "Anyone can read board_messages" ON public.board_messages;
CREATE POLICY "Anyone can read board_messages"
  ON public.board_messages
  FOR SELECT
  USING (true);

-- No INSERT / UPDATE / DELETE policies exist for anon after this: with RLS
-- enabled, no policy = denied. service_role bypasses RLS, so the API route
-- (and the pg_cron cleanup job, which runs as postgres) keep working.

-- Verify: this should list ONLY the SELECT policy.
-- SELECT policyname, cmd FROM pg_policies WHERE tablename = 'board_messages';
--
-- Verify from outside (should fail with 42501 "row-level security policy"):
-- curl -X POST "$SUPABASE_URL/rest/v1/board_messages" \
--   -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY" \
--   -H "Content-Type: application/json" \
--   -d '{"wallet_address":"0x0000000000000000000000000000000000000001","message":"rls test","type":"chat"}'
