import { NextRequest, NextResponse } from "next/server";
import { rectCells, type Rect } from "@/lib/grid";
import { contractToWorldRect } from "@/lib/boardSpace";
import { currentEpoch, getEpochInfo, EPOCH_SECONDS, VOTE_WINDOW_SECONDS } from "@/lib/epoch";
import { addProposal, type Proposal } from "../_store";
import { ProposalStore } from "@/lib/proposalStore";
import { CHAIN_ID } from "@/config/canonical";
import { DEPLOY_BLOCK, publicClient, BoardAbiTyped, BOARD } from "@/lib/viem";
import {
  LOREBOARD_VOTING_ADDRESS,
  loreboardVotingAbi,
} from "@/contracts/loreboardVoting";
import {
  decodeEventLog,
  hexToBytes,
  isHex,
  keccak256,
  stringToBytes,
  stringToHex,
  toHex,
} from "viem";
import type { Address, Hex } from "viem";

const textDecoder = new TextDecoder();
const CACHE_TTL_MS = 5_000;
const LOG_RANGE_LOOKBACK = 95_000n;
const MIN_LOOKBACK_SECONDS = 259_200;
const LOOKBACK_SAMPLE_BLOCKS = 2_000n;
const CHAIN_ID_HEX = `0x${CHAIN_ID.toString(16)}`;

const MAX_LOG_RANGE = 95_000n;
const MAX_RANGES = 10;
const TARGET_BOARD_EVENTS = 20;
const BLOCKSCOUT_BASE = process.env.BLOCKSCOUT_API_BASE ?? "https://testnet.fluentscan.xyz/api";
const PENDING_EVENT_TOPIC: Hex = keccak256(
  stringToBytes("PendingPlacementRegistered(uint256,bytes32,uint64,uint64)"),
) as Hex;
const PLACEMENT_EVENT_TOPIC: Hex = keccak256(
  stringToBytes("PlacementProposed(bytes32,address,uint32,int32,int32,uint32,uint32,uint32,uint96,bytes32)"),
) as Hex;
const PENDING_EVENT_NAME = "PendingPlacementRegistered";
const PENDING_EVENT_ADDRESSES: Address[] = [LOREBOARD_VOTING_ADDRESS, BOARD];

type RawLog = Awaited<ReturnType<typeof publicClient.getLogs>>[number];

async function getRawLogs(address: Address, fromBlock: bigint, toBlock: bigint) {
  return publicClient.getLogs({ address, fromBlock, toBlock });
}

function decodeBoardPlacementProposed(rawLogs: RawLog[]) {
  const out: PlacementProposedEvent[] = [];
  for (const log of rawLogs) {
    if (!ensureTopics(log?.topics)) continue;
    try {
      const decoded = decodeEventLog({
        abi: BoardAbiTyped,
        data: log.data,
        topics: log.topics,
        strict: false,
      });
      if (decoded.eventName !== "PlacementProposed") continue;
      out.push({
        ...decoded,
        address: log.address,
        blockHash: log.blockHash ?? null,
        blockNumber: log.blockNumber ?? null,
        data: log.data,
        logIndex: log.logIndex ?? null,
        removed: log.removed ?? false,
        transactionHash: log.transactionHash ?? null,
        transactionIndex: log.transactionIndex ?? null,
        topics: log.topics,
        args: decoded.args as PlacementProposedArgs,
      });
    } catch {
      // ignore non-matching logs
    }
  }
  return out;
}

function decodePendingPlacementRegistered(rawLogs: RawLog[]) {
  const out: PendingPlacementEvent[] = [];
  for (const log of rawLogs) {
    if (!ensureTopics(log?.topics)) continue;
    try {
      const decoded = decodeEventLog({
        abi: loreboardVotingAbi,
        data: log.data,
        topics: log.topics,
        strict: false,
      });
      if (decoded.eventName !== PENDING_EVENT_NAME) continue;
      out.push({
        ...decoded,
        address: log.address,
        blockHash: log.blockHash ?? null,
        blockNumber: log.blockNumber ?? null,
        data: log.data,
        logIndex: log.logIndex ?? null,
        removed: log.removed ?? false,
        transactionHash: log.transactionHash ?? null,
        transactionIndex: log.transactionIndex ?? null,
        topics: log.topics,
        args: decoded.args as PendingPlacementArgs,
      });
    } catch {
      // ignore non-matching logs
    }
  }
  return out;
}

type PendingPlacementEvent = Awaited<ReturnType<typeof publicClient.getContractEvents>>[number] & {
  args?: PendingPlacementArgs;
};
type PendingPlacementArgs = {
  epochId?: bigint;
  epoch?: bigint;
  placementId?: `0x${string}`;
  voteEndsAt?: bigint;
};

type PendingPlacementWire = {
  emitter: string;
  blockNumber: string | null;
  logIndex: string | null;
  epochId: string;
  placementId: `0x${string}` | "";
  voteEndsAt: string | null;
};

function toWire(event: PendingPlacementEvent): PendingPlacementWire {
  const args = (event.args ?? {}) as PendingPlacementArgs;
  const epochBigInt = args.epochId ?? args.epoch ?? 0n;
  const voteEndsAt = args.voteEndsAt ?? null;

  return {
    emitter: event.address,
    blockNumber: event.blockNumber ? event.blockNumber.toString() : null,
    logIndex: event.logIndex != null ? event.logIndex.toString() : null,
    epochId: epochBigInt.toString(),
    placementId: args.placementId ?? "",
    voteEndsAt: voteEndsAt != null ? voteEndsAt.toString() : null,
  };
}

