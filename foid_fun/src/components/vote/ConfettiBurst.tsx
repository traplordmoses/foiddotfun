"use client";

export function ConfettiBurst({ active }: { active: boolean }) {
  if (!active) return null;
  const pieces = Array.from({ length: 40 }, (_, i) => ({
    id: i, left: Math.random() * 100,
    color: ["#fbbf24","#a78bfa","#22c55e","#f472b6","#06b6d4","#e879f9"][i % 6],
    delay: Math.random() * 800, size: 4 + Math.random() * 4, duration: 2000 + Math.random() * 1500,
  }));
  return (
    <div aria-hidden="true" style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 60 }}>
      {pieces.map((p) => (
        <div key={p.id} style={{
          position: "absolute", top: 0, left: `${p.left}%`,
          width: p.size, height: p.size * 1.5, backgroundColor: p.color, borderRadius: 1,
          animation: `confetti-fall ${p.duration}ms ease-in forwards`,
          animationDelay: `${p.delay}ms`, opacity: 0,
        }} />
      ))}
    </div>
  );
}
