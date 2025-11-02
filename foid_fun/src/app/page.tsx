"use client";

import Head from "next/head";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useAccount, usePublicClient, useReadContract, useWriteContract } from "wagmi";
import { keccak256, stringToBytes, type Hex, type Hash } from "viem";
import { toast } from "react-hot-toast";
import { CONTRACT_ADDRESSES, NETWORK_DETAILS } from "./(components)/contracts";
import MoireLayer from "./(components)/MoireLayer";
import FoidMommyTerminal, {
  FEELING_LABELS,
  type FeelingKey,
} from "./(components)/FoidMommyTerminal";

const appTiles = [
  {
    href: "/foidfactory",
    title: "foid factory (launchpad)",
    body: "spin up a token + pool in minutes.",
  },
  {
    href: "/foidswap",
    title: "foid swap (amm + router)",
    body: "constant-product pools, 0.3% per hop, auto-routing across multiple pairs.",
  },
  {
    href: "/launchpad",
    title: "foid name service (fns)",
    body: "human-readable .foid names for sending/receiving (teaser/alpha).",
  },
] as const;

const valueProps = [
  {
    title: "blended execution (evm + wasm + svm)",
    body: "fluent lets contracts from different VMs interoperate on one chain, on shared state--no bridges. solidity and rust can call each other inside one app, enabling simpler architectures and new design space.",
  },
  {
    title: "zk-powered l2 security",
    body: "fluent is an ethereum l2 with a zkvm for verifiable execution. you keep ethereum settlement security while proving execution succinctly at high throughput.",
  },
  {
    title: "dev ergonomics, familiar tools",
    body: "ship today with evm compatibility (solidity/vyper), then extend with rust/wasm when you're ready--the fluentbase sdk bridges types and shared state so both paths feel native. less friction, more composability.",
  },
] as const;

const faqItems = [
  {
    question: "how do i add fluent testnet?",
    answer:
      "network name: fluent testnet - chain id: 20994 - rpc: https://rpc.testnet.fluent.xyz - symbol: ETH - explorer: https://testnet.fluentscan.xyz. add via wallet prompt or manually in metamask -&gt; networks. docs.fluent.xyz",
  },
  {
    question: "how do i get test tokens?",
    answer:
      "use the fluent dev portal faucet at https://portal.fluent.xyz, then refresh your wallet balance. docs.fluent.xyz",
  },
  {
    question: "how do i create a token in foidfactory?",
    answer:
      "enter name, symbol, max supply; confirm recipient (defaults to your wallet); sign the tx. the contract mints 100% of supply to the recipient and returns a receipt you can view on the explorer. docs.fluent.xyz",
  },
  {
    question: "how do i add liquidity on foidswap?",
    answer:
      "choose a pair (or create one), deposit both assets in proportion, confirm. you'll receive lp tokens representing your share; trades auto-route across pairs with a 0.3% fee per hop. docs.fluent.xyz",
  },
] as const;

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

function formatHexShort(h?: Hex) {
  if (!h) return "0x";
  return `${h.slice(0, 8)}...${h.slice(-6)}`;
}

