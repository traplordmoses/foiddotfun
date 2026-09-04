-- MiFOID mint reservations (audit U6). The MIFOID.EXE page advertised a
-- tiered mint for a contract that is not deployed; this table lets the page
-- capture intent instead of leading nowhere.
--
-- Writes go through /api/mifoid/reserve with the service-role key after an
-- EIP-191 signature check; anon has no access at all (the count is served by
-- the API, not by PostgREST).
--
-- Run in: Supabase Dashboard > SQL Editor.

CREATE TABLE IF NOT EXISTS public.mifoid_reservations (
  wallet      text PRIMARY KEY,
  handle      text,
  signature   text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.mifoid_reservations ENABLE ROW LEVEL SECURITY;
-- No policies: anon and authenticated roles are denied; service_role bypasses RLS.

-- Verify (should fail with 42501):
-- curl -X POST "$SUPABASE_URL/rest/v1/mifoid_reservations" \
--   -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY" \
--   -H "Content-Type: application/json" \
--   -d '{"wallet":"0x0000000000000000000000000000000000000001","signature":"0x"}'
