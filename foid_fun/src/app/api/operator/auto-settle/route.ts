// src/app/api/operator/auto-settle/route.ts
//
// Cron-triggered route that checks for proposals whose voting window has
// expired and triggers the finalize pipeline. Designed to be called every
// 5 minutes via Vercel Cron or an external scheduler.
//
// Auth: CRON_SECRET header (Vercel cron) or x-operator-key header.

import { NextRequest, NextResponse } from "next/server";
import { getUnfinalizedExpiredProposals } from "../../_store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  // ── Auth: fail-closed. At least one secret must be set AND match. ──
  const cronSecret = process.env.CRON_SECRET;
  const operatorKey = process.env.OPERATOR_API_KEY;
  const authHeader = req.headers.get("authorization");
  const operatorHeader = req.headers.get("x-operator-key");

  const cronAuthorized = Boolean(cronSecret) && authHeader === `Bearer ${cronSecret}`;
  const operatorAuthorized = Boolean(operatorKey) && operatorHeader === operatorKey;

  if (!cronAuthorized && !operatorAuthorized) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // ── Check for expired proposals ──
  const expired = getUnfinalizedExpiredProposals();

  if (expired.length === 0) {
    return NextResponse.json({
      ok: true,
      message: "No proposals ready to settle",
      checked: new Date().toISOString(),
    });
  }

  console.log(`[auto-settle] Found ${expired.length} expired proposals, triggering finalize...`);

  // ── Trigger finalize by calling the operator/finalize endpoint internally ──
  try {
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "http://localhost:3000";

    const finalizeUrl = `${baseUrl}/api/operator/finalize`;

    const response = await fetch(finalizeUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(operatorKey ? { "x-operator-key": operatorKey } : {}),
      },
      body: JSON.stringify({}),
    });

    const result = await response.json();

    console.log("[auto-settle] finalize result:", result);

    return NextResponse.json({
      ok: true,
      expiredCount: expired.length,
      expiredIds: expired.map((p) => p.id),
      finalizeStatus: response.status,
      finalizeResult: result,
      settledAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[auto-settle] finalize call failed:", error);
    return NextResponse.json(
      {
        ok: false,
        error: "Finalize call failed",
        details: String(error),
        expiredCount: expired.length,
      },
      { status: 500 }
    );
  }
}

// Also support POST for manual triggers
export async function POST(req: NextRequest) {
  return GET(req);
}
