"use client";

import React, { useState, type MouseEvent as ReactMouseEvent } from "react";

// ============================================================================
// TYPES
// ============================================================================

export type Y2kActionButtonProps = {
  onClick: () => void;
  label: string;
  disabled?: boolean;
  variant?: "primary" | "secondary";
  className?: string;
};

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * Y2K-style glass action button with mouse tracking highlight effect
 *
 * Features:
 * - Pink glass pill design
 * - Mouse position tracking for dynamic highlights
 * - Primary/secondary variants
 * - Disabled state handling
 * - Smooth hover transitions
 */
export function Y2kActionButton({
  onClick,
  label,
  disabled = false,
  variant = "primary",
  className = "",
}: Y2kActionButtonProps) {
  const [mousePos, setMousePos] = useState({ x: 0.5, y: 0.5 });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = (e: ReactMouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    setMousePos({ x, y });
  };

  const variantClass = variant === "secondary" ? "y2k-btn--secondary" : "";
  const disabledClass = disabled ? "y2k-btn--disabled" : "";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onMouseMove={handleMouseMove}
      className={`y2k-btn ${variantClass} ${disabledClass} ${className}`.trim()}
    >
      {/* Base reflection layer */}
      <span className="y2k-btn__reflection" />

      {/* Dynamic mouse-tracking highlight */}
      {isHovered && !disabled && (
        <span
          className="y2k-btn__highlight"
          style={{
            background: `radial-gradient(ellipse 70% 90% at ${mousePos.x * 100}% ${mousePos.y * 100}%, rgba(255,255,255,0.5) 0%, transparent 65%)`,
          }}
        />
      )}

      {/* Button label */}
      <span className="y2k-btn__label">{label}</span>
    </button>
  );
}
