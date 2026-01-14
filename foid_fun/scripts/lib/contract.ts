import type { Abi, Address, Chain, PublicClient, Transport } from "viem";
import { rpcWithTimeout } from "./rpc";

export function parseOptionalNumber(value?: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function getRpcTimeoutMs() {
  return parseOptionalNumber(process.env.RPC_TIMEOUT_MS) ?? 15_000;
}

type RpcClient = PublicClient<Transport, Chain | undefined, any>;

export async function readContractWithTimeout(params: {
  publicClient: RpcClient;
  label: string;
  request: Parameters<RpcClient["readContract"]>[0];
  timeoutMs?: number;
}) {
  const timeoutMs = params.timeoutMs ?? getRpcTimeoutMs();
  return rpcWithTimeout(
    params.label,
    timeoutMs,
    () => params.publicClient.readContract(params.request as any)
  );
}

export async function readContractSafe(params: {
  publicClient: RpcClient;
  address: Address;
  abi: Abi | readonly unknown[];
  functionName: string;
  args?: readonly unknown[];
  label?: string;
  timeoutMs?: number;
}) {
  const label = params.label ?? `${params.functionName} ${params.address}`;
  return readContractWithTimeout({
    publicClient: params.publicClient,
    label,
    timeoutMs: params.timeoutMs,
    request: {
      address: params.address,
      abi: params.abi as any,
      functionName: params.functionName as any,
      args: params.args as any,
    },
  });
}

export async function waitForReceiptWithTimeout(params: {
  publicClient: RpcClient;
  label: string;
  request: Parameters<RpcClient["waitForTransactionReceipt"]>[0];
  timeoutMs?: number;
}) {
  const timeoutMs = params.timeoutMs ?? getRpcTimeoutMs();
  return rpcWithTimeout(
    params.label,
    timeoutMs,
    () => params.publicClient.waitForTransactionReceipt(params.request)
  );
}
