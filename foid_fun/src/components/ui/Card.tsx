// src/components/ui/Card.tsx
// Glass surface primitive — the panel elevation of the shared material
// (see tokens.css "GLASS MATERIAL"). Use this instead of ad-hoc
// rgba+backdrop-filter combos so every card on the site is the same glass.
//
//   <Card>…</Card>                    // panel elevation (default)
//   <Card elevation="window">…</Card> // heavier window-frame elevation
"use client";

import React from "react";

export type CardElevation = "panel" | "window";

export type CardProps = {
  children: React.ReactNode;
  /** panel = inner surface (default) · window = outer-frame weight */
  elevation?: CardElevation;
  className?: string;
} & Omit<React.HTMLAttributes<HTMLDivElement>, "className">;

export function Card({
  children,
  elevation = "panel",
  className = "",
  ...rest
}: CardProps) {
  return (
    <div
      className={`foid-card foid-card--${elevation} ${className}`.trim()}
      {...rest}
    >
      {children}
    </div>
  );
}
