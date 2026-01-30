import type {
  AbiEvent,
  Address,
  EncodeEventTopicsReturnType,
  Hex,
  Log,
  PublicClient,
  TransactionReceipt,
} from "viem";
import { decodeEventLog, encodeEventTopics, TransactionReceiptNotFoundError } from "viem";
import { getLogsChunked } from "@/lib/viem/getLogsChunked";
import { CONTRACTS } from "@/lib/contracts/addresses";
import {
  PlacementProposedEvent,
  PendingPlacementRegisteredEvent,
  VoteCastEvent,
} from "@/lib/contracts/events";
import {
  cacheRpcPrunedReceipts,
  detectRpcPrunedReceipts,
  KNOWN_RPC_PRUNE_TX_BLOCK,
  KNOWN_RPC_PRUNE_TX_HASH,
} from "./rpcHealth";
import {
  ExplorerLogFilter,
  ExplorerLogItem,
  getExplorerLogs,
  getExplorerReceipt,
} from "./explorerClient";

const RPC_CHUNK_SIZE = 95_000n;
const FORCE_EXPLORER = process.env.NEXT_PUBLIC_FORCE_EXPLORER === "1";
const BOARD_ADDRESS = CONTRACTS.LOREBOARD_BOARD as Address;
const VOTING_ADDRESS = CONTRACTS.LOREBOARD_VOTING as Address;

let explorerModeActive = FORCE_EXPLORER;
const explorerModeListeners = new Set<(active: boolean) => void>();

function setExplorerMode(value: boolean) {
  const normalized = FORCE_EXPLORER ? true : value;
  if (explorerModeActive === normalized) return;
  explorerModeActive = normalized;
  for (const listener of explorerModeListeners) {
    listener(normalized);
  }
}

export function subscribeExplorerMode(listener: (active: boolean) => void) {
  listener(explorerModeActive);
  explorerModeListeners.add(listener);
  return () => {
    explorerModeListeners.delete(listener);
  };
}

export function isExplorerModeActive() {
  return explorerModeActive;
}

export type DataLog = {
  address: `0x${string}`;
  blockHash: `0x${string}`;
  blockNumber: bigint;
  data: `0x${string}`;
  logIndex: number | null;
  transactionHash: `0x${string}`;
  transactionIndex: number | null;
  topics: `0x${string}`[];
  removed: boolean;
  args?: Record<string, unknown>;
  eventName?: string;
};

function normalizeEncodedTopics(value: EncodeEventTopicsReturnType): (string | null)[] {
  if (!value) return [];
  if (typeof value === "string") {
    return [value];
  }
  if (Array.isArray(value)) {
    return [...value] as (string | null)[];
  }
  return [];
}

function buildEncodedTopics(event: AbiEvent, args?: Record<string, unknown>): (string | null)[] {
  return normalizeEncodedTopics(
    encodeEventTopics({
      abi: [event],
      eventName: event.name,
      args: args ?? undefined,
    })
  );
}

function ensureLogTopics(topics: `0x${string}`[]): [] | [ `0x${string}`, ...`0x${string}`[]] {
  if (topics.length === 0) {
    return [];
  }
  const [first, ...rest] = topics;
  return [first, ...rest] as [ `0x${string}`, ...`0x${string}`[]];
}

async function shouldUseExplorer(publicClient: PublicClient) {
  if (FORCE_EXPLORER) return true;
  try {
    return await detectRpcPrunedReceipts(
      publicClient,
      KNOWN_RPC_PRUNE_TX_HASH,
      KNOWN_RPC_PRUNE_TX_BLOCK
    );
  } catch (error) {
    console.warn("[dataSource] rpc health probe failed", error);
    return false;
  }
}

function normalizeRpcLogs(logs: Log[]): DataLog[] {
  return logs.map((log) => ({
    address: log.address,
    blockHash: (log.blockHash ?? "0x") as `0x${string}`,
    blockNumber: log.blockNumber ?? 0n,
    data: log.data,
    logIndex: log.logIndex ?? 0,
    transactionHash: (log.transactionHash ?? "0x") as `0x${string}`,
    transactionIndex: log.transactionIndex ?? 0,
    topics: log.topics ?? [],
    removed: log.removed,
    args: (log as unknown as { args?: Record<string, unknown> }).args,
    eventName: (log as unknown as { eventName?: string }).eventName,
  }));
}

function decodeExplorerLog(event: AbiEvent, log: ExplorerLogItem): DataLog {
  const decoded = decodeEventLog({
    abi: [event],
    data: log.data,
    topics: ensureLogTopics(log.topics),
  });
  return {
    ...log,
    args: decoded.args,
    eventName: decoded.eventName,
  };
}

async function fetchExplorerLogsForEvent(
  filter: Omit<ExplorerLogFilter, "topics"> & { topics?: (string | null)[] },
  event: AbiEvent
) {
  const logs = await getExplorerLogs(filter);
  return logs.map((log) => decodeExplorerLog(event, log));
}

