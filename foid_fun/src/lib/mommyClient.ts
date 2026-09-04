// src/lib/mommyClient.ts
// Browser-side helper for the Foid Mommy endpoint: fetches and caches the
// session token, retries once on a 401 (token expired or a redeploy rotated
// the secret) and never throws for token problems (the terminal falls back
// to its canned lines exactly as before).
"use client";

let cached: { token: string; expiresAt: number } | null = null;
let inflight: Promise<string | null> | null = null;

async function fetchToken(): Promise<string | null> {
  try {
    const res = await fetch("/api/foid-mommy/session", { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as { token?: string; expiresAt?: number };
    if (!data.token) return null;
    cached = { token: data.token, expiresAt: data.expiresAt ?? Date.now() + 30 * 60_000 };
    return data.token;
  } catch {
    return null;
  }
}

async function getToken(): Promise<string | null> {
  if (cached && cached.expiresAt - Date.now() > 60_000) return cached.token;
  if (!inflight) inflight = fetchToken().finally(() => { inflight = null; });
  return inflight;
}

export async function askFoidMommy(body: Record<string, unknown>): Promise<Response> {
  const send = async () => {
    const token = await getToken();
    return fetch("/api/foid-mommy", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { "x-foid-session": token } : {}),
      },
      body: JSON.stringify(body),
    });
  };
  let res = await send();
  if (res.status === 401) {
    cached = null;
    res = await send();
  }
  return res;
}
