"use client";

import Head from "next/head";
import Image from "next/image";
import { useEffect, useMemo, useRef, useCallback } from "react";
import { useAccount, usePublicClient, useReadContract, useWriteContract } from "wagmi";
import { keccak256, stringToBytes, type Hex, type Hash } from "viem";
import FoidMommyTerminal, {
  FEELING_LABELS,
  type FeelingKey,
} from "./(components)/FoidMommyTerminal";

/**
 * Resolve registry, mirror, and chain id from several sources so the page also
 * works in previews or when the user overrides via URL params/global env.
 */
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
    if (!registry && g.__ENV__?.NEXT_PUBLIC_FOIP_REGISTRY) {
      registry = g.__ENV__.NEXT_PUBLIC_FOIP_REGISTRY;
    }
    if (!mirror && g.__ENV__?.NEXT_PUBLIC_FOIP_MIRROR) {
      mirror = g.__ENV__.NEXT_PUBLIC_FOIP_MIRROR;
    }
    if (
      g.__ENV__?.NEXT_PUBLIC_FLUENT_CHAIN_ID &&
      !Number.isNaN(Number(g.__ENV__.NEXT_PUBLIC_FLUENT_CHAIN_ID))
    ) {
      chainId = Number(g.__ENV__.NEXT_PUBLIC_FLUENT_CHAIN_ID);
    }

    if (typeof process !== "undefined" && (process as any).env) {
      const env: any = (process as any).env;
      if (!registry && env.NEXT_PUBLIC_FOIP_REGISTRY) {
        registry = env.NEXT_PUBLIC_FOIP_REGISTRY;
      }
      if (!mirror && env.NEXT_PUBLIC_FOIP_MIRROR) {
        mirror = env.NEXT_PUBLIC_FOIP_MIRROR;
      }
      if (
        env.NEXT_PUBLIC_FLUENT_CHAIN_ID &&
        !Number.isNaN(Number(env.NEXT_PUBLIC_FLUENT_CHAIN_ID))
      ) {
        chainId = Number(env.NEXT_PUBLIC_FLUENT_CHAIN_ID);
      }
    }
  } catch {
    // swallow and fall back to defaults
  }

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
      { type: "uint256" },
      { type: "uint256" },
      { type: "uint256" },
      { type: "uint256" },
      { type: "uint256" },
      { type: "bytes32" },
      { type: "uint256" },
      { type: "uint256" },
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
      if (count > 0) {
        parts.push(`${count}${unit.label}`);
      }
      remaining -= count * unit.value;
    }
    if (parts.length === 2) break;
  }
  return parts.join(" ");
}

if (typeof window !== "undefined") {
  console.assert(secondsLeft(10, 15n) === 5, "secondsLeft basic forward should be 5");
  console.assert(secondsLeft(10, 9n) === 0, "secondsLeft past should clamp to 0");
}