interface EventLogParams {
  publicClient: PublicClient;
  address: Address;
  event: AbiEvent;
  args?: Record<string, unknown>;
  fromBlock: bigint;
  toBlock: bigint;
  chunkSize?: bigint;
}

async function fetchEventLogs(params: EventLogParams): Promise<DataLog[]> {
  const { publicClient, address, event, args, fromBlock, toBlock, chunkSize } = params;
  const explorerMode = await shouldUseExplorer(publicClient);
  const explorerTopics = buildEncodedTopics(event, args);
  if (explorerMode) {
    setExplorerMode(true);
    return fetchExplorerLogsForEvent(
      {
        address,
        fromBlock,
        toBlock,
        topics: explorerTopics,
      },
      event
    );
  }

  try {
    const rpcLogs = await getLogsChunked(publicClient, {
      address,
      event,
      args,
      fromBlock,
      toBlock,
      chunkSize: chunkSize ?? RPC_CHUNK_SIZE,
    });
    setExplorerMode(false);
    if (rpcLogs.length === 0) {
      const explorerLogs = await fetchExplorerLogsForEvent(
        {
          address,
          fromBlock,
          toBlock,
          topics: explorerTopics,
        },
        event
      );
      if (explorerLogs.length > 0) {
        console.warn(
          `[dataSource] RPC returned 0 ${event.name} logs but explorer returned ${explorerLogs.length}, marking RPC receipts as pruned.`
        );
        cacheRpcPrunedReceipts(true);
        setExplorerMode(true);
        return explorerLogs;
      }
    }
    return normalizeRpcLogs(rpcLogs);
  } catch (error) {
    console.warn(`[dataSource] RPC ${event.name} scan failed, falling back to explorer`, error);
    cacheRpcPrunedReceipts(true);
    setExplorerMode(true);
    return fetchExplorerLogsForEvent(
      {
        address,
        fromBlock,
        toBlock,
        topics: explorerTopics,
      },
      event
    );
  }
}

export async function getPlacementProposedLogs(params: {
  publicClient: PublicClient;
  bidder?: `0x${string}`;
  fromBlock: bigint;
  toBlock: bigint;
  chunkSize?: bigint;
}) {
  const args = params.bidder ? { bidder: params.bidder } : undefined;
  return fetchEventLogs({
    publicClient: params.publicClient,
    address: BOARD_ADDRESS,
    event: PlacementProposedEvent,
    args,
    fromBlock: params.fromBlock,
    toBlock: params.toBlock,
    chunkSize: params.chunkSize,
  });
}

export async function getPendingPlacementRegisteredLogs(params: {
  publicClient: PublicClient;
  epochId: number | bigint;
  fromBlock: bigint;
  toBlock: bigint;
  chunkSize?: bigint;
}) {
  const epochId = typeof params.epochId === "bigint" ? params.epochId : BigInt(params.epochId);
  return fetchEventLogs({
    publicClient: params.publicClient,
    address: VOTING_ADDRESS,
    event: PendingPlacementRegisteredEvent,
    args: { epochId },
    fromBlock: params.fromBlock,
    toBlock: params.toBlock,
    chunkSize: params.chunkSize,
  });
}

export async function getVoteCastLogs(params: {
  publicClient: PublicClient;
  epochId?: number | bigint;
  voter?: `0x${string}`;
  fromBlock: bigint;
  toBlock: bigint;
  chunkSize?: bigint;
}) {
  const args: Record<string, unknown> = {};
  if (params.epochId != null) {
    const epochId =
      typeof params.epochId === "bigint" ? params.epochId : BigInt(params.epochId);
    args.epochId = epochId;
  }
  if (params.voter) {
    args.voter = params.voter;
  }
  return fetchEventLogs({
    publicClient: params.publicClient,
    address: VOTING_ADDRESS,
    event: VoteCastEvent,
    args: Object.keys(args).length ? args : undefined,
    fromBlock: params.fromBlock,
    toBlock: params.toBlock,
    chunkSize: params.chunkSize,
  });
}

export async function getTxReceipt(
  publicClient: PublicClient,
  txHash: Hex
): Promise<TransactionReceipt> {
  if (FORCE_EXPLORER) {
    setExplorerMode(true);
    cacheRpcPrunedReceipts(true);
    return getExplorerReceipt(txHash);
  }

  const pruned = await shouldUseExplorer(publicClient);
  if (pruned) {
    setExplorerMode(true);
    cacheRpcPrunedReceipts(true);
    return getExplorerReceipt(txHash);
  }

  try {
    const receipt = await publicClient.getTransactionReceipt({ hash: txHash });
    setExplorerMode(false);
    return receipt;
  } catch (error) {
    if (error instanceof TransactionReceiptNotFoundError) {
      cacheRpcPrunedReceipts(true);
      setExplorerMode(true);
      return getExplorerReceipt(txHash);
    }
    throw error;
  }
}
