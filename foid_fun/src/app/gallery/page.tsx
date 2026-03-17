"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAccount, useReadContract } from "wagmi";
import { useSwitchWallet } from "@/hooks/useSwitchWallet";
import Link from "next/link";
import { CONTRACTS } from "@/lib/contracts/addresses";
import { FOID_TREST_ABI } from "@/lib/contracts/abis/foidTrest";
import { ENGRAVE_ABI } from "@/lib/contracts/abis/engrave";
import { publicClient, getWalletClient } from "@/lib/viem";
import AppTitlebar from "@/app/(components)/AppTitlebar";
import { ipfsToHttp } from "@/lib/ipfsUrl";

const ENGRAVE_ADDRESS = (process.env.NEXT_PUBLIC_ENGRAVE_ADDRESS ?? "0x0000000000000000000000000000000000000000") as `0x${string}`;
const ENGRAVE_DEPLOYED = ENGRAVE_ADDRESS !== "0x0000000000000000000000000000000000000000";

// ── localStorage fallback (used when contract not deployed) ──
const ENGRAVINGS_KEY = "foid_engravings";

function loadEngravingsLocal(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(ENGRAVINGS_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveEngravingLocal(entryId: number, message: string) {
  const all = loadEngravingsLocal();
  all[String(entryId)] = message;
  localStorage.setItem(ENGRAVINGS_KEY, JSON.stringify(all));
}

/** Deterministic pseudo-random rotation per entry ID, range [-2, 3] degrees */
function engravingRotation(id: number): number {
  const hash = ((id * 2654435761) >>> 0) % 1000;
  return -2 + (hash / 1000) * 5;
}

function tryNextGateway(el: HTMLImageElement, cid?: string) {
  if (!cid) return;
  const urls = ipfsToHttp(cid);
  const idx = Number(el.dataset.gatewayIndex ?? "-1") + 1;
  if (idx < urls.length) { el.src = urls[idx]; el.dataset.gatewayIndex = String(idx); }
}

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

// ── Engraving Modal ──
function EngravingModal({
  entryId,
  onClose,
  onSave,
  saving,
  error,
}: {
  entryId: number;
  onClose: () => void;
  onSave: (msg: string) => void;
  saving: boolean;
  error: string | null;
}) {
  const [text, setText] = useState("");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget && !saving) onClose(); }}
    >
      <div
        className="mx-4 w-full max-w-sm rounded-xl border border-purple-500/25 p-5 shadow-[0_0_40px_rgba(139,92,246,0.15)]"
        style={{ background: "linear-gradient(145deg, rgba(20,12,36,0.95), rgba(12,8,24,0.98))" }}
      >
        <h3
          className="mb-3 text-sm font-bold uppercase tracking-[0.15em] text-transparent bg-clip-text"
          style={{ backgroundImage: "linear-gradient(135deg, #d4a0ff, #fff)" }}
        >
          Engrave your mark
        </h3>
        <p className="mb-3 text-[10px] text-white/40">
          {ENGRAVE_DEPLOYED
            ? "Sign your canonized meme. This is permanent and on-chain."
            : "Sign your canonized meme. This is permanent (in your browser)."}
        </p>
        <textarea
          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/90 placeholder-white/25 outline-none focus:border-purple-500/40 resize-none"
          rows={3}
          maxLength={140}
          placeholder="Leave your mark..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={saving}
          autoFocus
        />
        {error && (
          <p className="mt-1 text-[10px] text-red-400">{error}</p>
        )}
        <div className="mt-1 flex items-center justify-between">
          <span className="text-[10px] text-white/30 font-mono">{text.length}/140</span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              disabled={saving}
              className="rounded-lg border border-white/10 px-3 py-1 text-[10px] text-white/50 hover:bg-white/5 transition-colors disabled:opacity-30"
            >
              Cancel
            </button>
            <button
              onClick={() => { if (text.trim()) onSave(text.trim()); }}
              disabled={!text.trim() || saving}
              className="rounded-lg px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white disabled:opacity-30 transition-all hover:shadow-[0_0_12px_rgba(224,64,251,0.3)]"
              style={{ background: text.trim() && !saving ? "linear-gradient(135deg, #e040fb, #f06292)" : "rgba(255,255,255,0.08)" }}
            >
              {saving ? "Engraving..." : "Engrave"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Engraving display overlay ──
function EngravingOverlay({ text, entryId }: { text: string; entryId: number }) {
  const rotation = useMemo(() => engravingRotation(entryId), [entryId]);

  return (
    <div
      className="absolute bottom-1 left-1 right-1 pointer-events-none select-none overflow-hidden px-1.5 py-0.5"
      style={{
        transform: `rotate(${rotation}deg)`,
      }}
    >
      <p
        className="italic leading-tight"
        style={{
          fontSize: "11px",
          color: "rgba(255, 215, 120, 0.55)",
          textShadow: "0 1px 3px rgba(0,0,0,0.7), 0 0 8px rgba(255,200,100,0.15)",
          fontFamily: "'Georgia', 'Times New Roman', serif",
          letterSpacing: "0.02em",
        }}
      >
        &ldquo;{text}&rdquo;
      </p>
      {/* Faint scribble underline */}
      <div
        className="mt-0.5"
        style={{
          height: "1px",
          background: "linear-gradient(90deg, transparent 0%, rgba(255,215,120,0.25) 15%, rgba(255,215,120,0.3) 50%, rgba(255,215,120,0.2) 85%, transparent 100%)",
          transform: `rotate(${rotation > 0 ? -0.5 : 0.5}deg)`,
        }}
      />
    </div>
  );
}

function TrestCard({
  entry,
  walletAddress,
  engraving,
  onEngrave,
}: {
  entry: TrestEntry;
  walletAddress?: string;
  engraving?: string;
  onEngrave: (entryId: number) => void;
}) {
  const [loaded, setLoaded] = useState(false);
  const isCreator =
    !!walletAddress &&
    entry.creator.toLowerCase() === walletAddress.toLowerCase();
  const canEngrave = isCreator && !engraving;

  return (
    <div
      className="group relative overflow-hidden rounded-xl border border-purple-500/15 bg-neutral-900/70 hover:border-purple-500/40 hover:shadow-[0_0_24px_rgba(139,92,246,0.2)] [perspective:600px] hover:[transform:scale(1.03)_rotateY(2deg)_rotateX(-1deg)]"
      style={{ transition: "transform 200ms ease-out, border-color 200ms ease, box-shadow 200ms ease" }}
    >
      <div className="relative aspect-square overflow-hidden bg-neutral-800/40">
        {entry.ipfsCid ? (
          <>
            {!loaded && <div className="absolute inset-0 animate-pulse bg-neutral-800" />}
            <img
              src={cidToUrl(entry.ipfsCid)}
              alt="Gallery entry"
              className={`h-full w-full object-cover transition-opacity duration-500 ${loaded ? "opacity-100" : "opacity-0"}`}
              loading="lazy"
              onLoad={() => setLoaded(true)}
              onError={(e) => tryNextGateway(e.currentTarget, entry.ipfsCid)}
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
        {/* Engraving display */}
        {engraving && <EngravingOverlay text={engraving} entryId={entry.id} />}
      </div>
      <div className="space-y-1 p-2">
        <div className="flex items-center justify-between text-[10px] text-neutral-400">
          <span className="font-mono">{truncateAddress(entry.creator)}</span>
          <span suppressHydrationWarning>{formatTimestamp(entry.placedAt)}</span>
        </div>
        {/* Engrave button — only visible to creator who hasn't engraved yet */}
        {canEngrave && (
          <button
            onClick={() => onEngrave(entry.id)}
            className="mt-1 w-full rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[9px] font-medium uppercase tracking-wider text-white/40 hover:border-purple-500/30 hover:text-white/70 hover:bg-purple-500/10 transition-all"
          >
            &#9998; Engrave
          </button>
        )}
        {/* Show "Engraved" badge if creator has already engraved */}
        {isCreator && engraving && (
          <div className="mt-1 text-center text-[9px] italic text-white/20 tracking-wide">
            &#10003; engraved
          </div>
        )}
      </div>
    </div>
  );
}

export default function GalleryPage() {
  const { address, isConnected } = useAccount();
  const { disconnect, switchWallet } = useSwitchWallet();
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<TrestEntry[]>([]);
  const [engravings, setEngravings] = useState<Record<string, string>>({});
  const [engravingModalId, setEngravingModalId] = useState<number | null>(null);
  const [engraveSaving, setEngraveSaving] = useState(false);
  const [engraveError, setEngraveError] = useState<string | null>(null);
  const [engraveVersion, setEngraveVersion] = useState(0);

  // Load engravings from chain (or localStorage fallback)
  useEffect(() => {
    if (!entries.length) return;

    if (!ENGRAVE_DEPLOYED) {
      setEngravings(loadEngravingsLocal());
      return;
    }

    let alive = true;
    const fetchEngravings = async () => {
      try {
        const entryIds = entries.map((e) => BigInt(e.id));
        const result = await publicClient.readContract({
          address: ENGRAVE_ADDRESS,
          abi: ENGRAVE_ABI,
          functionName: "getEngravings",
          args: [entryIds],
        });
        if (!alive) return;
        const messages = result as string[];
        const map: Record<string, string> = {};
        entries.forEach((e, i) => {
          if (messages[i]) map[String(e.id)] = messages[i];
        });
        setEngravings(map);
      } catch (err) {
        console.error("[gallery] Failed to load engravings from chain:", err);
        // Fall back to localStorage on read failure
        if (alive) setEngravings(loadEngravingsLocal());
      }
    };
    fetchEngravings();
    return () => { alive = false; };
  }, [entries, engraveVersion]);

  const handleEngrave = useCallback((entryId: number) => {
    setEngraveError(null);
    setEngravingModalId(entryId);
  }, []);

  const handleSaveEngraving = useCallback(async (msg: string) => {
    if (engravingModalId === null) return;

    // localStorage fallback when contract not deployed
    if (!ENGRAVE_DEPLOYED) {
      saveEngravingLocal(engravingModalId, msg);
      setEngravings((prev) => ({ ...prev, [String(engravingModalId)]: msg }));
      setEngravingModalId(null);
      return;
    }

    setEngraveSaving(true);
    setEngraveError(null);
    try {
      const walletClient = await getWalletClient();
      const account = walletClient.account ?? (address as `0x${string}`);
      const txHash = await walletClient.writeContract({
        account,
        address: ENGRAVE_ADDRESS,
        abi: ENGRAVE_ABI,
        functionName: "engrave",
        args: [BigInt(engravingModalId), msg],
        chain: walletClient.chain,
      });
      await publicClient.waitForTransactionReceipt({ hash: txHash });
      // Optimistically update local state + trigger refetch
      setEngravings((prev) => ({ ...prev, [String(engravingModalId)]: msg }));
      setEngraveVersion((v) => v + 1);
      setEngravingModalId(null);
    } catch (err: unknown) {
      console.error("[gallery] engrave tx failed:", err);
      const message = err instanceof Error ? err.message : "Transaction failed";
      setEngraveError(message.length > 120 ? message.slice(0, 120) + "..." : message);
    } finally {
      setEngraveSaving(false);
    }
  }, [engravingModalId, address]);

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

  const handleSwitchWallet = switchWallet;

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
                      <TrestCard
                        key={entry.id}
                        entry={entry}
                        walletAddress={address}
                        engraving={engravings[String(entry.id)]}
                        onEngrave={handleEngrave}
                      />
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
      {/* Engraving modal */}
      {engravingModalId !== null && (
        <EngravingModal
          entryId={engravingModalId}
          onClose={() => { if (!engraveSaving) { setEngravingModalId(null); setEngraveError(null); } }}
          onSave={handleSaveEngraving}
          saving={engraveSaving}
          error={engraveError}
        />
      )}
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
