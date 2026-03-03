"use client";

import { useCallback, useEffect, useState } from "react";
import { useAccount, useReadContract, useDisconnect, useConnect } from "wagmi";
import Link from "next/link";
import { CONTRACTS } from "@/lib/contracts/addresses";
import { FOID_TREST_ABI } from "@/lib/contracts/abis/foidTrest";
import { publicClient } from "@/lib/viem";
import AppTitlebar from "@/app/(components)/AppTitlebar";

type TrestEntry = {
  id: number;
  creator: string;
  ipfsCid: string;
  placedAt: number;
  path: number;
  visible: boolean;
};

const IPFS_GATEWAY = "https://ipfs.io/ipfs/";

function cidToUrl(cid: string): string {
  if (!cid) return "";
  if (cid.startsWith("http")) return cid;
  return `${IPFS_GATEWAY}${cid}`;
}

function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatTimestamp(unix: number): string {
  return new Date(unix * 1000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ── Gradient + symbol combos for trest cards ──
const TREST_VISUALS = [
  { gradient: "linear-gradient(135deg, #1a0a2e 0%, #4a1a8e 50%, #0f0c29 100%)", symbol: "\u2728" },
  { gradient: "linear-gradient(135deg, #0a1a2e 0%, #1a4a8e 50%, #0c1929 100%)", symbol: "\u{1F30A}" },
  { gradient: "linear-gradient(135deg, #2e0a1a 0%, #8e1a4a 50%, #290c0f 100%)", symbol: "\u{1F339}" },
  { gradient: "linear-gradient(135deg, #0a2e1a 0%, #1a8e4a 50%, #0c290f 100%)", symbol: "\u{1F331}" },
  { gradient: "linear-gradient(135deg, #2e2e0a 0%, #8e8e1a 50%, #29290c 100%)", symbol: "\u{1F31F}" },
  { gradient: "linear-gradient(135deg, #0a0a2e 0%, #2a1a6e 50%, #0c0c29 100%)", symbol: "\u{1F52E}" },
];

function TrestCard({ entry }: { entry: TrestEntry }) {
  const [loaded, setLoaded] = useState(false);

  return (
    <div className="group relative overflow-hidden rounded-xl border border-purple-500/15 bg-neutral-900/70 hover:border-purple-500/40 hover:shadow-[0_0_24px_rgba(139,92,246,0.2)] [perspective:600px] hover:[transform:scale(1.03)_rotateY(2deg)_rotateX(-1deg)]" style={{ transition: "transform 200ms ease-out, border-color 200ms ease, box-shadow 200ms ease" }}>
      <div className="relative aspect-square overflow-hidden bg-neutral-800/40">
        {entry.ipfsCid ? (
          <>
            {!loaded && <div className="absolute inset-0 animate-pulse bg-neutral-800" />}
            <img
              src={cidToUrl(entry.ipfsCid)}
              alt="Gallery entry"
              className={`h-full w-full object-cover transition-opacity duration-500 ${loaded ? "opacity-100" : "opacity-0"}`}
              onLoad={() => setLoaded(true)}
            />
          </>
        ) : (
          <div
            className="flex h-full items-center justify-center relative"
            style={{ background: TREST_VISUALS[(entry.id - 1) % TREST_VISUALS.length].gradient }}
          >
            <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")", backgroundSize: "150px" }} />
            <span className="text-5xl drop-shadow-[0_0_20px_rgba(255,255,255,0.15)]">
              {TREST_VISUALS[(entry.id - 1) % TREST_VISUALS.length].symbol}
            </span>
          </div>
        )}
      </div>
      <div className="space-y-1 p-2">
        <div className="flex items-center justify-between text-[10px] text-neutral-400">
          <span className="font-mono">{truncateAddress(entry.creator)}</span>
          <span suppressHydrationWarning>{formatTimestamp(entry.placedAt)}</span>
        </div>
      </div>
    </div>
  );
}

