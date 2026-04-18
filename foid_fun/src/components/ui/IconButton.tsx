// src/components/ui/IconButton.tsx
// Small icon-only button (⠿ move / ↘ resize / × remove / ↺ retry). Always
// accepts a required `label` so screen readers have a name even when the
// visible content is a glyph, and focus-ring styles default on for keyboard.
"use client";

import React from "react";

export type IconButtonProps = {
  /** Visible glyph / icon. Hidden from assistive tech (label covers it). */
  icon: React.ReactNode;
  /** Required accessible name. Read by screen readers. */
  label: string;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  /** Pointer-down handler for drag/resize starts (PendingItemCard pattern). */
  onPointerDown?: (e: React.PointerEvent<HTMLButtonElement>) => void;
  /** Visual size preset. Defaults to 28px square. */
  size?: "sm" | "md" | "lg";
  /** Native title attribute — cheap tooltip for sighted keyboard users. */
  title?: string;
  disabled?: boolean;
  tone?: "neutral" | "danger";
  className?: string;
  style?: React.CSSProperties;
};

const SIZE_PX: Record<NonNullable<IconButtonProps["size"]>, number> = {
  sm: 22,
  md: 28,
  lg: 32,
};

export function IconButton({
  icon,
  label,
  onClick,
  onPointerDown,
  size = "md",
  title,
  disabled,
  tone = "neutral",
  className,
  style,
}: IconButtonProps) {
  const dim = SIZE_PX[size];
  const hoverBg =
    tone === "danger" ? "rgba(255, 71, 87, 0.5)" : "rgba(116, 255, 235, 0.2)";
  return (
    <button
      type="button"
      aria-label={label}
      title={title ?? label}
      disabled={disabled}
      onClick={onClick}
      onPointerDown={onPointerDown}
      className={`ui-icon-btn${className ? ` ${className}` : ""}`}
      style={{
        width: dim,
        height: dim,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: "var(--foid-radius-sm)",
        background: "rgba(0, 0, 0, 0.6)",
        color: "var(--foid-text)",
        border: "1px solid var(--foid-border-mute)",
        fontSize: 12,
        lineHeight: 1,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        transition: "background var(--foid-motion-fast) ease, border-color var(--foid-motion-fast) ease, transform var(--foid-motion-fast) ease",
        ...style,
      }}
      onMouseEnter={(e) => {
        if (!disabled) e.currentTarget.style.background = hoverBg;
      }}
      onMouseLeave={(e) => {
        if (!disabled) e.currentTarget.style.background = "rgba(0, 0, 0, 0.6)";
      }}
    >
      <span aria-hidden="true" className="ui-icon-btn__icon">
        {icon}
      </span>
    </button>
  );
}
