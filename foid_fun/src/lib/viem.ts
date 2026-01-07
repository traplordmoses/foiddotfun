import {
  createPublicClient,
  createWalletClient,
  custom,
  decodeEventLog,
  defineChain,
  http,
} from "viem";
import TreasuryAbi from "@/abi/LoreBoardTreasury.json";
import BoardAbi from "@/abi/LoreboardBoardV1.json" assert { type: "json" };

export const TREASURY = (process.env.NEXT_PUBLIC_LOREBOARD_ADDRESS || "").toLowerCase() as `0x${string}`;
export const BOARD = (process.env.NEXT_PUBLIC_LOREBOARD_BOARD_ADDRESS || "").toLowerCase() as `0x${string}`;
export const DEPLOY_BLOCK = BigInt(process.env.NEXT_PUBLIC_LOREBOARD_DEPLOY_BLOCK || "0");

export const fluentTestnet = defineChain({
  id: 20994,
  name: "Fluent Testnet",
  nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [process.env.NEXT_PUBLIC_FLUENT_RPC as string] } },
});

export const publicClient = createPublicClient({
  chain: fluentTestnet,
  transport: http(process.env.NEXT_PUBLIC_FLUENT_RPC as string),
});

export const TreasuryAbiTyped = TreasuryAbi as unknown as readonly any[];
export const BoardAbiTyped = BoardAbi as unknown as readonly any[];

export async function getWalletClient() {
  const eth = (globalThis as any)?.ethereum;
  if (!eth) throw new Error("wallet not available");
  return createWalletClient({ chain: fluentTestnet, transport: custom(eth) });
}

/** call: proposePlacement(int32,int32,uint32,uint32,uint96,bytes) payable */
export async function writeProposePlacement(args: {
  bidder: `0x${string}`;
  rect: { x: number; y: number; w: number; h: number };
  bidPerCellWei: bigint;
  cidBytes: Uint8Array;
}) {
  const eth = (globalThis as any)?.ethereum;
  if (!eth) throw new Error("wallet not available");
  const walletClient = createWalletClient({ chain: fluentTestnet, transport: custom(eth) });
  const cellsWide = Math.ceil(args.rect.w / 32);
  const cellsHigh = Math.ceil(args.rect.h / 32);
  const cells = Math.max(1, cellsWide * cellsHigh);
  const value = BigInt(cells) * args.bidPerCellWei;

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
      args.bidPerCellWei,
      args.cidBytes,
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
