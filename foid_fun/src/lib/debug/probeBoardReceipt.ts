"use client";

import type { PublicClient, Hex } from "viem";
import { decodeEventLog } from "viem";
import {
  LOREBOARD_BOARD_ABI,
  LOREBOARD_TREASURY_ABI,
  LOREBOARD_VOTING_ABI,
} from "@/lib/contracts/abis";

const PROBE_TX_HASH =
  "0xcec18676c1e6dd7db361c2dd431804962c6fcbebeb9c8ac6a5bc6e33fe703bac";

const DECODERS = [
  { label: "LOREBOARD_BOARD", abi: LOREBOARD_BOARD_ABI },
  { label: "LOREBOARD_TREASURY", abi: LOREBOARD_TREASURY_ABI },
  { label: "LOREBOARD_VOTING", abi: LOREBOARD_VOTING_ABI },
];

export async function probeBoardReceipt(publicClient: PublicClient) {
  const receipt = await publicClient.getTransactionReceipt({
    hash: PROBE_TX_HASH as `0x${string}`,
  });
  if (!receipt) {
    console.warn("[probeBoardReceipt] receipt not found");
    return;
  }

  console.log(
    `[probeBoardReceipt] block=${receipt.blockNumber} to=${receipt.to} logs=${receipt.logs.length}`
  );

  receipt.logs.forEach((log, index) => {
    const topics = (log.topics ?? []) as Hex[];
    console.log(
      `[probeBoardReceipt] log ${index} address=${log.address} topics0=${topics[0] ?? "n/a"} topics=${topics.join(
        ", "
      )}`
    );

    for (const decoder of DECODERS) {
      try {
        const decoded = decodeEventLog({
          abi: decoder.abi,
          data: log.data,
          topics,
        });
        console.log(
          `[probeBoardReceipt] decoded by ${decoder.label} -> ${decoded.eventName}`,
          decoded.args
        );
        break;
      } catch {
        // ignore non-matching ABIs
      }
    }
  });
}
