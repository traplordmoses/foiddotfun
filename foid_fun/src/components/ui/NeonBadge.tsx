// src/components/ui/NeonBadge.tsx
// Status badge with a tone-based color palette. Extracted from the
// BADGE_SPEC/TONE_STYLES tables that were duplicated inline in
// PendingItemCard (and echoed in PlacementModal's STATUS_STYLES).
//
// Tones map to CSS tokens in tokens.css — any global contrast / brand
// adjustment happens there, not here.
"use client";

import React from "react";

export type NeonBadgeTone = "info" | "ok" | "warn" | "err";

export type NeonBadgeProps = {
  tone?: NeonBadgeTone;
  children: React.ReactNode;
  className?: string;
  /**
   * When true the badge participates in the live-region announcement flow
   * (aria-live="polite"). Use this on status that matters — confirmed,
   * failed, signing. Omit for decorative / static labels.
   */
  live?: boolean;
  style?: React.CSSProperties;
};

const TONE_STYLE: Record<NeonBadgeTone, React.CSSProperties> = {
  info: {
    background: "var(--tone-info-bg)",
    border: "1px solid var(--tone-info-border)",
    color: "var(--tone-info-text)",
    boxShadow: "0 0 12px var(--tone-info-glow)",
  },
  ok: {
    background: "var(--tone-ok-bg)",
    border: "1px solid var(--tone-ok-border)",
    color: "var(--tone-ok-text)",
    boxShadow: "0 0 12px var(--tone-ok-glow)",
  },
  warn: {
    background: "var(--tone-warn-bg)",
    border: "1px solid var(--tone-warn-border)",
    color: "var(--tone-warn-text)",
    boxShadow: "0 0 12px var(--tone-warn-glow)",
  },
  err: {
    background: "var(--tone-err-bg)",
    border: "1px solid var(--tone-err-border)",
    color: "var(--tone-err-text)",
    boxShadow: "0 0 12px var(--tone-err-glow)",
  },
};

export function NeonBadge({
  tone = "info",
  children,
  className,
  live,
  style,
}: NeonBadgeProps) {
  return (
    <span
      className={`ui-neon-badge${className ? ` ${className}` : ""}`}
      role={live ? "status" : undefined}
      aria-live={live ? "polite" : undefined}
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "3px 8px",
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: "0.12em",
        fontFamily: "var(--font-terminal, ui-monospace, monospace)",
        borderRadius: "var(--foid-radius-sm)",
        textTransform: "uppercase",
        ...TONE_STYLE[tone],
        ...style,
      }}
    >
      {children}
    </span>
  );
}
