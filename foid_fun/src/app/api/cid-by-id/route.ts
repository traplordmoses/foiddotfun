"use server";

import { NextResponse } from "next/server";
import { ProposalStore } from "@/lib/proposalStore";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "missing id" }, { status: 400 });
  }
  const stored = ProposalStore.get(id);
  return NextResponse.json({ cid: stored?.cid ?? "" });
}
