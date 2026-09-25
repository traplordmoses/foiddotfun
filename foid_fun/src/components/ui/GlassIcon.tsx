// src/components/ui/GlassIcon.tsx
// One of the crystal-glass app glyphs (src/config/appIcons.ts). Decorative:
// the control around it carries the label.

import { glassIconSrc, type GlassIconName } from "@/config/appIcons";

export function GlassIcon({
  name,
  size = 30,
  px = 96,
  className = "",
}: {
  name: GlassIconName;
  /** Drawn size in CSS pixels. */
  size?: number;
  /** Source size: 96 for the dock, 128 for bigger tiles. */
  px?: 96 | 128;
  className?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- tiny static glyphs; next/image adds nothing here
    <img
      src={glassIconSrc(name, px)}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      decoding="async"
      draggable={false}
      className={`foid-glass-icon ${className}`}
    />
  );
}
