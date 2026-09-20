-- Service-only durable replacement for legacy SQLite proposal metadata.
CREATE TABLE IF NOT EXISTS public.proposal_metadata_v2 (
  id text PRIMARY KEY,
  data jsonb NOT NULL,
  cid text GENERATED ALWAYS AS (data->>'cid') STORED,
  CHECK (jsonb_typeof(data) = 'object'),
  CHECK (data->>'id' = id)
);
CREATE INDEX IF NOT EXISTS proposal_metadata_v2_cid ON public.proposal_metadata_v2(cid);
ALTER TABLE public.proposal_metadata_v2 ENABLE ROW LEVEL SECURITY;
