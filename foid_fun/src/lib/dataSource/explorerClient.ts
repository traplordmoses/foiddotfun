import type { TransactionReceipt, Log } from "viem";
import { CHAIN_CONFIG } from "@/lib/contracts/addresses";

const BASE_URL = (process.env.NEXT_PUBLIC_EXPLORER_API_BASE ?? CHAIN_CONFIG.blockExplorer)
  .replace(/\/+$/, "");

const FETCH_TIMEOUT_MS = 10_000;
const FETCH_RETRY_DELAYS = [0, 400, 900];
const DEFAULT_WINDOW = 10_000n;
const MIN_WINDOW = 2_000n;
const LOG_PAGE_SIZE = 1_000;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const EMPTY_HASH = "0x" + "0".repeat(64);
const EMPTY_LOGS_BLOOM = "0x" + "0".repeat(512);

export interface ExplorerLogFilter {
  address: `0x${string}`;
  fromBlock: bigint;
  toBlock: bigint;
  topics?: (string | null)[];
}

export interface ExplorerLogItem {
  address: `0x${string}`;
  blockHash: `0x${string}` | null;
  blockNumber: bigint;
  data: `0x${string}`;
  logIndex: number | null;
  transactionHash: `0x${string}` | null;
  transactionIndex: number | null;
  topics: `0x${string}`[];
  removed: boolean;
}

class ExplorerRangeTooLargeError extends Error {}

async function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < FETCH_RETRY_DELAYS.length; attempt++) {
    if (attempt > 0) {
      await wait(FETCH_RETRY_DELAYS[attempt]);
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(url, { ...init, signal: controller.signal });
      if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new Error(`Explorer request failed (${response.status}): ${body}`);
      }
      const json = (await response.json()) as T;
      return json;
    } catch (error) {
      lastError = error;
      if (attempt === FETCH_RETRY_DELAYS.length - 1) {
        throw error;
      }
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError;
}

function buildLogUrl(filter: ExplorerLogFilter, page: number) {
  const params = new URLSearchParams({
    module: "logs",
    action: "getLogs",
    fromBlock: filter.fromBlock.toString(),
    toBlock: filter.toBlock.toString(),
    address: filter.address,
    page: page.toString(),
    offset: LOG_PAGE_SIZE.toString(),
  });

  filter.topics?.forEach((topic, index) => {
    if (topic === null || topic === undefined) return;
    const key = `topic${index}`;
    params.set(key, topic);
  });

  return `${BASE_URL}/api?${params.toString()}`;
}

function hasRangeTooLargeMessage(message?: string) {
  const normalized = message?.toLowerCase() ?? "";
  return (
    /max results/i.test(normalized) ||
    /max records/i.test(normalized) ||
    /limit reached/i.test(normalized) ||
    /please narrow/i.test(normalized)
  );
}

function hasNoLogsMessage(message?: string) {
  const normalized = message?.toLowerCase() ?? "";
  return /no (records|results|logs)/i.test(normalized);
}

async function fetchLogsForRange(filter: ExplorerLogFilter, page = 1): Promise<ExplorerLogItem[]> {
  const logs: ExplorerLogItem[] = [];
  while (true) {
    const url = buildLogUrl(filter, page);
    const response = await fetchJson<{ status?: string; message?: string; result?: unknown }>(url);
    const { status, message } = response;
    let result = response.result;
    if (typeof result === "string") {
      try {
        result = JSON.parse(result);
      } catch {
        result = undefined;
      }
    }

    if (status === "0" && hasRangeTooLargeMessage(message)) {
      throw new ExplorerRangeTooLargeError("Explorer log range too large");
    }

    if (status === "0" && hasNoLogsMessage(message)) {
      break;
    }

    if (Array.isArray(result) && result.length > 0) {
      logs.push(...result.map((item) => normalizeExplorerLog(item as ExplorerRawLog)));
      if (result.length < LOG_PAGE_SIZE) {
        break;
      }
    } else if (status === "0") {
      break;
    } else {
      break;
    }

    page += 1;
  }
  return logs;
}

interface ExplorerRawLog {
  address?: string;
  blockHash?: string;
  blockNumber?: string;
  data?: string;
  logIndex?: string;
  transactionHash?: string;
  transactionIndex?: string;
  topics?: string[];
  removed?: boolean | string;
}

function parseQuantity(value?: string | number | null): bigint {
  if (value === undefined || value === null || value === "") {
    return 0n;
  }
  if (typeof value === "number") {
    return BigInt(value);
  }
  if (typeof value === "string") {
    if (value.startsWith("0x") || value.startsWith("0X")) {
      return BigInt(value);
    }
    const normalized = value.replace(/\D+/g, "");
    if (normalized === "") {
      return 0n;
    }
    return BigInt(normalized);
  }
  return 0n;
}

function parseNumber(value?: string | number | null): number | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  try {
    return Number(parseQuantity(value));
  } catch {
    return null;
  }
}

function normalizeTopic(topic?: string): `0x${string}` | null {
  if (!topic) return null;
  return topic as `0x${string}`;
}

function normalizeExplorerLog(raw: ExplorerRawLog): ExplorerLogItem {
  const topics = (raw.topics ?? []).map((topic) => normalizeTopic(topic)).filter((topic): topic is `0x${string}` => Boolean(topic));
  return {
    address: (raw.address ?? ZERO_ADDRESS) as `0x${string}`,
    blockHash: (raw.blockHash ?? EMPTY_HASH) as `0x${string}`,
    blockNumber: parseQuantity(raw.blockNumber),
    data: (raw.data ?? "0x") as `0x${string}`,
    logIndex: parseNumber(raw.logIndex),
    transactionHash: (raw.transactionHash ?? EMPTY_HASH) as `0x${string}`,
    transactionIndex: parseNumber(raw.transactionIndex),
    topics,
    removed: raw.removed === true || raw.removed === "true" || raw.removed === "1",
  };
}

