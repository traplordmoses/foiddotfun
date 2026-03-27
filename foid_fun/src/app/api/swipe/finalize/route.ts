// POST /api/swipe/finalize
// Operator endpoint: reads EIP-712 votes from SQLite, calls Swipe.finalize() on-chain.
// Supports ?proposalId=N (single) and ?dry=1 (preview without submitting).
import { NextRequest, NextResponse } from "next/server";
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  decodeEventLog,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { SWIPE_ABI } from "@/lib/contracts/abis/swipe";
import { CANONICAL_ADDRESSES, CANONICAL_CHAIN, CHAIN_ID } from "@/config/canonical";
import { getVotesForProposal } from "@/lib/voteStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

// ── Runtime config ──────────────────────────────────────────────

function getRuntimeConfig() {
  const rpc = process.env.NEXT_PUBLIC_FLUENT_RPC ?? CANONICAL_CHAIN.rpcUrl;
  const operatorPk = process.env.OPERATOR_PK;

  if (!operatorPk) {
    throw new Error("OPERATOR_PK is required for finalization.");
  }

  const chain = defineChain({
    id: CHAIN_ID,
    name: "Fluent Testnet",
    nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [rpc] } },
    contracts: {
      multicall3: {
        address: "0xcA11bde05977b3631167028862bE2a173976CA11",
        blockCreated: 0,
      },
    },
  });

  const operatorAccount = privateKeyToAccount(
    operatorPk.startsWith("0x")
      ? (operatorPk as `0x${string}`)
      : (`0x${operatorPk}` as `0x${string}`),
  );

  const publicClient = createPublicClient({ chain, transport: http(rpc) });
  const wallet = createWalletClient({
    chain,
    transport: http(rpc),
    account: operatorAccount,
  });

  return { publicClient, wallet };
}

// ── Types ───────────────────────────────────────────────────────

type ProposalOnChain = {
  id: bigint;
  proposer: string;
  ipfsCid: string;
  createdAt: bigint;
  votingEndsAt: bigint;
  finalized: boolean;
  canonized: boolean;
  trestEntryId: bigint;
};

type FinalizeResult = {
  proposalId: number;
  txHash: string;
  canonized: boolean;
  weightFor: string;
  weightAgainst: string;
  voteCount: number;
};

// ── Helpers ─────────────────────────────────────────────────────

async function readProposal(
  publicClient: ReturnType<typeof createPublicClient>,
  proposalId: number,
): Promise<ProposalOnChain> {
  const raw = await publicClient.readContract({
    address: CANONICAL_ADDRESSES.swipe,
    abi: SWIPE_ABI,
    functionName: "getProposal",
    args: [BigInt(proposalId)],
  });

  if (Array.isArray(raw)) {
    return {
      id: raw[0] as bigint,
      proposer: raw[1] as string,
      ipfsCid: raw[2] as string,
      createdAt: raw[3] as bigint,
      votingEndsAt: raw[4] as bigint,
      finalized: raw[5] as boolean,
      canonized: raw[6] as boolean,
      trestEntryId: raw[7] as bigint,
    };
  }
  return raw as ProposalOnChain;
}

