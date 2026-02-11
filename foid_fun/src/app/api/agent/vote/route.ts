import { NextResponse } from "next/server";
import type { Abi } from "viem";
import { verifyAgentSignature } from "../_lib/auth";
import { checkRateLimit, recordAction } from "../_lib/rateLimit";
import { getRelayerWalletClient, getAgentPublicClient, getRelayerAccount } from "../_lib/relayer";
import { CONTRACTS } from "@/lib/contracts/addresses";
import VotingAbi from "@/abi/loreboardVoting.json" assert { type: "json" };

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VotingAbiTyped = VotingAbi as Abi;
const VOTING_ADDRESS = CONTRACTS.LOREBOARD_VOTING as `0x${string}`;

function json(success: boolean, data?: unknown, error?: string, status = 200) {
  return NextResponse.json({ success, ...(data ? { data } : {}), ...(error ? { error } : {}) }, { status });
}

function isBytes32(v: string): v is `0x${string}` {
  return typeof v === "string" && /^0x[0-9a-fA-F]{64}$/.test(v);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { wallet, proposalId, support, signature, timestamp } = body;

    if (!wallet || !proposalId || support == null || !signature || !timestamp) {
      return json(false, undefined, "Missing required fields: wallet, proposalId, support, signature, timestamp", 400);
    }

    if (!isBytes32(proposalId)) {
      return json(false, undefined, "proposalId must be a valid bytes32 hex string (0x + 64 hex chars)", 400);
    }

    const supportBool = support === true || support === "true" || support === "yes";

    // Verify signature
    const auth = await verifyAgentSignature({
      wallet,
      signature,
      timestamp,
      action: "vote",
      payload: `${proposalId}:${supportBool}`,
    });
    if (!auth.ok) return json(false, undefined, auth.error, 401);

    // Rate limit
    const limit = checkRateLimit(auth.wallet, "vote");
    if (!limit.ok) return json(false, undefined, limit.error, 429);

    // Submit vote on-chain via relayer
    const publicClient = getAgentPublicClient();
    const walletClient = getRelayerWalletClient();
    const account = getRelayerAccount();

    let txHash: string;
    try {
      const { request } = await publicClient.simulateContract({
        account,
        address: VOTING_ADDRESS,
        abi: VotingAbiTyped,
        functionName: "voteOnPlacement",
        args: [proposalId, supportBool],
      });

      txHash = await walletClient.writeContract(request);
      await publicClient.waitForTransactionReceipt({ hash: txHash as `0x${string}` });
    } catch (err) {
      const msg = (err as Error).message ?? String(err);
      if (msg.includes("already voted") || msg.includes("hasVoted")) {
        return json(false, undefined, "Relayer has already voted on this proposal", 409);
      }
      if (msg.includes("not votable") || msg.includes("voting closed")) {
        return json(false, undefined, "Proposal is not currently votable", 409);
      }
      console.error("[api/agent/vote] tx failed:", err);
      return json(false, undefined, `On-chain submission failed: ${msg.slice(0, 200)}`, 500);
    }

    recordAction(auth.wallet, "vote");

    return json(true, {
      wallet: auth.wallet,
      proposalId,
      support: supportBool,
      txHash,
    });
  } catch (err) {
    console.error("[api/agent/vote]", err);
    return json(false, undefined, "Internal error", 500);
  }
}
