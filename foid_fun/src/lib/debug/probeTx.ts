"use client";

import type { PublicClient } from "viem";

const TX_HASH = "0xcec18676c1e6dd7db361c2dd431804962c6fcbebeb9c8ac6a5bc6e33fe703bac";
const EXPECTED_BLOCK = 17036146n;
const BOARD_ADDRESS = "0xE41B2D418C09Ea928E4F657ED2438f5D01472105" as const;

export async function probeTx(publicClient: PublicClient) {
  const chainId = await publicClient.getChainId();
  console.log(`[probeTx] chainId=${chainId}`);

  const latestBlock = await publicClient.getBlockNumber();
  console.log(`[probeTx] latestBlock=${latestBlock}`);

  try {
    const tx = await publicClient.getTransaction({
      hash: TX_HASH as `0x${string}`,
    });
    if (!tx) {
      console.warn("[probeTx] transaction not found");
    } else {
      console.log(
        `[probeTx] tx blockNumber=${tx.blockNumber ?? "unknown"} to=${tx.to} from=${tx.from}`
      );
    }
  } catch (error) {
    console.error("[probeTx] failed to fetch transaction", error);
  }

  try {
    const receipt = await publicClient.getTransactionReceipt({
      hash: TX_HASH as `0x${string}`,
    });
    if (!receipt) {
      console.warn("[probeTx] receipt not found");
    } else {
      console.log(
        `[probeTx] receipt blockNumber=${receipt.blockNumber} to=${receipt.to} logs=${receipt.logs.length}`
      );
    }
  } catch (error) {
    console.error("[probeTx] failed to fetch receipt", error);
  }

  let blockWithTx;
  try {
    const block = await publicClient.getBlock({
      blockNumber: EXPECTED_BLOCK,
      includeTransactions: true,
    });
    if (block) {
      blockWithTx = block;
      const hasTx = block.transactions.some((tx) => {
        if (typeof tx === "string") {
          return tx.toLowerCase() === TX_HASH;
        }
        return tx.hash.toLowerCase() === TX_HASH;
      });
      console.log(
        `[probeTx] block includeTransactions=true number=${block.number} hash=${block.hash} txCount=${block.transactions.length} containsKnownTx=${hasTx}`
      );
    }
  } catch (error) {
    console.warn("[probeTx] includeTransactions=true failed", error);
  }

  if (!blockWithTx) {
    try {
      const block = await publicClient.getBlock({
        blockNumber: EXPECTED_BLOCK,
        includeTransactions: false,
      });
      if (block) {
        const txCount = Array.isArray(block.transactions)
          ? block.transactions.length
          : 0;
        console.log(
          `[probeTx] block includeTransactions=false number=${block.number} hash=${block.hash} txCount=${txCount}`
        );
      }
    } catch (error) {
      console.error("[probeTx] failed to fetch block without transactions", error);
    }
  }

  try {
    const rawLogs = await publicClient.getLogs({
      address: BOARD_ADDRESS,
      fromBlock: EXPECTED_BLOCK - 2000n,
      toBlock: EXPECTED_BLOCK + 2000n,
    });
    console.log(`[probeTx] raw board logs count=${rawLogs.length}`);
    if (rawLogs.length > 0) {
      const topic0Set = new Set<string>();
      rawLogs.forEach((log) => {
        const topic0 = log.topics?.[0];
        if (topic0) topic0Set.add(topic0);
      });
      console.log(
        `[probeTx] unique topic0 (${topic0Set.size}):`,
        Array.from(topic0Set)
      );
    }
  } catch (error) {
    console.error("[probeTx] failed to fetch raw logs", error);
  }
}
