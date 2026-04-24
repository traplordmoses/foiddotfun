import { NextRequest, NextResponse } from "next/server";
import { isAddress, getAddress } from "viem";
import { getAgentPublicClient } from "../../_lib/relayer";
import { fetchProposals, fetchVotesByVoter } from "../../_lib/goldsky";
import { PRAYER_MIRROR_ABI, PRAYER_REGISTRY_ABI } from "@/lib/contracts/abis";
import { CONTRACTS } from "@/lib/contracts/addresses";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(success: boolean, data?: unknown, error?: string, status = 200) {
  return NextResponse.json({ success, ...(data ? { data } : {}), ...(error ? { error } : {}) }, { status });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ wallet: string }> }
) {
  const { wallet } = await params;

  if (!wallet || !isAddress(wallet)) {
    return json(false, undefined, "Invalid wallet address", 400);
  }

  const address = getAddress(wallet) as `0x${string}`;
  const client = getAgentPublicClient();

  try {
    // Prayer data from main contracts (shared across all boards)
    // Note: prayer stats reflect the relayer's onchain state, not per-agent.
    const [prayerStats, cooldown] = await Promise.all([
      client.readContract({
        address: CONTRACTS.PRAYER_MIRROR as `0x${string}`,
        abi: PRAYER_MIRROR_ABI,
        functionName: "get",
        args: [address],
      }).catch(() => [0n, 0n, 0n] as const),

      client.readContract({
        address: CONTRACTS.PRAYER_REGISTRY as `0x${string}`,
        abi: PRAYER_REGISTRY_ABI,
        functionName: "nextAllowedAt",
        args: [address],
      }).catch(() => 0n),
    ]);

    // Agent board proposals and votes via direct contract event scanning.
    // Note: onchain bidder/voter is the relayer address, not the agent wallet.
    // Per-agent attribution requires off-chain tracking or a subgraph.
    const [proposals, votes] = await Promise.allSettled([
      fetchProposals(address),
      fetchVotesByVoter(address),
    ]);

    const proposalRows = proposals.status === "fulfilled" ? proposals.value : [];
    const voteRows = votes.status === "fulfilled" ? votes.value : [];

    const [currentStreak, longestStreak, totalPrayers] = prayerStats as readonly [bigint, bigint, bigint];

    return json(true, {
      wallet: address,
      prayer: {
        currentStreak: Number(currentStreak),
        longestStreak: Number(longestStreak),
        totalPrayers: Number(totalPrayers),
        nextAllowedAt: Number(cooldown),
        canPrayNow: Number(cooldown) <= Math.floor(Date.now() / 1000),
      },
      proposals: {
        total: proposalRows.length,
        recent: proposalRows.slice(0, 10).map((p) => ({
          id: p.idParam,
          epoch: Number(p.epoch),
          cells: Math.ceil(Number(p.w) / 32) * Math.ceil(Number(p.h) / 32),
        })),
      },
      votes: {
        total: voteRows.length,
        recent: voteRows.slice(0, 10).map((v) => ({
          placementId: v.placementId,
          epochId: v.epochId,
          support: v.support,
        })),
      },
    });
  } catch (err) {
    console.error("[api/agent/status]", err);
    return json(false, undefined, "Failed to fetch wallet status", 500);
  }
}