// ── POST handler ────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const tag = "[api/swipe/finalize]";

  try {
    const { publicClient, wallet } = getRuntimeConfig();
    const swipeAddress = CANONICAL_ADDRESSES.swipe;
    const { searchParams } = new URL(request.url);

    const dry = searchParams.get("dry") === "1";
    const singleId = searchParams.get("proposalId");
    const nowSec = Math.floor(Date.now() / 1000);

    // ── Determine candidate proposals ──────────────────────────
    let candidateIds: number[];

    if (singleId !== null) {
      candidateIds = [Number(singleId)];
    } else {
      const count = (await publicClient.readContract({
        address: swipeAddress,
        abi: SWIPE_ABI,
        functionName: "proposalCount",
      })) as bigint;
      candidateIds = Array.from({ length: Number(count) }, (_, i) => i);
    }

    // ── Filter to expired, unfinalized proposals ───────────────
    type Candidate = {
      proposalId: number;
      proposal: ProposalOnChain;
      voters: `0x${string}`[];
      approvals: boolean[];
      deadlines: bigint[];
      signatures: `0x${string}`[];
    };

    const candidates: Candidate[] = [];
    const skipped: Array<{ proposalId: number; reason: string }> = [];

    for (const pid of candidateIds) {
      try {
        const proposal = await readProposal(publicClient, pid);

        if (proposal.finalized) {
          skipped.push({ proposalId: pid, reason: "already finalized" });
          continue;
        }

        if (Number(proposal.votingEndsAt) > nowSec) {
          skipped.push({ proposalId: pid, reason: "voting still open" });
          continue;
        }

        // Read votes from SQLite via voteStore
        const voteData = getVotesForProposal(pid);

        candidates.push({
          proposalId: pid,
          proposal,
          voters: voteData.voters.map((v) => v as `0x${string}`),
          approvals: voteData.approvals,
          deadlines: voteData.deadlines.map((d) => BigInt(d)),
          signatures: voteData.signatures.map((s) => s as `0x${string}`),
        });
      } catch (err) {
        skipped.push({
          proposalId: pid,
          reason: `read error: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    }

    // ── Dry run ────────────────────────────────────────────────
    if (dry) {
      return NextResponse.json({
        dry: true,
        candidates: candidates.map((c) => ({
          proposalId: c.proposalId,
          voteCount: c.voters.length,
          forCount: c.approvals.filter(Boolean).length,
          againstCount: c.approvals.filter((a) => !a).length,
          votingEndsAt: Number(c.proposal.votingEndsAt),
        })),
        skipped,
      });
    }

    if (candidates.length === 0) {
      return NextResponse.json({
        ok: true,
        message: "No proposals ready for finalization",
        skipped,
        finalized: [],
        errors: [],
      });
    }

    // ── Finalize each proposal ─────────────────────────────────
    const finalized: FinalizeResult[] = [];
    const errors: Array<{ proposalId: number; error: string }> = [];

    for (const c of candidates) {
      try {
        console.log(`${tag} Finalizing proposal ${c.proposalId} with ${c.voters.length} votes...`);

        const txHash = await wallet.writeContract({
          address: swipeAddress,
          abi: SWIPE_ABI,
          functionName: "finalize",
          args: [BigInt(c.proposalId), c.voters, c.approvals, c.deadlines, c.signatures],
        });

        console.log(`${tag} Proposal ${c.proposalId} tx: ${txHash}`);

        const receipt = await publicClient.waitForTransactionReceipt({
          hash: txHash,
          timeout: 60_000,
        });

        if (receipt.status !== "success") {
          errors.push({ proposalId: c.proposalId, error: `Transaction reverted (${txHash})` });
          continue;
        }

        // Parse Finalized event
        let canonized = false;
        let weightFor = "0";
        let weightAgainst = "0";

        for (const log of receipt.logs) {
          try {
            const decoded = decodeEventLog({ abi: SWIPE_ABI, data: log.data, topics: log.topics });
            if (decoded.eventName === "Finalized") {
              const args = decoded.args as {
                proposalId: bigint;
                canonized: boolean;
                weightFor: bigint;
                weightAgainst: bigint;
              };
              canonized = args.canonized;
              weightFor = args.weightFor.toString();
              weightAgainst = args.weightAgainst.toString();
            }
          } catch {
            /* not a Finalized event */
          }
        }

        finalized.push({
          proposalId: c.proposalId,
          txHash,
          canonized,
          weightFor,
          weightAgainst,
          voteCount: c.voters.length,
        });

        console.log(`${tag} Proposal ${c.proposalId}: ${canonized ? "CANONIZED" : "REJECTED"} (for: ${weightFor}, against: ${weightAgainst})`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`${tag} Failed to finalize proposal ${c.proposalId}:`, msg);
        errors.push({ proposalId: c.proposalId, error: msg });
      }
    }

    return NextResponse.json({ ok: true, finalized, errors, skipped });
  } catch (error) {
    console.error(`${tag} Fatal error:`, error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
