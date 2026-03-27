import { useMemo, useState, useCallback } from "react";
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
  flagLabel?: string;
};

export function PlacementCard({ placement, onOpen, frameStyle, onFlag, isFlagged, flagLabel }: Props) {
  const { cid, x, y, width, height, name } = placement;
  const urls = useMemo(() => ipfsToHttp(cid), [cid]);
  const [gatewayIdx, setGatewayIdx] = useState(0);
  const [flagging, setFlagging] = useState(false);
  const src = urls[gatewayIdx] ?? `https://ipfs.io/ipfs/${cid}`;

  const handleFlag = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!onFlag || isFlagged || flagging) return;
    setFlagging(true);
    try {
      await onFlag(placement.id);
    } finally {
      setFlagging(false);
    }
  }, [onFlag, isFlagged, flagging, placement.id]);

  const handleError = () => {
    const next = gatewayIdx + 1;
    if (next < urls.length) setGatewayIdx(next);
  };

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
              onClick={(e) => void handleFlag(e)}
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
    </div>
  );
}
