import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import { ipfsToHttp } from "@/lib/ipfsUrl";

export type Placement = {
  id: string;
  cid: string;
  x: number;
  y: number;
  width: number;
  height: number;
  name?: string;
  description?: string;
  proposer?: `0x${string}`;
  epochId?: number | null;

  // Optional voting/status metadata
  status?: "proposed" | "accepted" | "rejected" | "expired" | "voting" | "canonized";
  yesVotes?: number;
  noVotes?: number;
  voters?: number;
  percentYes?: number;       // 0..1
  secondsLeft?: number;
  voteEndsAt?: number;
  epochSubmitted?: number;
  cells?: number;
};

type Props = {
  placement: Placement;
  onOpen: (placement: Placement) => void;
  frameStyle?: React.CSSProperties;
  onFlag?: (placementId: string) => Promise<void>;
  isFlagged?: boolean;
  flagCount?: number;
  flagThreshold?: number;
  flagLabel?: string;
};

/* ── Flag Confirmation Modal ──────────────────────────────────────── */

function FlagConfirmModal({
  flagLabel,
  onConfirm,
  onCancel,
}: {
  flagLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <>
      <div className="fc-backdrop" onClick={onCancel} />
      <div className="fc-modal" onClick={(e) => e.stopPropagation()}>
        <div className="fc-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
            <line x1="4" y1="22" x2="4" y2="15"/>
          </svg>
        </div>
        <p className="fc-title">Flag this placement?</p>
        <p className="fc-body">
          This costs <strong>{flagLabel}</strong> and cannot be undone.
          After 3 flags, a community removal vote begins.
        </p>
        <div className="fc-actions">
          <button type="button" className="fc-btn fc-btn--cancel" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="fc-btn fc-btn--confirm" onClick={onConfirm}>
            Flag
          </button>
        </div>
      </div>
      <style jsx>{`
        .fc-backdrop {
          position: fixed; inset: 0; z-index: 200;
          background: rgba(0,0,0,0.5);
          backdrop-filter: blur(3px);
          animation: fc-fade 150ms ease;
        }
        @keyframes fc-fade { from { opacity: 0; } }
        .fc-modal {
          position: fixed; z-index: 201;
          top: 50%; left: 50%; transform: translate(-50%, -50%);
          width: min(320px, calc(100vw - 32px));
          background: linear-gradient(180deg, rgba(20,10,30,0.97), rgba(12,6,20,0.99));
          border: 1px solid rgba(239,68,68,0.25);
          border-radius: 16px;
          padding: 24px;
          display: flex; flex-direction: column; align-items: center; gap: 12px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.6), 0 0 30px rgba(239,68,68,0.1);
          animation: fc-pop 200ms cubic-bezier(.16,.86,.22,1);
        }
        @keyframes fc-pop { from { transform: translate(-50%, -50%) scale(0.95); opacity: 0; } }
        .fc-icon {
          color: rgba(239,68,68,0.8);
          width: 40px; height: 40px;
          display: flex; align-items: center; justify-content: center;
          background: rgba(239,68,68,0.1);
          border-radius: 12px;
        }
        .fc-title {
          font-family: var(--font-mono, monospace);
          font-size: 14px; font-weight: 700;
          letter-spacing: 0.1em; text-transform: uppercase;
          color: rgba(255,255,255,0.9);
          margin: 0;
        }
        .fc-body {
          font-family: var(--font-mono, monospace);
          font-size: 11px; line-height: 1.5;
          color: rgba(255,255,255,0.5);
          text-align: center; margin: 0;
        }
        .fc-body strong { color: rgba(239,68,68,0.9); }
        .fc-actions {
          display: flex; gap: 10px; width: 100%; margin-top: 4px;
        }
        .fc-btn {
          flex: 1; padding: 8px 0; border-radius: 10px;
          font-family: var(--font-mono, monospace);
          font-size: 11px; font-weight: 700;
          letter-spacing: 0.12em; text-transform: uppercase;
          cursor: pointer; transition: all 150ms;
        }
        .fc-btn--cancel {
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.15);
          color: rgba(255,255,255,0.5);
        }
        .fc-btn--cancel:hover { background: rgba(255,255,255,0.1); color: rgba(255,255,255,0.7); }
        .fc-btn--confirm {
          background: rgba(239,68,68,0.15);
          border: 1px solid rgba(239,68,68,0.4);
          color: rgba(239,68,68,0.9);
        }
        .fc-btn--confirm:hover { background: rgba(239,68,68,0.25); }
      `}</style>
    </>
  );
}

/* ── PlacementCard ────────────────────────────────────────────────── */

