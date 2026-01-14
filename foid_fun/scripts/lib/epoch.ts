import type { Address, Chain, PublicClient, Transport } from "viem";
import { readContractSafe } from "./contract";

const votingV2Abi = [
  {
    type: "function",
    name: "epochAt",
    stateMutability: "view",
    inputs: [{ name: "t", type: "uint64" }],
    outputs: [{ name: "", type: "uint32" }],
  },
  {
    type: "function",
    name: "voteWindowSeconds",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint32" }],
  },
  {
    type: "function",
    name: "epochZeroUnix",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint64" }],
  },
  {
    type: "function",
    name: "epochSeconds",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint32" }],
  },
] as const;

export function parseEpochOverride(args: string[]) {
  const envEpoch = process.env.EPOCH;
  if (envEpoch) {
    const parsed = Number(envEpoch);
    if (Number.isFinite(parsed)) return Math.floor(parsed);
  }

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (!arg) continue;
    if (arg === "--") continue;
    if (arg === "--epoch" && args[i + 1]) {
      const parsed = Number(args[i + 1]);
      if (Number.isFinite(parsed)) return Math.floor(parsed);
    }
    if (arg.startsWith("--epoch=")) {
      const parsed = Number(arg.split("=", 2)[1]);
      if (Number.isFinite(parsed)) return Math.floor(parsed);
    }
    const parsed = Number(arg);
    if (Number.isFinite(parsed)) return Math.floor(parsed);
  }

  return null;
}

export async function resolveEpochId(params: {
  publicClient: PublicClient<Transport, Chain>;
  voting: Address;
  overrideEpochId: number | null;
}) {
  const nowSec = Math.floor(Date.now() / 1000);
  const [epochAtNowRaw, voteWindowSecondsRaw, epochSecondsRaw] =
    (await Promise.all([
      readContractSafe({
        publicClient: params.publicClient,
        address: params.voting,
        abi: votingV2Abi,
        functionName: "epochAt",
        args: [BigInt(nowSec)],
        label: `epochAt ${params.voting}`,
      }),
      readContractSafe({
        publicClient: params.publicClient,
        address: params.voting,
        abi: votingV2Abi,
        functionName: "voteWindowSeconds",
        label: `voteWindowSeconds ${params.voting}`,
      }),
      readContractSafe({
        publicClient: params.publicClient,
        address: params.voting,
        abi: votingV2Abi,
        functionName: "epochSeconds",
        label: `epochSeconds ${params.voting}`,
      }),
    ])) as [bigint | number, bigint | number, bigint | number];

  const nowEpoch = Number(epochAtNowRaw);
  const voteWindowSeconds = Number(voteWindowSecondsRaw);
  const epochSeconds = Number(epochSecondsRaw);

  let safeTime = nowSec;
  let safeEpochAt = nowEpoch;
  if (Number.isFinite(voteWindowSeconds) && voteWindowSeconds > 0) {
    safeTime = Math.max(0, nowSec - voteWindowSeconds);
    const safeEpochAtRaw =
      (await readContractSafe({
        publicClient: params.publicClient,
        address: params.voting,
        abi: votingV2Abi,
        functionName: "epochAt",
        args: [BigInt(safeTime)],
        label: `epochAt ${params.voting} safe`,
      })) as unknown as bigint;
    safeEpochAt = Number(safeEpochAtRaw);
  }

  const finalizable = safeEpochAt - 1;
  const finalizableEpoch = finalizable >= 0 ? finalizable : null;

  console.log(
    `[epoch] nowSec=${nowSec} nowEpoch=${nowEpoch} voteWindowSeconds=${voteWindowSeconds} epochSeconds=${epochSeconds} safeTime=${safeTime} safeEpochAt=${safeEpochAt} finalizableEpoch=${finalizableEpoch} override=${params.overrideEpochId ?? "null"}`
  );

  if (params.overrideEpochId !== null) {
    if (params.overrideEpochId >= nowEpoch) {
      console.warn(
        `[epoch] overrideEpochId=${params.overrideEpochId} is >= current epoch ${nowEpoch}; proceeding anyway`
      );
    }
    return params.overrideEpochId;
  }

  return finalizableEpoch;
}
