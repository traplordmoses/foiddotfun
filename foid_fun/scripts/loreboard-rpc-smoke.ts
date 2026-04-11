import "dotenv/config";
import {
  createPublicClient,
  defineChain,
  http,
  isAddress,
  type Address,
  type Chain,
  type Hex,
  type PublicClient,
  type Transport,
} from "viem";
import { CANONICAL_CHAIN } from "../src/config/canonical";

const EXPECTED_CHAIN_ID = BigInt(CANONICAL_CHAIN.id);
const DEFAULT_RPC = CANONICAL_CHAIN.rpcUrl;
const DEFAULT_BOARD = "0xE41B2D418C09Ea928E4F657ED2438f5D01472105" as Address;
const DEFAULT_TREASURY = "0x4A777d8650b3FA2419377F4ffeF0EF8007151536" as Address;
const DEFAULT_VOTING = "0xEbf065A7ca3917BB5e669982e8C6954cC27A7075" as Address;
const RAW_LOG_LOOKBACK = 2000n;
const DEFAULT_BLOCKSCOUT_API_BASE = "https://testnet.fluentscan.xyz/api";

function requireEnv(name: string, value?: string | null) {
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function parseOptionalNumber(value?: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseOptionalBigInt(value?: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return BigInt(trimmed);
}

function toBlockTag(blockNumber: bigint): Hex {
  return `0x${blockNumber.toString(16)}` as Hex;
}

function hexToBigInt(value: Hex): bigint {
  return BigInt(value);
}

function isEmptyCode(code: Hex) {
  return !code || code === "0x" || code === "0x0";
}

function isPrunedError(err: unknown): boolean {
  const message = (() => {
    if (!err) return "";
    if (typeof err === "string") return err;
    if (typeof err === "object" && "message" in err && typeof err.message === "string") {
      return err.message;
    }
    return "";
  })();
  const lower = message.toLowerCase();
  if (lower.includes("pruned") || lower.includes("state at block")) return true;
  if (typeof err === "object" && err) {
    const code = (err as { code?: number }).code;
    if (code === -32603) return true;
    const cause = (err as { cause?: unknown }).cause;
    if (cause && typeof cause === "object") {
      const causeMessage = (cause as { message?: string }).message;
      if (typeof causeMessage === "string") {
        const causeLower = causeMessage.toLowerCase();
        if (causeLower.includes("pruned") || causeLower.includes("state at block")) return true;
      }
      const causeCode = (cause as { code?: number }).code;
      if (causeCode === -32603) return true;
    }
  }
  return false;
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string) {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`Timeout after ${ms}ms (${label})`));
    }, ms);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });
}

async function rpcWithTimeout<T>(
  label: string,
  timeoutMs: number,
  fetcher: () => Promise<T>
) {
  return withTimeout(fetcher(), timeoutMs, label);
}

type RawLog = {
  blockNumber?: Hex;
  topics?: Hex[];
  data?: Hex;
};

