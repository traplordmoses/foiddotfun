import "dotenv/config";
import {
  createPublicClient,
  defineChain,
  http,
  isAddress,
  type Address,
  type Chain,
  type Hex,
  type PublicClient,
  type Transport,
} from "viem";

const DEFAULT_RPC = "https://rpc.testnet.fluent.xyz/";

function requireEnv(name: string, value?: string | null) {
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function parseOptionalNumber(value?: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseOptionalBigInt(value?: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return BigInt(trimmed);
}

function toBlockTag(blockNumber: bigint): Hex {
  return `0x${blockNumber.toString(16)}` as Hex;
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string) {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`Timeout after ${ms}ms (${label})`));
    }, ms);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });
}

async function rpcWithTimeout<T>(
  label: string,
  timeoutMs: number,
  fetcher: () => Promise<T>
) {
  return withTimeout(fetcher(), timeoutMs, label);
}

function isEmptyCode(code: Hex) {
  return !code || code === "0x" || code === "0x0";
}

function parseAddressArg(args: string[]): string | null {
  const sepIndex = args.indexOf("--");
  if (sepIndex >= 0 && args[sepIndex + 1]) {
    return args[sepIndex + 1];
  }
  const first = args.find((arg) => !arg.startsWith("--"));
  return first ?? null;
}

async function main() {
  const rawAddress = parseAddressArg(process.argv.slice(2));
  if (!rawAddress) {
    throw new Error("Usage: tsx scripts/find-deploy-block.ts -- <address>");
  }
  if (!isAddress(rawAddress)) {
    throw new Error(`Invalid address: ${rawAddress}`);
  }
  const address = rawAddress as Address;

  const rpc = requireEnv(
    "NEXT_PUBLIC_FLUENT_RPC or FLUENT_RPC_URL",
    process.env.NEXT_PUBLIC_FLUENT_RPC ??
      process.env.FLUENT_RPC_URL ??
      DEFAULT_RPC
  );

  const rpcTimeoutMs = parseOptionalNumber(process.env.RPC_TIMEOUT_MS) ?? 15_000;
  const rpcRetryCount = parseOptionalNumber(process.env.RPC_RETRY_COUNT) ?? 2;
  const rpcRetryDelay =
    parseOptionalNumber(process.env.RPC_RETRY_DELAY_MS) ?? 500;

  const fetchWithTimeout: typeof fetch = async (input, init = {}) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), rpcTimeoutMs);
    try {
      return await fetch(input, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timeoutId);
    }
  };

  const chain = defineChain({
    id: 20994,
    name: "Fluent Testnet",
    nativeCurrency: { name: "FLU", symbol: "FLU", decimals: 18 },
    rpcUrls: { default: { http: [rpc] } },
  });

  const transport = http(rpc, {
    timeout: rpcTimeoutMs,
    retryCount: rpcRetryCount,
    retryDelay: rpcRetryDelay,
    fetch: fetchWithTimeout,
  } as any);
  const publicClient: PublicClient<Transport, Chain> = createPublicClient({
    chain,
    transport,
  });

  const latestBlock = await rpcWithTimeout(
    "getBlockNumber",
    rpcTimeoutMs,
    () => publicClient.getBlockNumber()
  );

  const codeAt = async (blockNumber: bigint) =>
    rpcWithTimeout(`eth_getCode ${blockNumber.toString()}`, rpcTimeoutMs, () =>
      publicClient.request({
        method: "eth_getCode",
        params: [address, toBlockTag(blockNumber)],
      }) as Promise<Hex>
    );

  const latestCode = await codeAt(latestBlock);
  if (isEmptyCode(latestCode)) {
    console.log(
      `[deploy] address=${address} firstCodeBlock=none latest=${latestBlock.toString()} codeEmpty=true`
    );
    return;
  }

  let low = 0n;
  let high = latestBlock;

  while (low < high) {
    const mid = (low + high) / 2n;
    const code = await codeAt(mid);
    if (isEmptyCode(code)) {
      low = mid + 1n;
    } else {
      high = mid;
    }
  }

  const deployBlock = low;
  const envDeploy = parseOptionalBigInt(
    process.env.DEPLOY_BLOCK ??
      process.env.NEXT_PUBLIC_LOREBOARD_DEPLOY_BLOCK ??
      process.env.NEXT_PUBLIC_DEPLOY_BLOCK
  );

  let relation = "DEPLOY_BLOCK_UNSET";
  if (envDeploy !== null) {
    if (envDeploy < deployBlock) relation = "DEPLOY_BLOCK_BEFORE";
    else if (envDeploy > deployBlock) relation = "DEPLOY_BLOCK_AFTER";
    else relation = "DEPLOY_BLOCK_EQUAL";
  }

  console.log(
    `[deploy] address=${address} firstCodeBlock=${deployBlock.toString()} latest=${latestBlock.toString()} envDeployBlock=${envDeploy?.toString() ?? ""} relation=${relation}`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
