import { NextResponse } from "next/server";
import { checkRateLimit, recordAction } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const MAX_MESSAGE_LENGTH = 280;
const WALLET_RE = /^0x[a-fA-F0-9]{40}$/;
const HTML_TAG_RE = /<[^>]*>/g;

const MAX_RETRIES = 2;
const BASE_DELAY_MS = 500;

type ChatSendReq = {
  wallet: string;
  message: string;
};

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
        "Content-Type": "application/json",
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
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

  const { wallet, message } = body;

  if (!wallet || !WALLET_RE.test(wallet)) {
    return NextResponse.json({ error: "invalid wallet address" }, { status: 400 });
  }

  if (!message || typeof message !== "string") {
    return NextResponse.json({ error: "missing message" }, { status: 400 });
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

  // Rate limit
  const rl = checkRateLimit(wallet, "chat-send");
  if (!rl.ok) {
    return NextResponse.json({ error: rl.error }, { status: 429 });
  }

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return NextResponse.json({ error: "chat service unavailable" }, { status: 503 });
  }

  try {
    const inserted = await insertToSupabase(wallet, sanitized);

    if (!inserted) {
      return NextResponse.json({ error: "failed to save message" }, { status: 500 });
    }

    recordAction(wallet, "chat-send");

    return NextResponse.json({ ok: true, message: inserted });
  } catch (error) {
    console.error("[api/chat/send]", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