async function main() {
  const rpc = requireEnv(
    "NEXT_PUBLIC_FLUENT_RPC or FLUENT_RPC_URL",
    process.env.NEXT_PUBLIC_FLUENT_RPC ??
      process.env.FLUENT_RPC_URL ??
      DEFAULT_RPC
  );

  const board =
    (process.env.NEXT_PUBLIC_LOREBOARD_BOARD_ADDRESS ??
      process.env.LOREBOARD_BOARD_ADDRESS ??
      DEFAULT_BOARD) as Address;
  const treasury =
    (process.env.NEXT_PUBLIC_LOREBOARD_ADDRESS ??
      DEFAULT_TREASURY) as Address;
  const voting =
    (process.env.NEXT_PUBLIC_LOREBOARD_VOTING_ADDRESS ??
      process.env.LOREBOARD_VOTING_ADDRESS ??
      DEFAULT_VOTING) as Address;

  for (const [label, addr] of [
    ["board", board],
    ["treasury", treasury],
    ["voting", voting],
  ] as const) {
    if (!isAddress(addr)) {
      throw new Error(`Invalid ${label} address: ${addr}`);
    }
  }

  const deployBlockEnv = parseOptionalBigInt(
    process.env.DEPLOY_BLOCK ??
      process.env.NEXT_PUBLIC_LOREBOARD_DEPLOY_BLOCK ??
      process.env.NEXT_PUBLIC_DEPLOY_BLOCK
  );

  const rpcTimeoutMs = parseOptionalNumber(process.env.RPC_TIMEOUT_MS) ?? 15_000;
  const rpcRetryCount = parseOptionalNumber(process.env.RPC_RETRY_COUNT) ?? 2;
  const rpcRetryDelay =
    parseOptionalNumber(process.env.RPC_RETRY_DELAY_MS) ?? 500;
  const blockscoutApiBase =
    process.env.BLOCKSCOUT_API_BASE ?? DEFAULT_BLOCKSCOUT_API_BASE;

  const fetchWithTimeout: typeof fetch = async (input, init = {}) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), rpcTimeoutMs);
    try {
      return await fetch(input, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timeoutId);
    }
  };

  const chain = defineChain({
    id: CANONICAL_CHAIN.id,
    name: CANONICAL_CHAIN.chainName,
    nativeCurrency: { name: "FLU", symbol: "FLU", decimals: 18 },
    rpcUrls: { default: { http: [rpc] } },
  });

  const transport = http(rpc, {
    timeout: rpcTimeoutMs,
    retryCount: rpcRetryCount,
    retryDelay: rpcRetryDelay,
    fetch: fetchWithTimeout,
  } as any);
  const publicClient: PublicClient<Transport, Chain> = createPublicClient({
    chain,
    transport,
  });

  const chainIdHex = await rpcWithTimeout(
    "eth_chainId",
    rpcTimeoutMs,
    () =>
      publicClient.request({
        method: "eth_chainId",
      }) as Promise<Hex>
  );
  const chainId = hexToBigInt(chainIdHex);
  const chainIdMatches = chainId === EXPECTED_CHAIN_ID;

  const latestBlock = await rpcWithTimeout(
    "getBlockNumber",
    rpcTimeoutMs,
    () => publicClient.getBlockNumber()
  );

  const deployBlock =
    deployBlockEnv ??
    (latestBlock > RAW_LOG_LOOKBACK ? latestBlock - RAW_LOG_LOOKBACK : 0n);
  if (deployBlockEnv === null) {
    console.warn(
      `[smoke] DEPLOY_BLOCK missing; using lookback deployBlock=${deployBlock.toString()}`
    );
  }

  const midBlock = deployBlock + (latestBlock - deployBlock) / 2n;

  const codeAt = async (addr: Address, tag: Hex | "latest") =>
    rpcWithTimeout(`eth_getCode ${addr} ${tag}`, rpcTimeoutMs, () =>
      publicClient.request({
        method: "eth_getCode",
        params: [addr, tag],
      }) as Promise<Hex>
    );

  const safeCodeAt = async (
    addr: Address,
    tag: Hex | "latest",
    label: string
  ): Promise<{ code: Hex | null; pruned: boolean; err?: string }> => {
    try {
      const code = await codeAt(addr, tag);
      return { code, pruned: false };
    } catch (err) {
      const errText = `${label}: ${String(err)}`;
      if (isPrunedError(err)) {
        return { code: null, pruned: true, err: errText };
      }
      return { code: null, pruned: false, err: errText };
    }
  };

  const [boardLatestCode, treasuryLatestCode] = await Promise.all([
    codeAt(board, "latest"),
    codeAt(treasury, "latest"),
  ]);

  const [boardDeployCode, treasuryDeployCode, boardMidCode, treasuryMidCode] =
    await Promise.all([
      safeCodeAt(board, toBlockTag(deployBlock), "board@deployBlock"),
      safeCodeAt(treasury, toBlockTag(deployBlock), "treasury@deployBlock"),
      safeCodeAt(board, toBlockTag(midBlock), "board@midBlock"),
      safeCodeAt(treasury, toBlockTag(midBlock), "treasury@midBlock"),
    ]);

  const txCountAt = async (addr: Address) =>
    rpcWithTimeout(`eth_getTransactionCount ${addr}`, rpcTimeoutMs, () =>
      publicClient.request({
        method: "eth_getTransactionCount",
        params: [addr, "latest"],
      }) as Promise<Hex>
    );

  const [boardTxHex, treasuryTxHex, votingTxHex] = await Promise.all([
    txCountAt(board),
    txCountAt(treasury),
    txCountAt(voting),
  ]);

  const boardTxCount = hexToBigInt(boardTxHex);
  const treasuryTxCount = hexToBigInt(treasuryTxHex);
  const votingTxCount = hexToBigInt(votingTxHex);
  const anyTx =
    boardTxCount > 0n || treasuryTxCount > 0n || votingTxCount > 0n;

  const logsFrom = latestBlock > RAW_LOG_LOOKBACK
    ? latestBlock - RAW_LOG_LOOKBACK
    : 0n;
  const logsTo = latestBlock;
  const logsFromTag = toBlockTag(logsFrom);
  const logsToTag = toBlockTag(logsTo);

  const getRawLogs = async (addr: Address) =>
    rpcWithTimeout(`eth_getLogs ${addr}`, rpcTimeoutMs, () =>
      publicClient.request({
        method: "eth_getLogs",
        params: [
          {
            address: addr,
            fromBlock: logsFromTag,
            toBlock: logsToTag,
          },
        ],
      }) as Promise<RawLog[]>
    );

  const [boardLogs, treasuryLogs] = await Promise.all([
    getRawLogs(board),
    getRawLogs(treasury),
  ]);
  const combinedLogs = [...boardLogs, ...treasuryLogs];

  console.log(
    `[smoke] chainId=${chainId.toString()} expected=${EXPECTED_CHAIN_ID.toString()} ok=${chainIdMatches}`
  );
  console.log(`[smoke] latestBlock=${latestBlock.toString()}`);
  console.log(
    `[smoke] deployBlock=${deployBlock.toString()} midBlock=${midBlock.toString()}`
  );

  const summarizeCode = (
    label: string,
    result: { code: Hex | null; pruned?: boolean; err?: string }
  ) => {
    const code = result.code ?? "0x";
    const empty = isEmptyCode(code);
    const size = code.length > 2 ? (code.length - 2) / 2 : 0;
    const prunedSuffix =
      typeof result.pruned === "boolean" ? ` pruned=${result.pruned}` : "";
    console.log(`[smoke] code ${label}${prunedSuffix} empty=${empty} bytes=${size}`);
    if (result.err && !result.pruned) {
      console.warn(`[smoke] code ${label} error=${result.err}`);
    }
  };

  summarizeCode("board@latest", { code: boardLatestCode });
  summarizeCode("treasury@latest", { code: treasuryLatestCode });
  summarizeCode("board@deployBlock", boardDeployCode);
  summarizeCode("treasury@deployBlock", treasuryDeployCode);
  summarizeCode("board@midBlock", boardMidCode);
  summarizeCode("treasury@midBlock", treasuryMidCode);

  const historicalPruned =
    boardDeployCode.pruned ||
    treasuryDeployCode.pruned ||
    boardMidCode.pruned ||
    treasuryMidCode.pruned;

  console.log(
    `[smoke] txCount board=${boardTxCount.toString()} treasury=${treasuryTxCount.toString()} voting=${votingTxCount.toString()}`
  );

  console.log(
    `[smoke] rawLogs range=${logsFrom.toString()}-${logsTo.toString()} board=${boardLogs.length} treasury=${treasuryLogs.length}`
  );

  let blockscoutHasLogs = false;
  if (process.env.USE_BLOCKSCOUT_LOGS === "1") {
    const buildUrl = (address: Address) => {
      const url = new URL(blockscoutApiBase);
      url.searchParams.set("module", "logs");
      url.searchParams.set("action", "getLogs");
      url.searchParams.set("address", address);
      url.searchParams.set("fromBlock", logsFrom.toString());
      url.searchParams.set("toBlock", logsTo.toString());
      return url.toString();
    };
    const fetchBlockscoutLogs = async (address: Address) =>
      rpcWithTimeout(`blockscout getLogs ${address}`, rpcTimeoutMs, async () => {
        const res = await fetch(buildUrl(address));
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { result?: unknown };
        return Array.isArray(data.result) ? data.result.length : 0;
      });

    const [boardBlockscoutCount, treasuryBlockscoutCount] = await Promise.all([
      fetchBlockscoutLogs(board),
      fetchBlockscoutLogs(treasury),
    ]);
    blockscoutHasLogs =
      boardBlockscoutCount > 0 || treasuryBlockscoutCount > 0;
    console.log(
      `[smoke] blockscoutLogs range=${logsFrom.toString()}-${logsTo.toString()} board=${boardBlockscoutCount} treasury=${treasuryBlockscoutCount}`
    );
  }

  if (combinedLogs.length === 0) {
    console.log("[smoke] rawLogs empty for board+treasury");
  } else {
    const counts = new Map<string, number>();
    for (const log of combinedLogs) {
      const topic0 = log.topics?.[0];
      if (!topic0) continue;
      counts.set(topic0, (counts.get(topic0) ?? 0) + 1);
    }
    const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
    const top = sorted.slice(0, 5);
    for (const [topic, count] of top) {
      console.log(`[smoke] topic0 ${topic} count=${count}`);
    }
    const sample = combinedLogs[0];
    const dataLen = sample.data ? sample.data.length : 0;
    const topicsLen = sample.topics?.length ?? 0;
    console.log(
      `[smoke] sample block=${sample.blockNumber ?? "unknown"} topic0=${sample.topics?.[0] ?? ""} topicsLen=${topicsLen} dataLen=${dataLen}`
    );
  }

  let exitCode = 0;
  let conclusion = "OK";
  const boardNoCode = isEmptyCode(boardLatestCode);
  const treasuryNoCode = isEmptyCode(treasuryLatestCode);

  if (!chainIdMatches) {
    conclusion = `CHAIN_ID_MISMATCH expected=${EXPECTED_CHAIN_ID.toString()} got=${chainId.toString()}`;
    exitCode = 1;
  } else if (boardNoCode || treasuryNoCode) {
    conclusion =
      "ADDRESS_NO_CODE check board/treasury addresses or chain history";
    exitCode = 3;
  } else if (combinedLogs.length === 0 && anyTx && blockscoutHasLogs) {
    conclusion = "RPC_LOGS_UNAVAILABLE_BUT_BLOCKSCOUT_HAS_LOGS";
    exitCode = 0;
  } else if (combinedLogs.length === 0 && anyTx) {
    conclusion =
      "RPC_NO_LOGS_BUT_TXCOUNT_NONZERO enable USE_BLOCKSCOUT_LOGS=1 to accept Blockscout logs";
    exitCode = 2;
  } else if (combinedLogs.length === 0) {
    conclusion = historicalPruned ? "PRUNED_HISTORICAL_STATE" : "NO_ACTIVITY_CONFIRMED";
  } else {
    conclusion = historicalPruned
      ? "PRUNED_HISTORICAL_STATE"
      : "LOGS_PRESENT activity_detected";
  }

  const summary = exitCode === 0 ? "PASS" : "FAIL";
  console.log(`[smoke] summary=${summary} exitCode=${exitCode}`);
  console.log(`[smoke] conclusion=${conclusion}`);

  if (exitCode !== 0) {
    process.exitCode = exitCode;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
