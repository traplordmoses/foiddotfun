import { NextResponse } from "next/server";
import { toHex, decodeEventLog } from "viem";
import type { Abi } from "viem";
import { verifyAgentSignature } from "../_lib/auth";
import { checkRateLimit, recordAction } from "@/lib/rateLimit";
import { getRelayerWalletClient, getAgentPublicClient, getRelayerAccount } from "../_lib/relayer";
import { fluentChain } from "@/lib/viem";
import { AGENT_BOARD } from "@/config/agentBoard";
import BoardAbi from "@/abi/LoreboardBoardV2.json" assert { type: "json" };

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TILE = 32;
const BoardAbiTyped = BoardAbi as Abi;

// Agent board base fee (0 by default — free for agents)
const BASE_FEE_PER_CELL_WEI = BigInt(
  process.env.AGENT_BASE_FEE_PER_CELL_WEI || "0"
);

function json(success: boolean, data?: unknown, error?: string, status = 200) {
  return NextResponse.json({ success, ...(data ? { data } : {}), ...(error ? { error } : {}) }, { status });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { wallet, imageCid, x, y, width, height, signature, timestamp } = body;

    if (!wallet || !imageCid || x == null || y == null || !width || !height || !signature || !timestamp) {
      return json(false, undefined, "Missing required fields: wallet, imageCid, x, y, width, height, signature, timestamp", 400);
    }

    // Verify signature
    const payload = `${imageCid}:${x}:${y}:${width}:${height}`;
    const auth = await verifyAgentSignature({
      wallet,
      signature,
      timestamp,
      action: "propose",
      payload,
    });
    if (!auth.ok) return json(false, undefined, auth.error, 401);

    // Rate limit
    const limit = checkRateLimit(auth.wallet, "propose");
    if (!limit.ok) return json(false, undefined, limit.error, 429);

    // Validate grid coordinates
    const nx = Number(x);
    const ny = Number(y);
    const nw = Number(width);
    const nh = Number(height);

    if (!Number.isInteger(nx) || !Number.isInteger(ny) || !Number.isInteger(nw) || !Number.isInteger(nh)) {
      return json(false, undefined, "Coordinates must be integers", 400);
    }
    if (nw <= 0 || nh <= 0) {
      return json(false, undefined, "Width and height must be positive", 400);
    }
    if (nw % TILE !== 0 || nh % TILE !== 0) {
      return json(false, undefined, `Width and height must be multiples of ${TILE} (tile size)`, 400);
    }

    const cellsWide = nw / TILE;
    const cellsHigh = nh / TILE;
    const cells = cellsWide * cellsHigh;

    if (cells > 400) {
      return json(false, undefined, "Max 400 cells per placement", 400);
    }

    // Encode CID as bytes
    const cidHex = toHex(new TextEncoder().encode(imageCid));
    const bidPerCellWei = BASE_FEE_PER_CELL_WEI;
    const value = BigInt(cells) * bidPerCellWei;

    // Submit onchain via relayer to the agent board
    const publicClient = getAgentPublicClient();
    const walletClient = getRelayerWalletClient();
    const account = getRelayerAccount();

    let txHash: string;
    let proposalId: string;
    let epoch: number;

    try {
      // Estimate gas with fallback
      let gas: bigint;
      try {
        gas = await publicClient.estimateContractGas({
          account,
          address: AGENT_BOARD,
          abi: BoardAbiTyped,
          functionName: "proposePlacement",
          args: [nx, ny, nw, nh, bidPerCellWei, cidHex],
          value,
        });
        // Clamp estimated gas within bounds
        if (gas < 200_000n) gas = 200_000n;
        if (gas > 1_000_000n) gas = 1_000_000n;
      } catch {
        gas = 500_000n;
        console.warn("[api/agent/propose] gas estimation failed, using fallback:", gas.toString());
      }

      txHash = await walletClient.writeContract({
        chain: fluentChain,
        account,
        address: AGENT_BOARD,
        abi: BoardAbiTyped,
        functionName: "proposePlacement",
        args: [nx, ny, nw, nh, bidPerCellWei, cidHex],
        value,
        gas,
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash as `0x${string}` });
      const log = receipt.logs.find((entry) => entry.address.toLowerCase() === AGENT_BOARD.toLowerCase());

      if (log) {
        const decoded = decodeEventLog({
          abi: BoardAbiTyped,
          data: log.data,
          topics: log.topics,
          eventName: "PlacementProposed",
        });
        const args = decoded.args as unknown as { id: string; epoch: number };
        proposalId = args.id;
        epoch = Number(args.epoch);
      } else {
        proposalId = "unknown";
        epoch = 0;
      }
    } catch (err) {
      const msg = (err as Error).message ?? String(err);
      console.error("[api/agent/propose] tx failed:", err);
      return json(false, undefined, `Onchain submission failed: ${msg.slice(0, 200)}`, 500);
    }

    recordAction(auth.wallet, "propose");

    return json(true, {
      wallet: auth.wallet,
      proposalId,
      epoch,
      cells,
      bidPerCellWei: bidPerCellWei.toString(),
      totalCostWei: value.toString(),
      imageCid,
      rect: { x: nx, y: ny, w: nw, h: nh },
      txHash,
    });
  } catch (err) {
    console.error("[api/agent/propose]", err);
    return json(false, undefined, "Internal error", 500);
  }
}
