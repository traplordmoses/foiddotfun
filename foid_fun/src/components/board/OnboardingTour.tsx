// /src/components/board/OnboardingTour.tsx
// 3-step post-placement walkthrough for first-time placers. Anchored
// tooltips with an arrow pointing at a DOM ref (by CSS selector). Portal
// into document.body so it's never clipped by ancestor transforms.
//
// Storage: sets `board-onboarding-seen-v1=1` on finish/skip. Caller is
// responsible for gating on !localStorage.getItem(...) before mounting.
// Analytics: fires onboarding_completed / onboarding_skipped with step.
"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useBoardAnalytics } from "@/hooks/useBoardAnalytics";
import { ONBOARDING_STORAGE_KEY } from "@/lib/board/onboardingKey";

export { ONBOARDING_STORAGE_KEY };

export type OnboardingStep = {
  /** CSS selector for the element to point at. */
  anchor: string;
  title: string;
  body: string;
};

export const DEFAULT_STEPS: OnboardingStep[] = [
  {
    // Anchor on .board-window (the pan/zoom container) rather than
    // .board-stage (its transformed child). getBoundingClientRect on the
    // stage returns the post-transform box, which balloons to several
    // thousand pixels when zoomed out and pushes the spotlight off-screen.
    anchor: ".board-window",
    title: "You're on the board",
    body:
      "Your meme is in voting for 72h — here's where you'll watch it land or get rejected.",
  },
  {
    anchor: ".board-sidebar",
    title: "Boost your governance power",
    body:
      "Vote on other placements in the sidebar. Every vote compounds into your weight on future proposals.",
  },
  {
    anchor: "[data-tour='pray-link'], a[href='/pray']",
    title: "Pray daily for multipliers",
    body:
      "Your vote weight scales with your streak. Lurker → Mommy Milker. The streak is the point.",
  },
];

type Props = {
  /** Controlled: when true, the tour mounts and runs. */
  open: boolean;
  /** Callback when tour ends (completed or skipped). Caller should close it. */
  onClose: () => void;
  steps?: OnboardingStep[];
};

type AnchorRect = { x: number; y: number; w: number; h: number } | null;

function findAnchorRect(selector: string): AnchorRect {
  if (typeof document === "undefined") return null;
  const el = document.querySelector(selector);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height };
}

function clampToViewport(
  x: number,
  y: number,
  w: number,
  h: number,
  pad = 12
): { x: number; y: number } {
  if (typeof window === "undefined") return { x, y };
  const maxX = window.innerWidth - w - pad;
  const maxY = window.innerHeight - h - pad;
  return {
    x: Math.max(pad, Math.min(maxX, x)),
    y: Math.max(pad, Math.min(maxY, y)),
  };
}

const TITLE_ID = "onboarding-tour-title";
const BODY_ID = "onboarding-tour-body";

