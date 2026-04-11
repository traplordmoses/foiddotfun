"use client";

import { useEffect, useState } from "react";
import { playVictoryChord, playReward } from "@/lib/sfx";
import { CHAIN_CONFIG } from "@/lib/contracts/addresses";

export function VictoryCelebration({ count, txHashes, onDismiss }: { count: number; txHashes: string[]; onDismiss: () => void }) {
  const [particles] = useState(() =>
    Array.from({ length: 60 }, (_, i) => ({
      id: i,
      x: (Math.random() - 0.5) * 500,
      y: (Math.random() - 0.5) * 500 - 200,
      color: ["#fbbf24","#a78bfa","#22c55e","#06b6d4","#f472b6","#e879f9"][i % 6],
      size: 4 + Math.random() * 6,
      delay: Math.random() * 400,
      duration: 800 + Math.random() * 600,
    }))
  );
  const [shown, setShown] = useState(false);

  useEffect(() => {
    setShown(true);
    playVictoryChord();
    setTimeout(() => playReward(), 400);
    const t = setTimeout(onDismiss, 5000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,.5)", backdropFilter: "blur(6px)" }} onClick={onDismiss} role="alert" aria-live="assertive">
      {/* Particles */}
      <div aria-hidden="true" style={{ position: "absolute", top: "50%", left: "50%", pointerEvents: "none" }}>
        {particles.map((p) => (
          <div key={p.id} style={{
            position: "absolute", width: p.size, height: p.size, borderRadius: "50%",
            backgroundColor: p.color, boxShadow: `0 0 10px ${p.color}`,
            "--vx": `${p.x}px`, "--vy": `${p.y}px`,
            animation: `victory-particle ${p.duration}ms cubic-bezier(0.25,0.46,0.45,0.94) forwards`,
            animationDelay: `${p.delay}ms`, opacity: 0,
          } as React.CSSProperties} />
        ))}
      </div>

      <div className="relative z-10 text-center px-6" style={{ opacity: shown ? 1 : 0, transition: "opacity 0.5s ease" }}>
        <div className="text-5xl mb-4" style={{ animation: "count-up 600ms ease-out forwards" }} aria-hidden="true">
          {count === 1 ? "\u2694\uFE0F" : "\u{1F525}"}
        </div>
        <div className="text-3xl font-black text-white mb-1" style={{ animation: "count-up 600ms ease-out 200ms both" }}>
          {count} {count === 1 ? "VOTE" : "VOTES"} CAST
        </div>
        <p className="text-sm text-white/50 mb-4" style={{ animation: "count-up 600ms ease-out 400ms both" }}>
          Your voice shapes the loreboard
        </p>
        {txHashes.length > 0 && (
          <div className="flex flex-wrap justify-center gap-2 mb-4" style={{ animation: "count-up 600ms ease-out 600ms both" }}>
            {txHashes.map((h, i) => (
              <a key={i} href={`${CHAIN_CONFIG.blockExplorer}/tx/${h}`} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-full bg-white/5 border border-white/10 px-3 py-1 text-[10px] font-mono text-purple-300 hover:bg-white/10 transition">
                {h.slice(0, 6)}...{h.slice(-4)} <span className="text-white/30">&rarr;</span>
              </a>
            ))}
          </div>
        )}
        <button onClick={onDismiss}
          className="text-xs text-white/30 hover:text-white/60 transition" style={{ animation: "count-up 600ms ease-out 800ms both" }}>
          click anywhere to continue
        </button>
      </div>
    </div>
  );
}
