// src/lib/supabaseRest.ts
// Minimal server-side PostgREST helper (audit S4/G6/U6). Uses the service
// role key, so it must only be imported from API routes and scripts. Returns
// null when Supabase is not configured so callers can fall back.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export function supabaseServerConfigured(): boolean {
  return Boolean(SUPABASE_URL && SERVICE_KEY);
}

export async function supabaseRest(
  path: string,
  init: RequestInit & { prefer?: string } = {},
): Promise<Response | null> {
  if (!SUPABASE_URL || !SERVICE_KEY) return null;
  const headers: Record<string, string> = {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    "Content-Type": "application/json",
    ...(init.prefer ? { Prefer: init.prefer } : {}),
    ...((init.headers as Record<string, string>) ?? {}),
  };
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers,
    signal: init.signal ?? AbortSignal.timeout(8000),
  });
}
