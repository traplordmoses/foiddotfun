// src/components/ui/Chip.tsx
// Small rounded pill with an optional leading icon. Replaces the
// .board-section__chip + inline status-pill patterns used across the board
// sidebar, BoardActions, and PlacementModal.
//
// Variants:
//   - default  → neutral cyan-tinted pill (the FEE chip)
//   - neon     → brighter cyan border + stronger glow (LIVE / ACTIVE)
//   - warning  → amber border (STALE / OFFLINE)
"use client";

import React from "react";

export type ChipVariant = "default" | "neon" | "warning";

export type ChipProps = {
  children: React.ReactNode;
  icon?: React.ReactNode;
  /** Native tooltip. Not a substitute for visible text — use sparingly. */
  title?: string;
  variant?: ChipVariant;
  className?: string;
};

const VARIANT_STYLE: Record<ChipVariant, React.CSSProperties> = {
  default: {
    border: "1px solid var(--foid-border-subtle)",
    background: "var(--foid-panel)",
    color: "var(--foid-text-dim)",
    boxShadow: "var(--foid-shadow-chip)",
  },
  neon: {
    border: "1px solid var(--foid-border-strong)",
    background: "var(--tone-info-bg)",
    color: "var(--tone-info-text)",
    boxShadow: "0 0 10px var(--tone-info-glow)",
  },
  warning: {
    border: "1px solid var(--tone-warn-border)",
    background: "var(--tone-warn-bg)",
    color: "var(--tone-warn-text)",
    boxShadow: "0 0 10px var(--tone-warn-glow)",
  },
};

export function Chip({
  children,
  icon,
  title,
  variant = "default",
  className,
}: ChipProps) {
  return (
    <span
      className={`ui-chip${className ? ` ${className}` : ""}`}
      title={title}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: icon ? 4 : 0,
        padding: "1px 8px",
        borderRadius: "var(--foid-radius-pill)",
        fontFamily: "var(--font-terminal, ui-monospace, monospace)",
        fontSize: 9,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        backdropFilter: "blur(12px)",
        ...VARIANT_STYLE[variant],
      }}
    >
      {icon && (
        <span className="ui-chip__icon" aria-hidden="true">
          {icon}
        </span>
      )}
      <span className="ui-chip__label">{children}</span>
    </span>
  );
}