type PlacementProposedEvent = Awaited<ReturnType<typeof publicClient.getContractEvents>>[number] & {
  args?: PlacementProposedArgs;
};
type PlacementProposedArgs = {
  id?: `0x${string}`;
  bidder?: `0x${string}`;
  epoch?: bigint;
  x?: bigint | number;
  y?: bigint | number;
  w?: bigint | number;
  h?: bigint | number;
  cells?: bigint | number;
  bidPerCellWei?: bigint;
  cidHash?: `0x${string}`;
};
type PlacementProposedWire = {
  placementId: `0x${string}` | "";
  bidder: `0x${string}` | "";
  epoch: number;
  rect: Rect;
  cells: number;
  bidPerCellWei: string;
  cidHash?: `0x${string}`;
  blockNumber: string | null;
  logIndex: string | null;
};

function toPlacementWire(event: PlacementProposedEvent): PlacementProposedWire {
  const args = (event.args ?? {}) as PlacementProposedArgs;
  const rect = contractToWorldRect({
    x: Number(args.x ?? 0),
    y: Number(args.y ?? 0),
    w: Number(args.w ?? 0),
    h: Number(args.h ?? 0),
  });
  return {
    placementId: args.id ?? "",
    bidder: args.bidder ?? "",
    epoch: Number(args.epoch ?? 0n),
    rect,
    cells: Number(args.cells ?? 0),
    bidPerCellWei: (args.bidPerCellWei ?? 0n).toString(),
    cidHash: args.cidHash,
    blockNumber: event.blockNumber ? event.blockNumber.toString() : null,
    logIndex: event.logIndex != null ? event.logIndex.toString() : null,
  };
}

function buildScanRanges(latestBlock: bigint, fromBlock: bigint) {
  const ranges: Array<{ from: bigint; to: bigint }> = [];
  const deployStart = DEPLOY_BLOCK > 0n ? DEPLOY_BLOCK : 0n;
  const scanStart = fromBlock > deployStart ? fromBlock : deployStart;
  if (latestBlock < scanStart) {
    return ranges;
  }
  for (let i = 0; i < MAX_RANGES; i++) {
    const candidateTo = latestBlock - BigInt(i) * MAX_LOG_RANGE;
    if (candidateTo < scanStart) break;
    const fromCandidate = candidateTo > MAX_LOG_RANGE ? candidateTo - MAX_LOG_RANGE : 0n;
    const from = fromCandidate < scanStart ? scanStart : fromCandidate;
    ranges.push({ from, to: candidateTo });
    if (from <= scanStart) break;
  }
  return ranges;
}

function getWireKey(x: { placementId?: string; blockNumber?: string | null; logIndex?: string | null }) {
  const id = (x.placementId ?? "").toLowerCase();
  const block = x.blockNumber ?? "0";
  const index = x.logIndex ?? "0";
  return `${id}:${block}:${index}`;
}

function sampleUniqueNumbers(values: Iterable<number | undefined>, limit = 5) {
  const seen = new Set<number>();
  const sample: number[] = [];
  for (const maybeValue of values) {
    if (typeof maybeValue !== "number" || !Number.isFinite(maybeValue)) continue;
    if (seen.has(maybeValue)) continue;
    seen.add(maybeValue);
    sample.push(maybeValue);
    if (sample.length >= limit) break;
  }
  return sample;
}

function parseLogValue(value?: string | null) {
  if (!value) return 0n;
  try {
    return BigInt(value);
  } catch {
    return 0n;
  }
}

function isNewerEvent(
  existing: { blockNumber?: string | null; logIndex?: string | null },
  candidate: { blockNumber?: string | null; logIndex?: string | null },
) {
  const existingBlock = parseLogValue(existing.blockNumber);
  const candidateBlock = parseLogValue(candidate.blockNumber);
  if (candidateBlock > existingBlock) return true;
  if (candidateBlock < existingBlock) return false;
  const existingIndex = parseLogValue(existing.logIndex);
  const candidateIndex = parseLogValue(candidate.logIndex);
  return candidateIndex > existingIndex;
}

function recordPendingWire(map: Map<string, PendingPlacementWire>, wire: PendingPlacementWire) {
  const id = wire.placementId.toLowerCase();
  if (!id) return;
  const existing = map.get(id);
  if (!existing || isNewerEvent(existing, wire)) {
    map.set(id, wire);
  }
}

function recordBoardWire(map: Map<string, PlacementProposedWire>, wire: PlacementProposedWire) {
  const id = wire.placementId.toLowerCase();
  if (!id) return;
  const existing = map.get(id);
  if (!existing || isNewerEvent(existing, wire)) {
    map.set(id, wire);
  }
}

type BlockscoutLog = {
  address?: string;
  topics?: string[];
  data?: string;
  blockNumber?: string;
  blockHash?: string;
  logIndex?: string;
  transactionHash?: string;
  transactionIndex?: string;
  timeStamp?: string;
};

type ProxyGetLogsParams = {
  address: Address;
  fromBlock: bigint | string;
  toBlock: bigint | string;
  topic0: Hex;
};

type ProxyGetLogsResult = {
  logs: BlockscoutLog[];
  url: string;
  status?: string;
  message?: string;
};

