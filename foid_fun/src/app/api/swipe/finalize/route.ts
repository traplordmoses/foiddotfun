import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, createWalletClient, http, type Hash } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { SWIPE_ABI } from "@/lib/contracts/abis/swipe";
import { CONTRACTS, RPC_URL, CHAIN_CONFIG } from "@/lib/contracts/addresses";
import { getVotesForFinalize, getVoteCounts } from "@/lib/voteStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const chain = {
  id: CHAIN_CONFIG.id,
  name: CHAIN_CONFIG.name,
  nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
};

function validateSecret(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const authHeader = request.headers.get("authorization");
  if (authHeader === `Bearer ${secret}`) return true;

  const cronHeader = request.headers.get("x-cron-secret");
  if (cronHeader === secret) return true;

  return false;
}

type FinalizeResult = {
  proposalId: number;
  status: "finalized" | "failed" | "skipped";
  canonized?: boolean;
  weightFor?: string;
  weightAgainst?: string;
  txHash?: string;
  error?: string;
  voteCount?: number;
};

export async function POST(request: NextRequest) {
  if (!validateSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const operatorPk = process.env.OPERATOR_PK;
  if (!operatorPk) {
    return NextResponse.json(
      { error: "OPERATOR_PK not configured" },
      { status: 500 }
    );
  }

  const swipeAddress = CONTRACTS.SWIPE as `0x${string}`;
  if (!swipeAddress) {
    return NextResponse.json(
      { error: "Swipe contract not configured" },
      { status: 500 }
    );
  }

  try {
    const account = privateKeyToAccount(operatorPk as `0x${string}`);
    const publicClient = createPublicClient({ chain, transport: http(RPC_URL) });
    const walletClient = createWalletClient({
      account,
      chain,
      transport: http(RPC_URL),
    });

    // Read proposal count
    const count = (await publicClient.readContract({
      address: swipeAddress,
      abi: SWIPE_ABI,
      functionName: "proposalCount",
    })) as bigint;

    const proposalCount = Number(count);
    const now = Math.floor(Date.now() / 1000);
    const results: FinalizeResult[] = [];

    // Process each proposal sequentially (nonce safety)
    for (let i = 0; i < proposalCount; i++) {
      try {
        const raw = (await publicClient.readContract({
          address: swipeAddress,
          abi: SWIPE_ABI,
          functionName: "getProposal",
          args: [BigInt(i)],
        })) as {
          id: bigint;
          proposer: string;
          ipfsCid: string;
          createdAt: bigint;
          votingEndsAt: bigint;
          finalized: boolean;
          canonized: boolean;
          trestEntryId: bigint;
        };

        // Skip already finalized
        if (raw.finalized) {
          continue;
        }

        // Skip still-active proposals
        if (Number(raw.votingEndsAt) > now) {
          continue;
        }

        // Ready to finalize
        const votes = getVotesForFinalize(i);
        const counts = getVoteCounts(i);

        console.log(
          `[finalize] Proposal #${i}: ${counts.forCount} yes, ${counts.againstCount} no, ${votes.voters.length} total signatures`
        );

        // Call finalize on-chain
        const hash: Hash = await walletClient.writeContract({
          address: swipeAddress,
          abi: SWIPE_ABI,
          functionName: "finalize",
          args: [
            BigInt(i),
            votes.voters.map((v) => v as `0x${string}`),
            votes.approvals,
            votes.deadlines.map((d) => BigInt(d)),
            votes.signatures.map((s) => s as `0x${string}`),
          ],
        });

        // Wait for receipt
        const receipt = await publicClient.waitForTransactionReceipt({
          hash,
          timeout: 60_000,
        });

        // Parse Finalized event from logs
        let canonized = false;
        let weightFor = "0";
        let weightAgainst = "0";

        for (const log of receipt.logs) {
          try {
            // Finalized event topic
            if (log.topics[0] && log.data) {
              // Simple approach: check if this looks like our Finalized event
              const proposalIdTopic = log.topics[1];
              if (proposalIdTopic) {
                const pId = Number(BigInt(proposalIdTopic));
                if (pId === i) {
                  // Decode data: (bool canonized, uint256 weightFor, uint256 weightAgainst)
                  const data = log.data;
                  if (data.length >= 194) {
                    canonized = BigInt("0x" + data.slice(2, 66)) !== 0n;
                    weightFor = BigInt("0x" + data.slice(66, 130)).toString();
                    weightAgainst = BigInt("0x" + data.slice(130, 194)).toString();
                  }
                }
              }
            }
          } catch {
            // Non-fatal: event parsing failed
          }
        }

        results.push({
          proposalId: i,
          status: "finalized",
          canonized,
          weightFor,
          weightAgainst,
          txHash: hash,
          voteCount: votes.voters.length,
        });

        console.log(
          `[finalize] Proposal #${i}: ${canonized ? "CANONIZED" : "REJECTED"} (for: ${weightFor}, against: ${weightAgainst}) tx: ${hash}`
        );
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error(`[finalize] Proposal #${i} FAILED:`, errorMsg);

        results.push({
          proposalId: i,
          status: "failed",
          error: errorMsg,
        });
        // Continue to next proposal — don't let one failure stop others
      }
    }

    const finalized = results.filter((r) => r.status === "finalized");
    const failed = results.filter((r) => r.status === "failed");

    return NextResponse.json({
      total: proposalCount,
      finalized: finalized.length,
      failed: failed.length,
      results,
    });
  } catch (error) {
    console.error("[api/swipe/finalize] Error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

/** GET: dry-run showing which proposals are ready to finalize */
export async function GET(request: NextRequest) {
  if (!validateSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const swipeAddress = CONTRACTS.SWIPE as `0x${string}`;
  if (!swipeAddress) {
    return NextResponse.json({ error: "Swipe contract not configured" }, { status: 500 });
  }

  try {
    const publicClient = createPublicClient({ chain, transport: http(RPC_URL) });
    const count = (await publicClient.readContract({
      address: swipeAddress,
      abi: SWIPE_ABI,
      functionName: "proposalCount",
    })) as bigint;

    const now = Math.floor(Date.now() / 1000);
    const ready: Array<{
      proposalId: number;
      votingEndsAt: number;
      forCount: number;
      againstCount: number;
      totalVotes: number;
    }> = [];

    for (let i = 0; i < Number(count); i++) {
      try {
        const raw = (await publicClient.readContract({
          address: swipeAddress,
          abi: SWIPE_ABI,
          functionName: "getProposal",
          args: [BigInt(i)],
        })) as {
          finalized: boolean;
          votingEndsAt: bigint;
        };

        if (!raw.finalized && Number(raw.votingEndsAt) < now) {
          const counts = getVoteCounts(i);
          ready.push({
            proposalId: i,
            votingEndsAt: Number(raw.votingEndsAt),
            ...counts,
          });
        }
      } catch {
        // skip
      }
    }

    return NextResponse.json({
      total: Number(count),
      readyToFinalize: ready.length,
      proposals: ready,
    });
  } catch (error) {
    console.error("[api/swipe/finalize] GET error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
