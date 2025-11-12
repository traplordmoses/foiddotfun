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

/** ---------- ENV ---------- */
const rpc = process.env.NEXT_PUBLIC_FLUENT_RPC!;
const treasury = process.env.NEXT_PUBLIC_LOREBOARD_ADDRESS as `0x${string}` | undefined; // for finalize
const emitterEnv = process.env.NEXT_PUBLIC_LOREBOARD_EMITTER as `0x${string}` | undefined;
const emitter = emitterEnv ? (emitterEnv.toLowerCase() as `0x${string}`) : undefined;
const deployBlockEnv = process.env.NEXT_PUBLIC_LOREBOARD_DEPLOY_BLOCK ?? process.env.NEXT_PUBLIC_DEPLOY_BLOCK;
const operatorPk = process.env.OPERATOR_PK!;
const txProbe = process.env.PROBE_TX as `0x${string}` | undefined;
const topic0 = (process.env.TOPIC0_OVERRIDE as Hex | undefined) // from your receipt:
  ?? ("0x92b1196f974df8d5783915b6db84d712f8cb5ef8957f77bd341b6e731257cb34" as Hex);

if (!rpc) throw new Error("NEXT_PUBLIC_FLUENT_RPC is required");
if (!deployBlockEnv) throw new Error("NEXT_PUBLIC_LOREBOARD_DEPLOY_BLOCK (or NEXT_PUBLIC_DEPLOY_BLOCK) is required");
if (!operatorPk) throw new Error("OPERATOR_PK is required");
if (!emitter) throw new Error("Set NEXT_PUBLIC_LOREBOARD_EMITTER to the contract that emitted ProposedEvt");

const deployBlock = BigInt(deployBlockEnv);

/** ---------- Clients ---------- */
const chain = defineChain({
  id: 20994,
  name: "Fluent Testnet",
  nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [rpc] } },
});
const operatorAccount = privateKeyToAccount(
  operatorPk.startsWith("0x") ? operatorPk as `0x${string}` : (`0x${operatorPk}` as `0x${string}`)
);
const publicClient = createPublicClient({ chain, transport: http(rpc) });
const wallet = createWalletClient({ chain, transport: http(rpc), account: operatorAccount });

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
  address: `0x${string}`;
};

const overlaps = (a: Rect, b: Rect) => {
  const ax2 = a.x + a.w, ay2 = a.y + a.h;
  const bx2 = b.x + b.w, by2 = b.y + b.h;
  return !(ax2 <= b.x || bx2 <= a.x || ay2 <= b.y || by2 <= a.y);
};

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

/** --------- Minimal decoders (indexed + non-indexed) ---------- */
// topics[1] = id (bytes32), topics[2] = bidder (address, zero-padded)
function decodeIndexed(log: any) {
  const id = log.topics?.[1] as Hex | undefined;
  const bidderTopic = log.topics?.[2] as Hex | undefined;
  if (!id || !bidderTopic) throw new Error("Missing indexed id/bidder");
  const bidder = (`0x${bidderTopic.slice(26)}` as `0x${string}`).toLowerCase() as `0x${string}`;
  return { id, bidder };
}

// Your on-chain layout (from the working tx):
// ProposedEvt(bytes32 indexed id, address indexed bidder,
//   uint32 epoch, (int32,int32,int32,int32) rect, uint96 bidPerCellWei, uint32 cells, bytes32 cidHash, uint256 value)
function decodeData(dataHex: Hex) {
  // Strip 0x then parse 32-byte words
  const data = dataHex.startsWith("0x") ? dataHex.slice(2) : dataHex;
  const word = (i: number) => BigInt("0x" + data.slice(i*64, (i+1)*64));
  // words: [epoch][rect.x][rect.y][rect.w][rect.h][bidPerCellWei][cells][cidHash][value]
  const epoch = Number(word(0));
  const rectX = Number((word(1) << 0n) & ((1n<<32n)-1n) << 0n) | 0; // but we just parse as signed below
  const toSigned32 = (u: bigint) => {
    const v = Number(u & ((1n<<32n)-1n));
    return v & 0x80000000 ? v - 0x100000000 : v;
  };
  const x = toSigned32(word(1));
  const y = toSigned32(word(2));
  const w = toSigned32(word(3));
  const h = toSigned32(word(4));
  const bidPerCellWei = word(5);
  const cells = Number(word(6));
  return { epoch, rect: { x, y, w, h }, bidPerCellWei, cells };
}

/** ---------- Robust log fetch ---------- */
async function getLogsChunkedByAddressAndTopic() {
  const step = 90_000n;
  const latest = await publicClient.getBlockNumber();
  const all: any[] = [];
  let raw = 0;

  for (let start = deployBlock; start <= latest; start += step + 1n) {
    const end = start + step > latest ? latest : start + step;
    const logs = await publicClient.getLogs({
      address: emitter,                 // <-- filter on RPC
      fromBlock: start,
      toBlock: end,
      event: proposedEvtAbi,
    });
    raw += logs.length;
    all.push(...logs);
  }
  const now = await publicClient.getBlockNumber();
  console.log("Fetched logs (topic0-only, address-filtered):", raw, " blocks", Number(deployBlock), "→", Number(now));
  return all;
}

