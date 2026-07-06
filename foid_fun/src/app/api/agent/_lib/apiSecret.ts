// src/app/api/agent/_lib/apiSecret.ts
// Fail-closed shared-secret gate for the agent relayer routes.
//
// The /api/agent/* routes spend a shared relayer's gas (AGENT_RELAYER_
// PRIVATE_KEY) and, for /pray, burn an OpenAI completion. The per-wallet
// signature + rate limits prove a caller controls THEIR wallet, but wallets
// are free to mint — so a public relayer is Sybil-drainable. This gate locks
// the routes to a trusted caller (the internal bot) that holds AGENT_API_SECRET.
//
// FAIL CLOSED: if AGENT_API_SECRET is unset, the routes are DISABLED (503).
// This is deliberate — an unconfigured relayer endpoint should be off, not
// open. To enable: set AGENT_API_SECRET in the server env and have the bot
// send `Authorization: Bearer <AGENT_API_SECRET>`.
//
// (Founder follow-up: if these routes are ever meant to serve end users
// directly — gasless UX where a user signs and the relayer pays — replace
// this shared secret with a real per-user quota/allowlist. Until then,
// bot-only is the safe posture.)
import { NextResponse } from "next/server";

export function requireAgentSecret(req: Request): Response | null {
  const secret = process.env.AGENT_API_SECRET;
  if (!secret) {
    return NextResponse.json(
      { success: false, error: "agent relay disabled — AGENT_API_SECRET not configured" },
      { status: 503 },
    );
  }
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json(
      { success: false, error: "unauthorized" },
      { status: 401 },
    );
  }
  return null; // authorized
}
