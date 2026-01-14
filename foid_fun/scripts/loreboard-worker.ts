import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import {
  createPublicClient,
  getEventSelector,
  type Abi,
  type AbiEvent,
  type Address,
  type Chain,
  type Hex,
  type PublicClient,
  type Transport,
} from "viem";
import treasuryAbi from "../src/abi/LoreBoardTreasury.json";
import boardAbi from "../src/abi/LoreboardBoardV2.json";
import { loreBoardManifestStoreAbi } from "../src/abi/loreBoardManifestStore";
import { loadWorkerConfig } from "./lib/workerConfig";
import {
  getLogsChunkedEvent,
  getLogsChunkedRaw,
  getLogsChunkedTopic0,
  resolveBoardLogBounds,
} from "./lib/logScan";
import { getLogsFromBlockscout } from "./lib/blockscout";
import { inferDeployBlock } from "./lib/deployBlock";
import { getBlockWithTimeout, getCodeWithTimeout, getTxCountWithTimeout } from "./lib/rpc";
import { parseEpochOverride, resolveEpochId } from "./lib/epoch";
import { finalizeEpochIfReady } from "./lib/finalize";
import { logFinalizeReadinessReport, summarizeEpoch } from "./lib/syncReport";
import { parseOptionalNumber, readContractSafe } from "./lib/contract";
import type { ChainProposal } from "./lib/types";
import type { LogItem, LogResult } from "./lib/logTypes";
import {
  abiEventSig,
  coerceRect,
  computePlacementId,
  isEmptyCode,
  logAbiEventSelectors,
  logTopTopic0Counts,
  parseOptionalBigInt,
  readAddressArg,
  readHexArg,
  readNumberArg,
  topicToAddress,
  tryDecodeEventLog,
} from "./lib/workerHelpers";

dotenv.config();
dotenv.config({ path: ".env.local", override: true });

const getPlacementProposedEvent = (abi: Abi): AbiEvent => {
  const event = abi.find(
    (item) => item.type === "event" && item.name === "PlacementProposed"
  );
  if (!event) {
    throw new Error("Missing PlacementProposed event in LoreboardBoardV2 ABI");
  }
  return event as AbiEvent;
};

const getEventByName = (abi: Abi, name: string): AbiEvent => {
  const event = abi.find((item) => item.type === "event" && item.name === name);
  if (!event) {
    throw new Error(`Missing ${name} event in ABI`);
  }
  return event as AbiEvent;
};

const PLACEMENT_PROPOSED_EVENT = getPlacementProposedEvent(boardAbi as Abi);
const TREASURY_PROPOSED_EVENT = getEventByName(
  treasuryAbi as Abi,
  "ProposedEvt"
);

