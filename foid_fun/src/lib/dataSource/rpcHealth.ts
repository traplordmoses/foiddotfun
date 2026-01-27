import type { PublicClient } from "viem";
import { TransactionReceiptNotFoundError } from "viem";

const CACHE_KEY = "rpcHealth:prunedReceipts";
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

interface RpcHealthCache {
  pruned: boolean;
  timestamp: number;
}

const canUseStorage = typeof window !== "undefined" && typeof window.localStorage !== "undefined";

function readCache(): RpcHealthCache | null {
  if (!canUseStorage) return null;
  const raw = window.localStorage.getItem(CACHE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as RpcHealthCache;
    if (typeof parsed.pruned !== "boolean" || typeof parsed.timestamp !== "number") {
      return null;
    }
    if (Date.now() - parsed.timestamp > CACHE_TTL_MS) {
      window.localStorage.removeItem(CACHE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(pruned: boolean) {
  if (!canUseStorage) return;
  const payload: RpcHealthCache = { pruned, timestamp: Date.now() };
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch {
    // ignore localStorage write errors
  }
}

function normalizeHash(hash: string) {
  return hash.toLowerCase();
}

export const KNOWN_RPC_PRUNE_TX_HASH =
  "0xcec18676c1e6dd7db361c2dd431804962c6fcbebeb9c8ac6a5bc6e33fe703bac" as const;
export const KNOWN_RPC_PRUNE_TX_BLOCK = 17036146n;

export async function detectRpcPrunedReceipts(
  publicClient: PublicClient,
  knownTxHash: `0x${string}`,
  knownTxBlock: bigint
): Promise<boolean> {
  const cached = readCache();
  if (cached) {
    return cached.pruned;
  }

  try {
    await publicClient.getTransactionReceipt({ hash: knownTxHash });
    writeCache(false);
    return false;
  } catch (error) {
    if (error instanceof TransactionReceiptNotFoundError) {
      try {
        const block = await publicClient.getBlock({
          blockNumber: knownTxBlock,
          includeTransactions: true,
        });
        const normalizedTarget = normalizeHash(knownTxHash);
        const hasTx = block?.transactions?.some((tx) => {
          const hash = typeof tx === "string" ? tx : tx.hash;
          return typeof hash === "string" && normalizeHash(hash) === normalizedTarget;
        });
        const pruned = !!block && !!hasTx;
        writeCache(pruned);
        return pruned;
      } catch (blockError) {
        console.warn("[rpcHealth] failed to inspect block for probe transaction", blockError);
        writeCache(false);
        return false;
      }
    }
    throw error;
  }
}

export function cacheRpcPrunedReceipts(pruned: boolean) {
  writeCache(pruned);
}
