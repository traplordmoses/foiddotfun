// src/components/ui/StatusDot.tsx
// Tiny animated indicator for online/offline/pending states. Extracted from
// the inline .board-section__dot + .pray-status-dot patterns so future
// headers/toolbars can drop it in without re-inventing the pulse animation.
"use client";

import React from "react";

export type StatusDotProps = {
  status: "online" | "offline" | "pending";
  size?: "sm" | "md";
  /**
   * When true, screen readers announce the status via the accessible name.
   * Default is aria-hidden so the dot stays a pure decorative indicator and
   * a sibling text label (e.g. "CONNECTED") carries the real a11y info.
   */
  announce?: boolean;
  className?: string;
};

const SIZE_PX: Record<NonNullable<StatusDotProps["size"]>, number> = {
  sm: 6,
  md: 7,
};

const COLOR_VAR: Record<StatusDotProps["status"], string> = {
  online: "var(--foid-cyan)",
  offline: "var(--foid-text-mute)",
  pending: "var(--foid-gold)",
};

export function StatusDot({
  status,
  size = "md",
  announce = false,
  className,
}: StatusDotProps) {
  const dim = SIZE_PX[size];
  const color = COLOR_VAR[status];
  const isOnline = status === "online";
  return (
    <span
      className={`ui-status-dot${className ? ` ${className}` : ""}`}
      aria-hidden={announce ? undefined : true}
      role={announce ? "status" : undefined}
      aria-label={announce ? status : undefined}
      style={{
        display: "inline-block",
        width: dim,
        height: dim,
        borderRadius: "50%",
        background: color,
        boxShadow: isOnline
          ? "0 0 6px var(--tone-info-glow), 0 0 12px var(--foid-accent-soft)"
          : "none",
        animation: isOnline ? "ui-status-dot-pulse 2s ease-in-out infinite" : "none",
        verticalAlign: "middle",
      }}
    >
      <style jsx>{`
        @keyframes ui-status-dot-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(0.85); }
        }
        @media (prefers-reduced-motion: reduce) {
          .ui-status-dot {
            animation: none !important;
          }
        }
      `}</style>
    </span>
  );
}
