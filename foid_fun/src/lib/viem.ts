import { createPublicClient, createWalletClient, custom, http, defineChain } from "viem";
import TreasuryAbi from "@/abi/LoreBoardTreasury.json";

export const TREASURY = (process.env.NEXT_PUBLIC_TREASURY || "").toLowerCase() as `0x${string}`;
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

export async function getWalletClient() {
  const eth = (globalThis as any)?.ethereum;
  if (!eth) throw new Error("wallet not available");
  return createWalletClient({ chain: fluentTestnet, transport: custom(eth) });
}

/** call: proposePlacement(Proposed) payable */
export async function writeProposePlacement(args: {
  id: `0x${string}`;
  bidder: `0x${string}`;
  rect: { x: number; y: number; w: number; h: number };
  cells: number;
  bidPerCellWei: bigint;
  cidHash: `0x${string}`;
  epoch: number;
}) {
  const eth = (globalThis as any)?.ethereum;
  if (!eth) throw new Error("wallet not available");
  const walletClient = createWalletClient({ chain: fluentTestnet, transport: custom(eth) });
  const value = BigInt(args.cells) * args.bidPerCellWei;

  return walletClient.writeContract({
    account: args.bidder,
    address: TREASURY,
    abi: TreasuryAbiTyped,
    functionName: "proposePlacement",
    args: [
      {
        id: args.id,
        bidder: args.bidder,
        rect: args.rect,
        cells: args.cells,
        bidPerCellWei: args.bidPerCellWei,
        cidHash: args.cidHash,
        epoch: args.epoch,
      },
    ],
    value,
  });
}
