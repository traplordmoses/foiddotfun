"use client";

export function VoteBar({ forCount, againstCount, showThreshold }: { forCount: number; againstCount: number; showThreshold?: boolean }) {
  const total = forCount + againstCount;
  if (total === 0 && !showThreshold) return null;
  const pct = total > 0 ? Math.round((forCount / total) * 100) : 0;
  const passing = pct >= 51;
  return (
    <div className="flex flex-col gap-1" role="group" aria-label="Vote tally">
      <div className="flex items-center gap-1.5 text-[9px]">
        <span className="text-green-400 font-semibold">{forCount}</span>
        <div
          className="relative flex h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-800"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${pct}% approval: ${forCount} for, ${againstCount} against`}
        >
          {total > 0 && (
            <>
              <div className="bg-green-500 transition-all duration-500" style={{ width: `${(forCount / total) * 100}%` }} />
              <div className="bg-red-500 transition-all duration-500" style={{ width: `${(againstCount / total) * 100}%` }} />
            </>
          )}
          <div className="absolute top-0 bottom-0 w-px bg-white/40" style={{ left: "51%" }} />
        </div>
        <span className="text-red-400 font-semibold">{againstCount}</span>
      </div>
      {showThreshold && total > 0 && (
        <div className="flex items-center justify-between text-[9px]">
          <span className={passing ? "text-green-400" : "text-amber-400"}>
            {pct}% for {passing ? "— passing" : ""} <span className="text-white/30">(need 51%)</span>
          </span>
        </div>
      )}
    </div>
  );
}
