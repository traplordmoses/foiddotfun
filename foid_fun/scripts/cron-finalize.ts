// cron-finalize.ts — Automated epoch finalization cron job.
// Scans recent epochs and finalizes any with closed voting windows.
// Safe to run repeatedly — already-finalized epochs are skipped.
// Usage: npx tsx scripts/cron-finalize.ts
// Recommended cron: every 2 hours

import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { createPublicClient, defineChain, http, type Address } from "viem";
import { loadWorkerConfig } from "./lib/workerConfig";
import { finalizeEpochIfReady } from "./lib/finalize";
import { logFinalizeReadinessReport } from "./lib/syncReport";
import {
  getLogsChunkedEvent,
  resolveBoardLogBounds,
} from "./lib/logScan";
import { getLogsFromBlockscout } from "./lib/blockscout";
import { inferDeployBlock } from "./lib/deployBlock";
import { getBlockWithTimeout } from "./lib/rpc";
import {
  coerceRect,
  computePlacementId,
  readAddressArg,
  readHexArg,
  readNumberArg,
  topicToAddress,
  tryDecodeEventLog,
} from "./lib/workerHelpers";
import { readContractSafe } from "./lib/contract";
import type { ChainProposal } from "./lib/types";
import treasuryAbi from "../src/abi/LoreBoardTreasury.json";
import boardAbi from "../src/abi/LoreboardBoardV2.json";
import type { Abi, AbiEvent, Hex } from "viem";
import { getEventSelector } from "viem";

dotenv.config();
dotenv.config({ path: ".env.local", override: true });

const EPOCH_LOOKBACK = 6; // scan this many epochs back from current
const ZERO_BYTES32 =
  "0x0000000000000000000000000000000000000000000000000000000000000000";

const votingV2Abi = [
  { type: "function", name: "epochAt", stateMutability: "view", inputs: [{ name: "t", type: "uint64" }], outputs: [{ name: "", type: "uint32" }] },
  { type: "function", name: "epochSeconds", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint32" }] },
  { type: "function", name: "getPlacementMeta", stateMutability: "view", inputs: [{ name: "placementId", type: "bytes32" }], outputs: [{ name: "registeredAt", type: "uint64" }, { name: "voteEndsAt", type: "uint64" }, { name: "epochId", type: "uint32" }, { name: "exists", type: "bool" }] },
] as const;

function getPlacementProposedEvent(abi: Abi): AbiEvent {
  const event = abi.find(
    (item) => item.type === "event" && item.name === "PlacementProposed"
  );
  if (!event) throw new Error("Missing PlacementProposed event in ABI");
  return event as AbiEvent;
}

async function fetchProposalsForEpochSimple(params: {
  publicClient: ReturnType<typeof createPublicClient>;
  board: Address;
  voting: Address;
  epochId: number;
  blockscoutApiBase: string;
}) {
  const PLACEMENT_PROPOSED_EVENT = getPlacementProposedEvent(boardAbi as Abi);
  const eventTopic = getEventSelector(PLACEMENT_PROPOSED_EVENT);
  const latest = await params.publicClient.getBlockNumber();
  const fromBlock = latest > 100_000n ? latest - 100_000n : 0n;

  const boardLogs = await getLogsFromBlockscout({
    apiBase: params.blockscoutApiBase,
    address: params.board,
    fromBlock,
    toBlock: latest,
    topic0: eventTopic,
    timeoutMs: 15_000,
    retryCount: 2,
    retryDelayMs: 500,
    debug: false,
  });

  const effectiveLogs = boardLogs.map((log) =>
    tryDecodeEventLog({
      log,
      debug: false,
      event: PLACEMENT_PROPOSED_EVENT,
      failureLabel: "decode failed",
    })
  );

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
      timeoutMs: 15_000,
    });
    blockTimestamp.set(blockNumber, Number(block.timestamp));
  }

  const proposals = new Map<string, ChainProposal>();

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
        id = computePlacementId(bidder, BigInt(epochFromArgs), cidHash as Hex, rect);
      }
    }
    if (!id || !bidder) continue;

    const idKey = id.toLowerCase();
    let meta: readonly [bigint, bigint, number, boolean] | null = null;
    try {
      meta = (await readContractSafe({
        publicClient: params.publicClient,
        address: params.voting,
        abi: votingV2Abi,
        functionName: "getPlacementMeta",
        args: [id],
        label: `getPlacementMeta ${id}`,
        timeoutMs: 15_000,
      })) as readonly [bigint, bigint, number, boolean];
    } catch { /* skip */ }

    const epochFromMeta = meta ? Number(meta[2]) : null;
    const epochFromArgs = readNumberArg(args, ["epoch", "epochId"]);
    const epoch = epochFromMeta ?? epochFromArgs;
    if (epoch === null || epoch !== params.epochId) continue;

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

  return Array.from(proposals.values());
}

async function main() {
  const ts = () => new Date().toISOString();
  console.log(`\n[cron] ${ts()} starting epoch finalization scan`);

  const config = loadWorkerConfig(process.env);
  const {
    publicClient,
    addresses: { board, treasury, voting, manifestStore, nftAddress },
    wallets: { operatorWallet, adminWallet },
    flags: { skipNftSync },
    scanning: { blockscoutApiBase },
  } = config;

  if (!operatorWallet) {
    console.error("[cron] OPERATOR_KEY / OPERATOR_PK not set; cannot finalize");
    process.exit(1);
  }
  if (!manifestStore) {
    console.error("[cron] manifest store address not set; cannot finalize");
    process.exit(1);
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const currentEpoch = Number(
    await readContractSafe({
      publicClient,
      address: voting,
      abi: votingV2Abi,
      functionName: "epochAt",
      args: [BigInt(nowSec)],
      label: "epochAt now",
    })
  );

  console.log(`[cron] current epoch: ${currentEpoch}, scanning ${currentEpoch - EPOCH_LOOKBACK} to ${currentEpoch}`);

  let finalized = 0;

  for (let epochId = Math.max(0, currentEpoch - EPOCH_LOOKBACK); epochId <= currentEpoch; epochId++) {
    // check if treasury already finalized this epoch
    const manifestRoot = (await readContractSafe({
      publicClient,
      address: treasury,
      abi: treasuryAbi,
      functionName: "manifestRootOf",
      args: [epochId],
      label: `manifestRootOf ${epochId}`,
    })) as Hex;

    if (manifestRoot && manifestRoot !== ZERO_BYTES32) {
      continue; // already finalized
    }

    // fetch proposals for this epoch
    const proposals = await fetchProposalsForEpochSimple({
      publicClient,
      board,
      voting,
      epochId,
      blockscoutApiBase,
    });

    if (proposals.length === 0) continue;

    console.log(`[cron] epoch ${epochId}: ${proposals.length} proposals found, attempting finalization`);

    try {
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
        dryRun: false,
      });
      finalized++;
      console.log(`[cron] epoch ${epochId}: finalization complete`);
    } catch (err) {
      console.error(`[cron] epoch ${epochId}: finalization failed:`, err);
    }
  }

  console.log(`[cron] ${ts()} done. finalized ${finalized} epoch(s).`);
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) ===
    path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  main().catch((err) => {
    console.error("[cron] fatal:", err);
    process.exit(1);
  });
}
