// /src/app/api/mempool/route.ts
import { NextResponse } from "next/server";
import { listProposals } from "../_store";
import { currentEpoch } from "@/lib/epoch";

export const runtime = "nodejs";

const BASE = BigInt(process.env.NEXT_PUBLIC_BASE_FEE_PER_CELL_WEI ?? "0");

function bn(x: string) {
  try {
    return BigInt(x);
  } catch {
    return 0n;
  }
}

export async function GET(req: Request) {
  // For backwards-compat with your right-rail, we present "proposals still in voting"
  // as "mempool intents". We fabricate feePerCellWei/tipPerCellWei so
  // feePerCellWei + tipPerCellWei === bidPerCellWei.
  const epoch = currentEpoch();

  const live = listProposals().filter((p) => p.status === "proposed");

  const intents = live
    .map((p) => {
      // Put the full bid in feePerCellWei and 0 in tipPerCellWei to preserve UI math.
      return {
        id: p.id,
        owner: p.owner,
        cid: p.cid,
        rect: p.rect,
        cells: p.cells,
        feePerCellWei: p.bidPerCellWei,
        tipPerCellWei: "0",
        name: p.name,
        mime: p.mime,
        timeMs: p.createdAt,
      };
    })
    .sort((a, b) => {
      const aFee = bn(a.feePerCellWei) + bn(a.tipPerCellWei);
      const bFee = bn(b.feePerCellWei) + bn(b.tipPerCellWei);
      if (aFee !== bFee) return aFee > bFee ? -1 : 1;
      return a.timeMs - b.timeMs; // earlier first
    });

  const pendingCells = intents.reduce((n, it) => n + (it.cells || 0), 0);
  return NextResponse.json({
    epoch,
    count: intents.length,
    pendingCells,
    baseFeePerCellWei: BASE.toString(),
    intents,
  });
}