function toDecimal(value: bigint | string) {
  return typeof value === "bigint" ? value.toString(10) : value;
}

function normalizeHexField(value?: string | null) {
  if (!value) return undefined;
  try {
    return BigInt(value).toString();
  } catch {
    return undefined;
  }
}

async function proxyGetLogs(params: ProxyGetLogsParams): Promise<ProxyGetLogsResult> {
  const url = new URL(BLOCKSCOUT_BASE);
  url.searchParams.set("module", "logs");
  url.searchParams.set("action", "getLogs");
  url.searchParams.set("fromBlock", toDecimal(params.fromBlock));
  url.searchParams.set("toBlock", toDecimal(params.toBlock));
  url.searchParams.set("address", params.address);
  url.searchParams.set("topic0", params.topic0);
  const fetchUrl = url.toString();
  const res = await fetch(fetchUrl, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`proxy getLogs failed with status ${res.status}`);
  }
  const json = (await res.json()) as {
    status?: string;
    message?: string;
    result?: BlockscoutLog[];
    error?: string;
  };
  const logs =
    Array.isArray(json.result) && json.status === "1"
      ? json.result.map((log) => ({
          ...log,
          blockNumber: normalizeHexField(log.blockNumber) ?? log.blockNumber,
          logIndex: normalizeHexField(log.logIndex) ?? log.logIndex,
          transactionIndex: normalizeHexField(log.transactionIndex) ?? log.transactionIndex,
          timeStamp: normalizeHexField(log.timeStamp) ?? log.timeStamp,
        }))
      : [];
  return {
    logs,
    url: fetchUrl,
    status: json.status,
    message: json.message,
  };
}

function ensureTopics(
  topics?: string[],
): topics is [`0x${string}`, ...(`0x${string}`[])] {
  return Array.isArray(topics) && topics.length >= 1;
}

function parseBlockNumber(value?: string | null): string | null {
  if (!value) return null;
  try {
    return BigInt(value).toString();
  } catch {
    return null;
  }
}

function decodeBlockscoutPendingWire(log: BlockscoutLog): PendingPlacementWire | null {
  if (!log?.data || !log.address || !ensureTopics(log.topics)) return null;
  const data = log.data as `0x${string}`;
  try {
    const decoded = decodeEventLog({
      abi: loreboardVotingAbi,
      data,
      topics: log.topics,
      eventName: PENDING_EVENT_NAME,
    });
    const args = decoded.args as PendingPlacementArgs;
    const epochBigInt = args.epochId ?? args.epoch ?? 0n;
    const voteEndsAt = args.voteEndsAt ?? null;
    return {
      emitter: log.address.toLowerCase(),
      blockNumber: parseBlockNumber(log.blockNumber),
      logIndex: parseBlockNumber(log.logIndex),
      epochId: epochBigInt.toString(),
      placementId: args.placementId ?? "",
      voteEndsAt: voteEndsAt != null ? voteEndsAt.toString() : null,
    };
  } catch {
    return null;
  }
}

function decodeBlockscoutPlacementWire(log: BlockscoutLog): PlacementProposedWire | null {
  if (!log?.data || !log.address || !ensureTopics(log.topics)) return null;
  const data = log.data as `0x${string}`;
  try {
    const decoded = decodeEventLog({
      abi: BoardAbiTyped,
      data,
      topics: log.topics,
      eventName: "PlacementProposed",
    });
    const args = decoded.args as PlacementProposedArgs;
    const rect = contractToWorldRect({
      x: Number(args.x ?? 0),
      y: Number(args.y ?? 0),
      w: Number(args.w ?? 0),
      h: Number(args.h ?? 0),
    });
    return {
      placementId: args.id ?? "",
      bidder: args.bidder ?? "",
      epoch: Number(args.epoch ?? 0n),
      rect,
      cells: Number(args.cells ?? 0),
      bidPerCellWei: (args.bidPerCellWei ?? 0n).toString(),
      cidHash: args.cidHash,
      blockNumber: parseBlockNumber(log.blockNumber),
      logIndex: parseBlockNumber(log.logIndex),
    };
  } catch {
    return null;
  }
}

type PendingRenderable = {
  pending: PendingPlacementWire;
  placement: PlacementProposedWire;
};

type ProposalCache = {
  blockNumber: bigint;
  epoch: number | null;
  fetchedAt: number;
  proposals: Proposal[];
  debugError: string | null;
  pendingEvents: PendingPlacementWire[];
  pendingRenderable: PendingRenderable[];
  pendingActiveCount: number;
  boardEventsCount: number;
  joinedRenderableCount: number;
  missingBoardPayload: string[];
  pendingSamples: PendingPlacementWire[];
  joinedSamples: PendingRenderable[];
  fromBlock: bigint;
  rangesScanned: number;
  lastError: string | null;
  pendingEpochIdsSample: number[];
  boardEpochsSample: number[];
  proxyUrlUsed: string | null;
};

let proposalCache: ProposalCache = {
  blockNumber: 0n,
  epoch: null,
  fetchedAt: 0,
  proposals: [],
  debugError: null,
  pendingEvents: [],
  pendingRenderable: [],
  pendingActiveCount: 0,
  boardEventsCount: 0,
  joinedRenderableCount: 0,
  missingBoardPayload: [],
  pendingSamples: [],
  joinedSamples: [],
  fromBlock: 0n,
  rangesScanned: 0,
  lastError: null,
  pendingEpochIdsSample: [],
  boardEpochsSample: [],
  proxyUrlUsed: null,
};

