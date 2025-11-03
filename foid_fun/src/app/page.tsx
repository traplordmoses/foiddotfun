"use client";

import Head from "next/head";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useAccount, usePublicClient, useReadContract, useWriteContract } from "wagmi";
import { keccak256, stringToBytes, type Hex, type Hash } from "viem";
import { toast } from "react-hot-toast";
import { CONTRACT_ADDRESSES, NETWORK_DETAILS } from "./(components)/contracts";
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
    question: "what is foid.fun?",
    answer:
      "a ritual-driven on-chain game. you check in daily (“pray with foid mommy”), mint foid20 tokens, swap them, and eventually mint a mifoid whose traits are shaped by how you showed up.",
  },
  {
    question: "how do i start?",
    answer:
      "connect an evm wallet, hit pray with mommy, and your encrypted check-in records streak + mood. then mint a foid20 in the factory and trade it instantly on foid swap.",
  },
  {
    question: "which wallets work?",
    answer: "most evm wallets (we test with metamask and rabby). make sure you’re on fluent testnet.",
  },
  {
    question: "is this mainnet?",
    answer:
      "no—this is an alpha on fluent testnet. tokens here have no financial value. it’s a live prototype of the game loop.",
  },
  {
    question: "what is a mifoid?",
    answer:
      "your on-chain avatar. its traits are influenced by your streak, mood tags, and in-app actions like minting or swapping.",
  },
  {
    question: "how do traits get decided?",
    answer:
      "inputs include consecutive days checked-in, variability of moods, and activity across the factory/swap. the exact trait mapping will be published at mint time so it stays fair and auditable.",
  },
  {
    question: "what happens if i miss a day?",
    answer:
      "your streak resets, but your lifetime score stays. show up again to rebuild momentum.",
  },
  {
    question: "when can i mint my mifoid?",
    answer:
      "season 1 is coming soon—current check-ins already count. the dashboard will surface countdown + eligibility.",
  },
  {
    question: "can i game it by spamming wallets?",
    answer:
      "one streak per address. anti-abuse checks run at mint time; consistent participation beats churn.",
  },
  {
    question: "is my prayer private?",
    answer:
      "yes. prayers are encrypted client-side before sending; the chain stores ciphertext/hashed data only. explorers show encoded bytes, not plain text.",
  },
  {
    question: "can i edit or delete a prayer?",
    answer:
      "no. on-chain records are immutable. if you make a mistake, submit a new check-in the next day.",
  },
  {
    question: "do you ask for unlimited approvals?",
    answer:
      "we request the minimum allowances needed for minting or swapping. always read prompts before you sign.",
  },
  {
    question: "are the contracts open + verifiable?",
    answer: "yes. check the contracts section on the landing page for addresses and explorer links.",
  },
  {
    question: "what is wfoid?",
    answer:
      "the site’s native helper token—a dev tool with a clean UI so you can inspect balances, allowances, and contract flows. it’s for demos and testing.",
  },
  {
    question: "what is weth here?",
    answer:
      "wrap or unwrap eth ↔ weth directly on the page so you can trade on foid swap and provide liquidity.",
  },
  {
    question: "what is foid swap?",
    answer:
      "a uniswap v2-style router on fluent. pick tokens, set slippage, swap. it shows route, minimum received, and fees in real time.",
  },
  {
    question: "what is foidfactory?",
    answer:
      "a one-click foid20 token minter. every token deployed via the site ends with f01d / F01d thanks to deterministic deployment.",
  },
  {
    question: "why fluent?",
    answer:
      "speed, low fees, and dev-friendly UX—ideal for daily rituals with verifiable on-chain state.",
  },
  {
    question: "how do i add fluent testnet?",
    answer:
      "click “add network” when prompted or manually add: rpc https://rpc.testnet.fluent.xyz, chain id 20994, symbol ETH, explorer https://testnet.fluentscan.xyz.",
  },
  {
    question: "gas fees?",
    answer:
      "testnet gas is minimal. use the fluent faucet to fund your wallet. swaps, mints, and prayers are designed to stay lightweight.",
  },
  {
    question: "my wallet won’t connect.",
    answer:
      "refresh the page, switch networks, or re-enable the site in your wallet. if that fails, clear cache and reconnect.",
  },
  {
    question: "tx failed / stuck pending.",
    answer:
      "confirm you’re on fluent testnet, have testnet gas, and slippage isn’t too tight. retry with a fresh nonce if your wallet supports it.",
  },
  {
    question: "my streak didn’t update.",
    answer:
      "streaks roll over at 00:00 utc. if you checked in near reset, it may apply to the next day. the dashboard shows the latest recorded day.",
  },
  {
    question: "i minted a foid20—now what?",
    answer:
      "view it on the explorer, then create a pool or trade it on foid swap. share the vanity address (ending in f01d / F01d) so others can find it.",
  },
  {
    question: "safety & disclaimers?",
    answer:
      "alpha software on testnet—tokens have no financial value. always verify contract addresses and never sign transactions you don’t understand.",
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
      <main className="relative isolate min-h-screen pb-24 text-white/85">
        <div className="pointer-events-none fixed inset-0 z-0 vignette" />

        <div className="relative z-10 space-y-16">
          <section className="relative px-6 pt-12 md:pt-16 lg:pt-20">
          <div className="max-w-6xl mx-auto flex flex-col gap-10 rounded-3xl foid-glass px-8 py-8 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-white drop-shadow-[0_14px_38px_rgba(0,208,255,0.28)]">
                foid.fun
              </h1>
              <p className="mt-5 max-w-2xl text-lg text-white/80 sm:text-xl">
                foid.fun is a ritual-driven on-chain game. each day, you pray with foid mommy—a quick, private on-chain check-in that tracks your streak and mood. then you can mint a foid20 in the factory and trade instantly on foid swap. your consistency and choices shape the type of mifoid you’ll mint, so showing up actually changes outcomes. simple loop: show up → mint → swap → evolve. fast, playful, and fully on-chain.
              </p>
            </div>

            <div className="flex flex-col gap-2 text-xs uppercase tracking-[0.45em] text-foid-mint/80">
              <span>fax log id 20994</span>
              <span>checksum 0xf0id</span>
              <span>status: fluent testnet</span>
              <span>prayer ops online</span>
            </div>
          </div>
        </section>

        <section className="px-6">
        <div className="max-w-6xl mx-auto rounded-3xl foid-glass p-8">
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
            <aside className="foid-glass p-5 font-mono text-foid-mint/85 shadow-[0_0_55px_rgba(114,225,255,0.18)]">
              <div className="font-semibold uppercase tracking-[0.3em] text-foid-candy/85">your snapshot</div>
              {address ? (
                <div className="mt-3 space-y-1 text-sm text-white/85">
                  <div>
                    addr: <span className="text-foid-mint">{formatHexShort(address as Hex)}</span>
                  </div>
                  <div>
                    streak: <b className="text-foid-mint">{snap?.[0]?.toString?.() ?? 0}</b>
                  </div>
                  <div>
                    longest: <b className="text-foid-mint">{snap?.[1]?.toString?.() ?? 0}</b>
                  </div>
                  <div>
                    total: <b className="text-foid-mint">{snap?.[2]?.toString?.() ?? 0}</b>
                  </div>
                  <div>
                    milestones: <b className="text-foid-mint">{snap?.[3]?.toString?.() ?? 0}</b>
                  </div>
                  <div>
                    score: <b className="text-foid-mint">{snap?.[4]?.toString?.() ?? 0}</b>
                  </div>
                  <div>
                    hash: <span className="break-all text-foid-mint/90">{(snap?.[5] as Hex) ?? "0x"}</span>
                  </div>
                </div>
              ) : (
                <div className="mt-3 text-sm text-white/80">connect your wallet to load snapshot.</div>
              )}
              <div className="mt-4 text-xs text-foid-mint/80">
                chain: {chainId ?? "?"}
                {chainId !== FLUENT_CHAIN_ID && (
                  <button
                    onClick={requestSwitchNetwork}
                    className="ml-2 inline-flex items-center rounded-full border border-white/25 px-2.5 py-1 text-[0.6rem] uppercase tracking-[0.28em] text-white/80 transition hover:border-white/45 hover:text-white focus:outline-none focus:ring-1 focus:ring-foid-cyan/60"
                  >
                    switch to fluent {FLUENT_CHAIN_ID}
                  </button>
                )}
              </div>
              {address && (
                <div className="mt-4 text-xs text-foid-mint/80">
                  next allowed in: {secondsLeft(Math.floor(Date.now() / 1000), nextAllowed as bigint | undefined)}s
                </div>
              )}
            </aside>

            <div className="foid-glass p-5 text-white/85 shadow-[0_0_50px_rgba(203,183,255,0.18)]">
              <div className="font-semibold uppercase tracking-[0.3em] text-foid-candy/85">foid mommy</div>
              <p className="mt-2 text-sm leading-relaxed text-white/75">
                your nurturing (and a little absurd) terminal guide. share how you feel, she mirrors it back, and seals your prayer on chain—feeding the mifoid you’ll mint.
              </p>
              <ul className="mt-4 list-disc space-y-2 pl-4 text-sm text-foid-mint/85">
                <li>chat first: type anything or tap a feeling chip</li>
                <li>private by default: client-side encryption before every send (only ciphertext hits chain)</li>
                <li>on-chain anchor: fluent testnet, chain id 20994</li>
                <li>streak engine: gentle daily check-in nudges to keep you consistent</li>
                <li>progression: your streak + mood directly shape your future mifoid</li>
              </ul>
              <div className="mt-5 text-xs text-white/60">
                privacy sidebar: client-side encryption - fluent testnet anchor - readable by you + foid mommy.
              </div>
            </div>
          </div>
        </div>
        </div>
        </section>

        <section className="px-6">
        <div className="max-w-6xl mx-auto rounded-3xl foid-glass p-8 text-white/90">
          <div className="mb-6 flex flex-col gap-2">
            <h2 className="text-sm uppercase tracking-[0.45em] text-foid-mint/75">launch suite</h2>
            <p className="text-2xl font-semibold text-white">three apps, zero friction.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {appTiles.map((tile) => (
              <Link
                key={tile.title}
                href={tile.href}
                className="group foid-glass flex h-full flex-col justify-between gap-4 rounded-2xl p-6 transition hover:shadow-[0_0_35px_rgba(114,225,255,0.25)]"
              >
                <div className="space-y-3">
                  <div className="flex justify-end text-xs uppercase tracking-[0.4em] text-white/55 transition group-hover:text-white/80">
                    <span>enter -&gt;</span>
                  </div>
                  <h3 className="text-2xl font-bold text-white drop-shadow-[0_2px_12px_rgba(0,208,255,0.18)]">{tile.title}</h3>
                  <p className="text-sm text-white/75">{tile.body}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
        </section>

        <section className="px-6">
        <div className="max-w-6xl mx-auto rounded-3xl foid-glass p-8 text-white/90">
          <div className="mb-6 flex flex-col gap-2">
            <h2 className="text-sm uppercase tracking-[0.45em] text-foid-mint/75">why choose fluent</h2>
            <p className="text-2xl font-semibold text-white">three signals builders care about.</p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {valueProps.map((prop) => (
              <div
                key={prop.title}
                className="foid-glass flex h-full flex-col justify-between gap-4 rounded-2xl p-6 shadow-[0_0_32px_rgba(143,170,242,0.22)]"
              >
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold text-white drop-shadow-[0_2px_12px_rgba(0,208,255,0.18)]">
                    {prop.title}
                  </h3>
                  <p className="text-sm text-white/75">{prop.body}</p>
                </div>
                <div className="flex items-center justify-between text-xs uppercase tracking-[0.35em] text-white/60">
                  <Link
                    href="https://docs.fluent.xyz"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="transition hover:text-white/85"
                  >
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
        <div className="max-w-6xl mx-auto rounded-3xl foid-glass p-8 text-white/90">
          <div className="mb-6 flex flex-col gap-2">
            <h2 className="text-sm uppercase tracking-[0.45em] text-foid-mint/75">contracts</h2>
            <p className="text-2xl font-semibold text-white">copy, paste, ship.</p>
          </div>
          <ul className="space-y-4 text-white/85">
            {CONTRACT_ADDRESSES.map((contract) => (
              <li
                key={contract.label}
                className="foid-glass flex flex-col gap-3 rounded-2xl p-5 shadow-[0_0_30px_rgba(0,208,255,0.16)] sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="space-y-1">
                  <p className="text-sm font-semibold uppercase tracking-[0.35em] text-foid-mint/80">{contract.label}</p>
                  <p className="font-mono text-xs uppercase tracking-[0.25em] text-white/60">
                    {contract.address}
                  </p>
                </div>
                <div className="flex items-center gap-4 text-xs uppercase tracking-[0.35em] text-white/60">
                  <button
                    type="button"
                    onClick={() => void copyToClipboard(contract.address, `${contract.label} copied.`)}
                    className="transition hover:text-white"
                  >
                    copy
                  </button>
                  <span className="hidden h-3 w-px bg-white/25 sm:block" />
                  <a
                    href={`${NETWORK_DETAILS.explorer}/address/${contract.address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="transition hover:text-white"
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
        <div className="max-w-6xl mx-auto rounded-3xl foid-glass p-8 text-white/90">
          <div className="mb-6 flex flex-col gap-2">
            <h2 className="text-sm uppercase tracking-[0.45em] text-foid-mint/75">faq</h2>
            <p className="text-2xl font-semibold text-white">questions, answered.</p>
          </div>
          <div className="space-y-3 max-h-[28rem] overflow-y-auto pr-2">
            {faqItems.map((item, index) => {
              const open = faqOpen === index;
              return (
                <div key={item.question} className="foid-glass rounded-2xl">
                  <button
                    type="button"
                    onClick={() => toggleFaq(index)}
                    className="flex w-full items-center justify-between px-5 py-3 text-left text-xs uppercase tracking-[0.45em] text-white/75 transition hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-foid-cyan/60"
                    aria-expanded={open}
                  >
                    <span>{item.question}</span>
                    <span className="text-lg leading-none text-foid-mint/80">{open ? "--" : "+"}</span>
                  </button>
                  {open && (
                    <div className="px-5 pb-4 text-[0.7rem] uppercase tracking-[0.25em] text-white/60">
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
        <div className="max-w-6xl mx-auto rounded-3xl foid-glass px-6 py-8 text-white/85">
          <div className="flex flex-col items-center gap-4 text-xs uppercase tracking-[0.4em] text-foid-mint/75">
            <span className="text-white/60">follow the signal.</span>
            <a
              href="https://x.com/foidfun"
              className="btn-foid inline-flex items-center gap-2 text-sm uppercase tracking-[0.32em]"
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