export async function getExplorerLogs(
  filter: ExplorerLogFilter,
  chunkSize: bigint | undefined = undefined
): Promise<ExplorerLogItem[]> {
  if (filter.fromBlock > filter.toBlock) {
    return [];
  }

  const window = chunkSize && chunkSize > 0n ? chunkSize : DEFAULT_WINDOW;
  return collectLogs(filter, window);
}

async function collectLogs(filter: ExplorerLogFilter, chunkSize: bigint): Promise<ExplorerLogItem[]> {
  const chunkWindow = chunkSize > 0n ? chunkSize : DEFAULT_WINDOW;
  let cursor = filter.fromBlock;
  const collected: ExplorerLogItem[] = [];

  while (cursor <= filter.toBlock) {
    const end = filter.toBlock < cursor + chunkWindow - 1n ? filter.toBlock : cursor + chunkWindow - 1n;
    try {
      const chunkLogs = await fetchLogsForRange({ ...filter, fromBlock: cursor, toBlock: end });
      collected.push(...chunkLogs);
      cursor = end + 1n;
    } catch (error) {
      if (error instanceof ExplorerRangeTooLargeError) {
        if (chunkWindow <= MIN_WINDOW) {
          throw error;
        }
        const smallerWindow =
          chunkWindow <= MIN_WINDOW * 2n ? MIN_WINDOW : chunkWindow / 2n;
        if (smallerWindow >= chunkWindow) {
          throw error;
        }
        const fallbackLogs = await collectLogs(
          { ...filter, fromBlock: cursor, toBlock: end },
          smallerWindow
        );
        collected.push(...fallbackLogs);
        cursor = end + 1n;
      } else {
        throw error;
      }
    }
  }

  return collected;
}

function normalizeReceiptStatus(value: unknown): "success" | "reverted" {
  if (
    value === "0" ||
    value === "0x0" ||
    value === 0 ||
    value === false ||
    (typeof value === "string" && value.toLowerCase() === "reverted")
  ) {
    return "reverted";
  }
  return "success";
}

function normalizeTransactionType(value?: string | number | null): TransactionReceipt["type"] {
  if (typeof value === "number") {
    if (value === 1) return "eip2930";
    if (value === 2) return "eip1559";
    return "legacy";
  }
  if (typeof value === "string") {
    if (value === "0x2" || value === "2") return "eip1559";
    if (value === "0x1" || value === "1") return "eip2930";
    if (value === "0x0" || value === "0") return "legacy";
    return value as TransactionReceipt["type"];
  }
  return "legacy";
}

function normalizeAddress(value?: string | null): `0x${string}` | null {
  if (!value || value === "null") return null;
  return value as `0x${string}`;
}

function parseReceiptPayload(payload: any, txHash: `0x${string}`): TransactionReceipt {
  const logs = Array.isArray(payload.logs)
    ? payload.logs.map((item: ExplorerRawLog) => normalizeExplorerLog(item))
    : [];

  const blockHash = payload.blockHash ?? payload.blockHashHex ?? EMPTY_HASH;
  const transactionHash = payload.transactionHash ?? txHash;

  return {
    blockHash: (blockHash ?? EMPTY_HASH) as `0x${string}`,
    blockNumber: parseQuantity(payload.blockNumber || payload.blockNumberHex),
    contractAddress: normalizeAddress(payload.contractAddress),
    cumulativeGasUsed: parseQuantity(payload.cumulativeGasUsed),
    effectiveGasPrice: parseQuantity(payload.effectiveGasPrice ?? payload.gasPrice),
    from: normalizeAddress(payload.from) ?? (ZERO_ADDRESS as `0x${string}`),
    gasUsed: parseQuantity(payload.gasUsed),
    logs: logs as Log[],
    logsBloom: (payload.logsBloom ?? payload.logBloom ?? EMPTY_LOGS_BLOOM) as `0x${string}`,
    status: normalizeReceiptStatus(payload.status),
    to: normalizeAddress(payload.to),
    transactionHash: transactionHash as `0x${string}`,
    transactionIndex: parseNumber(payload.transactionIndex) ?? 0,
    type: normalizeTransactionType(payload.type),
  };
}

function tryExtractPayload(source: any) {
  if (!source || typeof source !== "object") {
    return null;
  }
  if ("receipt" in source && source.receipt) {
    return source.receipt;
  }
  if ("data" in source && source.data) {
    return source.data;
  }
  if ("result" in source && source.result) {
    return source.result;
  }
  return source;
}

export async function getExplorerReceipt(txHash: `0x${string}`): Promise<TransactionReceipt> {
  const v2Url = `${BASE_URL}/api/v2/transactions/${txHash}`;
  try {
    const v2Response = await fetchJson<any>(v2Url);
    const payload = tryExtractPayload(v2Response);
    if (payload) {
      return parseReceiptPayload(payload, txHash);
    }
  } catch (error) {
    // ignore and fallback to proxy
  }

  const proxyParams = new URLSearchParams({
    module: "proxy",
    action: "eth_getTransactionReceipt",
    txhash: txHash,
  });
  const proxyUrl = `${BASE_URL}/api?${proxyParams.toString()}`;
  const proxyResponse = await fetchJson<any>(proxyUrl);
  const payload = tryExtractPayload(proxyResponse);
  if (!payload) {
    throw new Error("Explorer returned no receipt data");
  }
  return parseReceiptPayload(payload, txHash);
}
