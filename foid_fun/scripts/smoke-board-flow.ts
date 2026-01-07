import { config as loadEnv } from "dotenv";
import {
  createPublicClient,
  createWalletClient,
  decodeEventLog,
  defineChain,
  http,
  toHex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { uploadJSON } from "../src/lib/ipfs";

loadEnv({ path: ".env.local" });
loadEnv();

const rpc = process.env.NEXT_PUBLIC_FLUENT_RPC || process.env.FLUENT_RPC_URL;
const operatorPk = process.env.OPERATOR_PK;
const boardAddress = process.env.NEXT_PUBLIC_LOREBOARD_BOARD_ADDRESS as
  | `0x${string}`
  | undefined;
const votingAddress = process.env.NEXT_PUBLIC_LOREBOARD_VOTING_ADDRESS as
  | `0x${string}`
  | undefined;
const treasuryAddress = process.env.TREASURY_ADDRESS as `0x${string}` | undefined;

if (!rpc) throw new Error("Missing NEXT_PUBLIC_FLUENT_RPC or FLUENT_RPC_URL");
if (!operatorPk) throw new Error("Missing OPERATOR_PK");
if (!boardAddress) throw new Error("Missing NEXT_PUBLIC_LOREBOARD_BOARD_ADDRESS");
if (!votingAddress) throw new Error("Missing NEXT_PUBLIC_LOREBOARD_VOTING_ADDRESS");
if (!treasuryAddress) throw new Error("Missing TREASURY_ADDRESS");

const operatorKey = (operatorPk.startsWith("0x")
  ? operatorPk
  : `0x${operatorPk}`) as `0x${string}`;
const board = boardAddress as `0x${string}`;
const voting = votingAddress as `0x${string}`;
const treasury = treasuryAddress as `0x${string}`;

const fluentTestnet = defineChain({
  id: 20994,
  name: "Fluent Testnet",
  nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [rpc] } },
});

const boardAbi = [
  {
    type: "function",
    name: "proposePlacement",
    stateMutability: "payable",
    inputs: [
      { name: "x", type: "int32" },
      { name: "y", type: "int32" },
      { name: "w", type: "uint32" },
      { name: "h", type: "uint32" },
      { name: "bidPerCellWei", type: "uint96" },
      { name: "cidBytes", type: "bytes" },
    ],
    outputs: [
      { name: "id", type: "bytes32" },
      { name: "epoch", type: "uint32" },
      { name: "cells", type: "uint32" },
    ],
  },
  {
    type: "function",
    name: "cidOf",
    stateMutability: "view",
    inputs: [{ name: "", type: "bytes32" }],
    outputs: [{ name: "", type: "bytes" }],
  },
  {
    type: "event",
    name: "PlacementProposed",
    inputs: [
      { name: "id", type: "bytes32", indexed: true },
      { name: "bidder", type: "address", indexed: true },
      { name: "epoch", type: "uint32", indexed: false },
      { name: "x", type: "int32", indexed: false },
      { name: "y", type: "int32", indexed: false },
      { name: "w", type: "uint32", indexed: false },
      { name: "h", type: "uint32", indexed: false },
      { name: "cells", type: "uint32", indexed: false },
      { name: "bidPerCellWei", type: "uint96", indexed: false },
      { name: "cidHash", type: "bytes32", indexed: false },
    ],
  },
] as const;