export function PlacementCard({
  placement,
  onOpen,
  frameStyle,
  onFlag,
  isFlagged,
  flagCount = 0,
  flagThreshold = 3,
  flagLabel,
}: Props) {
  const { cid, x, y, width, height, name } = placement;
  const urls = useMemo(() => ipfsToHttp(cid), [cid]);
  const [gatewayIdx, setGatewayIdx] = useState(0);
  const [flagging, setFlagging] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const src = urls[gatewayIdx] ?? `https://ipfs.io/ipfs/${cid}`;

  const handleFlagClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!onFlag || isFlagged || flagging) return;
    setShowConfirm(true);
  }, [onFlag, isFlagged, flagging]);

  const handleFlagConfirm = useCallback(async () => {
    setShowConfirm(false);
    if (!onFlag || isFlagged || flagging) return;
    setFlagging(true);
    try {
      await onFlag(placement.id);
    } finally {
      setFlagging(false);
    }
  }, [onFlag, isFlagged, flagging, placement.id]);

  const [loaded, setLoaded] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const handleError = () => {
    setLoaded(false);
    const next = gatewayIdx + 1;
    if (next < urls.length) setGatewayIdx(next);
  };

  const handleLoad = () => {
    setLoaded(true);
    if (timerRef.current) clearTimeout(timerRef.current);
  };

  // Timeout fallback — if image doesn't load within 6s, try next gateway
  useEffect(() => {
    setLoaded(false);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (!loaded) {
        const next = gatewayIdx + 1;
        if (next < urls.length) setGatewayIdx(next);
      }
    }, 6000);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gatewayIdx, urls.length]);

  return (
    <div
      className="absolute"
      style={{
        left: x,
        top: y,
        width,
        height,
      }}
    >
      <button
        type="button"
        aria-label={name ? `View ${name}` : "View placement"}
        onClick={() => onOpen(placement)}
        className="
          group relative h-full w-full overflow-hidden rounded-xl
          transition-transform duration-150 ease-out
          will-change-transform
          hover:scale-[1.03] hover:-translate-y-0.5 hover:-rotate-0.5
          hover:shadow-2xl
          focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300/80
        "
        style={frameStyle}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={name ?? ""}
          className="absolute inset-0 h-full w-full object-cover pointer-events-none"
          loading="eager"
          decoding="sync"
          onLoad={handleLoad}
          onError={handleError}
          referrerPolicy="no-referrer"
        />

        {/* long-hover Frutiger Aero aura */}
        <div
          className="
            pointer-events-none absolute inset-[-18%]
            opacity-0 group-hover:opacity-40
            transition-opacity duration-500 delay-300
            bg-[length:200%_200%]
            bg-gradient-to-r from-cyan-300 via-sky-400 to-indigo-500
            animate-aero-border
            blur-2xl mix-blend-screen
          "
        />

        {/* hover label */}
        <div
          className="
            pointer-events-none absolute bottom-1 left-1
            rounded-md bg-black/60 px-2 py-1 text-[10px]
            text-white/80 opacity-0
            transition-opacity duration-200 delay-200
            group-hover:opacity-100
          "
        >
          hold to inspect
        </div>

        {/* Flag count badge — always visible when flagCount > 0 */}
        {flagCount > 0 && (
          <div
            className="
              absolute top-1 left-1 z-10
              flex items-center gap-1
              rounded-md px-1.5 py-0.5
              text-[8px] font-mono font-bold leading-tight
              bg-red-900/80 text-red-200
              border border-red-500/40
              backdrop-blur-sm
            "
            title={`${flagCount} of ${flagThreshold} flags — removal vote at ${flagThreshold}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
              <line x1="4" y1="22" x2="4" y2="15"/>
            </svg>
            {flagCount}/{flagThreshold}
          </div>
        )}

        {/* Flag button - appears on hover */}
        {onFlag && (
          <div
            className="
              absolute top-1 right-1 z-10
              opacity-0 group-hover:opacity-100
              transition-opacity duration-200
              pointer-events-auto
            "
          >
            <button
              type="button"
              onClick={(e) => void handleFlagClick(e)}
              disabled={isFlagged || flagging}
              title={isFlagged ? "Already flagged" : (flagLabel ?? "Flag (0.001 ETH)")}
              className="
                flex items-center gap-1
                rounded-md px-1.5 py-0.5
                text-[9px] font-mono leading-tight
                transition-colors duration-150
                bg-red-900/70 text-red-200 hover:bg-red-700/80 hover:text-white
                disabled:opacity-50 disabled:cursor-not-allowed
                border border-red-500/40
                backdrop-blur-sm
              "
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
                <line x1="4" y1="22" x2="4" y2="15"/>
              </svg>
              {flagging ? "..." : isFlagged ? "Flagged" : "Flag"}
            </button>
          </div>
        )}
      </button>

      {/* Confirmation modal */}
      {showConfirm && (
        <FlagConfirmModal
          flagLabel={flagLabel ?? "0.001 ETH"}
          onConfirm={() => void handleFlagConfirm()}
          onCancel={() => setShowConfirm(false)}
        />
      )}
    </div>
  );
}
