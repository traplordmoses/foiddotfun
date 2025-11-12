// /src/app/api/finalize/route.ts
import { NextRequest, NextResponse } from "next/server";
import { currentEpoch } from "@/lib/epoch";
import {
  getStore,
  listAccepted,
  listProposals,
  replaceAccepted,
  setLatestManifest,
  type Placement,
  type Proposal,
  gcProposals,
} from "../_store";
import { hasOverlap } from "@/lib/grid";
import { uploadJSON } from "@/lib/ipfs";
import { ProposalStore } from "@/lib/proposalStore";

function canDisplaceAccepted(a: Proposal, accepted: Placement[]) {
  // NOTE: second arg must be Rect[]
  const overlapping = accepted.filter((pl) => hasOverlap(a.rect, [pl.rect]));
  if (!overlapping.length) return true;
  const aBid = BigInt(a.bidPerCellWei);
  return overlapping.every((pl) => aBid > BigInt(pl.bidPerCellWei));
}

export async function POST(req: NextRequest) {
  const epoch = currentEpoch();
  const S = getStore();

  const url = new URL(req.url);
  const force = url.searchParams.get("force") === "1";

  // close proposals whose window ended (or all, if force)
  const candidates = listProposals().filter(
    (p) => p.status === "proposed" && (p.voteEndsAtEpoch <= epoch || force)
  );

  // pass/fail by threshold + quorum (or bypass in force)
  const passed = candidates.filter((p) => {
    if (force) return true;
    const total = p.yes + p.no;
    if (total < S.quorum) return false;
    const pctYes = total === 0 ? 0 : p.yes / total;
    return pctYes >= S.yesThreshold;
  });

  // sort winners: higher bid first, then earlier submission
  const sorted = passed.slice().sort((a, b) => {
    const bidDelta = BigInt(b.bidPerCellWei) - BigInt(a.bidPerCellWei);
    if (bidDelta !== 0n) return bidDelta > 0n ? 1 : -1;
    if (a.epochSubmitted !== b.epochSubmitted) {
      return a.epochSubmitted - b.epochSubmitted;
    }
    return a.id.localeCompare(b.id);
  });

  let nextAccepted = listAccepted();
  const winners: Proposal[] = [];

  for (const proposal of sorted) {
    if (!canDisplaceAccepted(proposal, nextAccepted)) {
      proposal.status = "rejected";
      continue;
    }
    // NOTE: second arg must be Rect[]
    if (winners.some((w) => hasOverlap(proposal.rect, [w.rect]))) {
      proposal.status = "rejected";
      continue;
    }

    const aBid = BigInt(proposal.bidPerCellWei);
    // evict weaker overlappers from the current accepted set
    nextAccepted = nextAccepted.filter((pl) => {
      // NOTE: second arg must be Rect[]
      if (!hasOverlap(pl.rect, [proposal.rect])) return true;
      return BigInt(pl.bidPerCellWei) > aBid;
    });

    winners.push(proposal);
    proposal.status = "accepted";
  }

  // remaining become rejected
  for (const candidate of candidates) {
    if (candidate.status === "proposed") {
      candidate.status = "rejected";
    }
  }

  const added: Placement[] = winners.map((w) => {
    const stored = ProposalStore.get(w.id);
    return {
      id: w.id,
      owner: w.owner || stored?.owner || "",
      cid: w.cid || stored?.cid || "",
      name: w.name,
      mime: w.mime,
      rect: w.rect,
      cells: w.cells,
      bidPerCellWei: w.bidPerCellWei,
      width: w.width,
      height: w.height,
    };
  });

  nextAccepted = [...nextAccepted, ...added];

  const manifest = {
    epoch,
    finalizedAt: Date.now(),
    placements: nextAccepted,
  };

  let cid: string | null = null;
  try {
    cid = await uploadJSON(`mifoid-epoch-${epoch}.manifest.json`, manifest);
  } catch {
    cid = null;
  }

  replaceAccepted(nextAccepted);
  setLatestManifest(manifest, cid);
  gcProposals();

  return NextResponse.json({
    epoch,
    manifestCID: cid,
    accepted: nextAccepted.length,
    winners: winners.map((w) => w.id),
  });
}
