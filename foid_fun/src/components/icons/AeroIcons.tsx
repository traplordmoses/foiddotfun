"use client";

import * as React from "react";

// AeroIcons — the FOID OS frutiger-aero icon language.
//
// Drawn replacements for every emoji/text glyph in MUSIC.EXE and CHAT.EXE:
// rounded geometric forms, vertical gel gradients (white → cyan/blue), a
// 1px light edge stroke and a gloss cap — Windows Media Player 11 / Vista
// gel buttons at 10–20px. All icons share viewBox 24 and are decorative
// (aria-hidden); the host button carries the accessible label.
//
// Colorways (`tone`):
//   frost — white→cyan gel for dark glass surfaces (deck gels, chat send)
//   sea   — deep aqua gel for the pebble's white milk shell
//   plain — flat currentColor strokes for tiny chrome glyphs (chips, chevrons)
//
// Gradient defs use React.useId so every instance owns its ids — no
// cross-SVG url(#…) resolution into hidden subtrees (the deck body is
// display:none while shaded; Safari resolves paints document-wide).

import { useId, type ReactNode } from "react";

export type AeroTone = "frost" | "sea" | "plain";

export type AeroIconProps = {
  /** Square box size in px (default 14). */
  size?: number;
  /** Colorway — see file header. Gel icons default to frost. */
  tone?: AeroTone;
  className?: string;
};

const STOPS: Record<Exclude<AeroTone, "plain">, [string, string, string]> = {
  frost: ["#ffffff", "#d7f5ff", "#6fd0f6"],
  sea: ["#f4fbff", "#7cc0f2", "#1d5fa8"],
};

// Edge stroke: light lip on dark glass, deep-sea lip on the white shell.
const EDGE: Record<Exclude<AeroTone, "plain">, string> = {
  frost: "rgba(255, 255, 255, 0.55)",
  sea: "rgba(13, 58, 108, 0.4)",
};

type Gel = {
  defs: ReactNode;
  /** Fill paint for gel bodies (gradient url, or currentColor when plain). */
  fill: string;
  /** Stroke paint for gel-drawn strokes (shuffle lanes, volume waves). */
  stroke: string;
  /** Edge stroke color for gel bodies ("none" when plain). */
  edge: string;
  /** Gloss cap — same path re-filled with a white fade. Null when plain. */
  gloss: (d: string) => ReactNode;
};

