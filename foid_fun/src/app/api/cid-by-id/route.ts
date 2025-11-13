import { NextRequest, NextResponse } from "next/server";
import { ProposalStore } from "@/lib/proposalStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const id = new URL(req.url).searchParams.get("id") || "";
  if (!id) {
    return NextResponse.json({ error: "missing id" }, { status: 400 });
  }
  const rec = ProposalStore.get(id);
  return NextResponse.json({ cid: rec?.cid ?? null });
}