const votingV2Abi = [
  { type: "function", name: "epochAt", stateMutability: "view", inputs: [{ name: "t", type: "uint64" }], outputs: [{ name: "", type: "uint32" }] },
  { type: "function", name: "voteWindowSeconds", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint32" }] },
  { type: "function", name: "epochZeroUnix", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint64" }] },
  { type: "function", name: "epochSeconds", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint32" }] },
  { type: "function", name: "getPlacementMeta", stateMutability: "view", inputs: [{ name: "placementId", type: "bytes32" }], outputs: [{ name: "registeredAt", type: "uint64" }, { name: "voteEndsAt", type: "uint64" }, { name: "epochId", type: "uint32" }, { name: "exists", type: "bool" }] },
  { type: "function", name: "getPlacementVotes", stateMutability: "view", inputs: [{ name: "epochId", type: "uint256" }, { name: "placementId", type: "bytes32" }], outputs: [{ name: "yesWeight", type: "uint256" }, { name: "noWeight", type: "uint256" }] },
  { type: "function", name: "isPendingPlacement", stateMutability: "view", inputs: [{ name: "epochId", type: "uint256" }, { name: "placementId", type: "bytes32" }], outputs: [{ name: "", type: "bool" }] },
  { type: "function", name: "epochs", stateMutability: "view", inputs: [{ name: "epochId", type: "uint256" }], outputs: [{ name: "finalized", type: "bool" }] },
  { type: "function", name: "passesMajority51", stateMutability: "view", inputs: [{ name: "epochId", type: "uint256" }, { name: "placementId", type: "bytes32" }], outputs: [{ name: "", type: "bool" }] },
  { type: "function", name: "meetsQuorum", stateMutability: "view", inputs: [{ name: "epochId", type: "uint256" }, { name: "placementId", type: "bytes32" }], outputs: [{ name: "", type: "bool" }] },
  { type: "function", name: "boardAdmin", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "address" }] },
  { type: "function", name: "setEpochFinalized", stateMutability: "nonpayable", inputs: [{ name: "epochId", type: "uint256" }, { name: "finalized_", type: "bool" }], outputs: [] },
] as const;

const loreboardLiveNftAbi = [
  { type: "function", name: "syncLatest", stateMutability: "nonpayable", inputs: [], outputs: [] },
  { type: "function", name: "liveEpoch", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "liveManifestRoot", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "bytes32" }] },
  { type: "function", name: "liveManifestCID", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "string" }] },
] as const;

const ZERO_BYTES32 = "0x0000000000000000000000000000000000000000000000000000000000000000";
const LOG_CHUNK_TIMEOUT_MS = 15_000;
const LOG_CHUNK_RETRIES = 2;
const LOG_CHUNK_RETRY_BASE_MS = 500;
const DEFAULT_LOG_CHUNK_SIZE = 20_000n;
const MIN_LOG_CHUNK_SIZE = 2_000n;
const MAX_LOG_CHUNK_SIZE = 100_000n;



