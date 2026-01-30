import {
  createPublicClient,
  createWalletClient,
  custom,
  decodeEventLog,
  defineChain,
  http,
  hexToBytes,
  isHex,
  toHex,
} from "viem";
import type { Abi } from "viem";
import TreasuryAbi from "@/abi/LoreBoardTreasury.json" assert { type: "json" };
import BoardAbi from "@/abi/LoreboardBoardV2.json" assert { type: "json" };
import {
  CANONICAL_ADDRESSES,
  requireCanonicalAddress,
  CHAIN_ID,
  RPC_URL,
  BOARD_ADDRESS,
  DEPLOY_BLOCK,
} from "@/config/canonical";

const treasuryEnv = process.env.NEXT_PUBLIC_LOREBOARD_ADDRESS;

function getCanonicalAddress(params: {
  label: string;
  envValue?: string | null;
  expected: `0x${string}`;
  envHint: string;
}) {
  if (!params.envValue?.trim()) return params.expected;
  return requireCanonicalAddress(params);
}

export const TREASURY = getCanonicalAddress({
  label: "NEXT_PUBLIC_LOREBOARD_ADDRESS",
  envValue: treasuryEnv,
  expected: CANONICAL_ADDRESSES.treasury,
  envHint: "NEXT_PUBLIC_LOREBOARD_ADDRESS",
}).toLowerCase() as `0x${string}`;

export const BOARD = BOARD_ADDRESS.toLowerCase() as `0x${string}`;

export { DEPLOY_BLOCK };

export const fluentTestnet = defineChain({
  id: CHAIN_ID,
  name: "Fluent Testnet",
  nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
  contracts: {
    multicall3: {
      address: "0xcA11bde05977b3631167028862bE2a173976CA11",
      blockCreated: 0,
    },
  },
});

export const publicClient = createPublicClient({
  chain: fluentTestnet,
  transport: http(RPC_URL),
});

export const TreasuryAbiTyped = TreasuryAbi as Abi;
export const BoardAbiTyped = BoardAbi as Abi;

type EthereumProvider = {
  request: (args: { method: string; params?: readonly unknown[] }) => Promise<unknown>;
};

export async function getWalletClient() {
  const eth = (globalThis as { ethereum?: EthereumProvider }).ethereum;
  if (!eth) throw new Error("wallet not available");
  return createWalletClient({ chain: fluentTestnet, transport: custom(eth) });
}

/** call: proposePlacement(int32,int32,uint32,uint32,uint96,bytes) payable */
export async function writeProposePlacement(args: {
  bidder: `0x${string}`;
  rect: { x: number; y: number; w: number; h: number };
  bidPerCellWei: bigint | number | string;
  cidBytes: Uint8Array | string | { bytes: Uint8Array };
}) {
  const normalizeBigInt = (value: bigint | number | string): bigint => {
    if (typeof value === "bigint") return value;
    if (typeof value === "number") return BigInt(value);
    return BigInt(value);
  };

  const normalizeBytes = (value: Uint8Array | string | { bytes: Uint8Array }): Uint8Array => {
    if (value instanceof Uint8Array) return value;
    if (typeof value === "string") {
      if (isHex(value)) return hexToBytes(value);
      return new TextEncoder().encode(value);
    }
    return value.bytes;
  };

  const eth = (globalThis as { ethereum?: EthereumProvider }).ethereum;
  if (!eth) throw new Error("wallet not available");
  const walletClient = createWalletClient({ chain: fluentTestnet, transport: custom(eth) });
  const bidPerCellWei = normalizeBigInt(args.bidPerCellWei);
  const cidBytes = normalizeBytes(args.cidBytes);
  const cidHex = toHex(cidBytes);
  const cellsWide = Math.ceil(args.rect.w / 32);
  const cellsHigh = Math.ceil(args.rect.h / 32);
  const cells = Math.max(1, cellsWide * cellsHigh);
  const value = BigInt(cells) * bidPerCellWei;

  const txHash = await walletClient.writeContract({
    account: args.bidder,
    address: BOARD,
    abi: BoardAbiTyped,
    functionName: "proposePlacement",
    args: [
      args.rect.x,
      args.rect.y,
      args.rect.w,
      args.rect.h,
      bidPerCellWei,
      cidHex,
    ],
    value,
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  const log = receipt.logs.find((entry) => entry.address.toLowerCase() === BOARD);
  if (!log) {
    throw new Error("PlacementProposed event not found");
  }

  const decoded = decodeEventLog({
    abi: BoardAbiTyped,
    data: log.data,
    topics: log.topics,
    eventName: "PlacementProposed",
  });

  const { id, epoch, cells: placedCells, cidHash } = decoded.args as unknown as {
    id: `0x${string}`;
    epoch: number;
    cells: number;
    cidHash: `0x${string}`;
  };

  return { txHash, receipt, placementId: id, epoch, cells: placedCells, cidHash };
}
