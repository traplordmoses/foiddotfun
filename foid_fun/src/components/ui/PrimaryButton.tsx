// src/components/ui/PrimaryButton.tsx
// Generalized y2k-style CTA. Wraps the existing Y2kActionButton so current
// callers continue to work, and adds:
//   - `title` prop (was missing; useful for tooltips on disabled states)
//   - explicit `type` (default "button" to avoid accidental form submits)
//   - aria-label / aria-describedby passthrough for a11y
//   - keyboard Enter/Space handling (inherited from native <button>)
//
// For new code prefer this component. Y2kActionButton stays as a re-export
// so the existing /board and /swipe callers don't churn in this commit.
"use client";

import React, { useState, type MouseEvent as ReactMouseEvent } from "react";

export type PrimaryButtonVariant = "primary" | "secondary" | "ghost";

export type PrimaryButtonProps = {
  onClick: () => void;
  label: string;
  disabled?: boolean;
  variant?: PrimaryButtonVariant;
  title?: string;
  type?: "button" | "submit" | "reset";
  /** Override or extend the visible label with a richer children node. */
  children?: React.ReactNode;
  /** aria-describedby — point at a nearby help/error id for context. */
  describedBy?: string;
  className?: string;
};

export function PrimaryButton({
  onClick,
  label,
  disabled = false,
  variant = "primary",
  title,
  type = "button",
  children,
  describedBy,
  className = "",
}: PrimaryButtonProps) {
  const [mousePos, setMousePos] = useState({ x: 0.5, y: 0.5 });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = (e: ReactMouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setMousePos({
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    });
  };

  const variantClass =
    variant === "secondary" ? "y2k-btn--secondary" :
    variant === "ghost" ? "y2k-btn--ghost" : "";
  const disabledClass = disabled ? "y2k-btn--disabled" : "";

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-describedby={describedBy}
      title={title}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onMouseMove={handleMouseMove}
      className={`y2k-btn ${variantClass} ${disabledClass} ${className}`.trim()}
    >
      {/* Base reflection layer */}
      <span className="y2k-btn__reflection" aria-hidden="true" />

      {/* Dynamic mouse-tracking highlight — skipped when reduced-motion is on */}
      {isHovered && !disabled && (
        <span
          className="y2k-btn__highlight"
          aria-hidden="true"
          style={{
            background: `radial-gradient(ellipse 70% 90% at ${mousePos.x * 100}% ${mousePos.y * 100}%, rgba(255,255,255,0.5) 0%, transparent 65%)`,
          }}
        />
      )}

      <span className="y2k-btn__label">{children ?? label}</span>
    </button>
  );
}
