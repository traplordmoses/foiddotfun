"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useCallback } from "react";
import { useAccount, usePublicClient, useReadContract, useWriteContract } from "wagmi";
import { keccak256, stringToBytes, type Hex, type Hash } from "viem";

import FoidMommyTerminal, {
  FEELING_LABELS,
  type FeelingKey,
} from "@/app/(components)/FoidMommyTerminal";

/* --- env --- */
function resolveEnv(): { registry?: Hex; mirror?: Hex; chainId: number } {
  let registry: string | undefined;
  let mirror: string | undefined;
  let chainId = 20994;

  try {
    if (typeof window !== "undefined") {
      const sp = new URLSearchParams(window.location.search);
      registry = sp.get("registry") ?? undefined;
      mirror = sp.get("mirror") ?? undefined;
      const chainParam = sp.get("chain");
      if (chainParam) chainId = Number(chainParam);
    }
    const g: any = (globalThis as any) ?? {};
    if (!registry && g.__ENV__?.NEXT_PUBLIC_FOIP_REGISTRY) registry = g.__ENV__.NEXT_PUBLIC_FOIP_REGISTRY;
    if (!mirror && g.__ENV__?.NEXT_PUBLIC_FOIP_MIRROR) mirror = g.__ENV__.NEXT_PUBLIC_FOIP_MIRROR;
    if (g.__ENV__?.NEXT_PUBLIC_FLUENT_CHAIN_ID && !Number.isNaN(Number(g.__ENV__.NEXT_PUBLIC_FLUENT_CHAIN_ID))) {
      chainId = Number(g.__ENV__.NEXT_PUBLIC_FLUENT_CHAIN_ID);
    }
    if (typeof process !== "undefined" && (process as any).env) {
      const env: any = (process as any).env;
      if (!registry && env.NEXT_PUBLIC_FOIP_REGISTRY) registry = env.NEXT_PUBLIC_FOIP_REGISTRY;
      if (!mirror && env.NEXT_PUBLIC_FOIP_MIRROR) mirror = env.NEXT_PUBLIC_FOIP_MIRROR;
      if (env.NEXT_PUBLIC_FLUENT_CHAIN_ID && !Number.isNaN(Number(env.NEXT_PUBLIC_FLUENT_CHAIN_ID))) {
        chainId = Number(env.NEXT_PUBLIC_FLUENT_CHAIN_ID);
      }
    }
  } catch {}
  return { registry: registry as Hex | undefined, mirror: mirror as Hex | undefined, chainId };
}

