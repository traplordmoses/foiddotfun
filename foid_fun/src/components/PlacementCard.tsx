import { useMemo, useState } from "react";
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
};

export function PlacementCard({ placement, onOpen, frameStyle }: Props) {
  const { cid, x, y, width, height, name } = placement;
  const urls = useMemo(() => ipfsToHttp(cid), [cid]);
  const [gatewayIdx, setGatewayIdx] = useState(0);
  const src = urls[gatewayIdx] ?? `https://ipfs.io/ipfs/${cid}`;

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
          loading="lazy"
          decoding="async"
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
      </button>
    </div>
  );
}
