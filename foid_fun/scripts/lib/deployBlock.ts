import type { Address, Chain, Hex, PublicClient, Transport } from "viem";
import { getCodeWithTimeout } from "./rpc";

function toBlockTag(blockNumber: bigint): Hex {
  return `0x${blockNumber.toString(16)}` as Hex;
}

function isEmptyCode(code: Hex) {
  return !code || code === "0x" || code === "0x0";
}

export async function findDeployBlock(params: {
  publicClient: PublicClient<Transport, Chain | undefined, any>;
  address: Address;
  latestBlock: bigint;
  timeoutMs: number;
}) {
  const latestCode = await getCodeWithTimeout({
    publicClient: params.publicClient,
    address: params.address,
    blockTag: "latest",
    timeoutMs: params.timeoutMs,
  });
  if (isEmptyCode(latestCode)) return null;

  let low = 0n;
  let high = params.latestBlock;
  while (low < high) {
    const mid = (low + high) / 2n;
    const codeAtMid = await getCodeWithTimeout({
      publicClient: params.publicClient,
      address: params.address,
      blockTag: toBlockTag(mid),
      timeoutMs: params.timeoutMs,
    });
    if (isEmptyCode(codeAtMid)) {
      low = mid + 1n;
    } else {
      high = mid;
    }
  }
  return low;
}

export async function inferDeployBlock(params: {
  publicClient: PublicClient<Transport, Chain | undefined, any>;
  addresses: Address[];
  timeoutMs: number;
  latestBlock?: bigint;
}) {
  const latestBlock =
    params.latestBlock ?? (await params.publicClient.getBlockNumber());
  const deployBlocks = await Promise.all(
    params.addresses.map((address) =>
      findDeployBlock({
        publicClient: params.publicClient,
        address,
        latestBlock,
        timeoutMs: params.timeoutMs,
      })
    )
  );
  const candidates = deployBlocks.filter(
    (value): value is bigint => value !== null
  );
  if (!candidates.length) return null;
  return candidates.reduce((min, value) => (value < min ? value : min));
}
