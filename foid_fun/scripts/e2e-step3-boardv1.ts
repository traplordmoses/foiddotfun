import { config as loadEnv } from "dotenv";
import {
  createPublicClient,
  createWalletClient,
  decodeEventLog,
  defineChain,
  http,
  toHex,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { uploadJSON } from "../src/lib/ipfs";

type Address = `0x${string}`;

loadEnv({ path: ".env.local" });
loadEnv();

const rpc = process.env.NEXT_PUBLIC_FLUENT_RPC || process.env.FLUENT_RPC_URL;
const boardAddress = (process.env.NEXT_PUBLIC_LOREBOARD_BOARD_ADDRESS ||
  process.env.LOREBOARD_BOARD_ADDRESS) as Address | undefined;
const votingAddress = (process.env.NEXT_PUBLIC_LOREBOARD_VOTING_ADDRESS ||
  process.env.LOREBOARD_VOTING_ADDRESS) as Address | undefined;
const treasuryAddress = (process.env.NEXT_PUBLIC_LOREBOARD_ADDRESS ||
  process.env.TREASURY_ADDRESS) as Address | undefined;
const voterPks = [
  process.env.VOTER1_PK,
  process.env.VOTER2_PK,
  process.env.VOTER3_PK,
].filter(Boolean) as string[];

const bidPerCellWeiEnv = process.env.E2E_BID_PER_CELL_WEI;
const rectWidth = Number(process.env.E2E_RECT_W ?? 1);
const rectHeight = Number(process.env.E2E_RECT_H ?? 1);
const rectPad = Number(process.env.E2E_RECT_PAD ?? 1);

const chain = defineChain({
  id: 20994,
  name: "Fluent Testnet",
  nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [rpc || ""] } },
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

const treasuryAbi = [
  {
    type: "function",
    name: "baseFeePerCellWei",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint96" }],
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

function requireEnv<T>(label: string, value: T | undefined | null): T {
  if (value == null || value === "") {
    throw new Error(`Missing ${label}`);
  }
  return value as T;
}

function normalizePk(pk: string): Hex {
  return (pk.startsWith("0x") ? pk : `0x${pk}`) as Hex;
}

function resolveNonce() {
  const envNonce = process.env.E2E_SMOKE_NONCE;
  if (envNonce && envNonce.trim()) return envNonce.trim();
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return String(Date.now());
}

function cellCount(w: number, h: number): number {
  return Math.ceil(w / 32) * Math.ceil(h / 32);
}

async function main() {
  requireEnv("NEXT_PUBLIC_FLUENT_RPC or FLUENT_RPC_URL", rpc);
  requireEnv(
    "NEXT_PUBLIC_LOREBOARD_BOARD_ADDRESS or LOREBOARD_BOARD_ADDRESS",
    boardAddress
  );
  requireEnv(
    "NEXT_PUBLIC_LOREBOARD_VOTING_ADDRESS or LOREBOARD_VOTING_ADDRESS",
    votingAddress
  );
  requireEnv(
    "NEXT_PUBLIC_LOREBOARD_ADDRESS or TREASURY_ADDRESS",
    treasuryAddress
  );
  if (voterPks.length < 3) {
    throw new Error("Set VOTER1_PK, VOTER2_PK, VOTER3_PK");
  }

  const proposerAccount = privateKeyToAccount(normalizePk(voterPks[0]));
  const voterAccounts = voterPks.map((pk) => privateKeyToAccount(normalizePk(pk)));

  const publicClient = createPublicClient({
    chain,
    transport: http(rpc),
  });
  const proposerWallet = createWalletClient({
    chain,
    transport: http(rpc),
    account: proposerAccount,
  });
  const voterWallets = voterAccounts.map((account) =>
    createWalletClient({
      chain,
      transport: http(rpc),
      account,
    })
  );

  const baseFeePerCellWei = (await publicClient.readContract({
    address: treasuryAddress!,
    abi: treasuryAbi,
    functionName: "baseFeePerCellWei",
  })) as bigint;

  let bidPerCellWei = baseFeePerCellWei + 1n;
  if (bidPerCellWeiEnv) {
    const envBid = BigInt(bidPerCellWeiEnv);
    if (envBid <= baseFeePerCellWei) {
      console.warn(
        `E2E_BID_PER_CELL_WEI <= base fee; overriding to ${bidPerCellWei.toString()}`
      );
    } else {
      bidPerCellWei = envBid;
    }
  }

  const rect = { x: rectPad, y: rectPad, w: rectWidth, h: rectHeight };
  const cells = cellCount(rect.w, rect.h);
  const nonce = resolveNonce();
  const payload = {
    tag: "E2E_BOARDV1",
    nonce,
    rect,
    createdAt: Date.now(),
  };
  const cid = await uploadJSON(`e2e-boardv1-${nonce}.json`, payload);
  const cidString = `ipfs://${cid}`;
  const cidBytes = new TextEncoder().encode(cidString);

  const value = bidPerCellWei * BigInt(cells);

  console.log("== E2E Step 3 (BoardV2 + VotingV2) ==");
  console.log("proposer:", proposerAccount.address);
  console.log("rect:", rect);
  console.log("cells:", cells);
  console.log("baseFeePerCellWei:", baseFeePerCellWei.toString());
  console.log("bidPerCellWei:", bidPerCellWei.toString());
  console.log("cid:", cidString);

  const proposeHash = await proposerWallet.writeContract({
    address: boardAddress!,
    abi: boardAbi,
    functionName: "proposePlacement",
    args: [rect.x, rect.y, rect.w, rect.h, bidPerCellWei, toHex(cidBytes)],
    value,
  });

  console.log("proposeTx:", proposeHash);

  const receipt = await publicClient.waitForTransactionReceipt({
    hash: proposeHash,
  });

  console.log("proposeBlock:", receipt.blockNumber);
  for (const log of receipt.logs) {
    console.log("receiptLog:", {
      address: log.address,
      topic0: log.topics[0],
    });
  }

  const proposeLog = receipt.logs.find(
    (entry) => entry.address.toLowerCase() === boardAddress!.toLowerCase()
  );
  if (!proposeLog) throw new Error("PlacementProposed event not found");

  const decoded = decodeEventLog({
    abi: boardAbi,
    data: proposeLog.data,
    topics: proposeLog.topics,
    eventName: "PlacementProposed",
  });

  const { id, epoch, cells: eventCells, cidHash } = decoded.args as {
    id: Address;
    epoch: number;
    cells: number;
    cidHash: Hex;
  };

  console.log("placementId:", id);
  console.log("epoch:", epoch);
  console.log("cells(event):", eventCells);
  console.log("cidHash:", cidHash);

  const storedCid = (await publicClient.readContract({
    address: boardAddress!,
    abi: boardAbi,
    functionName: "cidOf",
    args: [id],
  })) as Hex;

  if (storedCid.toLowerCase() !== toHex(cidBytes).toLowerCase()) {
    throw new Error("cidOf mismatch");
  }

  console.log("\n-- voteOnPlacement (3 voters)");
  for (let i = 0; i < voterWallets.length; i += 1) {
    const voter = voterWallets[i];
    const voteHash = await voter.writeContract({
      address: votingAddress!,
      abi: votingAbi,
      functionName: "voteOnPlacement",
      args: [id, true],
    });
    await publicClient.waitForTransactionReceipt({ hash: voteHash });

    const [yesVotes, noVotes] = (await publicClient.readContract({
      address: votingAddress!,
      abi: votingAbi,
      functionName: "getPlacementVotes",
      args: [BigInt(epoch), id],
    })) as readonly [bigint, bigint];

    console.log(
      `voter ${i + 1}: yes=${yesVotes.toString()} no=${noVotes.toString()}`
    );
  }

  const [yes, no] = (await publicClient.readContract({
    address: votingAddress!,
    abi: votingAbi,
    functionName: "getPlacementVotes",
    args: [BigInt(epoch), id],
  })) as readonly [bigint, bigint];

  if (yes !== 3n || no !== 0n) {
    throw new Error("Unexpected vote counts");
  }

  console.log("\nOK: BoardV2 + VotingV2 flow complete");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
