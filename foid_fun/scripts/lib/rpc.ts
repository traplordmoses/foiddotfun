import type { Address, Chain, Hex, PublicClient, Transport } from "viem";

export function withTimeout<T>(promise: Promise<T>, ms: number, label: string) {
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

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function rpcWithTimeout<T>(
  label: string,
  timeoutMs: number,
  fetcher: () => Promise<T>
) {
  return withTimeout(fetcher(), timeoutMs, label);
}

export async function fetchJsonWithRetries<T>(params: {
  label: string;
  url: string;
  timeoutMs: number;
  retryCount: number;
  retryDelayMs: number;
  debug: boolean;
}) {
  let attempt = 0;
  while (attempt <= params.retryCount) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), params.timeoutMs);
    try {
      if (params.debug) {
        console.log(`[blockscout] ${params.label} url=${params.url}`);
      }
      const res = await fetch(params.url, { signal: controller.signal });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = (await res.json()) as T;
      return data;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (attempt >= params.retryCount) {
        throw new Error(`[blockscout] ${params.label} failed: ${msg}`);
      }
      const backoff = params.retryDelayMs * 2 ** attempt;
      console.warn(
        `[blockscout] ${params.label} retry ${attempt + 1}/${params.retryCount} error=${msg} backoff=${backoff}ms`
      );
      await sleep(backoff);
      attempt += 1;
    } finally {
      clearTimeout(timeoutId);
    }
  }
  throw new Error(`[blockscout] ${params.label} retries exhausted`);
}

export async function getCodeWithTimeout(params: {
  publicClient: PublicClient<Transport, Chain | undefined, any>;
  address: Address;
  blockTag: Hex | "latest";
  timeoutMs: number;
}) {
  return rpcWithTimeout(
    `eth_getCode ${params.address} ${params.blockTag}`,
    params.timeoutMs,
    () =>
      params.publicClient.request({
        method: "eth_getCode",
        params: [params.address, params.blockTag],
      }) as Promise<Hex>
  );
}

export async function getBlockWithTimeout(params: {
  publicClient: PublicClient<Transport, Chain | undefined, any>;
  label: string;
  request: Parameters<PublicClient<Transport, Chain | undefined, any>["getBlock"]>[0];
  timeoutMs: number;
}) {
  return rpcWithTimeout(
    params.label,
    params.timeoutMs,
    () => params.publicClient.getBlock(params.request)
  );
}

export async function getTxCountWithTimeout(params: {
  publicClient: PublicClient<Transport, Chain | undefined, any>;
  address: Address;
  timeoutMs: number;
}) {
  const hex = await rpcWithTimeout(
    `eth_getTransactionCount ${params.address}`,
    params.timeoutMs,
    () =>
      params.publicClient.request({
        method: "eth_getTransactionCount",
        params: [params.address, "latest"],
      }) as Promise<Hex>
  );
  return BigInt(hex);
}
