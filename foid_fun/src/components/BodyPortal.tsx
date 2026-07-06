"use client";

// src/components/BodyPortal.tsx
// Mounts children at <body> level — null on the server and the first
// client render, so SSR/hydration markup never diverges.
//
// Why this exists (multi-window plan §4, Stage B): .vista-window frames run
// a backdrop-filter, which makes them CONTAINING BLOCKS for position:fixed
// descendants. A "full-screen" overlay rendered inside a shell window would
// silently become window-relative and get clipped by the frame's
// overflow:hidden. Portaling to <body> keeps viewport takeovers
// viewport-fixed in BOTH presentations (standalone route and OSWindow).
// React context (wagmi, query, theme) flows through portals unchanged.
//
// The overlays carried through this are interaction-driven, so the
// one-frame mount delay is invisible.
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export default function BodyPortal({ children }: { children: React.ReactNode }) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setHost(document.body);
  }, []);
  return host ? createPortal(children, host) : null;
}
