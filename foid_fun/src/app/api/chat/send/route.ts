import { NextResponse } from "next/server";
import { verifyMessage } from "viem";
import {
  buildChatSignMessage,
  CHAT_SIG_MAX_AGE_MS,
  CHAT_SIG_MAX_FUTURE_SKEW_MS,
} from "@/lib/chatAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
// Writes go through the service-role key: RLS blocks anon INSERT on
// board_messages (sql/lock_board_messages_rls.sql), so posting straight to
// Supabase REST with the public anon key no longer bypasses this route.
// Anon fallback keeps chat alive on deployments where the service key env
// isn't set yet — which only works until the RLS lockdown SQL has run.
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SUPABASE_KEY = SERVICE_KEY || ANON_KEY;

if (!SERVICE_KEY && ANON_KEY) {
  console.warn(
    "[api/chat/send] SUPABASE_SERVICE_ROLE_KEY not set — falling back to the anon key. " +
      "Inserts will fail once RLS locks anon INSERT on board_messages."
  );
}

const MAX_MESSAGE_LENGTH = 280;
// Cheap guard before signature work; the real limit is enforced post-sanitize.
const MAX_RAW_MESSAGE_LENGTH = 2000;
const WALLET_RE = /^0x[a-fA-F0-9]{40}$/;
const SIGNATURE_RE = /^0x[a-fA-F0-9]+$/;
const HTML_TAG_RE = /<[^>]*>/g;

// Shared-state rate limit: count this wallet's rows in board_messages over
// the window. Every send IS a row, so the table doubles as the counter —
// shared across serverless instances and deploy-proof, unlike the SQLite
// rate_limits table this replaced.
const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;

const MAX_RETRIES = 2;
const BASE_DELAY_MS = 500;

type ChatSendReq = {
  wallet: string;
  message: string;
  timestamp: number;
  signature: string;
};

function supabaseHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    apikey: SUPABASE_KEY as string,
    Authorization: `Bearer ${SUPABASE_KEY}`,
  };
}

/**
 * Messages this wallet sent inside the rate-limit window. Returns null when
 * the count can't be determined — the caller fails open, since a Supabase
 * outage would make the subsequent insert fail anyway.
 */
async function countRecentMessages(wallet: string): Promise<number | null> {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;

  const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
  // ilike with no wildcard = case-insensitive equality; wallet is
  // regex-validated hex so the pattern can't contain PostgREST syntax.
  const params = new URLSearchParams({
    select: "id",
    type: "eq.chat",
    wallet_address: `ilike.${wallet}`,
    created_at: `gte.${since}`,
  });

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/board_messages?${params}`, {
      method: "HEAD",
      headers: { ...supabaseHeaders(), Prefer: "count=exact" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    // Content-Range is "0-18/19" (or "*/0" when empty) — total after the slash.
    const total = res.headers.get("content-range")?.split("/")[1];
    const count = total ? Number(total) : NaN;
    return Number.isFinite(count) ? count : null;
  } catch (err) {
    console.warn("[api/chat/send] rate-limit count failed:", err);
    return null;
  }
}

async function insertToSupabase(
  wallet: string,
  message: string,
  attempt = 0
): Promise<Record<string, unknown> | null> {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/board_messages`, {
      method: "POST",
      headers: {
        ...supabaseHeaders(),
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        wallet_address: wallet,
        message,
        type: "chat",
      }),
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      if (attempt < MAX_RETRIES) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt);
        await new Promise((r) => setTimeout(r, delay));
        return insertToSupabase(wallet, message, attempt + 1);
      }
      console.error("[api/chat/send] Supabase insert failed:", res.status, await res.text().catch(() => ""));
      return null;
    }

    const rows = await res.json();
    return Array.isArray(rows) ? rows[0] ?? null : null;
  } catch (err) {
    if (attempt < MAX_RETRIES) {
      const delay = BASE_DELAY_MS * Math.pow(2, attempt);
      await new Promise((r) => setTimeout(r, delay));
      return insertToSupabase(wallet, message, attempt + 1);
    }
    console.error("[api/chat/send] Supabase insert failed after retries:", err);
    return null;
  }
}

export async function POST(req: Request) {
  let body: ChatSendReq;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  const { wallet, message, timestamp, signature } = body;

  if (!wallet || !WALLET_RE.test(wallet)) {
    return NextResponse.json({ error: "invalid wallet address" }, { status: 400 });
  }

  if (!message || typeof message !== "string") {
    return NextResponse.json({ error: "missing message" }, { status: 400 });
  }

  if (message.length > MAX_RAW_MESSAGE_LENGTH) {
    return NextResponse.json({ error: "message too long" }, { status: 400 });
  }

  if (!signature || typeof signature !== "string" || !SIGNATURE_RE.test(signature)) {
    return NextResponse.json({ error: "missing signature" }, { status: 401 });
  }

  // Freshness window — stale or pre-dated signatures can't be replayed.
  const ts = Number(timestamp);
  if (!Number.isInteger(ts)) {
    return NextResponse.json({ error: "missing timestamp" }, { status: 400 });
  }
  if (Date.now() - ts > CHAT_SIG_MAX_AGE_MS) {
    return NextResponse.json({ error: "signature expired" }, { status: 401 });
  }
  if (ts - Date.now() > CHAT_SIG_MAX_FUTURE_SKEW_MS) {
    return NextResponse.json({ error: "timestamp in the future" }, { status: 401 });
  }

  // The wallet must have signed this exact message text — verified against
  // the raw string as sent (the client signs what it sends), so nobody can
  // post as an address they don't control.
  let sigValid = false;
  try {
    sigValid = await verifyMessage({
      address: wallet as `0x${string}`,
      message: buildChatSignMessage(wallet, message, ts),
      signature: signature as `0x${string}`,
    });
  } catch {
    sigValid = false;
  }
  if (!sigValid) {
    return NextResponse.json({ error: "signature does not match wallet" }, { status: 401 });
  }

  // Sanitize: strip HTML tags
  const sanitized = message.trim().replace(HTML_TAG_RE, "");

  if (sanitized.length === 0) {
    return NextResponse.json({ error: "empty message" }, { status: 400 });
  }

  if (sanitized.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json(
      { error: `message too long (max ${MAX_MESSAGE_LENGTH} chars)` },
      { status: 400 }
    );
  }

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return NextResponse.json({ error: "chat service unavailable" }, { status: 503 });
  }

  const recent = await countRecentMessages(wallet);
  if (recent !== null && recent >= RATE_LIMIT_MAX) {
    return NextResponse.json(
      {
        error: `Rate limit: max ${RATE_LIMIT_MAX} messages per ${RATE_LIMIT_WINDOW_MS / 60_000}m. Try again later.`,
      },
      { status: 429 }
    );
  }

  try {
    const inserted = await insertToSupabase(wallet, sanitized);

    if (!inserted) {
      return NextResponse.json({ error: "failed to save message" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, message: inserted });
  } catch (error) {
    console.error("[api/chat/send]", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