type ChainDataResult = {
  epoch: number | null;
  proposals: Proposal[];
  error: string | null;
  pendingEvents: PendingPlacementWire[];
  pendingRenderable: PendingRenderable[];
  pendingActiveCount: number;
  boardEventsCount: number;
  joinedRenderableCount: number;
  missingBoardPayload: string[];
  pendingSamples: PendingPlacementWire[];
  joinedSamples: PendingRenderable[];
  fromBlock: bigint;
  rangesScanned: number;
  lastError: string | null;
  pendingEpochIdsSample: number[];
  boardEpochsSample: number[];
  proxyUrlUsed: string | null;
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

async function determineFromBlock(latestBlock: bigint) {
  const fallback = () => {
    const lookbackStart =
      latestBlock > LOG_RANGE_LOOKBACK ? latestBlock - LOG_RANGE_LOOKBACK : 0n;
    const deployStart = DEPLOY_BLOCK > 0n ? DEPLOY_BLOCK : 0n;
    return lookbackStart > deployStart ? lookbackStart : deployStart;
  };

  try {
    const latestBlockData = await publicClient.getBlock({ blockNumber: latestBlock });
    const latestTimestamp =
      latestBlockData?.timestamp ?? BigInt(Math.floor(Date.now() / 1000));
    const sampleDistance =
      latestBlock >= LOOKBACK_SAMPLE_BLOCKS ? LOOKBACK_SAMPLE_BLOCKS : latestBlock;
    const sampleBlockNumber =
      latestBlock > sampleDistance ? latestBlock - sampleDistance : 0n;
    const sampleBlockData = await publicClient.getBlock({ blockNumber: sampleBlockNumber });
    const sampleTimestamp = sampleBlockData?.timestamp ?? latestTimestamp;

    const epochInfo = getEpochInfo(Date.now());
    const epochSeconds = epochInfo.lengthSec ?? 0;
    const windowSeconds = Math.max(
      epochSeconds,
      VOTE_WINDOW_SECONDS > 0 ? VOTE_WINDOW_SECONDS : 0,
      MIN_LOOKBACK_SECONDS,
    );

    const observedBlocks = latestBlock - sampleBlockNumber;
    const blockDelta = observedBlocks > 0n ? Number(observedBlocks) : 1;
    const timeDelta =
      latestTimestamp >= sampleTimestamp
        ? Number(latestTimestamp - sampleTimestamp)
        : Number(sampleTimestamp - latestTimestamp);
    const secondsPerBlock = blockDelta > 0 ? Math.max(timeDelta / blockDelta, 1) : 1;
    const neededBlocks = Math.max(1, Math.ceil(windowSeconds / secondsPerBlock));
    const lookbackBlocks = BigInt(neededBlocks);
    const lookbackStart = latestBlock > lookbackBlocks ? latestBlock - lookbackBlocks : 0n;
    const deployStart = DEPLOY_BLOCK > 0n ? DEPLOY_BLOCK : 0n;
    return lookbackStart > deployStart ? lookbackStart : deployStart;
  } catch {
    return fallback();
  }
}

export async function GET() {
  const nowEpoch = currentEpoch();
  const epochInfo = getEpochInfo(Date.now());
  const secondsPerEpoch = epochInfo.lengthSec;
  const secsRemainingCurrentEpoch = epochInfo.secondsLeft;

  const latestBlock = await publicClient.getBlockNumber();
  const {
    epoch: chainEpoch,
    proposals: chainProposals,
    error: chainError,
    pendingEvents: pendingEventsWire,
    pendingActiveCount,
    boardEventsCount,
    joinedRenderableCount,
    missingBoardPayload,
    pendingSamples,
    joinedSamples,
    fromBlock,
    rangesScanned,
    lastError: chainLastError,
    pendingEpochIdsSample,
    boardEpochsSample,
    proxyUrlUsed,
  } = await loadChainData(latestBlock);

  const hasChainLogs = pendingEventsWire.length > 0 || boardEventsCount > 0;
  const proposalsToShow = hasChainLogs ? chainProposals : [];
  const withCountdown = proposalsToShow.map((p) => {
    const rawId = String(p.id ?? "");
    const placementId =
      rawId.startsWith("0x") && rawId.length === 66
        ? (rawId as `0x${string}`)
        : (keccak256(stringToHex(rawId)) as `0x${string}`);
    const resolvedChainId =
      typeof p.chainId === "string" && p.chainId.startsWith("0x") ? p.chainId : CHAIN_ID_HEX;
    const epochsDiff = p.voteEndsAtEpoch - nowEpoch;
    const secondsLeft =
      epochsDiff < 0 || !epochInfo.enabled || secondsPerEpoch <= 0
        ? 0
        : secsRemainingCurrentEpoch + epochsDiff * secondsPerEpoch;
    const totalVotes = (p.yes ?? 0) + (p.no ?? 0);
    const percentYes = totalVotes > 0 ? (p.yes ?? 0) / totalVotes : 0;
    return {
      ...p,
      chainId: resolvedChainId,
      placementId,
      voters: p.voters ? Object.keys(p.voters).length : 0,
      epochId: p.epochSubmitted,
      secondsLeft: Math.max(0, secondsLeft),
      percentYes,
    };
  });

  const debugLastError = chainError ?? chainLastError ?? null;
  const payload = {
    proposals: withCountdown,
    debug: {
      lastError: debugLastError,
      epoch: chainEpoch,
      latestBlock: Number(latestBlock),
      fromBlock: Number(fromBlock),
      rangesScanned,
      pendingLogCount: pendingEventsWire.length,
      boardLogCount: boardEventsCount,
      boardEventsCount,
      joinedCount: joinedRenderableCount,
      pendingActiveCount,
      pendingEvents: pendingEventsWire,
      missingBoardPayload,
      samplePending: pendingSamples,
      sampleJoined: joinedSamples,
      pendingEpochIdsSample,
      boardEpochsSample,
      proxyUrlUsed: proxyUrlUsed ?? undefined,
    },
  };

  return NextResponse.json(payload, {
    status: 200,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "Content-Type": "application/json",
    },
  });
}

