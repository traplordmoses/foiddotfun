-- Server-side tables that used to live in the app's SQLite file (audit S4).
-- Render's disk is ephemeral unless a persistent disk is attached, so X
-- pairings and per-wallet rate limits reset on every deploy. The API routes
-- now prefer these Supabase tables (service-role key) and fall back to
-- SQLite only when SUPABASE_SERVICE_ROLE_KEY is unset (local dev).
--
-- Run in: Supabase Dashboard > SQL Editor.

CREATE TABLE IF NOT EXISTS public.x_pairings (
  wallet     text PRIMARY KEY,
  handle     text NOT NULL,
  signature  text NOT NULL,
  paired_at  timestamptz NOT NULL DEFAULT now(),
  active     boolean NOT NULL DEFAULT true
);
ALTER TABLE public.x_pairings ENABLE ROW LEVEL SECURITY;
-- Public read of active handles (the board and the narrator show them).
DROP POLICY IF EXISTS "Anyone can read active pairings" ON public.x_pairings;
CREATE POLICY "Anyone can read active pairings"
  ON public.x_pairings FOR SELECT USING (active = true);
-- No anon writes: service_role bypasses RLS.

CREATE TABLE IF NOT EXISTS public.rate_limits (
  id            bigserial PRIMARY KEY,
  wallet_action text NOT NULL,
  ts            timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rate_limits_key_ts ON public.rate_limits (wallet_action, ts DESC);
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
-- No policies: server-only.

-- Housekeeping: keep the table small. Requires pg_cron (Database > Extensions).
-- SELECT cron.schedule('prune-rate-limits', '17 * * * *',
--   $$DELETE FROM public.rate_limits WHERE ts < now() - interval '2 days'$$);
