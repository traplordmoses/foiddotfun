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
import boardAbi from "../src/abi/LoreboardBoardV2.json" assert { type: "json" };
import votingAbi from "../src/abi/loreboardVoting.json" assert { type: "json" };
import treasuryAbi from "../src/abi/LoreBoardTreasury.json" assert { type: "json" };
import { rectCells } from "../src/lib/grid";
import { CANONICAL_ADDRESSES, requireCanonicalAddress } from "../src/config/canonical";
import { normalizePk, requireEnv, resolveFirst, resolveRpcUrl } from "./lib/env";

loadEnv({ path: process.env.DOTENV_CONFIG_PATH || ".env.local" });
loadEnv();

const rpc = requireEnv(
  "NEXT_PUBLIC_FLUENT_RPC/FLUENT_RPC_URL/NEXT_PUBLIC_RPC_URL/RPC_URL",
  resolveRpcUrl(process.env)
);
const proposerPk = requireEnv(
  "E2E_PROPOSER_PK or OPERATOR_PK",
  process.env.E2E_PROPOSER_PK || process.env.OPERATOR_PK
);
const voterPk = requireEnv("VOTER1_PK", process.env.VOTER1_PK);
const boardAddress = resolveFirst(process.env, [
  "NEXT_PUBLIC_LOREBOARD_BOARD_ADDRESS",
  "LOREBOARD_BOARD_ADDRESS",
]) as `0x${string}` | undefined;
const votingAddress = resolveFirst(process.env, [
  "NEXT_PUBLIC_LOREBOARD_VOTING_ADDRESS",
  "LOREBOARD_VOTING_ADDRESS",
]) as `0x${string}` | undefined;
const treasuryAddress = resolveFirst(process.env, [
  "NEXT_PUBLIC_LOREBOARD_ADDRESS",
  "TREASURY_ADDRESS",
]) as `0x${string}` | undefined;

const proposerKey = normalizePk(proposerPk);
const voterKey = normalizePk(voterPk);
const board = requireCanonicalAddress({
  label: "LOREBOARD_BOARD_ADDRESS",
  envValue: boardAddress,
  expected: CANONICAL_ADDRESSES.board,
  envHint: "NEXT_PUBLIC_LOREBOARD_BOARD_ADDRESS or LOREBOARD_BOARD_ADDRESS",
});
const voting = requireCanonicalAddress({
  label: "LOREBOARD_VOTING_ADDRESS",
  envValue: votingAddress,
  expected: CANONICAL_ADDRESSES.voting,
  envHint: "NEXT_PUBLIC_LOREBOARD_VOTING_ADDRESS or LOREBOARD_VOTING_ADDRESS",
});
const treasury = requireCanonicalAddress({
  label: "LOREBOARD_ADDRESS",
  envValue: treasuryAddress,
  expected: CANONICAL_ADDRESSES.treasury,
  envHint: "NEXT_PUBLIC_LOREBOARD_ADDRESS or TREASURY_ADDRESS",
});

const fluentTestnet = defineChain({
  id: 20994,
  name: "Fluent Testnet",
  nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [rpc] } },
});

function resolveSmokeNonce() {
  const envNonce = process.env.SMOKE_NONCE;
  if (envNonce && envNonce.trim()) return envNonce.trim();
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return String(Date.now());
}

async function main() {
  const proposerAccount = privateKeyToAccount(proposerKey);
  const voterAccount = privateKeyToAccount(voterKey);

  const publicClient = createPublicClient({
    chain: fluentTestnet,
    transport: http(rpc),
  });
  const walletClient = createWalletClient({
    account: proposerAccount,
    chain: fluentTestnet,
    transport: http(rpc),
  });
  const voterWallet = createWalletClient({
    account: voterAccount,
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
  const cells = rectCells(rect);
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
  const value = bidPerCellWei * BigInt(cells);

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
    abi: boardAbi as any,
    data: proposeLog.data,
    topics: proposeLog.topics,
    eventName: "PlacementProposed",
  });

  const { id, epoch, cells: eventCells, cidHash } = decoded.args as {
    id: `0x${string}`;
    epoch: number;
    cells: number;
    cidHash: `0x${string}`;
  };

  const meta = (await publicClient.readContract({
    address: voting,
    abi: votingAbi as any,
    functionName: "getPlacementMeta",
    args: [id],
  })) as readonly [bigint, bigint, number, boolean];
  const epochId = meta[2];
  const exists = meta[3];
  if (!exists) throw new Error("Voting placement not registered");

  const voteHash = await voterWallet.writeContract({
    address: voting,
    abi: votingAbi as any,
    functionName: "voteOnPlacement",
    args: [id, true],
  });
  await publicClient.waitForTransactionReceipt({ hash: voteHash });

  const votes = (await publicClient.readContract({
    address: voting,
    abi: votingAbi as any,
    functionName: "getPlacementVotes",
    args: [BigInt(epochId), id],
  })) as readonly [bigint, bigint];

  const passesMajority = (await publicClient.readContract({
    address: voting,
    abi: votingAbi as any,
    functionName: "passesMajority51",
    args: [BigInt(epochId), id],
  })) as boolean;
  if (votes[0] <= 0n) {
    throw new Error(`Unexpected votes: yes=${votes[0]} no=${votes[1]}`);
  }

  const storedCid = (await publicClient.readContract({
    address: board,
    abi: boardAbi as any,
    functionName: "cidOf",
    args: [id],
  })) as `0x${string}`;

  if (storedCid.toLowerCase() !== toHex(cidBytes).toLowerCase()) {
    throw new Error("cidOf mismatch");
  }

  console.log("Smoke test OK");
  console.log("placementId", id);
  console.log("epoch", epochId);
  console.log("cells", eventCells);
  console.log("cidHash", cidHash);
  console.log("votes yes/no:", votes[0].toString(), "/", votes[1].toString());
  console.log("passesMajority51:", passesMajority);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
