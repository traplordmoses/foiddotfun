// src/app/api/propose/link/route.ts
//
// Links a local proposal to its on-chain Swipe proposalId.
// Called by the frontend after Swipe.proposeLoreboard() tx is confirmed.
// The on-chain ID is needed for vote settlement via Swipe.finalize().

import { NextRequest, NextResponse } from "next/server";
import { linkOnChainId } from "../../_store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { localId, onChainId } = body;

    if (!localId || typeof localId !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid localId (string)" },
        { status: 400 }
      );
    }

    if (typeof onChainId !== "number" || onChainId < 0) {
      return NextResponse.json(
        { error: "Missing or invalid onChainId (non-negative integer)" },
        { status: 400 }
      );
    }

    linkOnChainId(localId, onChainId);

    console.log(`[propose/link] linked local=${localId} → chain=${onChainId}`);

    return NextResponse.json({ ok: true, localId, onChainId });
  } catch (error) {
    console.error("[propose/link] error:", error);
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