export default function Page() {
  const { address, isConnected, chainId } = useAccount();
  const { writeContractAsync } = useWriteContract();

  const env = useMemo(resolveEnv, []);
  const REGISTRY = env.registry;
  const MIRROR = env.mirror;
  const FLUENT_CHAIN_ID = env.chainId;

  const publicClient = usePublicClient();
  const snapRef = useRef<(() => Promise<unknown>) | null>(null);
  const nextRef = useRef<(() => Promise<unknown>) | null>(null);

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

  const registryRef = useRef<Hex | undefined>(REGISTRY);

  useEffect(() => {
    snapRef.current = refetchSnap;
  }, [refetchSnap]);

  useEffect(() => {
    nextRef.current = refetchNext;
  }, [refetchNext]);

  useEffect(() => {
    registryRef.current = REGISTRY as Hex | undefined;
  }, [REGISTRY]);

  useEffect(() => {
    if (!address || !FLUENT_CHAIN_ID) return;
    if (MIRROR) {
      void refetchSnap({ throwOnError: false, cancelRefetch: false });
    }
    if (!REGISTRY) return;
    void refetchNext({ throwOnError: false, cancelRefetch: false });
  }, [MIRROR, REGISTRY, address, FLUENT_CHAIN_ID, refetchNext, refetchSnap]);

  const ensureWalletReady = useCallback(async () => {
    if (!isConnected || !address) {
      throw new Error("please connect your wallet before anchoring your prayer.");
    }
    if (FLUENT_CHAIN_ID && chainId && chainId !== FLUENT_CHAIN_ID) {
      throw new Error(`switch to fluent testnet (chain id ${FLUENT_CHAIN_ID}) to continue.`);
    }
  }, [FLUENT_CHAIN_ID, address, chainId, isConnected]);

  const submitPrayer = useCallback(
    async (prayer: string, feeling: FeelingKey) => {
      const registryAddress = registryRef.current;
      if (!registryAddress) {
        throw new Error("missing registry address on this page.");
      }

      const prayerHash = keccak256(stringToBytes(prayer));
      const label = FEELING_LABELS[feeling] ?? 1;

      const txHash = await writeContractAsync({
        address: registryAddress,
        abi: PrayerRegistryAbi,
        functionName: "checkIn",
        args: [prayerHash, 72, label],
      });

      return { txHash };
    },
    [writeContractAsync],
  );

  const waitForReceipt = useCallback(
    async (hash: string) => {
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash: hash as Hash });
      }
      const tasks: Promise<unknown>[] = [];
      if (snapRef.current) tasks.push(snapRef.current());
      if (nextRef.current) tasks.push(nextRef.current());
      if (tasks.length) {
        await Promise.allSettled(tasks);
      }
    },
    [publicClient],
  );

  return (
    <>
      <Head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=VT323&display=swap" rel="stylesheet" />
      </Head>
      <main className="relative isolate min-h-screen pb-24 text-white/90">
        <div className="pointer-events-none fixed inset-0 z-0 vignette" />

        <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col items-center gap-6 px-6 pt-10">
          <section className="w-full space-y-4">
            <div className="foid-glass rounded-3xl px-8 py-12 text-center shadow-[0_24px_80px_rgba(11,46,78,0.45)]">
              <h1 className="text-4xl font-semibold tracking-[0.38em] text-white drop-shadow-[0_12px_30px_rgba(0,208,255,0.25)] sm:text-5xl">
                foid.fun
              </h1>
              <p className="mx-auto mt-4 max-w-2xl text-lg text-white/75 sm:text-xl">
                pray daily with foid mommy, mint a foid20, and trade it on foidswap.
              </p>
            </div>
            <div className="overflow-hidden rounded-3xl shadow-[0_22px_65px_rgba(11,46,78,0.4)]">
              <Image
                src="/foidmommy.jpg"
                alt="Crayon sketch of Foid with cherries and neon eyes on a diner table."
                width={1280}
                height={960}
                className="h-full w-full object-cover"
                priority
              />
            </div>
          </section>

          <section className="w-full">
            <div className="grid items-stretch gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
              <div className="foid-glass overflow-hidden rounded-3xl shadow-[0_24px_80px_rgba(11,46,78,0.45)]">
                <div className="crt flicker h-full rounded-[30px] p-8">
                  <FoidMommyTerminal
                    className="h-full w-full min-h-[520px]"
                    ensureWalletReady={ensureWalletReady}
                    submitPrayer={submitPrayer}
                    waitForReceipt={waitForReceipt}
                    nextAllowedAt={nextAllowed as bigint | undefined}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-6">
                <aside className="foid-glass rounded-3xl p-6 text-white/85 shadow-[0_0_50px_rgba(203,183,255,0.18)]">
                  <h3 className="text-xs uppercase tracking-[0.5em] text-foid-mint/80">foid mommy</h3>
                  <p className="mt-3 text-sm text-white/75">
                    foid mommy is a super-simple daily check-in game on-chain: every time you “pray,” it logs your streak,
                    and the more consistent you are, the bigger your mifoid’s boobs will be at launch (tge = token generation event).
                  </p>
                  <div className="mt-5 space-y-3 text-sm text-white/80">
                    <div>
                      <span className="font-semibold uppercase tracking-[0.35em] text-foid-mint/80">how to start</span>
                      <ol className="mt-2 list-decimal space-y-2 pl-5 text-foid-mint/85">
                        <li>connect your wallet → switch to the fluent network (if asked).</li>
                        <li>click “chat with foid mommy.” the retro terminal opens.</li>
                        <li>foid mommy asks “how are you feeling?” pick a mood or type it.</li>
                        <li>foid mommy shows a short prayer. type your own prayer (optional).</li>
                        <li>click “send prayer.” your wallet pops up—confirm the transaction.</li>
                        <li>done. your streak number ticks up. come back in ~24h and do it again.</li>
                      </ol>
                    </div>
                    <div>
                      <span className="font-semibold uppercase tracking-[0.35em] text-foid-mint/80">
                        daily rules
                      </span>
                      <ol className="mt-2 list-decimal space-y-2 pl-5 text-foid-mint/85">
                        <li>1 prayer = 1 day’s check-in.</li>
                        <li>wait ~24 hours before the next one (too early won’t count).</li>
                        <li>higher streak = your mifoid has bigger boobs.</li>
                      </ol>
                    </div>
                    <div>
                      <span className="font-semibold uppercase tracking-[0.35em] text-foid-mint/80">privacy note</span>
                      <p className="mt-2 text-foid-mint/85">
                        prayers are encrypted and written on-chain; what you type isn’t publicly readable.
                      </p>
                    </div>
                    <div>
                      <span className="font-semibold uppercase tracking-[0.35em] text-foid-mint/80">
                        why it matters
                      </span>
                      <p className="mt-2 text-foid-mint/85">
                        show up daily → grow your streak → your mifoid has exclusive traits at tge.
                      </p>
                    </div>
                  </div>
                </aside>

                <aside className="foid-glass rounded-3xl p-6 font-mono text-foid-mint/85 shadow-[0_0_55px_rgba(114,225,255,0.18)]">
                  <div className="text-xs font-semibold uppercase tracking-[0.42em] text-foid-candy/85">
                    your prayers
                  </div>
                  <div className="mt-4 space-y-2 text-sm text-white/85">
                    <div>
                      prayer streak:{" "}
                      <b className="text-foid-mint">{snap?.[0]?.toString?.() ?? (address ? 0 : "–")}</b>
                    </div>
                    <div>
                      longest prayer streak:{" "}
                      <b className="text-foid-mint">{snap?.[1]?.toString?.() ?? (address ? 0 : "–")}</b>
                    </div>
                    <div>
                      total prayers:{" "}
                      <b className="text-foid-mint">{snap?.[2]?.toString?.() ?? (address ? 0 : "–")}</b>
                    </div>
                    <div>
                      milestones:{" "}
                      <b className="text-foid-mint">{snap?.[3]?.toString?.() ?? (address ? 0 : "–")}</b>
                    </div>
                    <div>
                      score: <b className="text-foid-mint">{snap?.[4]?.toString?.() ?? (address ? 0 : "–")}</b>
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
                    <div className="mt-4 text-xs uppercase tracking-[0.32em] text-white/60">
                      connect your wallet to start logging prayers.
                    </div>
                  )}
                </aside>
              </div>
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
