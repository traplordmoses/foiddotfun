"use client";

import { useEffect, useRef, useState, memo } from "react";
import { useActivityFeed, type ActivityItem } from "@/hooks/useActivityFeed";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_VISIBLE = 8;
const MAX_VISIBLE_MOBILE = 4;
const BUBBLE_DURATION_S = 16; // how long a bubble takes to float up
const BUBBLE_FADE_IN_S = 1.5;

// ---------------------------------------------------------------------------
// Single Bubble
// ---------------------------------------------------------------------------

type BubbleProps = {
  item: ActivityItem;
  left: number; // 0-100 (%)
  delay: number; // stagger delay in seconds
  duration: number; // total animation duration
  onDone: (id: string) => void;
};

const Bubble = memo(function Bubble({ item, left, delay, duration, onDone }: BubbleProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const timer = window.setTimeout(() => onDone(item.id), (delay + duration) * 1000);
    return () => window.clearTimeout(timer);
  }, [delay, duration, item.id, onDone]);

  return (
    <div
      ref={ref}
      className="activity-bubble"
      style={{
        left: `${left}%`,
        animationDelay: `${delay}s`,
        animationDuration: `${duration}s`,
        // @ts-expect-error CSS custom property
        "--accent": item.accent,
      }}
    >
      <span className="activity-bubble__dot" style={{ background: item.accent }} />
      <span className="activity-bubble__text">{item.message}</span>
    </div>
  );
});

// ---------------------------------------------------------------------------
// Container
// ---------------------------------------------------------------------------

function useIsMobile() {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    setMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return mobile;
}

export default function ActivityBubbles() {
  const { items, remove } = useActivityFeed();
  const isMobile = useIsMobile();
  const max = isMobile ? MAX_VISIBLE_MOBILE : MAX_VISIBLE;
  const visible = items.slice(-max);

  // Assign stable random left positions per item
  const leftMapRef = useRef(new Map<string, number>());
  visible.forEach((item) => {
    if (!leftMapRef.current.has(item.id)) {
      // Avoid edges — keep between 8% and 82%
      leftMapRef.current.set(item.id, 8 + Math.random() * 74);
    }
  });

  // Cleanup stale entries
  useEffect(() => {
    const activeIds = new Set(items.map((i) => i.id));
    leftMapRef.current.forEach((_, key) => {
      if (!activeIds.has(key)) leftMapRef.current.delete(key);
    });
  }, [items]);

  return (
    <>
      <div className="activity-bubbles" aria-hidden="true">
        {visible.map((item, idx) => (
          <Bubble
            key={item.id}
            item={item}
            left={leftMapRef.current.get(item.id) ?? 50}
            delay={idx * 0.6}
            duration={BUBBLE_DURATION_S + Math.random() * 4}
            onDone={remove}
          />
        ))}
      </div>

      <style jsx global>{`
        .activity-bubbles {
          position: absolute;
          inset: 0;
          z-index: 2;
          pointer-events: none;
          overflow: hidden;
        }

        .activity-bubble {
          position: absolute;
          bottom: -40px;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 5px 12px 5px 10px;
          border-radius: 20px;
          background: rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          white-space: nowrap;
          opacity: 0;
          animation:
            activity-rise var(--dur, ${BUBBLE_DURATION_S}s) ease-out forwards,
            activity-fade-in ${BUBBLE_FADE_IN_S}s ease-out forwards;
          animation-delay: var(--delay, 0s);
          will-change: transform, opacity;
        }

        /* Override animation-duration and delay from inline style */
        .activity-bubble {
          --dur: ${BUBBLE_DURATION_S}s;
          --delay: 0s;
        }

        .activity-bubble__dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          flex-shrink: 0;
          box-shadow: 0 0 6px var(--accent, rgba(255, 255, 255, 0.5));
        }

        .activity-bubble__text {
          font-family: var(--font-mono, ui-monospace, monospace);
          font-size: 10px;
          letter-spacing: 0.04em;
          color: rgba(255, 255, 255, 0.40);
          text-shadow: 0 0 8px rgba(255, 255, 255, 0.1);
        }

        @keyframes activity-rise {
          0% {
            transform: translateY(0) translateX(0);
          }
          25% {
            transform: translateY(-25vh) translateX(12px);
          }
          50% {
            transform: translateY(-50vh) translateX(-8px);
          }
          75% {
            transform: translateY(-75vh) translateX(6px);
          }
          100% {
            transform: translateY(-110vh) translateX(0);
            opacity: 0;
          }
        }

        @keyframes activity-fade-in {
          0% {
            opacity: 0;
          }
          15% {
            opacity: 0.7;
          }
          70% {
            opacity: 0.5;
          }
          100% {
            opacity: 0;
          }
        }

        /* Reduce motion */
        @media (prefers-reduced-motion: reduce) {
          .activity-bubble {
            animation: none;
            opacity: 0.4;
            bottom: auto;
            top: 50%;
          }
        }

        /* Mobile — smaller text, less padding */
        @media (max-width: 768px) {
          .activity-bubble {
            padding: 4px 10px 4px 8px;
          }
          .activity-bubble__text {
            font-size: 9px;
          }
          .activity-bubble__dot {
            width: 4px;
            height: 4px;
          }
        }
      `}</style>
    </>
  );
}
