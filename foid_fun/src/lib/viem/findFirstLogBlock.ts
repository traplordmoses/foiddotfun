"use client";

import type { PublicClient, AbiEvent, Log } from "viem";
import { getLogsChunked } from "@/lib/viem/getLogsChunked";
import { DEPLOY_BLOCK } from "@/lib/contracts/addresses";

const DEFAULT_WINDOW_SIZE = 95_000n;
const DEFAULT_MAX_WINDOWS = 60;

export async function findFirstLogBlock(params: {
  client: PublicClient;
  address: `0x${string}`;
  event: AbiEvent;
  args?: Record<string, any>;
  latestBlock: bigint;
  windowSize?: bigint;
  maxWindows?: number;
  cacheKey?: string;
}): Promise<bigint> {
  const {
    client,
    address,
    event,
    args,
    latestBlock,
    windowSize = DEFAULT_WINDOW_SIZE,
    maxWindows = DEFAULT_MAX_WINDOWS,
    cacheKey,
  } = params;

  const floorBlock = DEPLOY_BLOCK;

  if (latestBlock < floorBlock) {
    console.warn(
      `[findFirstLogBlock] latest block ${latestBlock.toString()} is before deploy ${floorBlock.toString()}`
    );
    return floorBlock;
  }

  const storage = typeof window !== "undefined" ? window.localStorage : null;

  if (cacheKey && storage) {
    const cached = storage.getItem(cacheKey);
    if (cached) {
      try {
        const parsed = BigInt(cached);
        console.log(`[findFirstLogBlock] cache hit ${cacheKey}: ${parsed}`);
        return parsed;
      } catch (error) {
        console.warn(
          `[findFirstLogBlock] failed to parse cached block for ${cacheKey}:`,
          error
        );
      }
    }
  }

  for (let i = 0; i < maxWindows; i += 1) {
    const offset = BigInt(i) * windowSize;
    if (offset > latestBlock) break;

    let end = latestBlock - offset;
    if (end < floorBlock) {
      break;
    }

    const rawStart = end > windowSize ? end - windowSize + 1n : 0n;
    const start = rawStart < floorBlock ? floorBlock : rawStart;
    if (start > end) break;

    const logs: Log[] = await getLogsChunked(client, {
      address,
      event,
      args,
      fromBlock: start,
      toBlock: end,
      chunkSize: windowSize,
    });

    if (logs.length > 0) {
      const minBlock = logs.reduce(
        (min, log) => (log.blockNumber < min ? log.blockNumber : min),
        logs[0].blockNumber
      );

      if (cacheKey && storage) {
        storage.setItem(cacheKey, minBlock.toString());
      }

      console.log(
        `[findFirstLogBlock] discovered ${minBlock} for ${cacheKey ?? address} (window ${start}-${end})`
      );
      return minBlock;
    }

    if (end === floorBlock) {
      break;
    }
  }

  const fallback = floorBlock;
  console.log(
    `[findFirstLogBlock] no logs found; defaulting ${fallback} for ${cacheKey ?? address}`
  );
  return fallback;
}
