"use client";

import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { JournalEntry } from "@/hooks/usePrayerMemory";
import type { FeelingKey } from "@/app/(components)/FoidMommyTerminal";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  entries: JournalEntry[];
  hasConsent: boolean;
  streak: number;
  longestStreak: number;
  totalPrayers: number;
};

// Feeling glyphs — abstract geometric, cult-tech not emoji
const FEELING_GLYPHS: Record<string, string> = {
  happy: "✺",
  calm: "○",
  hopeful: "◌",
  stressed: "⟁",
  sad: "◐",
  angry: "⚡",
  tired: "◡",
  lost: "⸱",
  guilty: "◉",
  pain: "◆",
  freeform: "◦",
};

// Per-feeling valence on a −3..+3 axis. Used by the 7-day sparkline.
const FEELING_VALENCE: Record<FeelingKey, number> = {
  happy: 3,
  hopeful: 2,
  calm: 1,
  freeform: 0,
  tired: -1,
  stressed: -1,
  lost: -1,
  sad: -2,
  guilty: -2,
  angry: -2,
  pain: -3,
};

function dateKey(d: Date): string {
  // YYYY-MM-DD in local time, matching usePrayerMemory format
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

type Popover = {
  dateKey: string;
  entry: JournalEntry | null;
  // Anchor coords in viewport px — we render a position:fixed popover.
  anchorX: number;
  anchorY: number;
};

export default function PrayerJournalDrawer({
  isOpen,
  onClose,
  entries,
  hasConsent,
  streak,
  longestStreak,
  totalPrayers,
}: Props) {
  const [popover, setPopover] = useState<Popover | null>(null);
  // Reduced-motion: swap the drawer's spring enter/exit for a quick tween so
  // RM users don't get the bounce, and drop the backdrop fade to match.
  const reduceMotion = useReducedMotion();
  const sheetTransition = reduceMotion
    ? { duration: 0.15 }
    : { type: "spring" as const, damping: 28, stiffness: 260 };
  const backdropTransition = reduceMotion ? { duration: 0 } : { duration: 0.2 };
  // Refs for focus management — see the focus effect below.
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  // Esc to close — closes the popover first if one is open, then the drawer.
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (popover) {
        setPopover(null);
      } else {
        onClose();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose, popover]);

  // Lock body scroll when open
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  // Focus management: on open, remember what was focused, move focus into the
  // dialog (close button), and trap Tab within the sheet. On close, restore
  // focus to whatever was focused before. This gives keyboard + AT users a
  // proper modal contract: focus starts inside, can't Tab out, returns home.
  useEffect(() => {
    if (!isOpen) return;

    previouslyFocusedRef.current =
      typeof document !== "undefined"
        ? (document.activeElement as HTMLElement | null)
        : null;

    // Defer focus one frame so framer-motion has mounted the sheet.
    const rafId = requestAnimationFrame(() => {
      closeButtonRef.current?.focus();
    });

    const trap = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const sheet = sheetRef.current;
      if (!sheet) return;
      const focusables = sheet.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length === 0) {
        e.preventDefault();
        closeButtonRef.current?.focus();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey) {
        if (active === first || !sheet.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", trap);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("keydown", trap);
      // Restore focus to whatever was focused before the dialog opened.
      const prev = previouslyFocusedRef.current;
      if (prev && typeof prev.focus === "function") {
        prev.focus();
      }
      previouslyFocusedRef.current = null;
    };
  }, [isOpen]);

  // Close popover when the drawer itself closes.
  useEffect(() => {
    if (!isOpen && popover) setPopover(null);
  }, [isOpen, popover]);

  // 30-day dot tape — last 30 calendar days ending today
  const dots = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const entryMap = new Map(entries.map((e) => [e.date, e]));
    return Array.from({ length: 30 }, (_, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() - (29 - i));
      const key = dateKey(d);
      return { date: key, entry: entryMap.get(key) ?? null };
    });
  }, [entries]);

  // 7-day sparkline — take the most recent 7 unique-day entries.
  // Only entries with a known feeling contribute; we don't backfill empty days
  // with zeros so the line is an honest shape of what the user actually did.
  const sparkline = useMemo(() => {
    const byDate = new Map<string, JournalEntry>();
    for (const e of entries) byDate.set(e.date, e);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const out: { date: string; value: number; entry: JournalEntry }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = dateKey(d);
      const entry = byDate.get(key);
      if (!entry) continue;
      const v = FEELING_VALENCE[entry.feelingKey] ?? 0;
      out.push({ date: key, value: v, entry });
    }
    return out;
  }, [entries]);

  const recent = useMemo(() => entries.slice(-14).reverse(), [entries]);

  const handleDotClick = useCallback((e: React.MouseEvent<HTMLButtonElement>, d: { date: string; entry: JournalEntry | null }) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setPopover((cur) => {
      if (cur && cur.dateKey === d.date) return null; // toggle off
      return {
        dateKey: d.date,
        entry: d.entry,
        anchorX: rect.left + rect.width / 2,
        anchorY: rect.top,
      };
    });
  }, []);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="journal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={backdropTransition}
            onClick={onClose}
          />
          <motion.div
            ref={sheetRef}
            className="journal-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Prayer journey"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={sheetTransition}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.18}
            onDragEnd={(_, info) => {
              if (info.offset.y > 80 || info.velocity.y > 350) onClose();
            }}
          >
            {/* Drag handle */}
            <div className="journal-sheet__handle" aria-hidden="true" />

            <div
              className="journal-sheet__scroll"
              onClick={() => {
                // Outside-tap on the scroll area closes the popover.
                if (popover) setPopover(null);
              }}
            >
              <header className="journal-sheet__header">
                <span className="journal-sheet__title">your journey</span>
                <button
                  ref={closeButtonRef}
                  type="button"
                  className="journal-sheet__close pray-tap"
                  onClick={onClose}
                  aria-label="Close journal"
                >
                  ✕
                </button>
              </header>

              {/* Stats row */}
              <div className="journal-stats">
                <div className="journal-stats__cell">
                  <span className="journal-stats__value">{streak}</span>
                  <span className="journal-stats__label">streak</span>
                </div>
                <div className="journal-stats__cell">
                  <span className="journal-stats__value">{longestStreak}</span>
                  <span className="journal-stats__label">longest</span>
                </div>
                <div className="journal-stats__cell">
                  <span className="journal-stats__value">{totalPrayers}</span>
                  <span className="journal-stats__label">total</span>
                </div>
              </div>

              {/* 7-day sparkline */}
              <section className="journal-section">
                <h3 className="journal-section__title">mood — 7 days</h3>
                {sparkline.length < 2 ? (
                  <p className="journal-empty journal-empty--thin">
                    not enough days yet, keep going
                  </p>
                ) : (
                  <Sparkline points={sparkline} />
                )}
              </section>

              {/* 30-day tape */}
              <section className="journal-section">
                <h3 className="journal-section__title">30 days</h3>
                <div
                  className="journal-tape"
                  role="img"
                  aria-label={`${dots.filter((d) => d.entry).length} of the last 30 days anchored`}
                  onClick={(e) => e.stopPropagation()}
                >
                  {dots.map((d) => {
                    const isActive = popover?.dateKey === d.date;
                    const dLabel = new Date(d.date + "T00:00:00").toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    });
                    return (
                      <button
                        key={d.date}
                        type="button"
                        className={`journal-tape__dot touch-target ${d.entry ? "journal-tape__dot--filled" : ""}${isActive ? " journal-tape__dot--active" : ""}`}
                        aria-label={d.entry ? `${dLabel}: ${d.entry.feelingKey}` : `${dLabel}: no prayer`}
                        aria-pressed={isActive}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDotClick(e, d);
                        }}
                      />
                    );
                  })}
                </div>
              </section>

              {/* Recent feelings */}
              <section className="journal-section">
                <h3 className="journal-section__title">recent</h3>
                {!hasConsent ? (
                  <p className="journal-empty">
                    memory is off. type <code>/remember</code> in the terminal
                    to let mommy remember how you&apos;re feeling each day.
                  </p>
                ) : recent.length === 0 ? (
                  <p className="journal-empty">
                    no entries yet. pray once to begin.
                  </p>
                ) : (
                  <ul className="journal-list">
                    {recent.map((entry, i) => {
                      const d = new Date(entry.date + "T00:00:00");
                      const dateLabel = d.toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      });
                      const glyph = FEELING_GLYPHS[entry.feelingKey] ?? "◦";
                      return (
                        <li
                          key={`${entry.date}-${i}`}
                          className="journal-list__row"
                        >
                          <span className="journal-list__glyph" aria-hidden="true">
                            {glyph}
                          </span>
                          <span className="journal-list__datecol">
                            <span className="journal-list__date">{dateLabel}</span>
                            {entry.mommyWord && (
                              <span className="journal-list__word">
                                <span className="journal-list__word-sep" aria-hidden="true">·</span>
                                &ldquo;{entry.mommyWord}&rdquo;
                              </span>
                            )}
                          </span>
                          <span className="journal-list__feeling">
                            {entry.feelingKey}
                          </span>
                          <span className="journal-list__time">
                            {entry.timeOfDay}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              <p className="journal-footnote">
                only the feeling label and date are kept on your device.
                your prayers stay private. type <code>/forget</code> to erase.
              </p>
            </div>
          </motion.div>

          {/* Tap-a-dot popover — fixed-positioned, doesn't scroll with drawer. */}
          {popover && (
            <DotPopover popover={popover} onClose={() => setPopover(null)} />
          )}

          <style jsx>{`
            :global(.journal-backdrop) {
              position: fixed;
              inset: 0;
              background: rgba(0, 0, 0, 0.55);
              backdrop-filter: blur(4px);
              -webkit-backdrop-filter: blur(4px);
              z-index: 999;
            }
            :global(.journal-sheet) {
              position: fixed;
              left: 0;
              right: 0;
              bottom: 0;
              z-index: 1000;
              display: flex;
              flex-direction: column;
              max-height: 82dvh;
              border-top-left-radius: 20px;
              border-top-right-radius: 20px;
              background: linear-gradient(
                180deg,
                rgba(10, 16, 24, 0.96) 0%,
                rgba(4, 8, 14, 0.98) 100%
              );
              border-top: 1px solid rgba(0, 255, 213, 0.15);
              box-shadow:
                0 -20px 60px rgba(0, 0, 0, 0.6),
                inset 0 1px 0 rgba(255, 255, 255, 0.05);
              padding-bottom: max(env(safe-area-inset-bottom), 12px);
              overflow: hidden;
              touch-action: none;
            }

            :global(.journal-sheet__handle) {
              width: 40px;
              height: 4px;
              border-radius: 2px;
              background: rgba(255, 255, 255, 0.25);
              margin: 10px auto 6px;
              flex-shrink: 0;
            }

            :global(.journal-sheet__scroll) {
              flex: 1;
              min-height: 0;
              overflow-y: auto;
              -webkit-overflow-scrolling: touch;
              padding: 4px 20px 16px;
            }

            :global(.journal-sheet__header) {
              display: flex;
              align-items: center;
              justify-content: space-between;
              margin-bottom: 16px;
            }
            :global(.journal-sheet__title) {
              font-family: var(--font-terminal, "JetBrains Mono", monospace);
              font-size: 13px;
              letter-spacing: 0.18em;
              text-transform: lowercase;
              color: var(--foid-cyan-electric);
              text-shadow: 0 0 12px rgba(0, 255, 213, 0.3);
              font-weight: 600;
            }
            :global(.journal-sheet__close) {
              background: transparent;
              border: 1px solid rgba(255, 255, 255, 0.12);
              color: rgba(255, 255, 255, 0.7);
              border-radius: 10px;
              font-size: 14px;
              padding: 8px 12px;
              cursor: pointer;
              transition: background 0.15s ease, border-color 0.15s ease;
            }
            :global(.journal-sheet__close:hover) {
              background: rgba(255, 255, 255, 0.05);
              border-color: rgba(255, 255, 255, 0.25);
            }

            :global(.journal-stats) {
              display: grid;
              grid-template-columns: 1fr 1fr 1fr;
              gap: 1px;
              background: rgba(0, 255, 255, 0.06);
              border-radius: 10px;
              overflow: hidden;
              margin-bottom: 24px;
            }
            :global(.journal-stats__cell) {
              display: flex;
              flex-direction: column;
              gap: 4px;
              padding: 14px 10px;
              background: rgba(0, 16, 28, 0.6);
              text-align: center;
            }
            :global(.journal-stats__value) {
              font-family: var(--font-terminal, monospace);
              font-size: 24px;
              font-weight: 700;
              color: #00e5ff;
              text-shadow: 0 0 14px rgba(0, 229, 255, 0.4);
              line-height: 1;
              font-variant-numeric: tabular-nums;
            }
            :global(.journal-stats__label) {
              font-size: 10px;
              letter-spacing: 0.2em;
              text-transform: uppercase;
              color: rgba(255, 255, 255, 0.45);
            }

            :global(.journal-section) {
              margin-bottom: 22px;
            }
            :global(.journal-section__title) {
              font-size: 10px;
              letter-spacing: 0.22em;
              text-transform: uppercase;
              color: rgba(255, 255, 255, 0.5);
              margin: 0 0 10px;
              font-weight: 600;
            }

            :global(.journal-sparkline) {
              width: 100%;
              height: 100px;
              display: block;
            }
            :global(.journal-sparkline__axis) {
              stroke: rgba(255, 255, 255, 0.06);
              stroke-width: 1;
            }

            :global(.journal-tape) {
              display: grid;
              grid-template-columns: repeat(30, 1fr);
              gap: 3px;
              align-items: center;
            }
            :global(.journal-tape__dot) {
              /* Reset button user-agent styles so the dot collapses to the
                 grid column width — global button min-heights in this app
                 would otherwise blow out the 30-dot tape. */
              all: unset;
              box-sizing: border-box;
              display: block;
              width: 100%;
              aspect-ratio: 1 / 1;
              min-height: 0;
              min-width: 0;
              padding: 0;
              border-radius: 50%;
              background: rgba(255, 255, 255, 0.08);
              border: 1px solid rgba(255, 255, 255, 0.04);
              cursor: pointer;
              transition: transform 0.12s ease, box-shadow 0.12s ease;
              touch-action: manipulation;
            }
            :global(.journal-tape__dot:hover),
            :global(.journal-tape__dot:focus-visible) {
              transform: scale(1.25);
              outline: none;
            }
            :global(.journal-tape__dot--filled) {
              background: #00e5ff;
              box-shadow: 0 0 6px rgba(0, 229, 255, 0.55);
              border-color: rgba(0, 229, 255, 0.45);
            }
            :global(.journal-tape__dot--active) {
              transform: scale(1.5);
              box-shadow:
                0 0 0 2px rgba(0, 255, 213, 0.45),
                0 0 10px rgba(0, 229, 255, 0.7);
            }

            :global(.journal-list) {
              list-style: none;
              padding: 0;
              margin: 0;
              display: flex;
              flex-direction: column;
              gap: 2px;
            }
            :global(.journal-list__row) {
              display: grid;
              grid-template-columns: 24px minmax(0, 1.3fr) minmax(0, 1fr) auto;
              align-items: center;
              gap: 10px;
              padding: 10px 8px;
              border-bottom: 1px solid rgba(255, 255, 255, 0.04);
              font-family: var(--font-terminal, monospace);
              font-size: 12px;
            }
            :global(.journal-list__row:last-child) {
              border-bottom: none;
            }
            :global(.journal-list__glyph) {
              font-size: 14px;
              color: var(--foid-cyan-electric);
              text-align: center;
            }
            :global(.journal-list__datecol) {
              display: flex;
              flex-wrap: wrap;
              align-items: baseline;
              gap: 6px;
              min-width: 0;
            }
            :global(.journal-list__date) {
              color: rgba(255, 255, 255, 0.7);
              letter-spacing: 0.04em;
              white-space: nowrap;
            }
            :global(.journal-list__word) {
              color: #f7d877;
              font-size: 11.5px;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
              min-width: 0;
            }
            :global(.journal-list__word-sep) {
              color: rgba(255, 255, 255, 0.25);
              margin-right: 4px;
            }
            :global(.journal-list__feeling) {
              color: rgba(255, 255, 255, 0.85);
              text-transform: lowercase;
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
            }
            :global(.journal-list__time) {
              color: rgba(255, 255, 255, 0.35);
              font-size: 10px;
              letter-spacing: 0.1em;
              text-transform: uppercase;
            }

            :global(.journal-empty) {
              color: rgba(255, 255, 255, 0.5);
              font-size: 13px;
              line-height: 1.5;
              padding: 12px 0;
              margin: 0;
            }
            :global(.journal-empty--thin) {
              font-size: 11.5px;
              text-align: center;
              letter-spacing: 0.06em;
              padding: 20px 0;
              color: rgba(255, 255, 255, 0.4);
            }
            :global(.journal-empty code) {
              font-family: var(--font-terminal, monospace);
              font-size: 12px;
              padding: 1px 6px;
              background: rgba(0, 255, 213, 0.08);
              color: var(--foid-cyan-electric);
              border-radius: 4px;
            }

            :global(.journal-footnote) {
              font-size: 10px;
              line-height: 1.55;
              color: rgba(255, 255, 255, 0.35);
              margin: 12px 0 0;
              text-align: center;
            }
            :global(.journal-footnote code) {
              font-family: var(--font-terminal, monospace);
              font-size: 10px;
              padding: 1px 5px;
              background: rgba(255, 255, 255, 0.05);
              color: rgba(255, 255, 255, 0.6);
              border-radius: 3px;
            }

            /* Dot popover */
            :global(.journal-popover) {
              position: fixed;
              z-index: 1100;
              min-width: 160px;
              max-width: 220px;
              background: linear-gradient(
                180deg,
                rgba(12, 20, 30, 0.98),
                rgba(6, 12, 20, 0.98)
              );
              border: 1px solid rgba(0, 255, 213, 0.28);
              border-radius: 10px;
              padding: 10px 12px;
              font-family: var(--font-terminal, monospace);
              font-size: 12px;
              color: rgba(255, 255, 255, 0.85);
              box-shadow:
                0 10px 30px rgba(0, 0, 0, 0.55),
                0 0 0 1px rgba(0, 0, 0, 0.4),
                0 0 24px rgba(0, 255, 213, 0.12);
              pointer-events: auto;
            }
            :global(.journal-popover__date) {
              font-size: 11px;
              color: var(--foid-cyan-electric);
              letter-spacing: 0.08em;
              text-transform: uppercase;
              margin-bottom: 6px;
            }
            :global(.journal-popover__row) {
              display: flex;
              justify-content: space-between;
              gap: 10px;
              padding: 2px 0;
              font-size: 11.5px;
            }
            :global(.journal-popover__row dt) {
              color: rgba(255, 255, 255, 0.4);
              text-transform: uppercase;
              font-size: 10px;
              letter-spacing: 0.1em;
              margin: 0;
            }
            :global(.journal-popover__row dd) {
              margin: 0;
              color: rgba(255, 255, 255, 0.85);
            }
            :global(.journal-popover__word) {
              color: #f7d877;
              font-weight: 600;
            }
            :global(.journal-popover__empty) {
              color: rgba(255, 255, 255, 0.5);
              font-size: 11.5px;
              letter-spacing: 0.02em;
            }
          `}</style>
        </>
      )}
    </AnimatePresence>
  );
}

