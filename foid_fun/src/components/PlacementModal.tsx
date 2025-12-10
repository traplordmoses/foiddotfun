import { useMemo, useState } from "react";
import { ipfsToHttp } from "@/lib/ipfsUrl";
import type { Placement } from "./PlacementCard";

type Props = {
  placement: Placement;
  onClose: () => void;
};

export function PlacementModal({ placement, onClose }: Props) {
  const { cid, name } = placement;
  const urls = useMemo(() => ipfsToHttp(cid), [cid]);
  const [gatewayIdx, setGatewayIdx] = useState(0);
  const src = urls[gatewayIdx] ?? `https://ipfs.io/ipfs/${cid}`;

  const handleError = () => {
    const next = gatewayIdx + 1;
    if (next < urls.length) setGatewayIdx(next);
  };

  return (
    <div
      className="
        fixed inset-0 z-40 flex items-center justify-center
        bg-black/60 backdrop-blur-sm
      "
      onClick={onClose}
    >
      <div
        className="
          relative max-h-[90vh] max-w-[90vw] text-white
        "
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between text-xs text-white/70">
          <span>FOID LORE</span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md bg-white/10 px-2 py-1 hover:bg-white/20 transition"
          >
            close
          </button>
        </div>

        {/* animated Frutiger Aero border around the image */}
        <div
          className="
            rounded-3xl p-[2px]
            bg-[length:200%_200%]
            bg-gradient-to-r from-cyan-300 via-sky-400 to-indigo-500
            animate-aero-border
            shadow-[0_0_40px_rgba(56,189,248,0.45)]
          "
        >
          <div className="relative aspect-video max-h-[70vh] w-[70vw] rounded-[22px] overflow-hidden bg-black/70">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={name ?? ""}
              className="absolute inset-0 h-full w-full object-contain"
              onError={handleError}
              referrerPolicy="no-referrer"
            />
          </div>
        </div>

      </div>
    </div>
  );
}