function secondsLeft(tsNow: number, tsNext: bigint | undefined) {
  if (!tsNext) return 0;
  const left = Number(tsNext) - tsNow;
  return left > 0 ? left : 0;
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
  const [faqOpen, setFaqOpen] = useState<number | null>(null);
  const snapRef = useRef<(() => Promise<unknown>) | null>(null);
  const nextRef = useRef<(() => Promise<unknown>) | null>(null);

  const toggleFaq = (index: number) => {
    setFaqOpen((prev) => (prev === index ? null : index));
  };

  const copyToClipboard = async (value: string, successMessage: string) => {
    if (typeof navigator === "undefined" || !navigator.clipboard) {
      toast.error("Clipboard unavailable.");
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
      toast.success(successMessage);
    } catch (error: any) {
      toast.error(error?.message ?? "Copy failed.");
    }
  };

  const { data: snap, refetch: refetchSnap } = useReadContract({
    address: (MIRROR ?? "0x0000000000000000000000000000000000000000") as Hex,
    abi: PrayerMirrorAbi,
    functionName: "get",
    args: [((address ?? "0x0000000000000000000000000000000000000000") as Hex)],
    query: { enabled: Boolean(address && MIRROR) },
  });

  const { data: nextAllowed, refetch: refetchNext } = useReadContract({
    address: (REGISTRY ?? "0x0000000000000000000000000000000000000000") as Hex,
    abi: PrayerRegistryAbi,
    functionName: "nextAllowedAt",
    args: [((address ?? "0x0000000000000000000000000000000000000000") as Hex)],
    query: { enabled: Boolean(address && REGISTRY) },
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


  const requestSwitchNetwork = async () => {
    if (!(globalThis as any)?.ethereum) return;
    if (!FLUENT_CHAIN_ID) return;
    try {
      await (globalThis as any).ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: `0x${FLUENT_CHAIN_ID.toString(16)}` }],
      });
    } catch {
      // ignore
    }
  };

  return (
    <>
      <Head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=VT323&display=swap" rel="stylesheet" />
      </Head>
      <main className="relative isolate min-h-screen text-neutral-200 pb-24">
        <MoireLayer />
        <div className="pointer-events-none fixed inset-0 z-0 vignette" />

        <div className="relative z-10 space-y-16">
          <section className="relative px-6 pt-12 md:pt-16 lg:pt-20">
          <div className="max-w-6xl mx-auto flex flex-col gap-10 rounded-3xl border border-neutral-800/60 bg-neutral-950/40 p-8 shadow-card backdrop-blur-md md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-neutral-50">
                foid.fun--make on-chain fun again.
              </h1>
              <p className="mt-5 max-w-2xl text-lg text-neutral-300 sm:text-xl">
                pray daily, launch anything, swap everything--on fluent testnet, fast and cheap.
              </p>
              <div className="mt-8 inline-flex flex-wrap items-center gap-3 text-sm text-neutral-300">
                <span className="px-2 py-1 rounded-full bg-neutral-900/80 border border-neutral-700/60">
                  registry: {formatHexShort(REGISTRY)}
                </span>
                <span className="px-2 py-1 rounded-full bg-neutral-900/80 border border-neutral-700/60">
                  mirror: {formatHexShort(MIRROR)}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-2 text-xs uppercase tracking-[0.45em] text-neutral-400">
              <span>fax log id 20994</span>
              <span>checksum 0xf0id</span>
              <span>status: fluent testnet</span>
              <span>prayer ops online</span>
            </div>
          </div>
        </section>

        <section className="px-6">
        <div className="max-w-6xl mx-auto rounded-3xl border border-neutral-800/60 bg-neutral-950/40 p-8 shadow-card backdrop-blur-md">
          <div className="grid gap-8 md:grid-cols-[1.3fr_0.7fr]">
          <div className="crt flicker">
            <FoidMommyTerminal
              className="min-h-[380px]"
              ensureWalletReady={ensureWalletReady}
              submitPrayer={submitPrayer}
              waitForReceipt={waitForReceipt}
              nextAllowedAt={nextAllowed as bigint | undefined}
            />
          </div>

          <div className="flex flex-col gap-6">
            <aside className="rounded-2xl border border-emerald-700/60 bg-[#05170a] p-5 text-[#64ff93] font-mono shadow-[0_0_60px_rgba(16,185,129,0.20)]">
              <div className="font-semibold uppercase tracking-[0.3em] text-[#8dffb5]">your snapshot</div>
              {address ? (
                <div className="mt-3 space-y-1 text-sm">
                  <div>addr: <span className="text-[#b7ffd4]">{formatHexShort(address as Hex)}</span></div>
                  <div>streak: <b className="text-[#b7ffd4]">{snap?.[0]?.toString?.() ?? 0}</b></div>
                  <div>longest: <b className="text-[#b7ffd4]">{snap?.[1]?.toString?.() ?? 0}</b></div>
                  <div>total: <b className="text-[#b7ffd4]">{snap?.[2]?.toString?.() ?? 0}</b></div>
                  <div>milestones: <b className="text-[#b7ffd4]">{snap?.[3]?.toString?.() ?? 0}</b></div>
                  <div>score: <b className="text-[#b7ffd4]">{snap?.[4]?.toString?.() ?? 0}</b></div>
                  <div>hash: <span className="break-all text-[#b7ffd4]">{(snap?.[5] as Hex) ?? "0x"}</span></div>
                </div>
              ) : (
                <div className="mt-3 text-sm text-[#7cffab]">connect your wallet to load snapshot.</div>
              )}
              <div className="mt-4 text-xs text-[#7cffab]">
                chain: {chainId ?? "?"}
                {chainId !== FLUENT_CHAIN_ID && (
                  <button onClick={requestSwitchNetwork} className="ml-2 underline hover:text-[#c9ffd8]">
                    switch to fluent {FLUENT_CHAIN_ID}
                  </button>
                )}
              </div>
              {address && (
                <div className="mt-4 text-xs text-[#7cffab]">
                  next allowed in: {secondsLeft(Math.floor(Date.now() / 1000), nextAllowed as bigint | undefined)}s
                </div>
              )}
            </aside>

            <div className="rounded-2xl border border-emerald-700/60 bg-[#071f0d] p-5 text-[#64ff93] shadow-[0_0_60px_rgba(16,185,129,0.15)]">
              <div className="font-semibold uppercase tracking-[0.3em] text-[#8dffb5]">foid mommy</div>
              <p className="text-sm mt-2 leading-relaxed text-[#b7ffd4]">
                a nurturing, slightly absurd terminal guide. share how you feel, let her mirror it back, and anchor your prayer when you're ready.
              </p>
              <ul className="text-sm mt-4 space-y-2 text-[#a8ffca] list-disc pl-4">
                <li>chat first: type anything or tap a feeling chip</li>
                <li>client-side encryption before every send</li>
                <li>on-chain anchor via fluent testnet (chain id 20994)</li>
                <li>optional daily check-in nudges to stay consistent</li>
              </ul>
              <div className="mt-5 text-xs text-[#7cffab]">
                privacy sidebar: client-side encryption - fluent testnet anchor - readable by you + foid mommy.
              </div>
            </div>
          </div>
        </div>
        </div>
        </section>

        <section className="px-6">
        <div className="max-w-6xl mx-auto rounded-3xl border border-neutral-800/60 bg-neutral-950/40 p-8 shadow-card backdrop-blur-md text-neutral-100">
          <div className="mb-6 flex flex-col gap-2">
            <h2 className="text-sm uppercase tracking-[0.45em] text-neutral-400">launch suite</h2>
            <p className="text-2xl font-semibold text-neutral-100">three apps, zero friction.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {appTiles.map((tile) => (
              <Link
                key={tile.title}
                href={tile.href}
                className="group flex h-full flex-col justify-between gap-4 rounded-2xl bg-neutral-950/90 p-6 ring-1 ring-neutral-800/50 transition hover:ring-fluent-pink/60 hover:bg-neutral-950"
              >
                <div className="space-y-3">
                  <div className="flex justify-end text-xs uppercase tracking-[0.4em] text-neutral-400 group-hover:text-neutral-200">
                    <span>enter -&gt;</span>
                  </div>
                  <h3 className="text-2xl font-bold text-neutral-50">{tile.title}</h3>
                  <p className="text-sm text-neutral-300">{tile.body}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
        </section>

        <section className="px-6">
        <div className="max-w-6xl mx-auto rounded-3xl border border-neutral-800/60 bg-neutral-950/40 p-8 shadow-card backdrop-blur-md text-neutral-100">
          <div className="mb-6 flex flex-col gap-2">
            <h2 className="text-sm uppercase tracking-[0.45em] text-neutral-400">why choose fluent</h2>
            <p className="text-2xl font-semibold text-neutral-100">three signals builders care about.</p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {valueProps.map((prop) => (
              <div
                key={prop.title}
                className="flex h-full flex-col justify-between gap-4 rounded-2xl bg-neutral-950/90 p-6 ring-1 ring-neutral-800/50"
              >
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold text-neutral-50">{prop.title}</h3>
                  <p className="text-sm text-neutral-300">{prop.body}</p>
                </div>
                <div className="flex items-center justify-between text-xs uppercase tracking-[0.35em] text-neutral-400">
                  <Link href="https://docs.fluent.xyz" target="_blank" rel="noopener noreferrer" className="hover:text-neutral-200">
                    docs.fluent.xyz
                  </Link>
                  <span>+1</span>
                </div>
              </div>
            ))}
          </div>
        </div>
        </section>

        <section className="px-6">
        <div className="max-w-6xl mx-auto rounded-3xl border border-neutral-800/60 bg-neutral-950/40 p-8 shadow-card backdrop-blur-md text-neutral-100">
          <div className="mb-6 flex flex-col gap-2">
            <h2 className="text-sm uppercase tracking-[0.45em] text-neutral-400">contracts</h2>
            <p className="text-2xl font-semibold text-neutral-100">copy, paste, ship.</p>
          </div>
          <ul className="space-y-4 text-neutral-200">
            {CONTRACT_ADDRESSES.map((contract) => (
              <li
                key={contract.label}
                className="flex flex-col gap-3 rounded-2xl bg-black/60 p-5 ring-1 ring-neutral-800/50 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="space-y-1">
                  <p className="text-sm font-semibold uppercase tracking-[0.35em] text-neutral-300">{contract.label}</p>
                  <p className="font-mono text-xs uppercase tracking-[0.25em] text-neutral-500">
                    {contract.address}
                  </p>
                </div>
                <div className="flex items-center gap-4 text-xs uppercase tracking-[0.35em] text-neutral-400">
                  <button
                    type="button"
                    onClick={() => void copyToClipboard(contract.address, `${contract.label} copied.`)}
                    className="transition hover:text-neutral-100"
                  >
                    copy
                  </button>
                  <span className="hidden h-3 w-px bg-neutral-700 sm:block" />
                  <a
                    href={`${NETWORK_DETAILS.explorer}/address/${contract.address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="transition hover:text-neutral-100"
                  >
                    view -&gt;
                  </a>
                </div>
              </li>
            ))}
          </ul>
        </div>
        </section>

        <section className="px-6">
        <div className="max-w-6xl mx-auto rounded-3xl border border-neutral-800/60 bg-neutral-950/40 p-8 shadow-card backdrop-blur-md text-neutral-100">
          <div className="mb-6 flex flex-col gap-2">
            <h2 className="text-sm uppercase tracking-[0.45em] text-neutral-400">faq</h2>
            <p className="text-2xl font-semibold text-neutral-100">builder questions, answered.</p>
          </div>
          <div className="space-y-3">
            {faqItems.map((item, index) => {
              const open = faqOpen === index;
              return (
                <div key={item.question} className="rounded-2xl bg-black/60 ring-1 ring-neutral-800/50">
                  <button
                    type="button"
                    onClick={() => toggleFaq(index)}
                    className="flex w-full items-center justify-between px-5 py-3 text-left text-xs uppercase tracking-[0.45em] text-neutral-200 transition hover:bg-black/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-fluent-pink/60"
                    aria-expanded={open}
                  >
                    <span>{item.question}</span>
                    <span className="text-lg leading-none">{open ? "--" : "+"}</span>
                  </button>
                  {open && (
                    <div className="px-5 pb-4 text-[0.7rem] uppercase tracking-[0.25em] text-neutral-400">
                      {item.answer}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        </section>

        <footer className="px-6 pb-20">
        <div className="max-w-6xl mx-auto rounded-3xl border border-neutral-800/60 bg-neutral-950/40 px-6 py-8 shadow-card backdrop-blur-md text-neutral-100">
          <div className="flex flex-col items-center gap-4 text-xs uppercase tracking-[0.4em] text-neutral-400">
            <span className="text-neutral-500/80">follow the signal.</span>
            <a
              href="https://x.com/foidfun"
              className="inline-flex items-center gap-2 rounded-xl border border-neutral-700/70 bg-black/60 px-4 py-2 text-neutral-200 transition hover:border-fluent-pink/60 hover:text-white"
            >
              X / @foidfun -&gt;
            </a>
          </div>
        </div>
        </footer>
      </div>
    </main>
    </>
  );
}
