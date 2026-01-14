import "dotenv/config";
import path from "path";
import { fileURLToPath } from "url";
import {
  createPublicClient,
  decodeEventLog,
  defineChain,
  getEventSelector,
  http,
  type Abi,
  type AbiEvent,
  type Address,
  type Chain,
  type Hex,
  type PublicClient,
  type Transport,
} from "viem";
import treasuryAbi from "../src/abi/LoreBoardTreasury.json" assert { type: "json" };
import boardAbi from "../src/abi/LoreboardBoardV2.json" assert { type: "json" };

const MAX_LOG_BLOCK_RANGE = 100_000n;
const LOG_CHUNK_TIMEOUT_MS = 15_000;
const LOG_CHUNK_RETRIES = 2;
const LOG_CHUNK_RETRY_BASE_MS = 500;
const DEFAULT_LOG_CHUNK_SIZE = 20_000n;
const MIN_LOG_CHUNK_SIZE = 2_000n;
const MAX_LOG_CHUNK_SIZE = 100_000n;

const getEventByName = (abi: Abi, name: string): AbiEvent => {
  const event = abi.find((item) => item.type === "event" && item.name === name);
  if (!event) {
    throw new Error(`Missing ${name} event in ABI`);
  }
  return event as AbiEvent;
};

const getPlacementProposedEvent = (abi: Abi): AbiEvent => {
  const event = abi.find(
    (item) => item.type === "event" && item.name === "PlacementProposed"
  );
  if (!event) {
    throw new Error("Missing PlacementProposed event in LoreboardBoardV2 ABI");
  }
  return event as AbiEvent;
};

const PLACEMENT_PROPOSED_EVENT = getPlacementProposedEvent(boardAbi as Abi);
const TREASURY_PROPOSED_EVENT = getEventByName(
  treasuryAbi as Abi,
  "ProposedEvt"
);

type RawLogItem = Awaited<
  ReturnType<PublicClient<Transport, Chain | undefined, any>["getLogs"]>
>[number];
type LogItem = RawLogItem & { args?: any };
type LogResult = LogItem[];

function requireEnv(name: string, value?: string | null) {
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function parseOptionalBigInt(value?: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return BigInt(trimmed);
}

function parseOptionalNumber(value?: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseEpochOverride(args: string[]) {
  const envEpoch = process.env.EPOCH;
  if (envEpoch) {
    const parsed = Number(envEpoch);
    if (Number.isFinite(parsed)) return Math.floor(parsed);
  }

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (!arg) continue;
    if (arg === "--") continue;
    if (arg === "--epoch" && args[i + 1]) {
      const parsed = Number(args[i + 1]);
      if (Number.isFinite(parsed)) return Math.floor(parsed);
    }
    if (arg.startsWith("--epoch=")) {
      const parsed = Number(arg.split("=", 2)[1]);
      if (Number.isFinite(parsed)) return Math.floor(parsed);
    }
    const parsed = Number(arg);
    if (Number.isFinite(parsed)) return Math.floor(parsed);
  }

  return null;
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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchLogsWithRetries(params: {
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
          `[logs] getLogs failed after retries: ${params.label} error=${msg}`
        );
      }
      const backoff = params.retryBaseMs * 2 ** attempt;
      console.warn(
        `[logs] getLogs retry ${attempt + 1}/${params.retryCount} ${params.label} error=${msg} backoff=${backoff}ms`
      );
      await sleep(backoff);
      attempt += 1;
    }
  }
  throw new Error(`[logs] getLogs retries exhausted: ${params.label}`);
}

