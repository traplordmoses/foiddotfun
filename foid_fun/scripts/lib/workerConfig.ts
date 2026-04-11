import type {
  Address,
  Chain,
  Hex,
  PublicClient,
  Transport,
  WalletClient,
} from "viem";
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  isAddress,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { parseOptionalNumber } from "./contract";
import { CANONICAL_ADDRESSES, CANONICAL_CHAIN, requireCanonicalAddress } from "../../src/config/canonical";

const DEFAULT_BLOCKSCOUT_API_BASE = `${CANONICAL_CHAIN.blockExplorer}/api`;

function requireEnv(name: string, value?: string | null) {
  if (!value) {
    throw new Error(
      `Missing ${name}. If you're using .env.local, run with DOTENV_CONFIG_PATH=.env.local.`
    );
  }
  return value;
}

function normalizePk(value?: string | null) {
  if (!value) return null;
  return value.startsWith("0x") ? (value as Hex) : (`0x${value}` as Hex);
}

function parseOptionalBigInt(value?: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return BigInt(trimmed);
}

export function loadWorkerConfig(env: NodeJS.ProcessEnv) {
  const dryRun = env.DRY_RUN === "1";

  const rpcUrl = requireEnv(
    "NEXT_PUBLIC_FLUENT_RPC or FLUENT_RPC_URL",
    env.NEXT_PUBLIC_FLUENT_RPC ?? env.FLUENT_RPC_URL
  );
  const treasury = requireCanonicalAddress({
    label: "NEXT_PUBLIC_LOREBOARD_ADDRESS",
    envValue: env.NEXT_PUBLIC_LOREBOARD_ADDRESS,
    expected: CANONICAL_ADDRESSES.treasury,
    envHint: "NEXT_PUBLIC_LOREBOARD_ADDRESS",
  }) as Address;
  const board = requireCanonicalAddress({
    label: "LOREBOARD_BOARD_ADDRESS",
    envValue: env.NEXT_PUBLIC_LOREBOARD_BOARD_ADDRESS ?? env.LOREBOARD_BOARD_ADDRESS,
    expected: CANONICAL_ADDRESSES.board,
    envHint: "NEXT_PUBLIC_LOREBOARD_BOARD_ADDRESS or LOREBOARD_BOARD_ADDRESS",
  }) as Address;
  const voting = requireCanonicalAddress({
    label: "LOREBOARD_VOTING_ADDRESS",
    envValue: env.NEXT_PUBLIC_LOREBOARD_VOTING_ADDRESS ?? env.LOREBOARD_VOTING_ADDRESS,
    expected: CANONICAL_ADDRESSES.voting,
    envHint: "NEXT_PUBLIC_LOREBOARD_VOTING_ADDRESS or LOREBOARD_VOTING_ADDRESS",
  }) as Address;

  const manifestStoreEnv =
    env.NEXT_PUBLIC_LOREBOARD_MANIFEST_STORE_ADDRESS ||
    env.NEXT_PUBLIC_LOREBOARD_ANCHOR ||
    env.NEXT_PUBLIC_MANIFEST_STORE ||
    env.NEXT_PUBLIC_MANIFEST_STORE_ADDRESS ||
    "";

  const manifestStore = manifestStoreEnv
    ? (requireCanonicalAddress({
        label: "LOREBOARD_MANIFEST_STORE_ADDRESS",
        envValue: manifestStoreEnv,
        expected: CANONICAL_ADDRESSES.manifestStore,
        envHint:
          "NEXT_PUBLIC_LOREBOARD_MANIFEST_STORE_ADDRESS (or NEXT_PUBLIC_LOREBOARD_ANCHOR/NEXT_PUBLIC_MANIFEST_STORE)",
      }) as Address)
    : null;

  const deployBlock = parseOptionalBigInt(
    env.DEPLOY_BLOCK ??
      env.NEXT_PUBLIC_LOREBOARD_DEPLOY_BLOCK ??
      env.NEXT_PUBLIC_DEPLOY_BLOCK
  );
  const lookbackBlocks = parseOptionalBigInt(env.LOOKBACK_BLOCKS);

  const adminKey = normalizePk(env.LOREBOARD_VOTING_ADMIN_PRIVATE_KEY);
  const operatorKey = normalizePk(env.OPERATOR_KEY ?? env.OPERATOR_PK);
  const nftEnv = (env.LOREBOARD_NFT ?? "").trim();
  const nftAddress = nftEnv && isAddress(nftEnv) ? (nftEnv as Address) : null;
  if (nftEnv && !nftAddress) {
    console.warn("[nft] invalid LOREBOARD_NFT address, skipping");
  }
  const skipNftSync = env.SKIP_NFT_SYNC === "1";

  const timeoutMs = parseOptionalNumber(env.RPC_TIMEOUT_MS) ?? 15_000;
  const retryCount = parseOptionalNumber(env.RPC_RETRY_COUNT) ?? 2;
  const retryDelayMs = parseOptionalNumber(env.RPC_RETRY_DELAY_MS) ?? 500;

  const fetchWithTimeout: typeof fetch = async (input, init = {}) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(input, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timeoutId);
    }
  };

  const chain = defineChain({
    id: CANONICAL_CHAIN.id,
    name: CANONICAL_CHAIN.chainName,
    nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl] } },
  });

  const transport = http(rpcUrl, {
    timeout: timeoutMs,
    retryCount,
    retryDelay: retryDelayMs,
    fetch: fetchWithTimeout,
  } as any);
  const publicClient: PublicClient<Transport, Chain> = createPublicClient({
    chain,
    transport,
  });
  const adminWallet: WalletClient<Transport, Chain> | null = adminKey
    ? createWalletClient({
        chain,
        transport,
        account: privateKeyToAccount(adminKey),
      })
    : null;
  const operatorWallet: WalletClient<Transport, Chain> | null = operatorKey
    ? createWalletClient({
        chain,
        transport,
        account: privateKeyToAccount(operatorKey),
      })
    : null;

  const blockscoutApiBase = env.BLOCKSCOUT_API_BASE ?? DEFAULT_BLOCKSCOUT_API_BASE;
  const useBlockscoutLogs = env.USE_BLOCKSCOUT_LOGS === "1";
  const blockscoutOnly = env.BLOCKSCOUT_ONLY === "1";

  return {
    rpcUrl,
    chain,
    transport,
    publicClient,
    addresses: { board, treasury, voting, manifestStore, nftAddress },
    wallets: { operatorWallet, adminWallet },
    flags: { dryRun, skipNftSync },
    scanning: {
      deployBlock,
      lookbackBlocks,
      blockscoutApiBase,
      useBlockscoutLogs,
      blockscoutOnly,
    },
    rpcConfig: { timeoutMs, retryCount, retryDelayMs },
  };
}
