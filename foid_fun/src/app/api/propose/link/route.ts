// src/app/api/propose/link/route.ts
//
// Links a local proposal record to its onchain Loreboard proposalId.
// Called by the frontend after Loreboard.propose() is confirmed.
//
// Trust model (audit S2): this used to accept any (localId, onChainId) pair
// from anyone, so a caller could relink ids and broadcast fake realtime
// events to every open client. The link is now accepted only when the
// onchain proposal actually carries the CID being linked, read straight
// from the contract. No signature is needed, so there is no extra wallet
// prompt for the honest path.
import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, http } from "viem";
import { linkOnChainId } from "../../_store";
import { emitBoardEvent } from "@/lib/supabaseServer";
import { safeErrorMessage } from "@/lib/apiError";
import { LOREBOARD_ABI } from "@/lib/contracts/abis/loreboard";
import { CONTRACTS, RPC_URL, CHAIN_CONFIG } from "@/lib/contracts/addresses";
import { cleanIpfsPath } from "@/lib/ipfsUrl";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_ID = 10_000_000;

async function onChainCid(onChainId: number): Promise<string | null> {
  const address = CONTRACTS.SWIPE as `0x${string}` | undefined;
  if (!address) return null;
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
    const raw = (await client.readContract({
      address,
      abi: LOREBOARD_ABI,
      functionName: "getProposal",
      args: [BigInt(onChainId)],
    })) as unknown;
    if (Array.isArray(raw)) return typeof raw[2] === "string" ? raw[2] : null;
    const rec = raw as { ipfsCid?: string };
    return typeof rec?.ipfsCid === "string" ? rec.ipfsCid : null;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { localId, onChainId } = body;

    if (!localId || typeof localId !== "string" || localId.length > 128) {
      return NextResponse.json(
        { error: "Missing or invalid localId (string)" },
        { status: 400 }
      );
    }

    if (!Number.isInteger(onChainId) || onChainId < 0 || onChainId > MAX_ID) {
      return NextResponse.json(
        { error: "Missing or invalid onChainId (non-negative integer)" },
        { status: 400 }
      );
    }

    // The local id IS the proposal's CID (see useSwipePropose). Only link
    // when the chain agrees.
    const wanted = cleanIpfsPath(localId);
    const actual = await onChainCid(onChainId);
    if (!wanted || !actual || cleanIpfsPath(actual) !== wanted) {
      return NextResponse.json(
        { error: "onchain proposal does not match localId" },
        { status: 409 }
      );
    }

    linkOnChainId(localId, onChainId);

    // Broadcast real-time event (fire-and-forget)
    emitBoardEvent({ event_type: "proposal_created", proposal_id: onChainId, data: { localId } });

    return NextResponse.json({ ok: true, localId, onChainId });
  } catch (error) {
    console.error("[propose/link] error:", error);
    return NextResponse.json(
      { error: safeErrorMessage(error, "link failed") },
      { status: 500 }
    );
  }
}
