// scripts/operatorFinalize.ts
import "dotenv/config";
import fs from "fs";
import path from "path";
import {
  concat,
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  keccak256,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

/* ---------- ENV ---------- */

const rpc = process.env.NEXT_PUBLIC_FLUENT_RPC!;
const treasury = process.env
  .NEXT_PUBLIC_LOREBOARD_ADDRESS as `0x${string}` | undefined; // finalize target

const emitterEnv = process.env
  .NEXT_PUBLIC_LOREBOARD_EMITTER as `0x${string}` | undefined;
const emitter = emitterEnv
  ? (emitterEnv.toLowerCase() as `0x${string}`)
  : undefined;

const deployBlockEnv =
  process.env.NEXT_PUBLIC_LOREBOARD_DEPLOY_BLOCK ??
  process.env.NEXT_PUBLIC_DEPLOY_BLOCK;

const operatorPk = process.env.OPERATOR_PK!;
const blocksLookbackEnv = process.env.LOOKBACK_BLOCKS ?? "20000";
const LOOKBACK_BLOCKS = BigInt(blocksLookbackEnv); // how far back we search

if (!rpc) throw new Error("NEXT_PUBLIC_FLUENT_RPC is required");
if (!deployBlockEnv)
  throw new Error(
    "NEXT_PUBLIC_LOREBOARD_DEPLOY_BLOCK (or NEXT_PUBLIC_DEPLOY_BLOCK) is required"
  );
if (!operatorPk) throw new Error("OPERATOR_PK is required");
if (!emitter)
  throw new Error(
    "Set NEXT_PUBLIC_LOREBOARD_EMITTER to the contract that emitted ProposedEvt"
  );

const deployBlock = BigInt(deployBlockEnv);

/* ---------- Clients ---------- */

const chain = defineChain({
  id: 20994,
  name: "Fluent Testnet",
  nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [rpc] } },
});

const operatorAccount = privateKeyToAccount(
  operatorPk.startsWith("0x")
    ? (operatorPk as `0x${string}`)
    : (`0x${operatorPk}` as `0x${string}`)
);

const publicClient = createPublicClient({ chain, transport: http(rpc) });
const wallet = createWalletClient({
  chain,
  transport: http(rpc),
  account: operatorAccount,
});

/* ---------- Types & helpers ---------- */

type Rect = { x: number; y: number; w: number; h: number };

type Proposal = {
  id: Hex;
  bidder: `0x${string}`;
  epoch: number;
  rect: Rect;
  bidPerCellWei: bigint;
  cells: number;
  blockNumber: bigint;
  logIndex: number;
};

const overlaps = (a: Rect, b: Rect) => {
  const ax2 = a.x + a.w,
    ay2 = a.y + a.h;
  const bx2 = b.x + b.w,
    by2 = b.y + b.h;
  return !(ax2 <= b.x || bx2 <= a.x || ay2 <= b.y || by2 <= a.y);
};

// Direct ABI for getLogs decoding (no manual parsing needed)
const proposedEvtAbi = {
  type: "event",
  name: "ProposedEvt",
  inputs: [
    { name: "id", type: "bytes32", indexed: true },
    { name: "bidder", type: "address", indexed: true },
    { name: "epoch", type: "uint32", indexed: false },
    {
      name: "rect",
      type: "tuple",
      components: [
        { name: "x", type: "int32" },
        { name: "y", type: "int32" },
        { name: "w", type: "int32" },
        { name: "h", type: "int32" },
      ],
      indexed: false,
    },
    { name: "bidPerCellWei", type: "uint96", indexed: false },
    { name: "cells", type: "uint32", indexed: false },
    { name: "cidHash", type: "bytes32", indexed: false },
    { name: "value", type: "uint256", indexed: false },
  ],
} as const;

/* ---------- Log fetch (no PROBE_TX) ---------- */

async function fetchRecentProposals(): Promise<Proposal[]> {
  const latest = await publicClient.getBlockNumber();
  const fromBlock =
    latest > LOOKBACK_BLOCKS
      ? latest - LOOKBACK_BLOCKS
      : (deployBlock ?? 0n);

  console.log(
    "[logs] scanning from",
    Number(fromBlock),
    "to",
    Number(latest),
    "lookback=",
    LOOKBACK_BLOCKS.toString()
  );

  const logs = await publicClient.getLogs({
    address: emitter,
    fromBlock,
    toBlock: latest,
    event: proposedEvtAbi,
  });

  console.log("[logs] found", logs.length, "ProposedEvt logs");

  return logs.map((log) => {
    const args = log.args;
    if (
      !args ||
      !args.id ||
      !args.bidder ||
      !args.rect ||
      args.bidPerCellWei == null ||
      args.cells == null
    ) {
      throw new Error("Malformed ProposedEvt log");
    }

    const rect = args.rect;

    return {
      id: args.id as Hex,
      bidder: (args.bidder as `0x${string}`).toLowerCase() as `0x${string}`,
      epoch: Number(args.epoch ?? 0),
      rect: {
        x: Number(rect.x ?? 0),
        y: Number(rect.y ?? 0),
        w: Number(rect.w ?? 0),
        h: Number(rect.h ?? 0),
      },
      bidPerCellWei: BigInt(args.bidPerCellWei),
      cells: Number(args.cells),
      blockNumber: log.blockNumber ?? 0n,
      logIndex: Number(log.logIndex ?? 0n),
    };
  });
}

