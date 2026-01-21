"use client";

import { CID } from "multiformats/cid";
import ABI from "@/abi/LoreboardBoardV2.json" assert { type: "json" };
import {
  Address,
  Hex,
  type Abi,
  encodePacked,
  decodeEventLog,
  isHex,
  keccak256,
} from "viem";
import { getWalletClient, publicClient } from "@/lib/viem";
import { CANONICAL_ADDRESSES, requireCanonicalAddress } from "@/config/canonical";

const LoreboardAbi = ABI as Abi;

const LOREBOARD = requireCanonicalAddress({
  label: "NEXT_PUBLIC_LOREBOARD_BOARD_ADDRESS",
  envValue: process.env.NEXT_PUBLIC_LOREBOARD_BOARD_ADDRESS,
  expected: CANONICAL_ADDRESSES.board,
  envHint: "NEXT_PUBLIC_LOREBOARD_BOARD_ADDRESS",
}) as Address;

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

type ViemErrorLike = {
  shortMessage?: string;
  message?: string;
  reason?: string;
  data?: unknown;
  cause?: { data?: unknown };
};

export function prettyViemError(err: unknown): string {
  const e = (typeof err === "object" && err !== null ? err : {}) as ViemErrorLike;
  const msg = e.shortMessage || e.message || "tx failed";
  const reason = e.reason || /reason:\s*"?([^"]+)"?/.exec(msg)?.[1];
  const data = e.data || e.cause?.data;
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
      abi: LoreboardAbi,
      functionName: "proposePlacement",
      args,
      value,
      account: bidder,
    });

    const txHash = await wallet.writeContract({
      address: LOREBOARD,
      abi: LoreboardAbi,
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
      abi: LoreboardAbi,
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
  } catch (e: unknown) {
    throw new Error(prettyViemError(e));
  }
}