async function fallbackLogsByTxBlock() {
  if (!txProbe) return [];
  try {
    const t = await publicClient.getTransaction({ hash: txProbe });
    if (!t.blockHash) return [];
    const logs = await publicClient.getLogs({ blockHash: t.blockHash });
    const hits = logs.filter(l =>
      l.address.toLowerCase() === emitter &&
      l.topics?.[0]?.toLowerCase() === topic0.toLowerCase()
    );
    console.log("[fallback] blockHash scan found:", hits.length);
    return hits;
  } catch {
    return [];
  }
}

async function main() {
  const latest = await publicClient.getBlockNumber();
  const chainId = await publicClient.getChainId();
  const bal = await publicClient.getBalance({ address: operatorAccount.address });
  console.log("[diag] chainId:", chainId, " latest block:", Number(latest));
  console.log("[diag] operator:", operatorAccount.address);
  console.log("[diag] operator balance (wei):", bal.toString());
  if (treasury) console.log("[diag] treasury (for finalize):", treasury);
  console.log("[diag] emitter:", emitter);
  console.log("[diag] topic0:", topic0);

  let rawLogs = await getLogsChunkedByAddressAndTopic();
  if (!rawLogs.length) {
    console.warn("[warn] range scan returned 0; trying single-block fallback via PROBE_TX (if set)...");
    const fb = await fallbackLogsByTxBlock();
    rawLogs = fb;
  }
  if (!rawLogs.length) {
    console.warn("No logs matched. Double-check emitter/topic0/deployBlock, or run a fresh proposePlacement.");
    return;
  }

  // Decode
  const decoded: Proposal[] = rawLogs.map((log: any) => {
    const { id, bidder } = decodeIndexed(log);
    const d = decodeData(log.data as Hex);
    return {
      id,
      bidder,
      epoch: d.epoch,
      rect: d.rect,
      bidPerCellWei: d.bidPerCellWei,
      cells: d.cells,
      blockNumber: log.blockNumber ?? 0n,
      logIndex: Number(log.logIndex ?? 0n),
      address: log.address,
    };
  });

  const epochEnv = process.env.EPOCH;
  const finalizeEpochNumber = epochEnv ? Number(epochEnv) : undefined;
  if (finalizeEpochNumber === undefined) {
    const uniqueEpochs = [...new Set(decoded.map((p) => p.epoch))].sort((a, b) => a - b);
    console.log("Epochs present in logs:", uniqueEpochs.join(", "));
    console.log("Set EPOCH=<one-of-these> and run again.");
    return;
  }

  const epochProps = decoded.filter((p) => p.epoch === finalizeEpochNumber);
  if (!epochProps.length) {
    console.warn("No proposals found for epoch", finalizeEpochNumber);
    return;
  }

  // Greedy select
  const winners: Proposal[] = [];
  const losers: Proposal[] = [];
  const byBid = [...epochProps].sort((a, b) => {
    if (a.bidPerCellWei === b.bidPerCellWei) {
      if (a.blockNumber === b.blockNumber) return a.logIndex - b.logIndex;
      return Number(a.blockNumber - b.blockNumber);
    }
    return a.bidPerCellWei > b.bidPerCellWei ? -1 : 1;
  });
  for (const p of byBid) {
    const conflict = winners.some((w) => overlaps(w.rect, p.rect));
    if (conflict) losers.push(p); else winners.push(p);
  }

  // Manifest
  const manifestCid = process.env.MANIFEST_CID ?? "ipfs://pending-manifest";
  const manifestOut = process.env.MANIFEST_PATH ??
    path.join(process.cwd(), ".next-cache", `manifest-epoch-${finalizeEpochNumber}.json`);
  fs.mkdirSync(path.dirname(manifestOut), { recursive: true });
  fs.writeFileSync(
    manifestOut,
    JSON.stringify({
      epoch: finalizeEpochNumber,
      winners: winners.map((w) => ({ id: w.id, rect: w.rect, cells: w.cells })),
      rejected: losers.map((l) => l.id),
      generatedAt: new Date().toISOString(),
      emitter,
      topic0Used: topic0,
    }, null, 2),
    "utf-8"
  );

  type Hex32 = `0x${string}`;
  const acceptedIds = winners.map((w) => w.id) as readonly Hex32[];
  const rejectedIds = losers.map((l) => l.id) as readonly Hex32[];
  const concatenated = acceptedIds.length ? (concat(acceptedIds as readonly Hex[]) as Hex) : ("0x" as Hex);
  const manifestRoot = keccak256(concatenated) as Hex32;

  console.log("Epoch:", finalizeEpochNumber);
  console.log("Winners:", winners.length, "Losers:", losers.length);
  console.log("Manifest path:", manifestOut);
  console.log("Manifest CID:", manifestCid);
  console.log("Manifest root:", manifestRoot);

  if ((process.env.SKIP_FINALIZE ?? "1") === "1") {
    console.log("SKIP_FINALIZE=1 set; not calling finalizeEpoch.");
    return;
  }
  if (!treasury) throw new Error("NEXT_PUBLIC_LOREBOARD_ADDRESS is required to finalize.");

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
    args: [finalizeEpochNumber, manifestRoot, manifestCid, acceptedIds, rejectedIds],
  });
  console.log("Finalize tx:", txHash);
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  console.log("Finalize status:", receipt.status);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
