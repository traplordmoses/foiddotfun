"use client";

import dynamic from "next/dynamic";
import Head from "next/head";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useCallback, useState, type CSSProperties } from "react";
import { useAccount, usePublicClient, useReadContract, useWriteContract } from "wagmi";
import { keccak256, stringToBytes, type Hex, type Hash } from "viem";
import FoidMommyTerminal, {
  FEELING_LABELS,
  type FeelingKey,
} from "./(components)/FoidMommyTerminal";
const MusicPanel = dynamic(() => import("@/components/MusicPanel"), {
  ssr: false,
  loading: () => (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-xs text-white/70">
      <span>Booting MUSIC.EXE…</span>
      <span className="text-[10px] uppercase tracking-[0.3em] text-white/40">
        keeping the dashboard snappy
      </span>
    </div>
  ),
});

/* --- left sidebar routes --- */
type NavLink = { href: string; label: string; external?: boolean };

const NAV_LINKS: NavLink[] = [
  { href: "/", label: "Dashboard" },
  { href: "/about", label: "About" },
  { href: "/wFOID", label: "wFOID" },
  { href: "/wETH", label: "wETH" },
  { href: "/foidswap", label: "FoidSwap" },
  { href: "/foidfactory", label: "FoidFactory" },
  { href: "https://github.com/traplordmoses/foiddotfun", label: "GitHub", external: true },
  { href: "https://x.com/foidfun", label: "X / @foidfun", external: true },
] as const;

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

  const musicRef = useRef<HTMLDivElement | null>(null);
  const [musicPanelReady, setMusicPanelReady] = useState(false);
  const rightColumnRef = useRef<HTMLDivElement | null>(null);
  const [columnsHeight, setColumnsHeight] = useState<number | null>(null);
  type ColumnHeightStyle = CSSProperties & { "--column-height"?: string };
  const columnHeightStyle: ColumnHeightStyle | undefined = useMemo(
    () => (columnsHeight != null ? { "--column-height": `${columnsHeight}px` } : undefined),
    [columnsHeight]
  );

  const syncColumnsHeight = useCallback(() => {
    const target = rightColumnRef.current;
    if (!target) return;
    const height = target.getBoundingClientRect().height;
    if (!height) return;
    const rounded = Math.round(height);
    setColumnsHeight((prev) => {
      if (prev !== null && Math.abs(prev - rounded) < 2) return prev;
      return rounded;
    });
  }, []);


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
  useEffect(() => { snapRef.current = refetchSnap; }, [refetchSnap]);
  useEffect(() => { nextRef.current = refetchNext; }, [refetchNext]);
  useEffect(() => { registryRef.current = REGISTRY as Hex | undefined; }, [REGISTRY]);
  useEffect(() => {
    if (!address || !FLUENT_CHAIN_ID) return;
    if (MIRROR) void refetchSnap({ throwOnError: false, cancelRefetch: false });
    if (!REGISTRY) return;
    void refetchNext({ throwOnError: false, cancelRefetch: false });
  }, [MIRROR, REGISTRY, address, FLUENT_CHAIN_ID, refetchNext, refetchSnap]);

  useEffect(() => {
    if (musicPanelReady) return;
    if (typeof window === "undefined") return;
    let cancelled = false;
    const enable = () => {
      if (!cancelled) setMusicPanelReady(true);
    };
    const idleCb = (window as any).requestIdleCallback?.(enable, { timeout: 2400 }) ?? null;
    const timeout = window.setTimeout(enable, 2600);
    return () => {
      cancelled = true;
      if (idleCb !== null) {
        (window as any).cancelIdleCallback?.(idleCb);
      }
      window.clearTimeout(timeout);
    };
  }, [musicPanelReady]);

  useEffect(() => {
    if (musicPanelReady) return;
    if (typeof window === "undefined" || typeof IntersectionObserver === "undefined") return;
    const target = musicRef.current;
    if (!target) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setMusicPanelReady(true);
        }
      },
      { rootMargin: "64px", threshold: 0.1 }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [musicPanelReady]);

  useEffect(() => {
    syncColumnsHeight();
  }, [syncColumnsHeight, musicPanelReady, snap, nextAllowed]);

  useEffect(() => {
    if (typeof ResizeObserver === "undefined") return;
    const target = rightColumnRef.current;
    if (!target) {
      syncColumnsHeight();
      return;
    }
    const observer = new ResizeObserver(() => syncColumnsHeight());
    observer.observe(target);
    return () => observer.disconnect();
  }, [syncColumnsHeight]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onResize = () => syncColumnsHeight();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [syncColumnsHeight]);

  const loadMusicPanelNow = useCallback(() => setMusicPanelReady(true), []);

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

  /* active-state helper for left nav */
  const pathname = usePathname();
  const leftLinkClass = (active: boolean) =>
    `group relative flex items-center gap-3.5 rounded-2xl px-4 py-3 text-lg font-semibold shadow-[0_3px_0_rgba(0,0,0,.18)] transition
     focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foid-mint/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900/60
     ${active
        ? "bg-gradient-to-r from-foid-aqua/80 via-foid-periw/80 to-foid-candy/80 text-foid-midnight border border-white/60 shadow-[0_10px_24px_rgba(0,0,0,.24)]"
        : "border border-white/25 bg-gradient-to-r from-white/10 via-white/5 to-white/10 text-white/90 hover:-translate-y-0.5 hover:bg-white/15 hover:border-white/40 hover:shadow-[0_10px_24px_rgba(0,0,0,.24)]"
      }`;

  return (
    <>
      <Head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=VT323&display=swap" rel="stylesheet" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/site.webmanifest" />
      </Head>

      <main className="relative isolate min-h-screen bg-foid-bg text-white/90 flex justify-center">
        <div className="pointer-events-none fixed inset-0 z-0 vignette" />
        <div className="relative z-10 w-full max-w-[1200px] px-6 lg:px-8 py-8 lg:py-10">
          {/* floating brand — overlays UI, doesn't move layout */}
          <div className="pointer-events-none absolute left-6 -top-8 z-[2000] sm:left-10 sm:-top-10">
            <span className="bg-gradient-to-r from-foid-candy via-foid-aqua to-foid-mint bg-clip-text
                            text-4xl font-black uppercase tracking-[0.5em] text-transparent
                            drop-shadow-[0_0_28px_rgba(114,225,255,0.6)]
                            sm:text-[2.75rem] sm:tracking-[0.55em]">
              foid.fun
            </span>
          </div>

          <div
            className="grid grid-cols-1 gap-6 lg:grid-cols-[25%_50%_25%] lg:items-start"
            style={columnHeightStyle}
          >
            <section
              className="relative order-1 w-full flex flex-col gap-4 lg:order-2 lg:min-h-0 lg:h-[var(--column-height)] lg:max-h-[var(--column-height)] lg:overflow-y-auto lg:pr-1"
            >
              <div className="vista-window vista-window--media w-full min-h-[320px] shrink-0">
                <div className="vista-window__titlebar">
                  <div className="vista-window__controls" aria-hidden="true">
                    <span className="vista-window__control vista-window__control--minimize" />
                    <span className="vista-window__control vista-window__control--restore" />
                    <span className="vista-window__control vista-window__control--close" />
                  </div>
                  <span className="vista-window__title">
                    <span aria-hidden="true">📸</span> foid_mommy.jpg
                  </span>
                  <span className="vista-window__badge" aria-hidden="true">🦋</span>
                </div>
                <div className="vista-window__body vista-window__body--flush w-full max-h-[52vh] overflow-hidden">
                  <Image
                    src="/foidmommy.jpg"
                    alt="Crayon sketch of Foid with cherries and neon eyes on a diner table."
                    width={1280}
                    height={960}
                    className="h-full w-full object-contain"
                    priority
                  />
                </div>
              </div>

              <div className="vista-window vista-window--terminal w-full flex shrink-0 flex-col">
                <div className="vista-window__titlebar">
                  <div className="vista-window__controls" aria-hidden="true">
                    <span className="vista-window__control vista-window__control--minimize" />
                    <span className="vista-window__control vista-window__control--restore" />
                    <span className="vista-window__control vista-window__control--close" />
                  </div>
                  <span className="vista-window__title">
                    <span aria-hidden="true">💾</span> foid_mommy_terminal.exe
                  </span>
                  <span className="vista-window__badge" aria-hidden="true">🪼</span>
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
              </div>

              <div className="vista-window vista-window--info vista-window--frosted w-full min-h-[320px] shrink-0 lg:pb-4">
                <div className="vista-window__titlebar">
                  <div className="vista-window__controls" aria-hidden="true">
                    <span className="vista-window__control vista-window__control--minimize" />
                    <span className="vista-window__control vista-window__control--restore" />
                    <span className="vista-window__control vista-window__control--close" />
                  </div>
                  <span className="vista-window__title">
                    <span aria-hidden="true">📄</span> foid_mommy_manual.txt
                  </span>
                  <span className="vista-window__badge" aria-hidden="true">🌊</span>
                </div>
                <div className="vista-window__body space-y-6">
                  <div className="space-y-4 text-sm">
                    <h3 className="text-xs uppercase tracking-[0.5em] text-foid-mint/80">foid mommy</h3>
                    <p>
                      foid mommy is a super-simple daily check-in game on-chain: every time you “pray,” it logs your streak,
                      and the more consistent you are, the bigger your mifoid’s boobs will be at launch (tge = token generation event).
                    </p>
                    <div className="space-y-4">
                      <div>
                        <span className="font-semibold uppercase tracking-[0.35em] text-foid-mint/80">how to start</span>
                        <ol className="mt-2 list-decimal space-y-1 pl-5 text-foid-mint/85">
                          <li>connect your wallet → switch to the fluent network (if asked).</li>
                          <li>click “chat with foid mommy.” the retro terminal opens.</li>
                          <li>foid mommy asks “how are you feeling?” pick a mood or type it.</li>
                          <li>foid mommy shows a short prayer. type your own prayer (optional).</li>
                          <li>click “send prayer.” your wallet pops up—confirm the transaction.</li>
                          <li>done. your streak number ticks up. come back in ~24h and do it again.</li>
                        </ol>
                      </div>
                      <div>
                        <span className="font-semibold uppercase tracking-[0.35em] text-foid-mint/80">daily rules</span>
                        <ol className="mt-2 list-decimal space-y-1 pl-5 text-foid-mint/85">
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
                        <span className="font-semibold uppercase tracking-[0.35em] text-foid-mint/80">why it matters</span>
                        <p className="mt-2 text-foid-mint/85">
                          show up daily → grow your streak → your mifoid has exclusive traits at tge.
                        </p>
                      </div>
                    </div>
                  </div>
                  {/* stats removed from here */}
                </div>
              </div>

              <div className="pointer-events-none sticky bottom-0 -mx-1 hidden h-12 bg-gradient-to-t from-foid-midnight/75 via-foid-midnight/35 to-transparent lg:block" />
            </section>

            <aside
              className="order-2 w-full lg:order-1 flex h-full flex-col lg:min-h-0 lg:h-[var(--column-height)] lg:max-h-[var(--column-height)] lg:overflow-hidden"
            >
              <div className="vista-window vista-window--compact w-full flex h-full flex-col">
                <div className="vista-window__titlebar">
                  <span className="vista-window__title">navigate</span>
                </div>
                <div className="vista-window__body mt-3 flex-1 overflow-hidden">
                  <nav className="grid h-full gap-3 overflow-y-auto pr-2">
                    {NAV_LINKS.map(({ href, label, external }) => {
                      const active = !external && pathname === href;
                      const className = leftLinkClass(active);
                      const content = (
                        <>
                          <span className="flex-1 text-left">{label}</span>
                          <Image
                            src="/foidmommy.gif"
                            alt=""
                            aria-hidden="true"
                            width={64}
                            height={64}
                            className="ml-auto h-14 w-14 flex-shrink-0 rounded-full object-contain transition-transform duration-200 ease-out group-hover:scale-110 sm:h-16 sm:w-16"
                            draggable={false}
                          />
                        </>
                      );
                      return external ? (
                        <a
                          key={href}
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={className}
                        >
                          {content}
                        </a>
                      ) : (
                        <Link key={href} href={href} className={className}>
                          {content}
                        </Link>
                      );
                    })}
                  </nav>
                </div>
              </div>
            </aside>

            <aside
              ref={rightColumnRef}
              className="order-3 w-full flex flex-col gap-4 lg:min-h-0"
            >
              <div className="vista-window vista-window--compact w-full">
                <div className="vista-window__titlebar">
                  <span className="vista-window__title">visit foid’s room</span>
                </div>
                <div className="vista-window__body">
                  <Link
                    href="/board"
                    className="block w-full rounded-2xl border border-white/35 bg-gradient-to-r from-foid-aqua/70 via-foid-periw/70 to-foid-candy/70 px-8 py-6 text-center text-xl font-bold uppercase tracking-[0.35em] text-foid-midnight shadow-[0_6px_0_rgba(0,0,0,.18)] transition hover:-translate-y-0.5 hover:brightness-110"
                    prefetch
                  >
                    enter
                  </Link>
                </div>
              </div>

              <div className="vista-window vista-window--compact w-full">
                <div className="vista-window__titlebar">
                  <span className="vista-window__title">your prayers</span>
                </div>
                <div className="vista-window__body font-mono text-sm">
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
              </div>

              <div ref={musicRef} className="vista-window vista-window--compact w-full flex flex-col">
                <div className="vista-window__titlebar flex items-center justify-between">
                  <span className="vista-window__title select-none uppercase">MUSIC.EXE</span>
                </div>

                <div className="vista-window__body overflow-hidden p-0">
                  {musicPanelReady ? (
                    <MusicPanel />
                  ) : (
                    <div className="flex h-[260px] flex-col items-center justify-center gap-4 px-6 text-center text-xs text-white/70 sm:text-sm">
                      <p>
                        Music.exe spins up after the dashboard finishes compiling so the rest of the UI can paint instantly.
                      </p>
                      <button
                        type="button"
                        onClick={loadMusicPanelNow}
                        className="rounded-full border border-white/30 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.3em] text-white/80 transition hover:bg-white/10"
                      >
                        Load now
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </aside>
          </div>
        </div>
      </main>
    </>
  );
}