async function getLogsChunkedAdaptive(params: {
  publicClient: PublicClient<Transport, Chain | undefined, any>;
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
  fetcher: (range: { fromBlock: bigint; toBlock: bigint }) => Promise<LogResult>;
}) {
  if (params.toBlock < params.fromBlock) return [];
  const logs: LogItem[] = [];
  let chunkSize = params.chunkSize;
  const debug = params.debug;
  let start = params.fromBlock;

  if (debug) {
    console.log(
      `[logs] ${params.label} chunking init size=${chunkSize.toString()} min=${params.minChunkSize.toString()} max=${params.maxChunkSize.toString()}`
    );
  }

  while (start <= params.toBlock) {
    const end = start + chunkSize - 1n;
    const toBlock = end > params.toBlock ? params.toBlock : end;
    const rangeLabel = `${params.label} ${params.address} ${start}-${toBlock} chunkSize=${chunkSize.toString()}`;
    const startedAt = Date.now();

    try {
      const batch = await fetchLogsWithRetries({
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
        const increased = next > params.maxChunkSize ? params.maxChunkSize : next;
        if (increased !== chunkSize && debug) {
          console.log(
            `[logs] ${params.label} chunkSize up ${chunkSize.toString()} -> ${increased.toString()} (${elapsed}ms)`
          );
        }
        chunkSize = increased;
      }
      start = toBlock + 1n;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (chunkSize <= params.minChunkSize) {
        throw new Error(
          `[logs] getLogs failed: address=${params.address} fromBlock=${start} toBlock=${toBlock} chunkSize=${chunkSize.toString()} error=${msg}`
        );
      }
      const next = chunkSize / 2n;
      const reduced = next < params.minChunkSize ? params.minChunkSize : next;
      if (debug) {
        console.warn(
          `[logs] ${params.label} chunkSize down ${chunkSize.toString()} -> ${reduced.toString()} error=${msg}`
        );
      }
      chunkSize = reduced;
    }
  }

  return logs;
}

function resolveBoardLogBounds(params: {
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

async function getLogsChunked(params: {
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
    publicClient: params.publicClient,
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

async function getLogsChunkedRaw(params: {
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
    publicClient: params.publicClient,
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

async function getLogsChunkedTopic0(params: {
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
    publicClient: params.publicClient,
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

function abiEventSig(event: AbiEvent): string {
  const inputs = event.inputs?.map((input) => input.type).join(",") ?? "";
  return `${event.name}(${inputs})`;
}

function logTopTopic0Counts(params: {
  logs: { topics?: Hex[] }[];
  limit?: number;
}) {
  const counts = new Map<string, number>();
  for (const log of params.logs) {
    const topic0 = log.topics?.[0];
    if (!topic0) continue;
    counts.set(topic0, (counts.get(topic0) ?? 0) + 1);
  }
  const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  const limit = params.limit ?? 10;
  const top = sorted.slice(0, limit);
  console.log(`[diag] top topic0 counts (limit=${limit})`);
  for (const [topic, count] of top) {
    console.log(`[diag] ${topic} -> ${count}`);
  }
}

async function getCodeWithTimeout(params: {
  publicClient: PublicClient<Transport, Chain>;
  address: Address;
  timeoutMs: number;
}) {
  return withTimeout(
    params.publicClient.getCode({ address: params.address }),
    params.timeoutMs,
    `getCode ${params.address}`
  );
}

async function getBlockNumberWithTimeout(
  publicClient: PublicClient<Transport, Chain>,
  timeoutMs: number
) {
  return withTimeout(
    publicClient.getBlockNumber(),
    timeoutMs,
    "getBlockNumber"
  );
}

async function getChainIdWithTimeout(
  publicClient: PublicClient<Transport, Chain>,
  timeoutMs: number
) {
  return withTimeout(publicClient.getChainId(), timeoutMs, "getChainId");
}

async function main() {
  const rpc = requireEnv(
    "NEXT_PUBLIC_FLUENT_RPC or FLUENT_RPC_URL",
    process.env.NEXT_PUBLIC_FLUENT_RPC ?? process.env.FLUENT_RPC_URL
  );
  const treasury = requireEnv(
    "NEXT_PUBLIC_LOREBOARD_ADDRESS",
    process.env.NEXT_PUBLIC_LOREBOARD_ADDRESS ??
      "0x4A777d8650b3FA2419377F4ffeF0EF8007151536"
  ) as Address;
  const board = requireEnv(
    "NEXT_PUBLIC_LOREBOARD_BOARD_ADDRESS or LOREBOARD_BOARD_ADDRESS",
    process.env.NEXT_PUBLIC_LOREBOARD_BOARD_ADDRESS ??
      process.env.LOREBOARD_BOARD_ADDRESS ??
      "0xE41B2D418C09Ea928E4F657ED2438f5D01472105"
  ) as Address;
  const voting = requireEnv(
    "NEXT_PUBLIC_LOREBOARD_VOTING_ADDRESS or LOREBOARD_VOTING_ADDRESS",
    process.env.NEXT_PUBLIC_LOREBOARD_VOTING_ADDRESS ??
      process.env.LOREBOARD_VOTING_ADDRESS ??
      "0xEbf065A7ca3917BB5e669982e8C6954cC27A7075"
  ) as Address;

  const deployBlock = parseOptionalBigInt(
    process.env.DEPLOY_BLOCK ??
      process.env.NEXT_PUBLIC_LOREBOARD_DEPLOY_BLOCK ??
      process.env.NEXT_PUBLIC_DEPLOY_BLOCK
  );
  const lookbackBlocks = parseOptionalBigInt(process.env.LOOKBACK_BLOCKS);

  const debugRawTopics = process.env.DEBUG_RAW_TOPICS === "1";
  const logScanDebug = process.env.LOG_SCAN_DEBUG === "1";
  const debugLogs = debugRawTopics || logScanDebug;

  const chunkSizeEnv = parseOptionalBigInt(process.env.LOG_CHUNK_SIZE);
  let chunkSize = chunkSizeEnv ?? DEFAULT_LOG_CHUNK_SIZE;
  if (chunkSize < MIN_LOG_CHUNK_SIZE) {
    console.log(
      `[diag] LOG_CHUNK_SIZE too small (${chunkSize.toString()}), clamping to ${MIN_LOG_CHUNK_SIZE.toString()}`
    );
    chunkSize = MIN_LOG_CHUNK_SIZE;
  } else if (chunkSize > MAX_LOG_CHUNK_SIZE) {
    console.log(
      `[diag] LOG_CHUNK_SIZE too large (${chunkSize.toString()}), clamping to ${MAX_LOG_CHUNK_SIZE.toString()}`
    );
    chunkSize = MAX_LOG_CHUNK_SIZE;
  }

  const timeoutOverride =
    parseOptionalNumber(process.env.RPC_TIMEOUT_MS) ?? LOG_CHUNK_TIMEOUT_MS;
  const retryCount =
    parseOptionalNumber(process.env.RPC_RETRY_COUNT) ?? LOG_CHUNK_RETRIES;
  const retryDelay =
    parseOptionalNumber(process.env.RPC_RETRY_DELAY_MS) ??
    LOG_CHUNK_RETRY_BASE_MS;

  const fetchWithTimeout: typeof fetch = async (input, init = {}) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutOverride);
    try {
      return await fetch(input, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timeoutId);
    }
  };

  const chain = defineChain({
    id: 20994,
    name: "Fluent Testnet",
    nativeCurrency: { name: "FLU", symbol: "FLU", decimals: 18 },
    rpcUrls: { default: { http: [rpc] } },
  });

  const transport = http(rpc, {
    timeout: timeoutOverride,
    retryCount,
    retryDelay,
    fetchFn: fetchWithTimeout,
  });
  const publicClient: PublicClient<Transport, Chain> = createPublicClient({
    chain,
    transport,
  });

  const epochOverride = parseEpochOverride(process.argv.slice(2));
  if (epochOverride !== null) {
    console.log(`[diag] epoch override=${epochOverride}`);
  }

  const chainId = await getChainIdWithTimeout(publicClient, timeoutOverride);
  const latest = await getBlockNumberWithTimeout(publicClient, timeoutOverride);
  console.log(`[diag] chainId=${chainId} latest=${latest.toString()}`);

  for (const [label, address] of [
    ["board", board],
    ["treasury", treasury],
    ["voting", voting],
  ] as const) {
    const code = await getCodeWithTimeout({
      publicClient,
      address,
      timeoutMs: timeoutOverride,
    });
    const hasCode = code && code !== "0x";
    console.log(
      `[diag] ${label}=${address} code=${hasCode ? code.length : 0}`
    );
  }

  const { fromBlock, toBlock, source } = resolveBoardLogBounds({
    latest,
    deployBlock,
    lookbackBlocks: lookbackBlocks ?? null,
  });
  console.log(
    `[diag] scan source=${source} fromBlock=${fromBlock} toBlock=${toBlock} timeoutMs=${timeoutOverride} retries=${retryCount} retryDelay=${retryDelay} chunkSize=${chunkSize.toString()}`
  );

  const boardTopic0 = getEventSelector(PLACEMENT_PROPOSED_EVENT);
  const boardSig = abiEventSig(PLACEMENT_PROPOSED_EVENT);
  console.log(`[diag] PlacementProposed ${boardSig} -> ${boardTopic0}`);

  const treasuryTopic0 = getEventSelector(TREASURY_PROPOSED_EVENT);
  const treasurySig = abiEventSig(TREASURY_PROPOSED_EVENT);
  console.log(`[diag] ProposedEvt ${treasurySig} -> ${treasuryTopic0}`);

  const boardEventLogs = await getLogsChunked({
    publicClient,
    address: board,
    event: PLACEMENT_PROPOSED_EVENT,
    fromBlock,
    toBlock,
    chunkSize,
    debug: debugLogs,
    timeoutMs: timeoutOverride,
    retryCount,
    retryBaseMs: retryDelay,
  });
  console.log(`[diag] board event logs=${boardEventLogs.length}`);

  const boardTopic0Logs = await getLogsChunkedTopic0({
    publicClient,
    address: board,
    topic0: boardTopic0,
    fromBlock,
    toBlock,
    chunkSize,
    debug: debugLogs,
    timeoutMs: timeoutOverride,
    retryCount,
    retryBaseMs: retryDelay,
  });
  console.log(`[diag] board topic0 logs=${boardTopic0Logs.length}`);

  const boardRawLogs = await getLogsChunkedRaw({
    publicClient,
    address: board,
    fromBlock,
    toBlock,
    chunkSize,
    debug: debugLogs,
    timeoutMs: timeoutOverride,
    retryCount,
    retryBaseMs: retryDelay,
  });
  console.log(`[diag] board raw logs=${boardRawLogs.length}`);
  logTopTopic0Counts({ logs: boardRawLogs, limit: 10 });

  if (boardTopic0Logs.length > 0) {
    const samples = boardTopic0Logs.slice(0, 3);
    for (const [idx, log] of samples.entries()) {
      try {
        const decoded = decodeEventLog({
          abi: [PLACEMENT_PROPOSED_EVENT],
          data: log.data,
          topics: log.topics,
        });
        const args: any = decoded.args ?? {};
        const epochSample = args.epoch ?? args.epochId ?? args[2];
        const bidderSample = args.bidder ?? args[1];
        const idSample = args.id ?? args.placementId ?? args[0];
        console.log(
          `[diag] board decoded sample ${idx + 1}: epoch=${epochSample} bidder=${bidderSample} id=${idSample}`
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[diag] board decode failed sample ${idx + 1}: ${msg}`);
      }
    }
  }

  const treasuryEventLogs = await getLogsChunked({
    publicClient,
    address: treasury,
    event: TREASURY_PROPOSED_EVENT,
    fromBlock,
    toBlock,
    chunkSize,
    debug: debugLogs,
    timeoutMs: timeoutOverride,
    retryCount,
    retryBaseMs: retryDelay,
  });
  console.log(`[diag] treasury event logs=${treasuryEventLogs.length}`);

  const treasuryTopic0Logs = await getLogsChunkedTopic0({
    publicClient,
    address: treasury,
    topic0: treasuryTopic0,
    fromBlock,
    toBlock,
    chunkSize,
    debug: debugLogs,
    timeoutMs: timeoutOverride,
    retryCount,
    retryBaseMs: retryDelay,
  });
  console.log(`[diag] treasury topic0 logs=${treasuryTopic0Logs.length}`);

  const treasuryRawLogs = await getLogsChunkedRaw({
    publicClient,
    address: treasury,
    fromBlock,
    toBlock,
    chunkSize,
    debug: debugLogs,
    timeoutMs: timeoutOverride,
    retryCount,
    retryBaseMs: retryDelay,
  });
  console.log(`[diag] treasury raw logs=${treasuryRawLogs.length}`);
  logTopTopic0Counts({ logs: treasuryRawLogs, limit: 10 });

  const expectedFound =
    boardEventLogs.length > 0 ||
    boardTopic0Logs.length > 0 ||
    treasuryEventLogs.length > 0 ||
    treasuryTopic0Logs.length > 0;
  const rawFound = boardRawLogs.length > 0 || treasuryRawLogs.length > 0;
  const topic0Found = boardTopic0Logs.length > 0 || treasuryTopic0Logs.length > 0;

  if (expectedFound) {
    console.log("[diag] conclusion=found-expected-logs");
    process.exit(0);
  }
  if (rawFound && !topic0Found) {
    console.log(
      "[diag] conclusion=raw-logs-without-expected-topic0 (likely abi/event mismatch or wrong contract)"
    );
    process.exit(2);
  }
  if (!rawFound) {
    console.log(
      "[diag] conclusion=no-raw-logs (likely wrong address/chain/fromBlock or no activity)"
    );
    process.exit(3);
  }

  console.log("[diag] conclusion=unknown");
  process.exit(1);
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) ===
    path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
