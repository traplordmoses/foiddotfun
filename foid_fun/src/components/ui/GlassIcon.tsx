// src/components/ui/GlassIcon.tsx
// One of the crystal-glass app glyphs (src/config/appIcons.ts), with a
// glossy cap and a glint that sweeps through it now and then, both cut to
// the glyph's own shape (the image doubles as a CSS mask). Decorative: the
// control around it carries the label.

import type { CSSProperties } from "react";
import { glassIconSrc, type GlassIconName } from "@/config/appIcons";

export function GlassIcon({
  name,
  size = 30,
  px = 96,
  sweepDelayMs = 0,
  className = "",
}: {
  name: GlassIconName;
  /** Drawn size in CSS pixels. */
  size?: number;
  /** Source size: 96 for the dock, 128 for bigger tiles. */
  px?: 96 | 128;
  /** Offsets the glint so a row of icons catches one travelling light. */
  sweepDelayMs?: number;
  className?: string;
}) {
  const src = glassIconSrc(name, px);
  const style = {
    width: size,
    height: size,
    "--glass-src": `url(${src})`,
    "--sweep-delay": `${sweepDelayMs}ms`,
  } as CSSProperties;
  return (
    <span className={`glass-glyph ${className}`} style={style} aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element -- tiny static glyphs; next/image adds nothing here */}
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        decoding="async"
        draggable={false}
        className="foid-glass-icon"
      />
      <span className="glass-glyph__gloss" />
    </span>
  );
}
