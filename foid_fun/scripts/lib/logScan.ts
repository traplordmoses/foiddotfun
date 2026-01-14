import type { AbiEvent, Address, Chain, Hex, PublicClient, Transport } from "viem";
import { sleep, withTimeout } from "./rpc";
import type { LogItem, LogResult } from "./logTypes";

const MAX_LOG_BLOCK_RANGE = 100_000n;
const DEFAULT_LOG_CHUNK_SIZE = 20_000n;
const MIN_LOG_CHUNK_SIZE = 2_000n;
const MAX_LOG_CHUNK_SIZE = 100_000n;
const LOG_CHUNK_TIMEOUT_MS = 15_000;
const LOG_CHUNK_RETRIES = 2;
const LOG_CHUNK_RETRY_BASE_MS = 500;

async function fetchLogsWithRetries(params: {
  logPrefix: string;
  label: string;
  fetcher: () => Promise<LogResult>;
  timeoutMs: number;
  retryCount: number;
  retryBaseMs: number;
}) {
  let attempt = 0;
  while (attempt <= params.retryCount) {
    try {
      const result = await withTimeout(
        params.fetcher(),
        params.timeoutMs,
        params.label
      );
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (attempt >= params.retryCount) {
        throw new Error(
          `[${params.logPrefix}] getLogs failed after retries: ${params.label} error=${msg}`
        );
      }
      const backoff = params.retryBaseMs * 2 ** attempt;
      console.warn(
        `[${params.logPrefix}] getLogs retry ${attempt + 1}/${params.retryCount} ${params.label} error=${msg} backoff=${backoff}ms`
      );
      await sleep(backoff);
      attempt += 1;
    }
  }
  throw new Error(
    `[${params.logPrefix}] getLogs retries exhausted: ${params.label}`
  );
}

export async function getLogsChunkedAdaptive(params: {
  address: Address;
  fromBlock: bigint;
  toBlock: bigint;
  chunkSize: bigint;
  minChunkSize: bigint;
  maxChunkSize: bigint;
  timeoutMs: number;
  retryCount: number;
  retryBaseMs: number;
  label: string;
  debug: boolean;
  logPrefix?: string;
  fetcher: (range: { fromBlock: bigint; toBlock: bigint }) => Promise<LogResult>;
}) {
  if (params.toBlock < params.fromBlock) return [];
  const logs: LogItem[] = [];
  let chunkSize = params.chunkSize;
  const debug = params.debug;
  const logPrefix = params.logPrefix ?? "logs";
  let start = params.fromBlock;

  if (debug) {
    console.log(
      `[${logPrefix}] ${params.label} chunking init size=${chunkSize.toString()} min=${params.minChunkSize.toString()} max=${params.maxChunkSize.toString()}`
    );
  }

  while (start <= params.toBlock) {
    const end = start + chunkSize - 1n;
    const toBlock = end > params.toBlock ? params.toBlock : end;
    const rangeLabel = `${params.label} ${params.address} ${start}-${toBlock} chunkSize=${chunkSize.toString()}`;
    const startedAt = Date.now();

    try {
      const batch = await fetchLogsWithRetries({
        logPrefix,
        label: rangeLabel,
        timeoutMs: params.timeoutMs,
        retryCount: params.retryCount,
        retryBaseMs: params.retryBaseMs,
        fetcher: () => params.fetcher({ fromBlock: start, toBlock }),
      });
      logs.push(...batch);
      const elapsed = Date.now() - startedAt;
      if (elapsed < 2000 && chunkSize < params.maxChunkSize) {
        const next = chunkSize * 2n;
        const increased =
          next > params.maxChunkSize ? params.maxChunkSize : next;
        if (increased !== chunkSize && debug) {
          console.log(
            `[${logPrefix}] ${params.label} chunkSize up ${chunkSize.toString()} -> ${increased.toString()} (${elapsed}ms)`
          );
        }
        chunkSize = increased;
      }
      start = toBlock + 1n;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (chunkSize <= params.minChunkSize) {
        throw new Error(
          `[${logPrefix}] getLogs failed: address=${params.address} fromBlock=${start} toBlock=${toBlock} chunkSize=${chunkSize.toString()} error=${msg}`
        );
      }
      const next = chunkSize / 2n;
      const reduced = next < params.minChunkSize ? params.minChunkSize : next;
      if (debug) {
        console.warn(
          `[${logPrefix}] ${params.label} chunkSize down ${chunkSize.toString()} -> ${reduced.toString()} error=${msg}`
        );
      }
      chunkSize = reduced;
    }
  }

  return logs;
}

