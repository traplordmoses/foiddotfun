import type { Address, Chain, Hex, PublicClient, Transport } from "viem";
import { fetchJsonWithRetries } from "./rpc";
import { getLogsChunkedAdaptive } from "./logScan";
import type { BlockscoutLogItem, LogItem, LogResult } from "./logTypes";

const DEFAULT_LOG_CHUNK_SIZE = 20_000n;
const MIN_LOG_CHUNK_SIZE = 2_000n;
const MAX_LOG_CHUNK_SIZE = 100_000n;

type BlockscoutLog = {
  address?: string;
  topics?: string[];
  data?: string;
  blockNumber?: string;
  transactionHash?: string;
  logIndex?: string;
  topic0?: string;
  topic1?: string;
  topic2?: string;
  topic3?: string;
};

function parseHexOrDecimalToBigInt(value: string): bigint | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("0x")) {
    try {
      return BigInt(trimmed);
    } catch {
      return null;
    }
  }
  try {
    return BigInt(trimmed);
  } catch {
    return null;
  }
}

export function normalizeBlockscoutLog(
  raw: BlockscoutLog
): BlockscoutLogItem | null {
  const address = raw.address;
  if (!address || !address.startsWith("0x")) return null;
  const data = typeof raw.data === "string" ? (raw.data as Hex) : "0x";
  let topics = Array.isArray(raw.topics)
    ? (raw.topics.filter((topic) => typeof topic === "string") as Hex[])
    : [];
  if (topics.length === 0) {
    const topicCandidates = [raw.topic0, raw.topic1, raw.topic2, raw.topic3]
      .filter((topic): topic is string => !!topic)
      .filter((topic) => topic.startsWith("0x"));
    topics = topicCandidates as Hex[];
  }
  const blockNumberRaw = raw.blockNumber ?? "";
  const blockNumber = parseHexOrDecimalToBigInt(blockNumberRaw);
  if (blockNumber === null) return null;
  const transactionHash =
    raw.transactionHash && raw.transactionHash.startsWith("0x")
      ? (raw.transactionHash as Hex)
      : undefined;
  const logIndexRaw = raw.logIndex ?? "";
  const logIndex = logIndexRaw ? parseHexOrDecimalToBigInt(logIndexRaw) : null;
  return {
    address: address as Address,
    topics,
    data,
    blockNumber,
    transactionHash,
    logIndex: logIndex ?? undefined,
  };
}

export async function getLogsFromBlockscout(params: {
  apiBase: string;
  address: `0x${string}`;
  fromBlock: bigint;
  toBlock: bigint;
  topic0?: `0x${string}`;
  timeoutMs: number;
  retryCount: number;
  retryDelayMs: number;
  debug: boolean;
}): Promise<LogResult> {
  const offset = 1000;
  const makeUrl = (paramsObj: Record<string, string>) => {
    const url = new URL(params.apiBase);
    for (const [key, value] of Object.entries(paramsObj)) {
      url.searchParams.set(key, value);
    }
    return url.toString();
  };

  const fetchRange = async (range: { fromBlock: bigint; toBlock: bigint }) => {
    const baseParams: Record<string, string> = {
      module: "logs",
      action: "getLogs",
      address: params.address,
      fromBlock: range.fromBlock.toString(),
      toBlock: range.toBlock.toString(),
    };
    if (params.topic0) baseParams.topic0 = params.topic0;

    const tryParams = async (extraParams: Record<string, string>) => {
      const url = makeUrl({ ...baseParams, ...extraParams });
      return fetchJsonWithRetries<any>({
        label: "getLogs",
        url,
        timeoutMs: params.timeoutMs,
        retryCount: params.retryCount,
        retryDelayMs: params.retryDelayMs,
        debug: params.debug,
      });
    };

    let results: BlockscoutLog[] = [];
    let page = 1;
    let paginationSupported = true;

    while (paginationSupported) {
      const response = await tryParams({
        page: page.toString(),
        offset: offset.toString(),
      });
      if (response?.status === "0" && response?.message) {
        const msg = String(response.message).toLowerCase();
        if (msg.includes("no records")) return [];
        if (msg.includes("invalid") || msg.includes("unsupported")) {
          paginationSupported = false;
          break;
        }
      }
      const batch = Array.isArray(response?.result)
        ? (response.result as BlockscoutLog[])
        : [];
      results.push(...batch);
      if (batch.length < offset) break;
      page += 1;
    }

    if (!paginationSupported) {
      const response = await tryParams({});
      if (response?.status === "0" && response?.message) {
        const msg = String(response.message).toLowerCase();
        if (msg.includes("no records")) return [];
      }
      results = Array.isArray(response?.result)
        ? (response.result as BlockscoutLog[])
        : [];
      if (results.length === 0) {
        const altResponse = await fetchJsonWithRetries<any>({
          label: "getLogs alt",
          url: makeUrl({
            module: "logs",
            action: "getLogs",
            address: params.address,
            startblock: range.fromBlock.toString(),
            endblock: range.toBlock.toString(),
            ...(params.topic0 ? { topic0: params.topic0 } : {}),
          }),
          timeoutMs: params.timeoutMs,
          retryCount: params.retryCount,
          retryDelayMs: params.retryDelayMs,
          debug: params.debug,
        });
        results = Array.isArray(altResponse?.result)
          ? (altResponse.result as BlockscoutLog[])
          : [];
      }
    }

    return results;
  };

  if (params.debug) {
    console.log(
      `[blockscout] chunking init size=${DEFAULT_LOG_CHUNK_SIZE.toString()} min=${MIN_LOG_CHUNK_SIZE.toString()} max=${MAX_LOG_CHUNK_SIZE.toString()}`
    );
  }

  const logs = await getLogsChunkedAdaptive({
    address: params.address as Address,
    fromBlock: params.fromBlock,
    toBlock: params.toBlock,
    chunkSize: DEFAULT_LOG_CHUNK_SIZE,
    minChunkSize: MIN_LOG_CHUNK_SIZE,
    maxChunkSize: MAX_LOG_CHUNK_SIZE,
    timeoutMs: params.timeoutMs,
    retryCount: 0,
    retryBaseMs: params.retryDelayMs,
    label: "getLogs",
    debug: false,
    logPrefix: "blockscout",
    fetcher: async (range) => {
      const batch = await fetchRange(range);
      if (params.debug) {
        const chunkSize = range.toBlock - range.fromBlock + 1n;
        const rangeLabel = `${params.address} ${range.fromBlock}-${range.toBlock} chunkSize=${chunkSize.toString()}`;
        console.log(`[blockscout] fetched range ${rangeLabel}`);
      }
      const normalized: LogItem[] = [];
      for (const raw of batch) {
        const parsed = normalizeBlockscoutLog(raw);
        if (parsed) normalized.push(parsed);
      }
      return normalized;
    },
  });

  return logs as LogResult;
}
