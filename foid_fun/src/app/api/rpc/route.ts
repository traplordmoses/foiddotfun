// Proxy JSON-RPC calls from the client to the private Fluent RPC so the
// private URL is never inlined into the browser bundle or exposed to
// MetaMask / DevTools Network.
//
// The private URL must live in a non-`NEXT_PUBLIC_*` env var so Next.js
// does not inline it at build time. Priority: FLUENT_RPC_URL > FLUENT_RPC.
// (NEXT_PUBLIC_FLUENT_RPC kept as transitional fallback; remove from the
// production env once the new var is deployed.)

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const ALLOWED_METHOD_PREFIXES = ["eth_", "net_", "web3_"];
const MAX_BATCH_SIZE = 50;

function getPrivateRpcUrl(): string | null {
  const value =
    process.env.FLUENT_RPC_URL?.trim() ||
    process.env.FLUENT_RPC?.trim() ||
    process.env.NEXT_PUBLIC_FLUENT_RPC?.trim() ||
    process.env.NEXT_PUBLIC_RPC_URL?.trim() ||
    null;
  return value || null;
}

function isMethodAllowed(method: unknown): boolean {
  if (typeof method !== "string") return false;
  return ALLOWED_METHOD_PREFIXES.some((p) => method.startsWith(p));
}

function isSameOrigin(req: NextRequest): boolean {
  const host = req.headers.get("host");
  if (!host) return false;
  const origin = req.headers.get("origin");
  if (!origin) {
    // Some clients (non-CORS, same-origin fetch in certain browsers) omit
    // Origin. Fall back to referer host match.
    const referer = req.headers.get("referer");
    if (!referer) return true;
    try {
      return new URL(referer).host === host;
    } catch {
      return false;
    }
  }
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const rpcUrl = getPrivateRpcUrl();
  if (!rpcUrl) {
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        id: null,
        error: {
          code: -32603,
          message: "server RPC not configured (set FLUENT_RPC_URL)",
        },
      },
      { status: 500 }
    );
  }

  if (!isSameOrigin(req)) {
    return NextResponse.json(
      { error: "cross-origin requests not allowed" },
      { status: 403 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const calls = Array.isArray(body) ? body : [body];
  if (calls.length === 0 || calls.length > MAX_BATCH_SIZE) {
    return NextResponse.json(
      { error: `batch size must be 1..${MAX_BATCH_SIZE}` },
      { status: 400 }
    );
  }

  for (const call of calls) {
    if (!call || typeof call !== "object") {
      return NextResponse.json(
        { error: "invalid JSON-RPC call" },
        { status: 400 }
      );
    }
    const method = (call as { method?: unknown }).method;
    if (!isMethodAllowed(method)) {
      return NextResponse.json(
        { error: `method not allowed: ${String(method)}` },
        { status: 403 }
      );
    }
  }

  const upstream = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const text = await upstream.text();
  return new NextResponse(text, {
    status: upstream.status,
    headers: {
      "Content-Type":
        upstream.headers.get("content-type") ?? "application/json",
      "Cache-Control": "no-store",
    },
  });
}
