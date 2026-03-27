// Server-side Supabase helper for API routes.
// Uses fetch directly — no "use client" dependency.
// Includes retry with exponential backoff.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 500;

type BoardEventInsert = {
  event_type: "proposal_created" | "vote_cast" | "proposal_finalized";
  proposal_id?: number | null;
  data?: Record<string, unknown>;
};

async function postEvent(event: BoardEventInsert, attempt = 0): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_KEY) return;

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/board_events`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        Prefer: "return=minimal",
      },
      body: JSON.stringify(event),
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok && attempt < MAX_RETRIES) {
      const delay = BASE_DELAY_MS * Math.pow(2, attempt);
      await new Promise((r) => setTimeout(r, delay));
      return postEvent(event, attempt + 1);
    }
  } catch (err) {
    if (attempt < MAX_RETRIES) {
      const delay = BASE_DELAY_MS * Math.pow(2, attempt);
      await new Promise((r) => setTimeout(r, delay));
      return postEvent(event, attempt + 1);
    }
    console.warn("[supabaseServer] emitBoardEvent failed after retries:", err);
  }
}

/**
 * Insert a board event from a server-side API route.
 * Fire-and-forget with retry (up to 3 attempts, exponential backoff).
 */
export function emitBoardEvent(event: BoardEventInsert): void {
  // Don't await — fire-and-forget so API response isn't delayed
  postEvent(event).catch(() => {});
}