const votingAbi = [
  {
    type: "function",
    name: "voteOnPlacement",
    stateMutability: "nonpayable",
    inputs: [
      { name: "placementId", type: "bytes32" },
      { name: "support", type: "bool" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "getPlacementMeta",
    stateMutability: "view",
    inputs: [{ name: "placementId", type: "bytes32" }],
    outputs: [
      { name: "registeredAt", type: "uint64" },
      { name: "voteEndsAt", type: "uint64" },
      { name: "epochId", type: "uint32" },
      { name: "exists", type: "bool" },
    ],
  },
  {
    type: "function",
    name: "getPlacementVotes",
    stateMutability: "view",
    inputs: [
      { name: "epochId", type: "uint256" },
      { name: "placementId", type: "bytes32" },
    ],
    outputs: [
      { name: "yesWeight", type: "uint256" },
      { name: "noWeight", type: "uint256" },
    ],
  },
] as const;

const treasuryAbi = [
  {
    type: "function",
    name: "baseFeePerCellWei",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint96" }],
  },
] as const;

function resolveSmokeNonce() {
  const envNonce = process.env.SMOKE_NONCE;
  if (envNonce && envNonce.trim()) return envNonce.trim();
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return String(Date.now());
}

async function main() {
  const account = privateKeyToAccount(operatorKey);

  const publicClient = createPublicClient({
    chain: fluentTestnet,
    transport: http(rpc),
  });
  const walletClient = createWalletClient({
    account,
    chain: fluentTestnet,
    transport: http(rpc),
  });

  const baseFeePerCellWei = (await publicClient.readContract({
    address: treasury,
    abi: treasuryAbi,
    functionName: "baseFeePerCellWei",
  })) as bigint;
  const bidPerCellWei = baseFeePerCellWei > 0n ? baseFeePerCellWei : 1n;

  const rect = { x: 0, y: 0, w: 32, h: 32 };
  const nonce = resolveSmokeNonce();
  const payload = {
    tag: "SMOKE_BOARD",
    nonce,
    rect,
    createdAt: Date.now(),
  };
  const cid = await uploadJSON(`smoke-board-${nonce}.json`, payload);
  const cidString = `ipfs://${cid}`;
  const cidBytes = new TextEncoder().encode(cidString);
  const value = bidPerCellWei;

  const proposeHash = await walletClient.writeContract({
    address: board,
    abi: boardAbi,
    functionName: "proposePlacement",
    args: [
      rect.x,
      rect.y,
      rect.w,
      rect.h,
      bidPerCellWei,
      toHex(cidBytes),
    ],
    value,
  });

  const proposeReceipt = await publicClient.waitForTransactionReceipt({
    hash: proposeHash,
  });

  const proposeLog = proposeReceipt.logs.find(
    (entry) => entry.address.toLowerCase() === board.toLowerCase()
  );
  if (!proposeLog) throw new Error("PlacementProposed event not found");

  const decoded = decodeEventLog({
    abi: boardAbi,
    data: proposeLog.data,
    topics: proposeLog.topics,
    eventName: "PlacementProposed",
  });

  const { id, epoch, cells, cidHash } = decoded.args as {
    id: `0x${string}`;
    epoch: number;
    cells: number;
    cidHash: `0x${string}`;
  };

  const meta = (await publicClient.readContract({
    address: voting,
    abi: votingAbi,
    functionName: "getPlacementMeta",
    args: [id],
  })) as readonly [bigint, bigint, number, boolean];
  const epochId = meta[2];
  const exists = meta[3];
  if (!exists) throw new Error("Voting placement not registered");

  const voteHash = await walletClient.writeContract({
    address: voting,
    abi: votingAbi,
    functionName: "voteOnPlacement",
    args: [id, true],
  });
  await publicClient.waitForTransactionReceipt({ hash: voteHash });

  const votes = (await publicClient.readContract({
    address: voting,
    abi: votingAbi,
    functionName: "getPlacementVotes",
    args: [BigInt(epochId), id],
  })) as readonly [bigint, bigint];

  if (votes[0] !== 1n || votes[1] !== 0n) {
    throw new Error(`Unexpected votes: yes=${votes[0]} no=${votes[1]}`);
  }

  const storedCid = (await publicClient.readContract({
    address: board,
    abi: boardAbi,
    functionName: "cidOf",
    args: [id],
  })) as `0x${string}`;

  if (storedCid.toLowerCase() !== toHex(cidBytes).toLowerCase()) {
    throw new Error("cidOf mismatch");
  }

  console.log("Smoke test OK");
  console.log("placementId", id);
  console.log("epoch", epochId);
  console.log("cells", cells);
  console.log("cidHash", cidHash);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