async function fetchProposalsForEpoch(params: {
  publicClient: ReturnType<typeof createPublicClient>;
  board: Address;
  voting: Address;
  treasury: Address;
  epochId: number;
  deployBlock: bigint | null;
  lookbackBlocks?: bigint | null;
  blockscoutApiBase: string;
  useBlockscoutLogs: boolean;
  blockscoutOnly: boolean;
}) {
  const latest = await params.publicClient.getBlockNumber();
  const { fromBlock, toBlock, source } = resolveBoardLogBounds({
    latest,
    deployBlock: params.deployBlock,
    lookbackBlocks: params.lookbackBlocks ?? null,
  });
  const debugRawTopics = process.env.DEBUG_RAW_TOPICS === "1";
  const logScanDebug = process.env.LOG_SCAN_DEBUG === "1";
  const debugLogs = debugRawTopics || logScanDebug;
  const useTopic0Scan = process.env.USE_TOPIC0_SCAN === "1";
  const useBlockscoutLogs = params.useBlockscoutLogs;
  const blockscoutOnly = params.blockscoutOnly;
  const blockscoutApiBase = params.blockscoutApiBase;
  const chunkSizeEnv = parseOptionalBigInt(process.env.LOG_CHUNK_SIZE);
  let chunkSize = chunkSizeEnv ?? DEFAULT_LOG_CHUNK_SIZE;
  if (chunkSize < MIN_LOG_CHUNK_SIZE) {
    if (debugLogs) {
      console.log(
        `[logs] LOG_CHUNK_SIZE too small (${chunkSize.toString()}), clamping to ${MIN_LOG_CHUNK_SIZE.toString()}`
      );
    }
    chunkSize = MIN_LOG_CHUNK_SIZE;
  } else if (chunkSize > MAX_LOG_CHUNK_SIZE) {
    if (debugLogs) {
      console.log(
        `[logs] LOG_CHUNK_SIZE too large (${chunkSize.toString()}), clamping to ${MAX_LOG_CHUNK_SIZE.toString()}`
      );
    }
    chunkSize = MAX_LOG_CHUNK_SIZE;
  }
  const timeoutOverride =
    parseOptionalNumber(process.env.RPC_TIMEOUT_MS) ?? LOG_CHUNK_TIMEOUT_MS;
  const retryCount =
    parseOptionalNumber(process.env.RPC_RETRY_COUNT) ?? LOG_CHUNK_RETRIES;
  const retryDelay =
    parseOptionalNumber(process.env.RPC_RETRY_DELAY_MS) ??
    LOG_CHUNK_RETRY_BASE_MS;
  const getTxCount = async (address: Address) =>
    getTxCountWithTimeout({
      publicClient: params.publicClient,
      address,
      timeoutMs: timeoutOverride,
    });

  const eventTopic = getEventSelector(PLACEMENT_PROPOSED_EVENT);
  const eventSig = abiEventSig(PLACEMENT_PROPOSED_EVENT);
  const treasuryTopic = getEventSelector(TREASURY_PROPOSED_EVENT);
  const treasurySig = abiEventSig(TREASURY_PROPOSED_EVENT);
  console.log(
    `[logs] PlacementProposed board=${params.board} topic=${eventTopic}`
  );
  console.log(
    `[logs] PlacementProposed sig=${eventSig} selector=${eventTopic}`
  );
  if (debugLogs) {
    console.log(
      `[logs] rpc timeout=${timeoutOverride}ms retries=${retryCount} retryDelay=${retryDelay}ms chunkSize=${chunkSize.toString()}`
    );
  }
  console.log(
    `[logs] PlacementProposed scan source=${source} latest=${latest} fromBlock=${fromBlock} toBlock=${toBlock}`
  );

  let logs: LogResult = [];
  let rpcBoardLogs: LogResult = [];
  let rpcTreasuryLogs: LogResult = [];
  let rpcRawBoardLogs: LogResult | null = null;
  let rpcRawTreasuryLogs: LogResult | null = null;
  let blockscoutBoardLogs: LogResult = [];
  let blockscoutTreasuryLogs: LogResult = [];
  let anyTxCount: boolean | null = null;

  let rpcEventScanRan = false;
  let rpcTopic0ScanRan = false;
  let rpcRawScanRan = false;
  let blockscoutBoardScanRan = false;
  let blockscoutTreasuryScanRan = false;

  if (blockscoutOnly) {
    console.log("[logs] BLOCKSCOUT_ONLY=1 skipping RPC log scans");
  } else if (useTopic0Scan) {
    rpcTopic0ScanRan = true;
    const topic0Logs = await getLogsChunkedTopic0({
      publicClient: params.publicClient,
      address: params.board,
      topic0: eventTopic,
      fromBlock,
      toBlock,
      chunkSize,
      debug: debugLogs,
      timeoutMs: timeoutOverride,
      retryCount,
      retryBaseMs: retryDelay,
    });
    console.log(
      `[logs] PlacementProposed topic0 fetched=${topic0Logs.length}`
    );
    rpcBoardLogs = topic0Logs.map((log) =>
      tryDecodeEventLog({
        log,
        debug: debugLogs,
        event: PLACEMENT_PROPOSED_EVENT,
        failureLabel: "topic0 decode failed",
      })
    );
    logs = rpcBoardLogs;
  } else {
    rpcEventScanRan = true;
    rpcBoardLogs = await getLogsChunkedEvent({
      publicClient: params.publicClient,
      address: params.board,
      event: PLACEMENT_PROPOSED_EVENT,
      fromBlock,
      toBlock,
      chunkSize,
      debug: debugLogs,
      timeoutMs: timeoutOverride,
      retryCount,
      retryBaseMs: retryDelay,
    });
    console.log(`[logs] PlacementProposed fetched=${rpcBoardLogs.length}`);
    logs = rpcBoardLogs;
  }

  if (logs.length === 0 && debugRawTopics) {
    rpcRawScanRan = true;
    const topic0Logs = await getLogsChunkedTopic0({
      publicClient: params.publicClient,
      address: params.board,
      topic0: eventTopic,
      fromBlock,
      toBlock,
      chunkSize,
      debug: debugLogs,
      timeoutMs: timeoutOverride,
      retryCount,
      retryBaseMs: retryDelay,
    });
    console.log(`[logs] PlacementProposed topic0 fetched=${topic0Logs.length}`);

    rpcRawBoardLogs = await getLogsChunkedRaw({
      publicClient: params.publicClient,
      address: params.board,
      fromBlock,
      toBlock,
      chunkSize,
      debug: debugLogs,
      timeoutMs: timeoutOverride,
      retryCount,
      retryBaseMs: retryDelay,
    });
    console.log(`[logs] raw board logs fetched=${rpcRawBoardLogs.length}`);
    logTopTopic0Counts({ logs: rpcRawBoardLogs, limit: 10 });
    logAbiEventSelectors({ abi: boardAbi as Abi, label: "BoardV2" });
  }

  const sampleLogs = logs.slice(0, 3);
  for (const log of sampleLogs) {
    const args: any = log.args ?? {};
    const epochSample = args.epoch ?? args.epochId ?? args[2];
    const bidderSample = args.bidder ?? args[1];
    const idSample = args.id ?? args.placementId ?? args[0];
    if (epochSample === undefined) {
      console.log(
        `[logs] sample block=${log.blockNumber} argsKeys=${Object.keys(args).join(",")}`
      );
    }
    console.log(
      `[logs] sample block=${log.blockNumber} epoch=${epochSample} bidder=${bidderSample} id=${idSample}`
    );
  }

  let logSource = "board";
  let effectiveLogs = logs;

  if (!blockscoutOnly && logs.length === 0) {
    logSource = "treasury-fallback";
    rpcTreasuryLogs = await getLogsChunkedEvent({
      publicClient: params.publicClient,
      address: params.treasury,
      event: TREASURY_PROPOSED_EVENT,
      fromBlock,
      toBlock,
      chunkSize,
      debug: debugLogs,
      timeoutMs: timeoutOverride,
      retryCount,
      retryBaseMs: retryDelay,
    });
    console.log(`[logs] ProposedEvt fetched=${rpcTreasuryLogs.length}`);
    effectiveLogs = rpcTreasuryLogs;
    if (debugRawTopics) {
      rpcRawScanRan = true;
      rpcRawTreasuryLogs = await getLogsChunkedRaw({
        publicClient: params.publicClient,
        address: params.treasury,
        fromBlock,
        toBlock,
        chunkSize,
        debug: debugLogs,
        timeoutMs: timeoutOverride,
        retryCount,
        retryBaseMs: retryDelay,
      });
      console.log(`[logs] raw treasury logs fetched=${rpcRawTreasuryLogs.length}`);
      logTopTopic0Counts({ logs: rpcRawTreasuryLogs, limit: 10 });
    }
  }

  if (effectiveLogs.length === 0) {
    if (anyTxCount === null) {
      const [boardTxCount, treasuryTxCount, votingTxCount] =
        await Promise.all([
        getTxCount(params.board),
        getTxCount(params.treasury),
        getTxCount(params.voting),
      ]);
      anyTxCount =
        boardTxCount > 0n ||
        treasuryTxCount > 0n ||
        votingTxCount > 0n;
    }

    const shouldTryBlockscout =
      blockscoutOnly ||
      useBlockscoutLogs ||
      (debugLogs && anyTxCount) ||
      anyTxCount;

    if (shouldTryBlockscout) {
      console.log(
        `[blockscout] PlacementProposed topic0=${eventTopic} base=${blockscoutApiBase}`
      );
      blockscoutBoardScanRan = true;
      const boardLogs = await getLogsFromBlockscout({
        apiBase: blockscoutApiBase,
        address: params.board,
        fromBlock,
        toBlock,
        topic0: eventTopic,
        timeoutMs: timeoutOverride,
        retryCount,
        retryDelayMs: retryDelay,
        debug: debugLogs,
      });
      console.log(
        `[blockscout] PlacementProposed fetched=${boardLogs.length}`
      );
      blockscoutBoardLogs = boardLogs.map((log) =>
        tryDecodeEventLog({
          log,
          debug: debugLogs,
          event: PLACEMENT_PROPOSED_EVENT,
          failureLabel: "topic0 decode failed",
        })
      );
      effectiveLogs = blockscoutBoardLogs;
      logSource = "blockscout-board";
    }

    if (effectiveLogs.length === 0 && shouldTryBlockscout) {
      console.log(
        `[blockscout] ProposedEvt topic0=${treasuryTopic} sig=${treasurySig}`
      );
      blockscoutTreasuryScanRan = true;
      const treasuryLogs = await getLogsFromBlockscout({
        apiBase: blockscoutApiBase,
        address: params.treasury,
        fromBlock,
        toBlock,
        topic0: treasuryTopic,
        timeoutMs: timeoutOverride,
        retryCount,
        retryDelayMs: retryDelay,
        debug: debugLogs,
      });
      console.log(`[blockscout] ProposedEvt fetched=${treasuryLogs.length}`);
      blockscoutTreasuryLogs = treasuryLogs.map((log) =>
        tryDecodeEventLog({
          log,
          debug: debugLogs,
          event: TREASURY_PROPOSED_EVENT,
          failureLabel: "treasury decode failed",
        })
      );
      effectiveLogs = blockscoutTreasuryLogs;
      logSource = "blockscout-treasury";
    }
  }

  const blockNumbers = new Set<bigint>();
  for (const log of effectiveLogs) {
    if (log.blockNumber !== null && log.blockNumber !== undefined) {
      blockNumbers.add(log.blockNumber);
    }
  }

  const blockTimestamp = new Map<bigint, number>();
  for (const blockNumber of blockNumbers) {
    const block = await getBlockWithTimeout({
      publicClient: params.publicClient,
      label: `getBlock ${blockNumber.toString()}`,
      request: { blockNumber },
      timeoutMs: timeoutOverride,
    });
    blockTimestamp.set(blockNumber, Number(block.timestamp));
  }

  const proposals = new Map<string, ChainProposal>();
  const metaCache = new Map<
    string,
    readonly [bigint, bigint, number, boolean] | null
  >();

  if (logSource === "board") {
    for (const log of effectiveLogs) {
      const args: any = log.args ?? {};
      const rect = coerceRect({
        x: args.x ?? args[3],
        y: args.y ?? args[4],
        w: args.w ?? args[5],
        h: args.h ?? args[6],
      });
      let id =
        readHexArg(args, ["id", "placementId", "proposalId"]) ??
        (log.topics?.[1] as Hex | undefined) ??
        null;
      const bidder =
        readAddressArg(args, ["bidder", "proposer", "owner"]) ??
        topicToAddress(log.topics?.[2] as Hex | undefined) ??
        null;
      const cidHash =
        readHexArg(args, ["cidHash", "cid"]) ?? ZERO_BYTES32 ?? null;
      const bidPerCellWei = BigInt(args.bidPerCellWei ?? args[8] ?? 0);
      const cells = Number(args.cells ?? args[7] ?? 0);
      const proposedAt = log.blockNumber
        ? blockTimestamp.get(log.blockNumber) ?? 0
        : 0;

      if (!id && bidder && cidHash && rect) {
        const epochFromArgs = readNumberArg(args, ["epoch", "epochId"]);
        if (epochFromArgs !== null) {
          id = computePlacementId(
            bidder,
            BigInt(epochFromArgs),
            cidHash as Hex,
            rect
          );
        }
      }

      if (!id || !bidder) {
        console.warn(
          `[logs] skipping log missing id/bidder block=${log.blockNumber} id=${id} bidder=${bidder}`
        );
        continue;
      }

      const idKey = id.toLowerCase();
      let meta = metaCache.get(idKey);
      if (meta === undefined) {
        try {
          meta = (await readContractSafe({
            publicClient: params.publicClient,
            address: params.voting,
            abi: votingV2Abi,
            functionName: "getPlacementMeta",
            args: [id],
            label: `getPlacementMeta ${params.voting} ${id}`,
            timeoutMs: timeoutOverride,
          })) as readonly [bigint, bigint, number, boolean];
        } catch {
          meta = null;
        }
        metaCache.set(idKey, meta);
      }

      const epochFromMeta = meta ? Number(meta[2]) : null;
      const epochFromArgs = readNumberArg(args, ["epoch", "epochId"]);
      const epoch = epochFromMeta ?? epochFromArgs;
      if (epoch === null) {
        console.warn(
          `[logs] missing epoch for placement ${id} (meta missing or no epoch arg)`
        );
        continue;
      }

      if (epoch !== params.epochId) continue;

      const computedId = computePlacementId(
        bidder,
        BigInt(epoch),
        cidHash as Hex,
        rect
      );
      if (computedId.toLowerCase() !== id.toLowerCase()) {
        console.warn(
          `[warn] placementId mismatch for epoch ${epoch}: log=${id} computed=${computedId}`
        );
      }

      if (!proposals.has(idKey)) {
        proposals.set(idKey, {
          id,
          bidder,
          epoch,
          rect,
          bidPerCellWei,
          cells,
          cidHash: cidHash as Hex,
          proposedAt,
        });
      }
    }
  } else {
    for (const log of effectiveLogs) {
      const args: any = log.args ?? {};
      const rect = coerceRect(args.rect ?? args[3] ?? {});
      let id =
        readHexArg(args, ["id", "placementId", "proposalId"]) ??
        (log.topics?.[1] as Hex | undefined) ??
        null;
      const bidder =
        readAddressArg(args, ["bidder", "proposer", "owner"]) ??
        topicToAddress(log.topics?.[2] as Hex | undefined) ??
        null;
      const bidPerCellWei = BigInt(args.bidPerCellWei ?? args[4] ?? 0);
      const cells = Number(args.cells ?? args[5] ?? 0);
      const cidHash =
        readHexArg(args, ["cidHash", "cid"]) ??
        (args[6] as Hex | undefined) ??
        ZERO_BYTES32;
      const proposedAt = log.blockNumber
        ? blockTimestamp.get(log.blockNumber) ?? 0
        : 0;

      if (!id && bidder && cidHash && rect) {
        const epochFromArgs = readNumberArg(args, ["epoch", "epochId"]);
        if (epochFromArgs !== null) {
          id = computePlacementId(
            bidder,
            BigInt(epochFromArgs),
            cidHash as Hex,
            rect
          );
        }
      }

      if (!id || !bidder) {
        console.warn(
          `[logs] skipping proposed log missing id/bidder block=${log.blockNumber} id=${id} bidder=${bidder}`
        );
        continue;
      }

      const idKey = id.toLowerCase();
      let meta = metaCache.get(idKey);
      if (meta === undefined) {
        try {
          meta = (await readContractSafe({
            publicClient: params.publicClient,
            address: params.voting,
            abi: votingV2Abi,
            functionName: "getPlacementMeta",
            args: [id],
            label: `getPlacementMeta ${params.voting} ${id}`,
            timeoutMs: timeoutOverride,
          })) as readonly [bigint, bigint, number, boolean];
        } catch {
          meta = null;
        }
        metaCache.set(idKey, meta);
      }

      const epochFromMeta = meta ? Number(meta[2]) : null;
      const epochFromArgs = readNumberArg(args, ["epoch", "epochId"]);
      const epoch = epochFromMeta ?? epochFromArgs;
      if (epoch === null) {
        console.warn(
          `[logs] missing epoch for placement ${id} (meta missing or no epoch arg)`
        );
        continue;
      }

      if (epoch !== params.epochId) continue;

      if (!proposals.has(idKey)) {
        proposals.set(idKey, {
          id,
          bidder,
          epoch,
          rect,
          bidPerCellWei,
          cells,
          cidHash: cidHash as Hex,
          proposedAt,
        });
      }
    }
  }

  console.log(
    `[logs] PlacementProposed source=${logSource} proposals=${proposals.size}`
  );
  if (proposals.size === 0) {
    if (!blockscoutOnly && !rpcRawBoardLogs) {
      rpcRawBoardLogs = await getLogsChunkedRaw({
        publicClient: params.publicClient,
        address: params.board,
        fromBlock,
        toBlock,
        chunkSize,
        debug: debugLogs,
        timeoutMs: timeoutOverride,
        retryCount,
        retryBaseMs: retryDelay,
      });
    }
    if (!blockscoutOnly && !rpcRawTreasuryLogs) {
      rpcRawTreasuryLogs = await getLogsChunkedRaw({
        publicClient: params.publicClient,
        address: params.treasury,
        fromBlock,
        toBlock,
        chunkSize,
        debug: debugLogs,
        timeoutMs: timeoutOverride,
        retryCount,
        retryBaseMs: retryDelay,
      });
    }

    const [boardCode, treasuryCode, votingCode] = await Promise.all([
      getCodeWithTimeout({
        publicClient: params.publicClient,
        address: params.board,
        blockTag: "latest",
        timeoutMs: timeoutOverride,
      }),
      getCodeWithTimeout({
        publicClient: params.publicClient,
        address: params.treasury,
        blockTag: "latest",
        timeoutMs: timeoutOverride,
      }),
      getCodeWithTimeout({
        publicClient: params.publicClient,
        address: params.voting,
        blockTag: "latest",
        timeoutMs: timeoutOverride,
      }),
    ]);

    const anyAddressMismatch =
      isEmptyCode(boardCode) || isEmptyCode(treasuryCode) || isEmptyCode(votingCode);

    if (anyTxCount === null) {
      const [boardTxCount, treasuryTxCount, votingTxCount] =
        await Promise.all([
        getTxCount(params.board),
        getTxCount(params.treasury),
        getTxCount(params.voting),
      ]);
      anyTxCount =
        boardTxCount > 0n ||
        treasuryTxCount > 0n ||
        votingTxCount > 0n;
    }

    const rpcRawEmpty =
      blockscoutOnly
        ? false
        : (rpcRawBoardLogs?.length ?? 0) === 0 &&
          (rpcRawTreasuryLogs?.length ?? 0) === 0;
    const blockscoutUsed = blockscoutBoardScanRan || blockscoutTreasuryScanRan;
    const blockscoutEmpty =
      blockscoutBoardLogs.length === 0 && blockscoutTreasuryLogs.length === 0;

    let conclusion = "NO_ACTIVITY";
    if (anyAddressMismatch) conclusion = "ADDRESS_MISMATCH";
    else if (blockscoutUsed && blockscoutEmpty) conclusion = "BLOCKSCOUT_NO_LOGS";
    else if (anyTxCount && rpcRawEmpty) conclusion = "RPC_NO_LOGS";
    else if (!anyTxCount) conclusion = "NO_ACTIVITY";

    const chainId = await params.publicClient.getChainId();
    const scanPaths = [
      rpcEventScanRan ? "rpc:event" : null,
      rpcTopic0ScanRan ? "rpc:topic0" : null,
      rpcRawScanRan ? "rpc:raw" : null,
      blockscoutBoardScanRan ? "blockscout:board" : null,
      blockscoutTreasuryScanRan ? "blockscout:treasury" : null,
    ].filter(Boolean);

    console.log(
      `[logs] proposals=0 board=${params.board} treasury=${params.treasury} voting=${params.voting} fromBlock=${fromBlock} toBlock=${toBlock} DEBUG_RAW_TOPICS=${debugRawTopics} USE_TOPIC0_SCAN=${useTopic0Scan} BLOCKSCOUT_ONLY=${blockscoutOnly} USE_BLOCKSCOUT_LOGS=${useBlockscoutLogs}`
    );
    console.log(
      `[conclusion] ${conclusion} chainId=${chainId} board=${params.board} treasury=${params.treasury} voting=${params.voting} fromBlock=${fromBlock} toBlock=${toBlock} scans=${scanPaths.join(",") || "none"}`
    );
  }

  return Array.from(proposals.values()).sort((a, b) =>
    a.id.toLowerCase().localeCompare(b.id.toLowerCase())
  );
}
async function main() {
  const command = process.argv[2] ?? "run";
  if (!["sync", "finalize", "run"].includes(command)) {
    throw new Error(
      "Usage: tsx scripts/loreboard-worker.ts <sync|finalize|run> [--epoch N|N]"
    );
  }

  const config = loadWorkerConfig(process.env);
  const {
    publicClient,
    addresses: { board, treasury, voting, manifestStore, nftAddress },
    wallets: { operatorWallet, adminWallet },
    flags: { dryRun, skipNftSync },
    scanning: {
      deployBlock: deployBlockRaw,
      lookbackBlocks,
      blockscoutApiBase,
      useBlockscoutLogs,
      blockscoutOnly,
    },
    rpcConfig: { timeoutMs: rpcTimeoutMs },
  } = config;
  let deployBlock = deployBlockRaw;

  if (deployBlock === null) {
    const latestBlock = await publicClient.getBlockNumber();
    const inferred = await inferDeployBlock({
      publicClient,
      addresses: [board, treasury, voting],
      timeoutMs: rpcTimeoutMs,
      latestBlock,
    });
    if (inferred !== null) {
      deployBlock = inferred;
      console.log(
        `[deploy] inferred deployBlock=${deployBlock.toString()} latest=${latestBlock.toString()} set DEPLOY_BLOCK to pin this`
      );
    } else {
      console.warn(
        `[deploy] unable to infer deploy block; code missing at latest for board/treasury/voting`
      );
    }
  }

  const epochOverride = parseEpochOverride(process.argv.slice(3));
  const epochId = await resolveEpochId({
    publicClient,
    voting,
    overrideEpochId: epochOverride,
  });
  if (epochId === null) {
    console.warn("[worker] no finalizable epoch available yet");
    return;
  }
  const proposals = await fetchProposalsForEpoch({
    publicClient,
    board,
    voting,
    treasury,
    epochId,
    deployBlock,
    lookbackBlocks,
    blockscoutApiBase,
    useBlockscoutLogs,
    blockscoutOnly,
  });

  console.log(
    `[worker] command=${command} epoch=${epochId} proposals=${proposals.length} dryRun=${dryRun}`
  );

  if (command === "sync" || command === "run") {
    await summarizeEpoch({
      publicClient,
      voting,
      board,
      treasury,
      epochId,
      proposals,
    });
  }

  if (command === "finalize" || command === "run") {
    if (!manifestStore) {
      throw new Error(
        "Missing manifest store address (NEXT_PUBLIC_LOREBOARD_MANIFEST_STORE_ADDRESS). If you're using .env.local, run with DOTENV_CONFIG_PATH=.env.local."
      );
    }
    if (!dryRun && !operatorWallet) {
      throw new Error(
        "Missing OPERATOR_KEY. If you're using .env.local, run with DOTENV_CONFIG_PATH=.env.local."
      );
    }
    await logFinalizeReadinessReport({
      publicClient,
      voting,
      board,
      epochId,
      proposals,
    });
    await finalizeEpochIfReady({
      publicClient,
      operatorWallet,
      adminWallet,
      treasury,
      voting,
      board,
      manifestStore,
      nftAddress,
      skipNftSync,
      epochId,
      proposals,
      dryRun,
    });
  }
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