export function resolveBoardLogBounds(params: {
  latest: bigint;
  deployBlock: bigint | null;
  lookbackBlocks: bigint | null;
}) {
  const { latest, deployBlock, lookbackBlocks } = params;
  if (deployBlock !== null) {
    return {
      fromBlock: deployBlock,
      toBlock: latest,
      source: "deploy-block",
      lookbackUsed: null as bigint | null,
    };
  }
  if (lookbackBlocks !== null && lookbackBlocks > 0n) {
    const fromBlock = latest > lookbackBlocks ? latest - lookbackBlocks : 0n;
    return {
      fromBlock,
      toBlock: latest,
      source: "lookback",
      lookbackUsed: lookbackBlocks,
    };
  }
  const defaultFrom = latest > MAX_LOG_BLOCK_RANGE ? latest - MAX_LOG_BLOCK_RANGE : 0n;
  return {
    fromBlock: defaultFrom,
    toBlock: latest,
    source: "default",
    lookbackUsed: MAX_LOG_BLOCK_RANGE,
  };
}

export async function getLogsChunkedEvent(params: {
  publicClient: PublicClient<Transport, Chain | undefined, any>;
  address: Address;
  event: AbiEvent;
  fromBlock: bigint;
  toBlock: bigint;
  chunkSize?: bigint;
  debug?: boolean;
  timeoutMs?: number;
  retryCount?: number;
  retryBaseMs?: number;
}) {
  const chunkSize = params.chunkSize ?? DEFAULT_LOG_CHUNK_SIZE;
  const timeoutMs = params.timeoutMs ?? LOG_CHUNK_TIMEOUT_MS;
  return getLogsChunkedAdaptive({
    address: params.address,
    fromBlock: params.fromBlock,
    toBlock: params.toBlock,
    chunkSize,
    minChunkSize: MIN_LOG_CHUNK_SIZE,
    maxChunkSize: MAX_LOG_CHUNK_SIZE,
    timeoutMs,
    retryCount: params.retryCount ?? LOG_CHUNK_RETRIES,
    retryBaseMs: params.retryBaseMs ?? LOG_CHUNK_RETRY_BASE_MS,
    label: "getLogs event",
    debug: params.debug ?? false,
    fetcher: (range) =>
      params.publicClient.getLogs({
        address: params.address,
        event: params.event,
        fromBlock: range.fromBlock,
        toBlock: range.toBlock,
      }) as Promise<LogResult>,
  });
}

export async function getLogsChunkedRaw(params: {
  publicClient: PublicClient<Transport, Chain | undefined, any>;
  address: Address;
  fromBlock: bigint;
  toBlock: bigint;
  chunkSize?: bigint;
  debug?: boolean;
  timeoutMs?: number;
  retryCount?: number;
  retryBaseMs?: number;
}) {
  const chunkSize = params.chunkSize ?? DEFAULT_LOG_CHUNK_SIZE;
  const timeoutMs = params.timeoutMs ?? LOG_CHUNK_TIMEOUT_MS;
  return getLogsChunkedAdaptive({
    address: params.address,
    fromBlock: params.fromBlock,
    toBlock: params.toBlock,
    chunkSize,
    minChunkSize: MIN_LOG_CHUNK_SIZE,
    maxChunkSize: MAX_LOG_CHUNK_SIZE,
    timeoutMs,
    retryCount: params.retryCount ?? LOG_CHUNK_RETRIES,
    retryBaseMs: params.retryBaseMs ?? LOG_CHUNK_RETRY_BASE_MS,
    label: "getLogs raw",
    debug: params.debug ?? false,
    fetcher: (range) =>
      params.publicClient.getLogs({
        address: params.address,
        fromBlock: range.fromBlock,
        toBlock: range.toBlock,
      }) as Promise<LogResult>,
  });
}

export async function getLogsChunkedTopic0(params: {
  publicClient: PublicClient<Transport, Chain | undefined, any>;
  address: Address;
  topic0: Hex;
  fromBlock: bigint;
  toBlock: bigint;
  chunkSize?: bigint;
  debug?: boolean;
  timeoutMs?: number;
  retryCount?: number;
  retryBaseMs?: number;
}) {
  const chunkSize = params.chunkSize ?? DEFAULT_LOG_CHUNK_SIZE;
  const timeoutMs = params.timeoutMs ?? LOG_CHUNK_TIMEOUT_MS;
  return getLogsChunkedAdaptive({
    address: params.address,
    fromBlock: params.fromBlock,
    toBlock: params.toBlock,
    chunkSize,
    minChunkSize: MIN_LOG_CHUNK_SIZE,
    maxChunkSize: MAX_LOG_CHUNK_SIZE,
    timeoutMs,
    retryCount: params.retryCount ?? LOG_CHUNK_RETRIES,
    retryBaseMs: params.retryBaseMs ?? LOG_CHUNK_RETRY_BASE_MS,
    label: "getLogs topic0",
    debug: params.debug ?? false,
    fetcher: (range) =>
      params.publicClient.getLogs({
        address: params.address,
        topics: [params.topic0],
        fromBlock: range.fromBlock,
        toBlock: range.toBlock,
      } as any) as Promise<LogResult>,
  });
}
