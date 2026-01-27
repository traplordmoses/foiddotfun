import { NextRequest, NextResponse } from "next/server";
import { Buffer } from "buffer";
import bs58 from "bs58";

const VOTING_URL = process.env.GOLDSKY_VOTING_URL ||
  "https://api.goldsky.com/api/public/project_cmkwd7dgh0bq501z7fog65iag/subgraphs/foid-loreboard-fluent-testnet/1.0.0/gn";
const BOARD_URL = process.env.GOLDSKY_BOARD_URL ||
  "https://api.goldsky.com/api/public/project_cmkwd7dgh0bq501z7fog65iag/subgraphs/foid-loreboard-fluent-testnet/1.0.1/gn";
const IPFS_GATEWAY = process.env.NEXT_PUBLIC_IPFS_GATEWAY ||
  process.env.NEXT_PUBLIC_IPFS_GATEWAY_BASE ||
  "https://ipfs.io/ipfs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

// Convert bytes32 hash to IPFS CID (base58)
function bytes32ToCID(bytes32: string): string | null {
  try {
    if (!bytes32) return null;
    const hex = bytes32.startsWith("0x") ? bytes32.slice(2) : bytes32;
    const multihash = "1220" + hex;
    const bytes = Buffer.from(multihash, "hex");
    return bs58.encode(bytes);
  } catch (error) {
    console.error("[bytes32ToCID] Error:", error);
    return null;
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const owner = searchParams.get("owner");

  console.log("[api/proposals] === Using Goldsky ===");
  console.log("[api/proposals] Owner filter:", owner);

  try {
    // Query 1: Get placement proposals from Board subgraph
    const boardQuery = `
      query GetPlacements${owner ? '($owner: Bytes!)' : ''} {
        placementProposeds(
          first: 1000
          orderBy: id
          orderDirection: desc
          ${owner ? 'where: { bidder: $owner }' : ''}
        ) {
          id
          bidder
          epoch
          x
          y
          w
          h
          bidPerCellWei
          cidHash
        }
      }
    `;

    const boardVars = owner ? { owner: owner.toLowerCase() } : {};

    const boardResponse = await fetch(BOARD_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: boardQuery, variables: boardVars }),
    });

    const boardData = await boardResponse.json();

    if (boardData.errors) {
      console.error("[api/proposals] Board errors:", boardData.errors);
      return NextResponse.json({
        proposals: [],
        error: boardData.errors
      }, { status: 500 });
    }

    // Query 2: Get pending placements and votes from Voting subgraph
    const votingQuery = `
      query GetVoting {
        pendingPlacementRegistereds(first: 1000) {
          id
          epochId
          placementId
          registeredAt
          voteEndsAt
        }
        voteCasts(first: 1000) {
          id
          epochId
          placementId
          voter
          support
          weight
        }
      }
    `;

    const votingResponse = await fetch(VOTING_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: votingQuery }),
    });

    const votingData = await votingResponse.json();

    if (votingData.errors) {
      console.error("[api/proposals] Voting errors:", votingData.errors);
    }

    const placements = boardData.data?.placementProposeds || [];
    const pending = votingData.data?.pendingPlacementRegistereds || [];
    const votes = votingData.data?.voteCasts || [];

    console.log("[api/proposals] ✅ Found placements:", placements.length);
    console.log("[api/proposals] ✅ Found pending:", pending.length);
    console.log("[api/proposals] ✅ Found votes:", votes.length);

    // Transform to expected format
    const proposals = placements.map((p: any) => {
      // Use id as the placementId
      const cid = bytes32ToCID(p.cidHash);
      const normalizedCid = p.cid ?? cid ?? p.cidHash;
      const imageUrl = normalizedCid;
      const placementVotes = votes.filter((v: any) => v.placementId === p.id);
      const yesVotes = placementVotes
        .filter((v: any) => v.support)
        .reduce((sum: number, v: any) => sum + Number(v.weight), 0);
      const noVotes = placementVotes
        .filter((v: any) => !v.support)
        .reduce((sum: number, v: any) => sum + Number(v.weight), 0);

      const isPending = pending.some((pd: any) => pd.placementId === p.id);

      return {
        id: p.id,
        placementId: p.id, // Use id as placementId
        owner: p.bidder,
        bidder: p.bidder,
        epochSubmitted: Number(p.epoch),
        epoch: Number(p.epoch),
        x: Number(p.x),
        y: Number(p.y),
        w: Number(p.w),
        h: Number(p.h),
        rect: {
          x: Number(p.x),
          y: Number(p.y),
          w: Number(p.w),
          h: Number(p.h),
        },
        bidPerCellWei: p.bidPerCellWei,
        cidHash: p.cidHash,
        cid: cid || p.cidHash,
        imageUrl,
        yes: yesVotes,
        no: noVotes,
        yesVotes,
        noVotes,
        status: isPending ? "voting" : "canonized",
        isVotable: isPending,
      };
    });

    console.log("[api/proposals] 🎉 Returning", proposals.length, "proposals");

    return NextResponse.json({
      proposals,
      debug: {
        source: "goldsky",
        placementsCount: placements.length,
        pendingCount: pending.length,
        votesCount: votes.length,
      },
    }, {
      headers: {
        "Cache-Control": "no-store, max-age=0",
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.error("[api/proposals] ❌ Error:", error);
    return NextResponse.json({
      proposals: [],
      error: String(error)
    }, { status: 500 });
  }
}
