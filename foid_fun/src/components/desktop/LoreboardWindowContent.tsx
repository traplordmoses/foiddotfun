"use client";

import Link from "next/link";
import { useEpochCountdown } from "@/hooks/useEpochCountdown";

export default function LoreboardWindowContent() {
  const { enabled, index, remainingMs } = useEpochCountdown();

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    if (seconds <= 0) return "Epoch ending...";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}m remaining`;
    return `${m}m remaining`;
  };

  return (
    <div className="h-full flex flex-col items-center justify-center p-4 text-center">
      {/* Icon/Visual */}
      <div className="text-5xl mb-4">🎨</div>

      {/* Title */}
      <h2 className="font-primary text-xl font-bold uppercase tracking-wider text-white mb-2">
        Loreboard
      </h2>

      {/* Description */}
      <p className="text-sm text-white/70 mb-4 max-w-[240px]">
        Collaborative vision board. Place your mark. Vote on culture.
      </p>

      {/* Epoch Info */}
      {enabled && (
        <div className="flex flex-col items-center gap-1 mb-4 px-3 py-2 bg-foid-midnight/50 rounded-lg border border-foid-periw/30">
          <span className="text-xs text-white/50 uppercase tracking-wider">
            Epoch {index}
          </span>
          {remainingMs > 0 && (
            <span className="font-terminal text-sm text-foid-periw">
              {formatTime(remainingMs)}
            </span>
          )}
        </div>
      )}

      {/* Enter Button */}
      <Link
        href="/board"
        className="group relative px-8 py-3 rounded-xl font-bold uppercase tracking-wider text-foid-midnight
                   bg-gradient-to-r from-foid-periw via-foid-lav to-foid-candy
                   shadow-[0_4px_0_rgba(0,0,0,0.2),0_0_20px_rgba(143,170,242,0.3)]
                   hover:-translate-y-0.5 hover:shadow-[0_6px_0_rgba(0,0,0,0.2),0_0_30px_rgba(143,170,242,0.5)]
                   active:translate-y-0 active:shadow-[0_2px_0_rgba(0,0,0,0.2)]
                   transition-all duration-150"
      >
        <span className="relative z-10">Open Canvas</span>
      </Link>
    </div>
  );
}
