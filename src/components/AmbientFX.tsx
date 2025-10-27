"use client";
export default function AmbientFX() {
  // purely decorative, behind everything
  return (
    <div className="ambient pointer-events-none">
      <div className="ambient-glow" />
      <div className="ambient-grain" />
    </div>
  );
}