async function loadChainData(latestBlock: bigint): Promise<ChainDataResult> {
  const now = Date.now();
  if (
    proposalCache.blockNumber === latestBlock &&
    now - proposalCache.fetchedAt < CACHE_TTL_MS
  ) {
    return {
      epoch: proposalCache.epoch,
      proposals: proposalCache.proposals,
      error: proposalCache.debugError,
      pendingEvents: proposalCache.pendingEvents,
      pendingRenderable: proposalCache.pendingRenderable,
      pendingActiveCount: proposalCache.pendingActiveCount,
      boardEventsCount: proposalCache.boardEventsCount,
      joinedRenderableCount: proposalCache.joinedRenderableCount,
      missingBoardPayload: proposalCache.missingBoardPayload,
      pendingSamples: proposalCache.pendingSamples,
      joinedSamples: proposalCache.joinedSamples,
      fromBlock: proposalCache.fromBlock,
      rangesScanned: proposalCache.rangesScanned,
      lastError: proposalCache.lastError,
      pendingEpochIdsSample: proposalCache.pendingEpochIdsSample,
      boardEpochsSample: proposalCache.boardEpochsSample,
      proxyUrlUsed: proposalCache.proxyUrlUsed,
    };
  }

  let epoch: number | null = null;
  let proposals: Proposal[] = [];
  let error: string | null = null;

  try {
    epoch = await fetchChainEpoch(latestBlock);
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  let pendingEventsWire: PendingPlacementWire[] = [];
  let pendingRenderable: PendingRenderable[] = [];
  let pendingActiveCount = 0;
  let boardEventsCount = 0;
  let joinedRenderableCount = 0;
  let missingBoardPayload: string[] = [];
  let pendingSamples: PendingPlacementWire[] = [];
  let joinedSamples: PendingRenderable[] = [];
  let pendingEpochIdsSample: number[] = [];
  let boardEpochsSample: number[] = [];
  let proxyUrlUsed: string | null = null;
  let fromBlock = await determineFromBlock(latestBlock);
  let rangesScanned = 0;
  let lastScanError: string | null = null;

  if (epoch !== null) {
    try {
    const result = await loadOnChainProposals(epoch, latestBlock, fromBlock);
    proposals = result.proposals;
    pendingEventsWire = result.pendingEvents;
    pendingRenderable = result.pendingRenderable;
    pendingActiveCount = result.pendingActiveCount;
    boardEventsCount = result.boardEventsCount;
    joinedRenderableCount = result.joinedRenderableCount;
    missingBoardPayload = result.missingBoardPayload;
    pendingSamples = result.pendingSamples;
    joinedSamples = result.joinedSamples;
    pendingEpochIdsSample = result.pendingEpochIdsSample;
    boardEpochsSample = result.boardEpochsSample;
    proxyUrlUsed = result.proxyUrlUsed;
    fromBlock = result.fromBlock;
    rangesScanned = result.rangesScanned;
    lastScanError = result.lastError;
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }
  } else if (!error) {
    error = "unable to resolve epoch";
  }

  if (!error) {
    proposalCache = {
      blockNumber: latestBlock,
      epoch,
      fetchedAt: now,
      proposals,
      debugError: null,
      pendingEvents: pendingEventsWire,
      pendingRenderable,
      pendingActiveCount,
      boardEventsCount,
      joinedRenderableCount,
      missingBoardPayload,
      pendingSamples,
      joinedSamples,
      fromBlock,
      rangesScanned,
      lastError: lastScanError,
      pendingEpochIdsSample,
      boardEpochsSample,
      proxyUrlUsed,
    };
    return {
      epoch,
      proposals,
      error: null,
      pendingEvents: pendingEventsWire,
      pendingRenderable,
      pendingActiveCount,
      boardEventsCount,
      joinedRenderableCount,
      missingBoardPayload,
      pendingSamples,
      joinedSamples,
      fromBlock,
      rangesScanned,
      lastError: lastScanError,
      pendingEpochIdsSample,
      boardEpochsSample,
      proxyUrlUsed,
    };
  }

  console.error("[api/proposals] on-chain scan failed", error);
  return {
    epoch: proposalCache.epoch,
    proposals: proposalCache.proposals,
    error,
    pendingEvents: proposalCache.pendingEvents,
    pendingRenderable: proposalCache.pendingRenderable,
    pendingActiveCount: proposalCache.pendingActiveCount,
    boardEventsCount: proposalCache.boardEventsCount,
    joinedRenderableCount: proposalCache.joinedRenderableCount,
    missingBoardPayload: proposalCache.missingBoardPayload,
    pendingSamples: proposalCache.pendingSamples,
    joinedSamples: proposalCache.joinedSamples,
    fromBlock: proposalCache.fromBlock,
    rangesScanned: proposalCache.rangesScanned,
    lastError: proposalCache.lastError,
    pendingEpochIdsSample: proposalCache.pendingEpochIdsSample,
    boardEpochsSample: proposalCache.boardEpochsSample,
    proxyUrlUsed: proposalCache.proxyUrlUsed,
  };
}

async function fetchChainEpoch(blockNumber: bigint) {
  const block = await publicClient.getBlock({ blockNumber });
  const timestamp = block?.timestamp;
  if (timestamp == null) {
    throw new Error("missing block timestamp");
  }
  const epochAt = await publicClient.readContract({
    address: LOREBOARD_VOTING_ADDRESS,
    abi: loreboardVotingAbi,
    functionName: "epochAt",
    args: [timestamp as bigint],
  });
  const epochNumber = Number(epochAt);
  if (!Number.isFinite(epochNumber)) {
    throw new Error("invalid epoch from chain");
  }
  return epochNumber;
}

async function loadOnChainProposals(
  epochId: number,
  latestBlock: bigint,
  fromBlock: bigint
): Promise<{
  proposals: Proposal[];
  pendingEvents: PendingPlacementWire[];
  pendingRenderable: PendingRenderable[];
  pendingActiveCount: number;
  boardEventsCount: number;
  joinedRenderableCount: number;
  missingBoardPayload: string[];
  pendingSamples: PendingPlacementWire[];
  joinedSamples: PendingRenderable[];
  pendingEpochIdsSample: number[];
  boardEpochsSample: number[];
  fromBlock: bigint;
  rangesScanned: number;
  lastError: string | null;
  proxyUrlUsed: string | null;
}> {
  if (fromBlock > latestBlock) {
    return {
      proposals: [],
      pendingEvents: [],
      pendingRenderable: [],
      pendingActiveCount: 0,
      boardEventsCount: 0,
      joinedRenderableCount: 0,
      missingBoardPayload: [],
      pendingSamples: [],
      joinedSamples: [],
      pendingEpochIdsSample: [],
      boardEpochsSample: [],
      fromBlock,
      rangesScanned: 0,
      lastError: null,
      proxyUrlUsed: null,
    };
  }

  const ranges = buildScanRanges(latestBlock, fromBlock);
  const processedRanges: Array<{ from: bigint; to: bigint }> = [];
  const pendingById = new Map<string, PendingPlacementWire>();
  const boardById = new Map<string, PlacementProposedWire>();
  let scanError: string | null = null;
  let proxyUrlUsed: string | null = null;

  for (const range of ranges) {
    processedRanges.push(range);
    try {
      const [pendingChunk, boardChunk] = await Promise.all([
        fetchPendingPlacementEvents(range.from, range.to),
        fetchPlacementProposedEvents(range.from, range.to),
      ]);
      for (const event of pendingChunk) {
        recordPendingWire(pendingById, toWire(event));
      }
      for (const event of boardChunk) {
        recordBoardWire(boardById, toPlacementWire(event));
      }
    } catch (err) {
      scanError = err instanceof Error ? err.message : String(err);
      continue;
    }
    if (pendingById.size >= 1 && boardById.size >= TARGET_BOARD_EVENTS) {
      break;
    }
  }

  if (!pendingById.size && !boardById.size) {
    try {
    for (const range of ranges) {
      for (const address of PENDING_EVENT_ADDRESSES) {
        const logsResult = await proxyGetLogs({
          address,
          fromBlock: range.from,
          toBlock: range.to,
          topic0: PENDING_EVENT_TOPIC,
        });
        if (!proxyUrlUsed) proxyUrlUsed = logsResult.url;
        for (const log of logsResult.logs) {
          const wire = decodeBlockscoutPendingWire(log);
          if (!wire) continue;
          recordPendingWire(pendingById, wire);
        }
      }
      const boardResult = await proxyGetLogs({
        address: BOARD,
        fromBlock: range.from,
        toBlock: range.to,
        topic0: PLACEMENT_EVENT_TOPIC,
      });
      if (!proxyUrlUsed) proxyUrlUsed = boardResult.url;
      for (const log of boardResult.logs) {
        const wire = decodeBlockscoutPlacementWire(log);
        if (!wire) continue;
        recordBoardWire(boardById, wire);
      }
    }
    } catch (err) {
      scanError = err instanceof Error ? err.message : String(err);
      console.warn("[api/proposals] blockscout proxy fallback failed", err);
    }
  }

  const pendingEventsWire = Array.from(pendingById.values());
  const nowSec = BigInt(Math.floor(Date.now() / 1000));
  const nowSecNumber = Number(nowSec);
  const epochWindowMin = Math.max(0, epochId - 2);
  const epochWindowMax = epochId + 10;
  const pendingActive = pendingEventsWire.filter((wire) => {
    const voteEnds = wire.voteEndsAt ? BigInt(wire.voteEndsAt) : 0n;
    if (voteEnds <= nowSec) return false;
    const epoch = wire.epochId ? Number(wire.epochId) : NaN;
    if (!Number.isFinite(epoch)) return false;
    return epoch >= epochWindowMin && epoch <= epochWindowMax;
  });
  const sortedPendingActive = [...pendingActive].sort((a, b) => {
    const blockA = a.blockNumber ? BigInt(a.blockNumber) : 0n;
    const blockB = b.blockNumber ? BigInt(b.blockNumber) : 0n;
    if (blockA !== blockB) return blockB > blockA ? 1 : -1;
    const logA = a.logIndex ? BigInt(a.logIndex) : 0n;
    const logB = b.logIndex ? BigInt(b.logIndex) : 0n;
    if (logA !== logB) return logB > logA ? 1 : -1;
    return 0;
  });
  const pendingSamples = sortedPendingActive.slice(0, 2);

  const joinedRenderable = sortedPendingActive
    .map((pending) => {
      const placement = boardById.get(pending.placementId.toLowerCase());
      if (!placement) return null;
      return { pending, placement };
    })
    .filter((entry): entry is PendingRenderable => Boolean(entry));
  const joinedSamples = joinedRenderable.slice(0, 2);

  const missingBoardPayload = sortedPendingActive
    .filter((pending) => !boardById.has(pending.placementId.toLowerCase()))
    .map((pending) => pending.placementId)
    .filter(Boolean)
    .slice(0, 10);

  const boardOnlyPlacements = Array.from(boardById.values()).filter(
    (placement) => !pendingById.has(placement.placementId.toLowerCase())
  );

  const sortedBoardOnly = [...boardOnlyPlacements].sort((a, b) => {
    const blockA = a.blockNumber ? BigInt(a.blockNumber) : 0n;
    const blockB = b.blockNumber ? BigInt(b.blockNumber) : 0n;
    if (blockA !== blockB) return blockB > blockA ? 1 : -1;
    const logA = a.logIndex ? BigInt(a.logIndex) : 0n;
    const logB = b.logIndex ? BigInt(b.logIndex) : 0n;
    if (logA !== logB) return logB > logA ? 1 : -1;
    return 0;
  });

  const recentBoardOnly = sortedBoardOnly;

  const pendingEpochIdsSample = sampleUniqueNumbers(
    pendingEventsWire.map((wire) => (wire.epochId ? Number(wire.epochId) : undefined)),
    5,
  );
  const boardEpochsSample = sampleUniqueNumbers(
    Array.from(boardById.values()).map((placement) => placement.epoch),
    5,
  );

  const proposalPromises: Promise<Proposal | null>[] = joinedRenderable.map(async ({ pending, placement }) => {
    const placementId = pending.placementId as `0x${string}`;
    if (!placementId) return null;
    const epochSubmitted = Number(pending.epochId ?? placement.epoch ?? 0);
    const cid = await readCidForPlacement(placementId);
    let yes = 0;
    let no = 0;
    try {
      const [yesWeight, noWeight] = (await publicClient.readContract({
        address: LOREBOARD_VOTING_ADDRESS,
        abi: loreboardVotingAbi,
        functionName: "getPlacementVotes",
        args: [BigInt(epochSubmitted), placementId],
      })) as [bigint, bigint];
      yes = Number(yesWeight);
      no = Number(noWeight);
    } catch {
      // Voting may not be available yet
    }
    const voteEndsAtSec = pending.voteEndsAt ? Number(BigInt(pending.voteEndsAt)) : 0;
    const isVotable =
      voteEndsAtSec > nowSecNumber &&
      Boolean(pending.placementId) &&
      Boolean(placement.placementId);
    return {
      id: placementId,
      owner: placement.bidder,
      cid: cid ?? placement.cidHash ?? placementId,
      name: cid ?? placement.cidHash ?? placementId,
      mime: "image/png",
      rect: placement.rect,
      cells: placement.cells,
      bidPerCellWei: placement.bidPerCellWei,
      width: placement.rect.w,
      height: placement.rect.h,
      epochSubmitted,
      voteEndsAtEpoch: Number(pending.epochId ?? placement.epoch ?? epochSubmitted),
      voteEndsAtSec,
      voters: {},
      yes,
      no,
      status: "proposed",
      createdAt: Date.now(),
      chainId: CHAIN_ID_HEX,
      isVotable,
    } satisfies Proposal;
  });

  const boardOnlyPromises: Promise<Proposal | null>[] = recentBoardOnly.map(async (placement) => {
    const placementId = placement.placementId as `0x${string}`;
    if (!placementId) return null;
    const epochSubmitted = placement.epoch;
    const cid = await readCidForPlacement(placementId);

    let yes = 0;
    let no = 0;
    try {
      const [yesWeight, noWeight] = (await publicClient.readContract({
        address: LOREBOARD_VOTING_ADDRESS,
        abi: loreboardVotingAbi,
        functionName: "getPlacementVotes",
        args: [BigInt(epochSubmitted), placementId],
      })) as [bigint, bigint];
      yes = Number(yesWeight);
      no = Number(noWeight);
    } catch {
      // Voting might not be available for unregistered placements
    }

    return {
      id: placementId,
      owner: placement.bidder,
      cid: cid ?? placement.cidHash ?? placementId,
      name: cid ?? placement.cidHash ?? placementId,
      mime: "image/png",
      rect: placement.rect,
      cells: placement.cells,
      bidPerCellWei: placement.bidPerCellWei,
      width: placement.rect.w,
      height: placement.rect.h,
      epochSubmitted,
      voteEndsAtEpoch: epochSubmitted + 1,
      voteEndsAtSec: 0,
      voters: {},
      yes,
      no,
      status: "proposed",
      createdAt: Date.now(),
      chainId: CHAIN_ID_HEX,
      isVotable: false,
    } satisfies Proposal;
  });

  const [registeredResults, boardOnlyResults] = await Promise.all([
    Promise.all(proposalPromises),
    Promise.all(boardOnlyPromises),
  ]);

  const registeredProposals = registeredResults.filter((entry): entry is Proposal => entry !== null);
  const boardOnlyProposals = boardOnlyResults.filter((entry): entry is Proposal => entry !== null);

  const allProposals = [...registeredProposals, ...boardOnlyProposals];

  const earliestScannedFrom =
    processedRanges[processedRanges.length - 1]?.from ?? fromBlock;
  const rangesScanned = processedRanges.length;

  const pendingActiveCount = pendingActive.length;

  return {
    proposals: allProposals,
    pendingEvents: pendingEventsWire,
    pendingRenderable: joinedRenderable,
    pendingActiveCount,
    boardEventsCount: boardById.size,
    joinedRenderableCount: joinedRenderable.length,
    missingBoardPayload,
    pendingSamples,
    joinedSamples,
    fromBlock: earliestScannedFrom,
    rangesScanned,
    lastError: scanError,
    pendingEpochIdsSample,
    boardEpochsSample,
    proxyUrlUsed,
  };
}

async function fetchPendingPlacementEvents(fromBlock: bigint, toBlock: bigint) {
  const events: PendingPlacementEvent[] = [];
  if (fromBlock > toBlock) return events;

  for (const address of PENDING_EVENT_ADDRESSES) {
    const rawLogs = await getRawLogs(address, fromBlock, toBlock);
    events.push(...decodePendingPlacementRegistered(rawLogs));
  }

  return events;
}

async function fetchPlacementProposedEvents(fromBlock: bigint, toBlock: bigint) {
  const events: PlacementProposedEvent[] = [];
  if (fromBlock > toBlock) return events;

  const rawLogs = await getRawLogs(BOARD, fromBlock, toBlock);
  events.push(...decodeBoardPlacementProposed(rawLogs));

  return events;
}

async function readCidForPlacement(placementId: `0x${string}`) {
  const raw = await publicClient.readContract({
    address: BOARD,
    abi: BoardAbiTyped,
    functionName: "cidOf",
    args: [placementId],
  });
  const hex =
    typeof raw === "string"
      ? raw
      : typeof raw === "object" && raw !== null
      ? toHex(raw as Uint8Array)
      : "";
  if (!isHex(hex)) return null;
  const bytes = hexToBytes(hex);
  const decoded = textDecoder.decode(bytes);
  const trimmed = decoded.replace(/\0+$/g, "").trim();
  return trimmed || null;
}

type ProposalPostBody = {
  id?: string;
  owner: string;
  cid: string;
  name?: string;
  mime?: "image/png" | "image/jpeg";
  rect: Rect;
  width?: number;
  height?: number;
  bidPerCellWei: string | number | bigint;
  cells?: number;
  filename?: string;
};

export async function POST(req: NextRequest) {
  let body: ProposalPostBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { owner, cid, rect, bidPerCellWei } = body ?? {};
  if (!owner || !cid || !rect || bidPerCellWei == null) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (body.mime && body.mime !== "image/png" && body.mime !== "image/jpeg") {
    return NextResponse.json({ error: "Unsupported mime type" }, { status: 400 });
  }

  const normalizedCid = cid.replace(/^ipfs:\/\//, "").trim();
  if (!normalizedCid) {
    return NextResponse.json({ error: "Invalid CID" }, { status: 400 });
  }

  const cells = Number.isFinite(body.cells) && body.cells && body.cells > 0 ? body.cells : rectCells(rect);
  if (cells <= 0) {
    return NextResponse.json({ error: "Cells must be positive" }, { status: 400 });
  }

  const nowEpoch = currentEpoch();
  const secondsPerEpoch = EPOCH_SECONDS > 0 ? EPOCH_SECONDS : 0;
  const voteWindowSeconds = VOTE_WINDOW_SECONDS > 0 ? VOTE_WINDOW_SECONDS : 259200;
  const windowEpochs =
    secondsPerEpoch > 0 ? Math.max(1, Math.ceil(voteWindowSeconds / secondsPerEpoch)) : 1;

  const proposal = addProposal({
    id: body.id ?? normalizedCid,
    owner,
    cid: normalizedCid,
    name: body.name ?? "",
    mime: (body.mime ?? "image/png") as "image/png" | "image/jpeg",
    rect,
    cells,
    bidPerCellWei: String(bidPerCellWei),
    width: body.width,
    height: body.height,
    epochSubmitted: nowEpoch,
    voteEndsAtEpoch: nowEpoch + windowEpochs,
    chainId:
      typeof body.id === "string" && body.id.startsWith("0x") && body.id.length === 66
        ? body.id
        : undefined,
  } as Omit<Proposal, "yes" | "no" | "voters" | "status" | "createdAt">);

  ProposalStore.upsert({
    id: proposal.id,
    owner,
    cid: normalizedCid,
    name: proposal.name,
    mime: proposal.mime,
    width: proposal.width,
    height: proposal.height,
    filename: body.filename,
    rect,
    bidPerCellWei: proposal.bidPerCellWei,
  });

  return NextResponse.json({ ok: true, proposal }, { status: 200 });
}
