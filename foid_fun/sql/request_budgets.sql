-- Apply BEFORE deploying the API safeguards. Service role only.
CREATE TABLE IF NOT EXISTS public.request_budgets (
  key text PRIMARY KEY,
  count bigint NOT NULL,
  expires_at timestamptz NOT NULL
);
ALTER TABLE public.request_budgets ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS request_budgets_expiry ON public.request_budgets(expires_at);
CREATE OR REPLACE FUNCTION public.consume_request_budget(
  budget_key text, max_count integer, window_ms integer, amount integer DEFAULT 1
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE accepted boolean;
BEGIN
  IF max_count < 1 OR window_ms < 1 OR amount < 1 OR amount > max_count OR length(budget_key) > 160 THEN
    RETURN false;
  END IF;
  INSERT INTO request_budgets AS b(key, count, expires_at)
  VALUES (budget_key, amount, clock_timestamp() + window_ms * interval '1 millisecond')
  ON CONFLICT (key) DO UPDATE SET
    count = CASE WHEN b.expires_at <= clock_timestamp() THEN amount ELSE b.count + amount END,
    expires_at = CASE WHEN b.expires_at <= clock_timestamp() THEN clock_timestamp() + window_ms * interval '1 millisecond' ELSE b.expires_at END
  WHERE b.expires_at <= clock_timestamp() OR b.count + amount <= max_count
  RETURNING true INTO accepted;
  -- Bound retained expired identities without depending on a separate scheduler.
  DELETE FROM request_budgets WHERE key IN (
    SELECT key FROM request_budgets WHERE expires_at < clock_timestamp() - interval '1 day' LIMIT 100
  );
  RETURN coalesce(accepted, false);
END $$;
REVOKE ALL ON FUNCTION public.consume_request_budget(text, integer, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_request_budget(text, integer, integer, integer) TO service_role;
