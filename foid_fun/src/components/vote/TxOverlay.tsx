"use client";

export function TxOverlay({ stage, progress, total }: { stage: "preparing" | "confirm" | "broadcasting" | "done"; progress: number; total: number }) {
  const steps = [
    { key: "preparing", label: "Preparing transaction...", icon: "..." },
    { key: "confirm", label: "Confirm in your wallet", icon: "\u{1F4B3}" },
    { key: "broadcasting", label: `Submitting vote ${progress} of ${total}...`, icon: "\u{1F4E1}" },
    { key: "done", label: "Confirmed!", icon: "\u2713" },
  ];
  const activeIdx = steps.findIndex((s) => s.key === stage);

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,.6)", backdropFilter: "blur(8px)" }}
      role="alertdialog"
      aria-busy={stage !== "done"}
      aria-label="Processing votes"
    >
      <div className="w-full max-w-xs rounded-2xl border border-white/10 bg-neutral-900/90 backdrop-blur-xl p-6 space-y-4">
        <h3 className="text-center text-sm font-bold text-white/80 mb-4">Processing Votes</h3>
        <div aria-live="polite">
          {steps.map((step, i) => {
            const isActive = i === activeIdx;
            const isDone = i < activeIdx;
            return (
              <div key={step.key} className="flex items-center gap-3 mb-4 last:mb-0">
                <div
                  className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold transition-all duration-300 ${
                    isDone ? "bg-green-500/20 text-green-400 border border-green-500/30"
                    : isActive ? "bg-purple-500/20 text-purple-300 border border-purple-500/40"
                    : "bg-white/5 text-white/20 border border-white/10"
                  }`}
                  style={isActive ? { animation: "step-pulse 1.5s ease-in-out infinite" } : {}}
                  aria-hidden="true"
                >
                  {isDone ? "\u2713" : step.icon}
                </div>
                <span className={`text-xs font-medium transition-colors ${
                  isDone ? "text-green-400/70" : isActive ? "text-white/80" : "text-white/25"
                }`}>{step.label}</span>
              </div>
            );
          })}
        </div>
        {total > 1 && (
          <div className="mt-3 h-1.5 rounded-full bg-neutral-800 overflow-hidden" role="progressbar" aria-valuenow={progress} aria-valuemax={total} aria-label={`${progress} of ${total} votes submitted`}>
            <div className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-500 rounded-full"
              style={{ width: `${total > 0 ? (progress / total) * 100 : 0}%` }} />
          </div>
        )}
      </div>
    </div>
  );
}
