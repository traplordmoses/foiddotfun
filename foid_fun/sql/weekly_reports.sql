-- Weekly Foid Mommy reports (audit G6). The narrator cron POSTs rendered
-- HTML to /api/report with CRON_SECRET; /report serves the latest one.
-- Run in: Supabase Dashboard > SQL Editor.
CREATE TABLE IF NOT EXISTS public.weekly_reports (
  id           bigserial PRIMARY KEY,
  period_from  timestamptz NOT NULL,
  period_to    timestamptz NOT NULL,
  html         text NOT NULL,
  narrative    text,
  created_at   timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.weekly_reports ENABLE ROW LEVEL SECURITY;
-- No policies: written and read through the service role only.
