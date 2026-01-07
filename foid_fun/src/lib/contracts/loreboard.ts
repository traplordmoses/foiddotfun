"use client";

import { CID } from "multiformats/cid";
import ABI from "@/abi/LoreboardBoardV1.json" assert { type: "json" };
import {
  Address,
  Hex,
  encodePacked,
  decodeEventLog,
  isHex,
  keccak256,
} from "viem";
import { getWalletClient, publicClient } from "@/lib/viem";

const LOREBOARD = process.env.NEXT_PUBLIC_LOREBOARD_BOARD_ADDRESS as Address;

export type Rect = { x: number; y: number; w: number; h: number };

export function hashCid(cid: string): Hex {
  return keccak256(CID.parse(cid).bytes);
}

export function computePlacementId(
  bidder: Address,
  epoch: bigint,
  cidHash: Hex,
  r: Rect
): Hex {
  return keccak256(
    encodePacked(
      ["address", "uint256", "bytes32", "int32", "int32", "uint32", "uint32"],
      [bidder, epoch, cidHash, r.x, r.y, r.w, r.h]
    )
  );
}

export const cellsOf = (r: Rect) =>
  BigInt(Math.ceil(r.w / 32)) * BigInt(Math.ceil(r.h / 32));

export function prettyViemError(err: any): string {
  const msg = err?.shortMessage || err?.message || "tx failed";
  const reason = err?.reason || /reason:\s*"?([^"]+)"?/.exec(msg)?.[1];
  const data = err?.data || err?.cause?.data;
  if (reason) return reason.trim();
  if (typeof data === "string" && isHex(data)) {
    return `${msg} (${data.slice(0, 10)}…)`;
  }
  return msg;
}

export async function proposePlacement(opts: {
  rect: Rect;
  bidPerCellWei: bigint;
  cid: string;
}) {
  const wallet = await getWalletClient();
  const [bidder] = await wallet.getAddresses();
  if (!bidder) throw new Error("No wallet address");

  const normalizedCid = opts.cid
    .trim()
    .replace(/^ipfs:\/\//, "")
    .replace(/^https?:\/\/[^/]+\//, "");
  const cidBytes = new TextEncoder().encode(normalizedCid);
  const value = opts.bidPerCellWei * cellsOf(opts.rect);

  const args = [
    opts.rect.x,
    opts.rect.y,
    opts.rect.w,
    opts.rect.h,
    opts.bidPerCellWei,
    cidBytes,
  ] as const;

  try {
    await publicClient.simulateContract({
      address: LOREBOARD,
      abi: ABI as any,
      functionName: "proposePlacement",
      args,
      value,
      account: bidder,
    });

    const txHash = await wallet.writeContract({
      address: LOREBOARD,
      abi: ABI as any,
      functionName: "proposePlacement",
      args,
      value,
      account: bidder,
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
    const log = receipt.logs.find(
      (entry) => entry.address.toLowerCase() === LOREBOARD.toLowerCase()
    );
    if (!log) {
      throw new Error("PlacementProposed event not found");
    }
    const decoded = decodeEventLog({
      abi: ABI as any,
      data: log.data,
      topics: log.topics,
      eventName: "PlacementProposed",
    });
    const { id, epoch, cidHash } = decoded.args as {
      id: Hex;
      epoch: number;
      cidHash: Hex;
    };
    return { txHash, receipt, id, epoch, cidHash };
  } catch (e: any) {
    throw new Error(prettyViemError(e));
  }
}