export default function GalleryPage() {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { connectors } = useConnect();
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<TrestEntry[]>([]);

  const trestAddress = (CONTRACTS.FOID_TREST ?? "") as `0x${string}`;
  const hasTrest = !!CONTRACTS.FOID_TREST;

  const { data: entryCount } = useReadContract({
    address: trestAddress,
    abi: FOID_TREST_ABI,
    functionName: "entryCount",
    query: { enabled: hasTrest },
  });

  // Load real entries from FoidTrest via multicall
  useEffect(() => {
    if (!hasTrest || entryCount === undefined) {
      setLoading(false);
      return;
    }

    const count = Number(entryCount);
    if (count === 0) {
      setEntries([]);
      setLoading(false);
      return;
    }

    let alive = true;
    const loadEntries = async () => {
      try {
        const contracts = Array.from({ length: count }, (_, i) => ({
          address: trestAddress,
          abi: FOID_TREST_ABI,
          functionName: "getEntry" as const,
          args: [BigInt(i + 1)] as const,
        }));

        const results = await publicClient.multicall({ contracts, allowFailure: true });

        if (!alive) return;

        const loaded: TrestEntry[] = results
          .map((result) => {
            if (result.status !== "success" || !result.result) return null;
            const e = result.result as {
              id: bigint;
              creator: string;
              ipfsCid: string;
              title: string;
              description: string;
              placedAt: bigint;
              path: number;
              duelId: bigint;
              visible: boolean;
            };
            if (!e.visible) return null;
            return {
              id: Number(e.id),
              creator: e.creator,
              ipfsCid: e.ipfsCid,
              placedAt: Number(e.placedAt),
              path: e.path,
              visible: e.visible,
            };
          })
          .filter((e): e is NonNullable<typeof e> => e !== null) as TrestEntry[];

        setEntries(loaded);
      } catch (err) {
        console.error("[gallery] Failed to load entries:", err);
        setEntries([]);
      } finally {
        if (alive) setLoading(false);
      }
    };

    loadEntries();
    return () => { alive = false; };
  }, [hasTrest, entryCount, trestAddress]);

  const handleSwitchWallet = useCallback(() => {
    const injected = connectors.find((c) => c.id === "injected") ?? connectors[0];
    if (injected) injected.connect?.();
  }, [connectors]);

  return (
    <main className="relative bg-foid-bg text-white/90 overflow-hidden flex items-center justify-center" style={{ height: "100vh" }}>
      <div className="pointer-events-none fixed inset-0 z-0 vignette" />
      <section className="relative z-10 w-full max-w-full px-2 sm:px-4">
        <div className="mx-auto w-full max-w-6xl">
          <div className="vista-window vista-window--terminal vista-window--enhanced h-[94vh] max-h-[94vh] w-full flex flex-col">
            <AppTitlebar
              title="GALLERY.EXE"
              connected={isConnected}
              address={address}
              onDisconnect={() => disconnect()}
              onSwitchWallet={handleSwitchWallet}
            />
            <div className="vista-window__body" style={{ overflowY: "auto", flex: 1, minHeight: 0 }}>
              <div className="p-3 md:p-4 flex flex-col gap-4">
                {/* Header */}
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h1
                      className="text-xl sm:text-2xl font-black uppercase tracking-[0.2em] text-transparent bg-clip-text"
                      style={{
                        backgroundImage: "linear-gradient(135deg, rgba(168,130,255,1) 0%, rgba(255,255,255,0.95) 50%, rgba(200,160,255,0.9) 100%)",
                      }}
                    >
                      Gallery
                    </h1>
                    <p className="mt-1 text-[10px] text-white/45 tracking-wide">
                      the internet&apos;s hottest pop-up gallery
                    </p>
                  </div>
                  <Link href="/swipe" className="foid-cta-btn text-xs px-3 py-1.5" style={{ background: "linear-gradient(135deg, #e040fb, #f06292)" }}>
                    PROPOSE A MEME
                  </Link>
                </div>

                {entryCount !== undefined && (
                  <div className="text-[10px] text-white/40">
                    {Number(entryCount)} {Number(entryCount) === 1 ? "entry" : "entries"} on-chain
                  </div>
                )}

                {/* Gallery grid */}
                {loading ? (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <div key={i} className="aspect-square animate-pulse rounded-xl bg-neutral-800/50" />
                    ))}
                  </div>
                ) : entries.length > 0 ? (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                    {entries.map((entry) => (
                      <TrestCard key={entry.id} entry={entry} />
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <div className="mb-3 text-4xl opacity-30">&#x2727;</div>
                    <h2 className="text-base font-medium text-white/70">The gallery awaits</h2>
                    <p className="mt-1 max-w-sm text-xs text-white/40">
                      No entries yet. Win a swipe to earn your place in the Gallery.
                    </p>
                    <Link href="/swipe/submit" className="foid-cta-btn mt-4" style={{ background: "linear-gradient(135deg, #e040fb, #f06292)" }}>
                      Propose a Meme
                    </Link>
                  </div>
                )}

              </div>
            </div>
          </div>
        </div>
      </section>
      <style jsx>{`
        :global(.vista-window__body) {
          scrollbar-width: thin;
          scrollbar-color: rgba(255,255,255,0.15) transparent;
        }
        :global(.vista-window__body)::-webkit-scrollbar { width: 8px; }
        :global(.vista-window__body)::-webkit-scrollbar-thumb {
          border-radius: 999px;
          background: rgba(255,255,255,0.2);
          border: 2px solid transparent;
          background-clip: padding-box;
        }
        :global(.vista-window__body)::-webkit-scrollbar-track { background: transparent; }
      `}</style>
    </main>
  );
}
