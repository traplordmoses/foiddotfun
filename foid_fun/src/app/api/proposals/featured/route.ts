// /src/app/api/proposals/featured/route.ts
// Returns the top 1 active voting proposal (not finalized, within the last
// 24h by createdAt) ordered by forCount desc. Used by the board's
// "PROPOSAL OF THE DAY" ribbon.
//
// Implementation note: we call the existing Loreboard multicall the same
// way /api/swipe/proposals does, rather than HTTP-proxying that route, so
// this endpoint is usable from edge runtime environments in the future.

import { NextResponse } from "next/server";
import { createPublicClient, http } from "viem";
import { LOREBOARD_ABI } from "@/lib/contracts/abis/loreboard";
import { CONTRACTS, RPC_URL, CHAIN_CONFIG } from "@/lib/contracts/addresses";
import { cidToHttpUrl } from "@/lib/ipfsUrl";
import { contractToWorldRect } from "@/lib/boardSpace";

export const runtime = "nodejs";
export const revalidate = 300; // 5min edge cache

type ProposalTuple = [
  bigint, string, string, bigint, bigint, boolean, boolean, bigint, number, number, number, number
];

export async function GET() {
  const contractAddress = CONTRACTS.SWIPE as `0x${string}`;
  if (!contractAddress) {
    return NextResponse.json({ proposal: null, reason: "not-configured" });
  }

  const client = createPublicClient({
    chain: {
      id: CHAIN_CONFIG.id,
      name: CHAIN_CONFIG.name,
      nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
      rpcUrls: { default: { http: [RPC_URL] } },
    },
    transport: http(RPC_URL),
  });

  try {
    const count = (await client.readContract({
      address: contractAddress,
      abi: LOREBOARD_ABI,
      functionName: "proposalCount",
    })) as bigint;

    const n = Number(count);
    if (n === 0) return NextResponse.json({ proposal: null, reason: "empty" });

    // Fan-out proposals + vote tallies in parallel. For Loreboards under
    // ~500 proposals this is fine; revisit with multicall if it grows.
    const ids = Array.from({ length: n }, (_, i) => i);
    const BATCH = 12;
    const cutoff = Math.floor(Date.now() / 1000) - 24 * 60 * 60;

    type Row = {
      id: number;
      proposer: string;
      ipfsCid: string;
      createdAt: number;
      finalized: boolean;
      forCount: number;
      gridX: number; gridY: number; gridW: number; gridH: number;
    };
    const rows: Row[] = [];

    for (let i = 0; i < ids.length; i += BATCH) {
      const chunk = ids.slice(i, i + BATCH);
      const results = await Promise.allSettled(
        chunk.map(async (id) => {
          const [p, forRaw] = await Promise.all([
            client.readContract({
              address: contractAddress,
              abi: LOREBOARD_ABI,
              functionName: "getProposal",
              args: [BigInt(id)],
            }) as Promise<unknown>,
            client.readContract({
              address: contractAddress,
              abi: LOREBOARD_ABI,
              functionName: "voteWeightFor",
              args: [BigInt(id)],
            }) as Promise<bigint>,
          ]);
          const t = (Array.isArray(p) ? p : (p as unknown)) as ProposalTuple;
          return {
            id,
            proposer: t[1] as string,
            ipfsCid: t[2] as string,
            createdAt: Number(t[3]),
            finalized: t[5] as boolean,
            forCount: Number(forRaw),
            gridX: Number(t[8] ?? 0),
            gridY: Number(t[9] ?? 0),
            gridW: Number(t[10] ?? 0),
            gridH: Number(t[11] ?? 0),
          } satisfies Row;
        })
      );
      for (const r of results) {
        if (r.status === "fulfilled") rows.push(r.value);
      }
    }

    // Active = still in voting & created in the last 24h.
    const active = rows.filter((r) => !r.finalized && r.createdAt >= cutoff);
    active.sort((a, b) => b.forCount - a.forCount);
    const pick = active[0] ?? null;

    if (!pick) return NextResponse.json({ proposal: null, reason: "no-active" });

    // Contract grid coords are offset-shifted; normalize to world space so
    // the client can hand the rect straight to zoomToRect() without having
    // to know about the offset.
    const worldRect = contractToWorldRect({
      x: pick.gridX,
      y: pick.gridY,
      w: pick.gridW,
      h: pick.gridH,
    });

    return NextResponse.json(
      {
        proposal: {
          id: pick.id,
          proposer: pick.proposer,
          ipfsCid: pick.ipfsCid,
          imageUrl: pick.ipfsCid ? cidToHttpUrl(pick.ipfsCid) : null,
          createdAt: pick.createdAt,
          forCount: pick.forCount,
          rect: worldRect,
        },
      },
      { headers: { "Cache-Control": "public, max-age=60, s-maxage=300" } }
    );
  } catch (error) {
    console.error("[api/proposals/featured] Error:", error);
    return NextResponse.json({ proposal: null, error: String(error) }, { status: 500 });
  }
}
