-- Supabase pg_cron: delete board_messages older than 24 hours
-- Run this in the Supabase SQL editor to set up the cron job.
--
-- Prerequisites: pg_cron extension must be enabled in Supabase dashboard
-- (Database > Extensions > search "pg_cron" > Enable)

-- Schedule hourly cleanup
SELECT cron.schedule(
  'cleanup-old-board-messages',
  '0 * * * *',
  $$DELETE FROM public.board_messages WHERE created_at < now() - interval '24 hours'$$
);

-- Verify the job was created:
-- SELECT * FROM cron.job;

-- To remove the job:
-- SELECT cron.unschedule('cleanup-old-board-messages');

-- ============================================================================
-- REQUIRED: Realtime + RLS setup for board_messages
-- ============================================================================

-- 1. Enable Realtime on board_messages (also do this in Dashboard > Database > Replication)
ALTER PUBLICATION supabase_realtime ADD TABLE board_messages;

-- 2. Enable RLS
ALTER TABLE public.board_messages ENABLE ROW LEVEL SECURITY;

-- 3. Allow anyone to read chat messages
CREATE POLICY "Anyone can read board_messages"
  ON public.board_messages
  FOR SELECT
  USING (true);

-- 4. NO insert policy for anon — deliberately. Writes go through
--    /api/chat/send using the service_role key (which bypasses RLS), so the
--    route's signature check + rate limit can't be skipped by posting to the
--    REST API directly. See lock_board_messages_rls.sql for the migration
--    that removes the old permissive INSERT policy from live projects.