// ── Sparkline ────────────────────────────────────────────────────────────────

function Sparkline({ points }: { points: { date: string; value: number; entry: JournalEntry }[] }) {
  // Viewbox is normalized — the SVG scales to the container width.
  const W = 300;
  const H = 100;
  const PAD_X = 10;
  const PAD_Y = 14;

  // Map valence -3..+3 to H..0 (inverted Y).
  const yFor = (v: number) => {
    const norm = (v + 3) / 6; // 0..1
    return H - PAD_Y - norm * (H - 2 * PAD_Y);
  };
  const xFor = (i: number) => {
    if (points.length === 1) return W / 2;
    return PAD_X + (i / (points.length - 1)) * (W - 2 * PAD_X);
  };

  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${xFor(i).toFixed(1)} ${yFor(p.value).toFixed(1)}`)
    .join(" ");

  return (
    <svg
      className="journal-sparkline"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      aria-label="7-day mood sparkline"
      role="img"
    >
      <defs>
        <linearGradient id="journal-spark-stroke" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="var(--pray-accent, #6eead8)" />
          <stop offset="100%" stopColor="#f7d877" />
        </linearGradient>
      </defs>
      {/* Zero line for visual anchoring — subtle. */}
      <line
        className="journal-sparkline__axis"
        x1={PAD_X}
        x2={W - PAD_X}
        y1={yFor(0)}
        y2={yFor(0)}
      />
      <path
        d={path}
        fill="none"
        stroke="url(#journal-spark-stroke)"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {points.map((p, i) => (
        <circle
          key={p.date}
          cx={xFor(i)}
          cy={yFor(p.value)}
          r={3}
          fill="var(--pray-accent, #6eead8)"
        >
          <title>{`${p.date}: ${p.entry.feelingKey}`}</title>
        </circle>
      ))}
    </svg>
  );
}

// ── Dot popover ──────────────────────────────────────────────────────────────

function DotPopover({ popover, onClose }: { popover: Popover; onClose: () => void }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  // After render, measure the popover and clamp it into the viewport,
  // preferring to sit above the anchor dot (which is inside the drawer).
  useEffect(() => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const GAP = 10;
    let left = popover.anchorX - rect.width / 2;
    left = Math.max(8, Math.min(left, vw - rect.width - 8));
    let top = popover.anchorY - rect.height - GAP;
    if (top < 8) {
      // Not enough room above — place below.
      top = popover.anchorY + 16 + GAP;
    }
    top = Math.min(top, vh - rect.height - 8);
    setPos({ left, top });
  }, [popover]);

  // Outside tap closes
  useEffect(() => {
    const handler = (e: Event) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) onClose();
    };
    // Delay one tick so the opening click doesn't immediately close it.
    const id = window.setTimeout(() => {
      window.addEventListener("mousedown", handler);
      window.addEventListener("touchstart", handler);
    }, 0);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("mousedown", handler);
      window.removeEventListener("touchstart", handler);
    };
  }, [onClose]);

  const dateLabel = new Date(popover.dateKey + "T00:00:00").toLocaleDateString(
    undefined,
    { weekday: "short", month: "short", day: "numeric" },
  );

  const style: React.CSSProperties = pos
    ? { left: pos.left, top: pos.top, visibility: "visible" }
    : { left: 0, top: 0, visibility: "hidden" };

  return (
    <div
      ref={ref}
      className="journal-popover"
      role="dialog"
      aria-label="Day details"
      style={style}
    >
      <div className="journal-popover__date">{dateLabel}</div>
      {popover.entry ? (
        <dl>
          <div className="journal-popover__row">
            <dt>feeling</dt>
            <dd>{popover.entry.feelingKey}</dd>
          </div>
          <div className="journal-popover__row">
            <dt>word</dt>
            <dd className="journal-popover__word">
              {popover.entry.mommyWord ? `"${popover.entry.mommyWord}"` : "—"}
            </dd>
          </div>
          <div className="journal-popover__row">
            <dt>time</dt>
            <dd>{popover.entry.timeOfDay}</dd>
          </div>
        </dl>
      ) : (
        <div className="journal-popover__empty">no prayer on this day</div>
      )}
    </div>
  );
}
