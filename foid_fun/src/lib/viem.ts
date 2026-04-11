import {
  createPublicClient,
  createWalletClient,
  custom,
  decodeEventLog,
  defineChain,
  fallback,
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
  FALLBACK_RPC_URL,
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

import { BLOCK_EXPLORER, CHAIN_NAME } from "@/config/canonical";

export const fluentTestnet = defineChain({
  id: CHAIN_ID,
  name: CHAIN_NAME,
  nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
  blockExplorers: { default: { name: "FluentScan", url: BLOCK_EXPLORER } },
  contracts: {
    multicall3: {
      address: "0xcA11bde05977b3631167028862bE2a173976CA11",
      blockCreated: 0,
    },
  },
});

// QuickNode primary, public RPC fallback. Both with retries.
const resilientTransport = fallback(
  [
    http(RPC_URL, { retryCount: 3, retryDelay: 500 }),
    http(FALLBACK_RPC_URL, { retryCount: 2, retryDelay: 1000 }),
  ],
  { rank: false },
);

export const publicClient = createPublicClient({
  chain: fluentTestnet,
  transport: resilientTransport,
});

export const TreasuryAbiTyped = TreasuryAbi as Abi;
export const BoardAbiTyped = BoardAbi as Abi;

type EthereumProvider = {
  request: (args: { method: string; params?: readonly unknown[] }) => Promise<unknown>;
};

/** Check if the embedded wallet is the active connector */
function isEmbeddedWalletActive(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem("foid-embedded-active") === "true";
}

/** Create a wallet client using the correct provider (embedded or injected) */
async function createActiveWalletClient() {
  if (isEmbeddedWalletActive()) {
    const { getSession, setSession } = await import("@/lib/wallet");
    let session = getSession();

    if (!session) {
      // Wallet locked — trigger unlock modal
      const { requestWalletUnlock } = await import(
        "@/lib/connectors/onboardingBridge"
      );
      const result = await requestWalletUnlock();
      if (!result) throw new Error("Wallet unlock cancelled");
      setSession(result.privateKey, result.address);
      session = result;
    }

    const { privateKeyToAccount } = await import("viem/accounts");
    const account = privateKeyToAccount(session.privateKey as `0x${string}`);
    return createWalletClient({
      account,
      chain: fluentTestnet,
      transport: resilientTransport,
    });
  }
  const eth = (globalThis as { ethereum?: EthereumProvider }).ethereum;
  if (!eth) throw new Error("wallet not available");

  // Update MetaMask's chain RPC to QuickNode so transactions don't hit
  // the rate-limited public RPC. wallet_addEthereumChain updates the RPC
  // if the chain already exists.
  try {
    await eth.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: toHex(CHAIN_ID),
          chainName: CHAIN_NAME,
          rpcUrls: [RPC_URL],
          nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
          blockExplorerUrls: [BLOCK_EXPLORER],
        },
      ],
    });
  } catch {
    // Non-fatal — wallet may not support this or user may reject
  }

  return createWalletClient({ chain: fluentTestnet, transport: custom(eth) });
}

export { isEmbeddedWalletActive };

export async function getWalletClient() {
  return createActiveWalletClient();
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

  const walletClient = await createActiveWalletClient();
  const bidPerCellWei = normalizeBigInt(args.bidPerCellWei);
  const cidBytes = normalizeBytes(args.cidBytes);
  const cidHex = toHex(cidBytes);
  const cellsWide = Math.ceil(args.rect.w / 32);
  const cellsHigh = Math.ceil(args.rect.h / 32);
  const cells = Math.max(1, cellsWide * cellsHigh);
  const value = BigInt(cells) * bidPerCellWei;

  // Estimate gas with fallback
  let gas: bigint | undefined;
  try {
    gas = await publicClient.estimateContractGas({
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
  } catch (err) {
    console.warn("[proposePlacement] Gas estimation failed, using fallback:", err);
    // Fallback: 500k gas should be enough for most placements
    gas = BigInt(500_000);
  }

  // Embedded wallet: account already set on client (signs locally via http).
  // Injected wallet: must pass address so MetaMask knows which account to use.
  const writeArgs = {
    account: (walletClient.account ?? args.bidder) as `0x${string}`,
    address: BOARD,
    abi: BoardAbiTyped,
    functionName: "proposePlacement" as const,
    args: [
      args.rect.x,
      args.rect.y,
      args.rect.w,
      args.rect.h,
      bidPerCellWei,
      cidHex,
    ] as const,
    value,
    gas,
    chain: fluentTestnet,
  };
  const txHash = await walletClient.writeContract(writeArgs);

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

// writeSwipeLoreboardPlace removed — SwipeLoreboard not deployed in v1.
// Loreboard placements now go through Swipe.proposeLoreboard() via useSwipePropose hook.
