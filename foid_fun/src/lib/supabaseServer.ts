// Server-side Supabase helper for API routes.
// Uses fetch directly — no "use client" dependency.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

type BoardEventInsert = {
  event_type: "proposal_created" | "vote_cast" | "proposal_finalized";
  proposal_id?: number | null;
  data?: Record<string, unknown>;
};

/**
 * Insert a board event from a server-side API route.
 * Non-blocking, fire-and-forget. Failures are logged silently.
 */
export function emitBoardEvent(event: BoardEventInsert): void {
  if (!SUPABASE_URL || !SUPABASE_KEY) return;

  fetch(`${SUPABASE_URL}/rest/v1/board_events`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      Prefer: "return=minimal",
    },
    body: JSON.stringify(event),
  }).catch((err) => {
    console.warn("[supabaseServer] emitBoardEvent failed:", err);
  });
}