/* ---------- Main ---------- */

async function main() {
  const latest = await publicClient.getBlockNumber();
  const chainId = await publicClient.getChainId();
  const bal = await publicClient.getBalance({
    address: operatorAccount.address,
  });

  console.log("[diag] chainId:", chainId, "latest block:", Number(latest));
  console.log("[diag] operator:", operatorAccount.address);
  console.log("[diag] balance (wei):", bal.toString());
  console.log("[diag] treasury:", treasury);
  console.log("[diag] emitter:", emitter);

  const proposalsAll = await fetchRecentProposals();
  if (!proposalsAll.length) {
    console.warn(
      "No ProposedEvt logs in recent window. Submit a proposal first, then retry."
    );
    return;
  }

  const epochEnv = process.env.EPOCH;
  const targetEpoch = epochEnv ? Number(epochEnv) : undefined;

  if (targetEpoch === undefined || Number.isNaN(targetEpoch)) {
    const epochs = [...new Set(proposalsAll.map((p) => p.epoch))].sort(
      (a, b) => a - b
    );
    console.log("Epochs present in recent logs:", epochs.join(", "));
    console.log("Set EPOCH=<one-of-these> and run again.");
    return;
  }

  const epochProps = proposalsAll.filter(
    (p) => p.epoch === targetEpoch
  );
  if (!epochProps.length) {
    console.warn("No proposals found for epoch", targetEpoch);
    return;
  }

  // Greedy select: highest bidPerCellWei wins; tie-break by blockNumber/logIndex
  const winners: Proposal[] = [];
  const losers: Proposal[] = [];

  const byBid = [...epochProps].sort((a, b) => {
    if (a.bidPerCellWei === b.bidPerCellWei) {
      if (a.blockNumber === b.blockNumber)
        return a.logIndex - b.logIndex;
      return Number(a.blockNumber - b.blockNumber);
    }
    return a.bidPerCellWei > b.bidPerCellWei ? -1 : 1;
  });

  for (const p of byBid) {
    const conflict = winners.some((w) => overlaps(w.rect, p.rect));
    if (conflict) losers.push(p);
    else winners.push(p);
  }

  /* ---------- Manifest JSON & root ---------- */

  const manifestCid =
    process.env.MANIFEST_CID ?? "ipfs://pending-manifest"; // you can overwrite this later

  const manifestOut =
    process.env.MANIFEST_PATH ??
    path.join(
      process.cwd(),
      ".next-cache",
      `manifest-epoch-${targetEpoch}.json`
    );

  fs.mkdirSync(path.dirname(manifestOut), { recursive: true });
  fs.writeFileSync(
    manifestOut,
    JSON.stringify(
      {
        epoch: targetEpoch,
        winners: winners.map((w) => ({
          id: w.id,
          rect: w.rect,
          cells: w.cells,
        })),
        rejected: losers.map((l) => l.id),
        generatedAt: new Date().toISOString(),
        emitter,
      },
      null,
      2
    ),
    "utf-8"
  );

  type Hex32 = `0x${string}`;
  const acceptedIds = winners.map((w) => w.id) as readonly Hex32[];
  const rejectedIds = losers.map((l) => l.id) as readonly Hex32[];

  const concatenated: Hex =
    acceptedIds.length > 0
      ? (concat(acceptedIds as readonly Hex[]) as Hex)
      : ("0x" as Hex);

  const manifestRoot = keccak256(concatenated) as Hex32;

  console.log("Epoch:", targetEpoch);
  console.log("Winners:", winners.length, "Losers:", losers.length);
  console.log("Manifest path:", manifestOut);
  console.log("Manifest CID:", manifestCid);
  console.log("Manifest root:", manifestRoot);

  if ((process.env.SKIP_FINALIZE ?? "1") === "1") {
    console.log("SKIP_FINALIZE=1 set; not calling finalizeEpoch.");
    return;
  }
  if (!treasury)
    throw new Error(
      "NEXT_PUBLIC_LOREBOARD_ADDRESS is required to finalize."
    );

  const finalizeAbi = [
    {
      type: "function",
      name: "finalizeEpoch",
      stateMutability: "nonpayable",
      inputs: [
        { name: "epoch", type: "uint32" },
        { name: "manifestRoot", type: "bytes32" },
        { name: "manifestCID", type: "string" },
        { name: "accepted", type: "bytes32[]" },
        { name: "rejected", type: "bytes32[]" },
      ],
      outputs: [],
    } as const,
  ];

  const txHash = await wallet.writeContract({
    address: treasury,
    abi: finalizeAbi as any,
    functionName: "finalizeEpoch",
    args: [targetEpoch, manifestRoot, manifestCid, acceptedIds, rejectedIds],
  });

  console.log("Finalize tx:", txHash);
  const receipt = await publicClient.waitForTransactionReceipt({
    hash: txHash,
  });
  console.log("Finalize status:", receipt.status);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