const PrayerRegistryAbi = [
  {
    type: "function",
    name: "checkIn",
    stateMutability: "nonpayable",
    inputs: [
      { name: "prayer_hash", type: "bytes32" },
      { name: "score", type: "uint16" },
      { name: "label", type: "uint8" },
    ],
    outputs: [
      { type: "uint256" }, { type: "uint256" }, { type: "uint256" }, { type: "uint256" },
      { type: "uint256" }, { type: "bytes32" }, { type: "uint256" }, { type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "nextAllowedAt",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
] as const;

const PrayerMirrorAbi = [
  {
    type: "function",
    name: "get",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [
      { name: "streak", type: "uint32" },
      { name: "longest", type: "uint32" },
      { name: "total", type: "uint32" },
      { name: "milestones", type: "uint32" },
      { name: "score", type: "uint16" },
      { name: "prayerHash", type: "bytes32" },
    ],
  },
] as const;

function secondsLeft(tsNow: number, tsNext: bigint | undefined) {
  if (!tsNext) return 0;
  const left = Number(tsNext) - tsNow;
  return left > 0 ? left : 0;
}
function formatDurationShort(seconds: number) {
  if (seconds <= 0) return "ready now";
  const units = [
    { label: "d", value: 86400 },
    { label: "h", value: 3600 },
    { label: "m", value: 60 },
    { label: "s", value: 1 },
  ] as const;
  const parts: string[] = [];
  let remaining = seconds;
  for (const unit of units) {
    if (remaining >= unit.value || (unit.label === "s" && parts.length === 0)) {
      const count = Math.floor(remaining / unit.value);
      if (count > 0) parts.push(`${count}${unit.label}`);
      remaining -= count * unit.value;
    }
    if (parts.length === 2) break;
  }
  return parts.join(" ");
}

export default function PrayersClient() {
  const { address, isConnected, chainId } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();

  const env = useMemo(resolveEnv, []);
  const REGISTRY = env.registry;
  const MIRROR = env.mirror;
  const FLUENT_CHAIN_ID = env.chainId;

  const snapRef = useRef<(() => Promise<unknown>) | null>(null);
  const nextRef = useRef<(() => Promise<unknown>) | null>(null);
  const registryRef = useRef<Hex | undefined>(REGISTRY);

  const { data: snap, refetch: refetchSnap } = useReadContract({
    address: (MIRROR ?? "0x0000000000000000000000000000000000000000") as Hex,
    abi: PrayerMirrorAbi,
    functionName: "get",
    args: [((address ?? "0x0000000000000000000000000000000000000000") as Hex)],
    chainId: FLUENT_CHAIN_ID,
    query: { enabled: Boolean(address && MIRROR && FLUENT_CHAIN_ID) },
  });

  const { data: nextAllowed, refetch: refetchNext } = useReadContract({
    address: (REGISTRY ?? "0x0000000000000000000000000000000000000000") as Hex,
    abi: PrayerRegistryAbi,
    functionName: "nextAllowedAt",
    args: [((address ?? "0x0000000000000000000000000000000000000000") as Hex)],
    chainId: FLUENT_CHAIN_ID,
    query: { enabled: Boolean(address && REGISTRY && FLUENT_CHAIN_ID) },
  });

  useEffect(() => { snapRef.current = refetchSnap; }, [refetchSnap]);
  useEffect(() => { nextRef.current = refetchNext; }, [refetchNext]);
  useEffect(() => { registryRef.current = REGISTRY as Hex | undefined; }, [REGISTRY]);

  useEffect(() => {
    if (!address || !FLUENT_CHAIN_ID) return;
    if (MIRROR) void refetchSnap({ throwOnError: false, cancelRefetch: false });
    if (REGISTRY) void refetchNext({ throwOnError: false, cancelRefetch: false });
  }, [MIRROR, REGISTRY, address, FLUENT_CHAIN_ID, refetchNext, refetchSnap]);

  const ensureWalletReady = useCallback(async () => {
    if (!isConnected || !address) throw new Error("please connect your wallet before anchoring your prayer.");
    if (FLUENT_CHAIN_ID && chainId && chainId !== FLUENT_CHAIN_ID) {
      throw new Error(`switch to fluent testnet (chain id ${FLUENT_CHAIN_ID}) to continue.`);
    }
  }, [FLUENT_CHAIN_ID, address, chainId, isConnected]);

  const submitPrayer = useCallback(async (prayer: string, feeling: FeelingKey) => {
    const registryAddress = registryRef.current;
    if (!registryAddress) throw new Error("missing registry address on this page.");
    const prayerHash = keccak256(stringToBytes(prayer));
    const label = FEELING_LABELS[feeling] ?? 1;

    const txHash = await writeContractAsync({
      address: registryAddress,
      abi: PrayerRegistryAbi,
      functionName: "checkIn",
      args: [prayerHash, 72, label],
    });

    return { txHash };
  }, [writeContractAsync]);

  const waitForReceipt = useCallback(async (hash: string) => {
    if (publicClient) await publicClient.waitForTransactionReceipt({ hash: hash as Hash });

    const tasks: Promise<unknown>[] = [];
    if (snapRef.current) tasks.push(snapRef.current());
    if (nextRef.current) tasks.push(nextRef.current());
    if (tasks.length) await Promise.allSettled(tasks);
  }, [publicClient]);

  return (
    <main className="relative isolate min-h-screen bg-foid-bg text-white/90">
      <div className="pointer-events-none fixed inset-0 z-0 vignette" />

      <div className="relative z-10 mx-auto w-full max-w-[1200px] px-6 py-8 lg:px-8">
        <div className="mb-5 flex items-center justify-between">
          <Link
            href="/"
            className="rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.32em] text-white/80 backdrop-blur-md transition hover:bg-white/15"
          >
            back
          </Link>

          <div className="text-xs uppercase tracking-[0.35em] text-white/55">
            prayers
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.6fr_1fr]">
          {/* terminal */}
          <section className="vista-window vista-window--terminal w-full">
            <div className="vista-window__titlebar">
              <div className="vista-window__controls" aria-hidden="true">
                <span className="vista-window__control vista-window__control--minimize" />
                <span className="vista-window__control vista-window__control--restore" />
                <span className="vista-window__control vista-window__control--close" />
              </div>
              <span className="vista-window__title">
                <span aria-hidden="true">💾</span> foid_mommy_terminal.exe
              </span>
              <span className="vista-window__badge" aria-hidden="true">
                <Image src="/icons/skull.png" alt="" width={20} height={20} className="h-5 w-5 rounded-full" />
              </span>
            </div>

            <div className="vista-window__body vista-window__body--flush mt-3">
              <div className="frutiger-terminal flicker w-full p-5 sm:p-6">
                <FoidMommyTerminal
                  className="w-full"
                  ensureWalletReady={ensureWalletReady}
                  submitPrayer={submitPrayer}
                  waitForReceipt={waitForReceipt}
                  nextAllowedAt={nextAllowed as bigint | undefined}
                />
              </div>
            </div>
          </section>

          {/* your prayers */}
          <section className="vista-window vista-window--compact w-full">
            <div className="vista-window__titlebar">
              <span className="vista-window__title">your prayers</span>
            </div>

            <div className="vista-window__body font-terminal text-xs sm:text-[13px] leading-snug">
              <div className="divide-y divide-white/12 rounded-lg border border-white/10 bg-white/5 text-white/95">
                <div className="space-y-1 pb-2">
                  <div>
                    prayer streak:{" "}
                    <b className="text-foid-mint">
                      {snap?.[0]?.toString?.() ?? (address ? 0 : "–")}
                    </b>
                  </div>
                  <div>
                    longest prayer streak:{" "}
                    <b className="text-foid-mint">
                      {snap?.[1]?.toString?.() ?? (address ? 0 : "–")}
                    </b>
                  </div>
                  <div>
                    total prayers:{" "}
                    <b className="text-foid-mint">
                      {snap?.[2]?.toString?.() ?? (address ? 0 : "–")}
                    </b>
                  </div>
                  <div>
                    milestones:{" "}
                    <b className="text-foid-mint">
                      {snap?.[3]?.toString?.() ?? (address ? 0 : "–")}
                    </b>
                  </div>
                </div>

                <div className="space-y-1 py-2">
                  <div>
                    score:{" "}
                    <b className="text-foid-mint">
                      {snap?.[4]?.toString?.() ?? (address ? 0 : "–")}
                    </b>
                  </div>
                  <div>chain: {FLUENT_CHAIN_ID ?? "?"}</div>
                  <div>
                    next allowed in:{" "}
                    {formatDurationShort(
                      secondsLeft(Math.floor(Date.now() / 1000), nextAllowed as bigint | undefined),
                    )}
                  </div>
                </div>

                {!address && (
                  <div className="pt-2 text-xs uppercase tracking-[0.32em] text-white/70">
                    connect your wallet to start logging prayers.
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