function useGel(tone: AeroTone): Gel {
  const uid = useId();
  const gradId = `${uid}g`;
  const glossId = `${uid}s`;
  if (tone === "plain") {
    return { defs: null, fill: "currentColor", stroke: "currentColor", edge: "none", gloss: () => null };
  }
  const [top, mid, low] = STOPS[tone];
  return {
    defs: (
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={top} />
          <stop offset="0.45" stopColor={mid} />
          <stop offset="1" stopColor={low} />
        </linearGradient>
        <linearGradient id={glossId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.65" />
          <stop offset="0.5" stopColor="#ffffff" stopOpacity="0.06" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>
    ),
    fill: `url(#${gradId})`,
    stroke: `url(#${gradId})`,
    edge: EDGE[tone],
    gloss: (d: string) => <path d={d} fill={`url(#${glossId})`} />,
  };
}

function AeroSvg({
  size = 14,
  className,
  children,
}: {
  size?: number;
  className?: string;
  children: ReactNode;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
      className={className}
      style={{ display: "block", flexShrink: 0 }}
    >
      {children}
    </svg>
  );
}

/** Gel body: gradient fill + light edge + gloss cap. */
function GelBody({ d, gel }: { d: string; gel: Gel }) {
  return (
    <>
      <path d={d} fill={gel.fill} stroke={gel.edge} strokeWidth="1" strokeLinejoin="round" />
      {gel.gloss(d)}
    </>
  );
}

// ── Transport ───────────────────────────────────────────────────────────

export function PlayIcon({ size, tone = "frost", className }: AeroIconProps) {
  const gel = useGel(tone);
  const d =
    "M7 6.2c0-1.25 1.4-2 2.45-1.3l8.2 6.05c.9.65.9 1.45 0 2.1l-8.2 6.05C8.4 19.8 7 19.05 7 17.8V6.2z";
  return (
    <AeroSvg size={size} className={className}>
      {gel.defs}
      <GelBody d={d} gel={gel} />
      {tone !== "plain" && (
        <ellipse cx="10" cy="7.4" rx="2.1" ry="1" fill="#ffffff" opacity="0.55" transform="rotate(-14 10 7.4)" />
      )}
    </AeroSvg>
  );
}

export function PauseIcon({ size, tone = "frost", className }: AeroIconProps) {
  const gel = useGel(tone);
  const d =
    "M6.6 6.7c0-1.05.85-1.9 1.9-1.9s1.9.85 1.9 1.9v10.6c0 1.05-.85 1.9-1.9 1.9s-1.9-.85-1.9-1.9V6.7z" +
    "M13.6 6.7c0-1.05.85-1.9 1.9-1.9s1.9.85 1.9 1.9v10.6c0 1.05-.85 1.9-1.9 1.9s-1.9-.85-1.9-1.9V6.7z";
  return (
    <AeroSvg size={size} className={className}>
      {gel.defs}
      <GelBody d={d} gel={gel} />
    </AeroSvg>
  );
}

export function PrevIcon({ size, tone = "frost", className }: AeroIconProps) {
  const gel = useGel(tone);
  const d =
    "M19 6.2c0-1.25-1.4-2-2.45-1.3l-7.8 5.75c-.9.65-.9 1.45 0 2.1l7.8 5.75c1.05.7 2.45-.05 2.45-1.3V6.2z" +
    "M4.6 6.2c0-.85.7-1.55 1.55-1.55S7.7 5.35 7.7 6.2v11.6c0 .85-.7 1.55-1.55 1.55S4.6 18.65 4.6 17.8V6.2z";
  return (
    <AeroSvg size={size} className={className}>
      {gel.defs}
      <GelBody d={d} gel={gel} />
    </AeroSvg>
  );
}

export function NextIcon({ size, tone = "frost", className }: AeroIconProps) {
  const gel = useGel(tone);
  const d =
    "M5 6.2c0-1.25 1.4-2 2.45-1.3l7.8 5.75c.9.65.9 1.45 0 2.1l-7.8 5.75C6.4 19.25 5 18.5 5 17.25V6.2z" +
    "M16.3 6.2c0-.85.7-1.55 1.55-1.55s1.55.7 1.55 1.55v11.6c0 .85-.7 1.55-1.55 1.55s-1.55-.7-1.55-1.55V6.2z";
  return (
    <AeroSvg size={size} className={className}>
      {gel.defs}
      <GelBody d={d} gel={gel} />
    </AeroSvg>
  );
}

export function ShuffleIcon({ size, tone = "frost", className }: AeroIconProps) {
  const gel = useGel(tone);
  return (
    <AeroSvg size={size} className={className}>
      {gel.defs}
      <path
        d="M3.6 16.6h3.1c4.8 0 6.8-9.2 11.6-9.2h.5"
        stroke={gel.stroke}
        strokeWidth="2.1"
        strokeLinecap="round"
      />
      <path
        d="M3.6 7.4h3.1c4.8 0 6.8 9.2 11.6 9.2h.5"
        stroke={gel.stroke}
        strokeWidth="2.1"
        strokeLinecap="round"
      />
      <path d="M18.2 4.7l4.2 2.7-4.2 2.7z" fill={gel.fill} stroke={gel.edge} strokeWidth="0.6" strokeLinejoin="round" />
      <path d="M18.2 13.9l4.2 2.7-4.2 2.7z" fill={gel.fill} stroke={gel.edge} strokeWidth="0.6" strokeLinejoin="round" />
    </AeroSvg>
  );
}

// ── Volume ──────────────────────────────────────────────────────────────

export type VolumeLevel = "mute" | "low" | "high";

const SPEAKER_D =
  "M4.2 10.3c0-.72.58-1.3 1.3-1.3h2.4l3.85-3.25c.8-.68 2.05-.11 2.05.95v10.6c0 1.06-1.25 1.63-2.05.95L7.9 15H5.5c-.72 0-1.3-.58-1.3-1.3v-3.4z";

export function VolumeIcon({
  size,
  tone = "frost",
  className,
  level = "high",
}: AeroIconProps & { level?: VolumeLevel }) {
  const gel = useGel(tone);
  return (
    <AeroSvg size={size} className={className}>
      {gel.defs}
      <GelBody d={SPEAKER_D} gel={gel} />
      {level === "mute" ? (
        <path
          d="M16.2 9.9l4.4 4.2m0-4.2l-4.4 4.2"
          stroke={gel.stroke}
          strokeWidth="1.9"
          strokeLinecap="round"
        />
      ) : (
        <>
          <path d="M15.4 9.7c1.5 1.25 1.5 3.35 0 4.6" stroke={gel.stroke} strokeWidth="2" strokeLinecap="round" />
          {level === "high" && (
            <path d="M17.9 7.4c2.7 2.4 2.7 6.8 0 9.2" stroke={gel.stroke} strokeWidth="2" strokeLinecap="round" />
          )}
        </>
      )}
    </AeroSvg>
  );
}

export function MuteIcon(props: AeroIconProps) {
  return <VolumeIcon {...props} level="mute" />;
}

// ── Chat ────────────────────────────────────────────────────────────────

export function SendIcon({ size, tone = "frost", className }: AeroIconProps) {
  const gel = useGel(tone);
  const d =
    "M20.7 3.3c.9-.32 1.77.55 1.45 1.45l-5.35 14.9c-.34.96-1.68 1-2.07.06l-2.34-5.55a1.15 1.15 0 0 0-.61-.61l-5.55-2.34c-.94-.4-.9-1.73.06-2.07L20.7 3.3z";
  return (
    <AeroSvg size={size} className={className}>
      {gel.defs}
      <GelBody d={d} gel={gel} />
      {tone !== "plain" && (
        <path d="M20.9 4.3l-8.6 8.6" stroke="rgba(255,255,255,0.75)" strokeWidth="0.9" strokeLinecap="round" />
      )}
    </AeroSvg>
  );
}

export function SparkleIcon({ size, tone = "frost", className }: AeroIconProps) {
  const gel = useGel(tone);
  const main =
    "M12 3.1c.55 3.95 2.95 6.35 6.9 6.9-3.95.55-6.35 2.95-6.9 6.9-.55-3.95-2.95-6.35-6.9-6.9 3.95-.55 6.35-2.95 6.9-6.9z";
  const minor =
    "M17.8 15.2c.3 2.1 1.55 3.35 3.65 3.65-2.1.3-3.35 1.55-3.65 3.65-.3-2.1-1.55-3.35-3.65-3.65 2.1-.3 3.35-1.55 3.65-3.65z";
  return (
    <AeroSvg size={size} className={className}>
      {gel.defs}
      <GelBody d={main} gel={gel} />
      <path d={minor} fill={gel.fill} opacity="0.85" />
    </AeroSvg>
  );
}

export function HourglassIcon({ size, tone = "frost", className }: AeroIconProps) {
  const gel = useGel(tone);
  const d =
    "M7.6 5.6c0-.66.54-1.2 1.2-1.2h6.4c.66 0 1.2.54 1.2 1.2 0 2.9-1.9 4.5-3.3 5.7-.44.37-.44 1.03 0 1.4 1.4 1.2 3.3 2.8 3.3 5.7 0 .66-.54 1.2-1.2 1.2H8.8c-.66 0-1.2-.54-1.2-1.2 0-2.9 1.9-4.5 3.3-5.7.44-.37.44-1.03 0-1.4-1.4-1.2-3.3-2.8-3.3-5.7z";
  return (
    <AeroSvg size={size} className={className}>
      {gel.defs}
      <GelBody d={d} gel={gel} />
    </AeroSvg>
  );
}

// ── Chrome glyphs (plain by default — tiny strokes on chips/titlebars) ──

export function CloseIcon({ size, tone = "plain", className }: AeroIconProps) {
  const gel = useGel(tone);
  return (
    <AeroSvg size={size} className={className}>
      {gel.defs}
      <path d="M7 7l10 10M17 7L7 17" stroke={gel.stroke} strokeWidth="2.2" strokeLinecap="round" />
    </AeroSvg>
  );
}

/** Double-diagonal expand arrows — the pebble's "back to deck" chip. */
export function SwapIcon({ size, tone = "plain", className }: AeroIconProps) {
  const gel = useGel(tone);
  return (
    <AeroSvg size={size} className={className}>
      {gel.defs}
      <path
        d="M13.8 5.2h5v5M18.5 5.5l-6.2 6.2M10.2 18.8h-5v-5M5.5 18.5l6.2-6.2"
        stroke={gel.stroke}
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </AeroSvg>
  );
}

export function ChevronIcon({
  size,
  tone = "plain",
  className,
  dir = "down",
}: AeroIconProps & { dir?: "up" | "down" }) {
  const gel = useGel(tone);
  const d = dir === "down" ? "M6.7 9.6l5.3 4.8 5.3-4.8" : "M6.7 14.4l5.3-4.8 5.3 4.8";
  return (
    <AeroSvg size={size} className={className}>
      {gel.defs}
      <path d={d} stroke={gel.stroke} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </AeroSvg>
  );
}