export function OnboardingTour({ open, onClose, steps = DEFAULT_STEPS }: Props) {
  const analytics = useBoardAnalytics();
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<AnchorRect>(null);
  const [mounted, setMounted] = useState(false);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const nextBtnRef = useRef<HTMLButtonElement | null>(null);
  const skipBtnRef = useRef<HTMLButtonElement | null>(null);
  // Element that had focus before the tour opened. Restored on close so
  // keyboard / screen-reader users return to where they were.
  const previousActiveRef = useRef<HTMLElement | null>(null);

  useEffect(() => setMounted(true), []);

  // Reset to step 0 whenever the tour opens.
  useEffect(() => {
    if (open) setIndex(0);
  }, [open]);

  // Focus management — when the tour opens, capture the current activeElement
  // so we can return focus to it on close, and move focus into the dialog
  // (to the primary Next button). Screen readers announce the dialog via
  // aria-labelledby/aria-describedby once focus lands inside it.
  useEffect(() => {
    if (!open) return;
    if (typeof document !== "undefined") {
      previousActiveRef.current =
        (document.activeElement as HTMLElement | null) ?? null;
    }
    // Defer one tick so the tooltip + button refs are attached after render.
    const t = window.setTimeout(() => {
      nextBtnRef.current?.focus({ preventScroll: true });
    }, 0);
    return () => {
      window.clearTimeout(t);
      // Restore focus — ignore errors if the previous element is gone.
      try {
        previousActiveRef.current?.focus?.({ preventScroll: true });
      } catch {
        /* noop */
      }
    };
  }, [open]);

  // Recompute anchor rect on step change, scroll, or resize.
  useLayoutEffect(() => {
    if (!open) return;
    const step = steps[index];
    if (!step) return;
    let raf = 0;
    const update = () => {
      raf = requestAnimationFrame(() => setRect(findAnchorRect(step.anchor)));
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, index, steps]);

  if (!mounted || !open) return null;

  const step = steps[index];
  if (!step) return null;

  const finish = (kind: "completed" | "skipped") => {
    try {
      window.localStorage.setItem(ONBOARDING_STORAGE_KEY, "1");
    } catch {
      /* noop */
    }
    if (kind === "completed") {
      analytics.trackOnboardingCompleted({ step: index });
    } else {
      analytics.trackOnboardingSkipped({ step: index });
    }
    onClose();
  };

  const next = () => {
    if (index >= steps.length - 1) {
      finish("completed");
    } else {
      setIndex((i) => i + 1);
    }
  };

  // Tooltip placement — prefer below anchor, fall back above if near bottom.
  const TOOLTIP_W = 320;
  const TOOLTIP_H = 170;
  const GAP = 14;

  let tipX = 0;
  let tipY = 0;
  let arrowEdge: "top" | "bottom" = "top";

  if (rect) {
    const anchorCenterX = rect.x + rect.w / 2;
    const spaceBelow = window.innerHeight - (rect.y + rect.h);
    if (spaceBelow < TOOLTIP_H + GAP + 16) {
      tipY = rect.y - TOOLTIP_H - GAP;
      arrowEdge = "bottom";
    } else {
      tipY = rect.y + rect.h + GAP;
      arrowEdge = "top";
    }
    tipX = anchorCenterX - TOOLTIP_W / 2;
  } else {
    // Anchor not found — center on screen.
    tipX = (window.innerWidth - TOOLTIP_W) / 2;
    tipY = (window.innerHeight - TOOLTIP_H) / 2;
  }
  const clamped = clampToViewport(tipX, tipY, TOOLTIP_W, TOOLTIP_H);
  tipX = clamped.x;
  tipY = clamped.y;

  const content = (
    <AnimatePresence>
      <motion.div
        key="onboarding-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.45)",
          backdropFilter: "blur(2px)",
          zIndex: 9996,
          pointerEvents: "auto",
        }}
        onClick={() => finish("skipped")}
      />

      {rect && (
        <motion.div
          key={`onboarding-spotlight-${index}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
            position: "fixed",
            left: rect.x - 6,
            top: rect.y - 6,
            width: rect.w + 12,
            height: rect.h + 12,
            border: "2px solid rgba(167, 139, 250, 0.85)",
            borderRadius: 12,
            boxShadow:
              "0 0 0 9999px rgba(0,0,0,0.55), 0 0 24px rgba(167,139,250,0.6)",
            zIndex: 9997,
            pointerEvents: "none",
          }}
        />
      )}

      <motion.div
        ref={tooltipRef}
        key={`onboarding-tip-${index}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={TITLE_ID}
        aria-describedby={BODY_ID}
        tabIndex={-1}
        onKeyDown={(e) => {
          // Escape dismisses as skipped.
          if (e.key === "Escape") {
            e.preventDefault();
            finish("skipped");
            return;
          }
          // Tab focus trap — only Skip and Next are focusable inside the
          // dialog. Wrap between them in DOM order (Skip first, Next last).
          if (e.key !== "Tab") return;
          const first = skipBtnRef.current;
          const last = nextBtnRef.current;
          if (!first || !last) return;
          const active = document.activeElement;
          if (e.shiftKey && active === first) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && active === last) {
            e.preventDefault();
            first.focus();
          }
        }}
        initial={{ opacity: 0, y: arrowEdge === "top" ? -8 : 8, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ type: "spring", damping: 22, stiffness: 260 }}
        style={{
          position: "fixed",
          left: tipX,
          top: tipY,
          width: TOOLTIP_W,
          zIndex: 9999,
          background:
            "linear-gradient(135deg, rgba(15, 6, 36, 0.96), rgba(24, 10, 56, 0.96))",
          border: "1px solid rgba(167, 139, 250, 0.4)",
          borderRadius: 14,
          boxShadow: "0 12px 40px rgba(0,0,0,0.55), 0 0 24px rgba(116,255,235,0.15)",
          color: "#fff",
          padding: "14px 16px 12px",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          outline: "none",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            marginBottom: 6,
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              color: "#a78bfa",
              letterSpacing: 0.5,
            }}
          >
            STEP {index + 1} / {steps.length}
          </div>
          <button
            ref={skipBtnRef}
            type="button"
            onClick={() => finish("skipped")}
            style={{
              fontSize: 11,
              color: "rgba(255,255,255,0.55)",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: 4,
            }}
            aria-label="Skip tour"
          >
            Skip
          </button>
        </div>

        <div
          id={TITLE_ID}
          style={{
            fontSize: 15,
            fontWeight: 700,
            marginBottom: 4,
            color: "#74ffeb",
          }}
        >
          {step.title}
        </div>
        <div
          id={BODY_ID}
          style={{ fontSize: 13, lineHeight: 1.45, color: "rgba(255,255,255,0.85)" }}
        >
          {step.body}
        </div>

        <div
          style={{
            marginTop: 12,
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
          }}
        >
          <button
            ref={nextBtnRef}
            type="button"
            onClick={next}
            style={{
              padding: "7px 14px",
              background: "linear-gradient(135deg, #a78bfa, #74ffeb)",
              color: "#0e0f2b",
              fontWeight: 700,
              fontSize: 12,
              border: "none",
              borderRadius: 8,
              cursor: "pointer",
              letterSpacing: 0.3,
            }}
          >
            {index >= steps.length - 1 ? "Got it" : "Next →"}
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );

  return createPortal(content, document.body);
}
