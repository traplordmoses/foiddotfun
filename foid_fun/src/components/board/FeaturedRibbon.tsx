// /src/components/board/FeaturedRibbon.tsx
// "PROPOSAL OF THE DAY" ribbon rendered above the board viewport (not
// inside .board-stage — it needs fixed screen position, not world-pan-
// attached). Dismiss × persists for 24h in localStorage.
"use client";

import { useEffect, useState } from "react";
import { IpfsImage } from "@/components/IpfsImage";

export type FeaturedProposal = {
  id: number;
  proposer: string;
  forCount: number;
  rect: { x: number; y: number; w: number; h: number };
  imageUrl: string | null;
};

type Props = {
  proposal: FeaturedProposal | null;
  onView?: (proposal: FeaturedProposal) => void;
  onVote?: (proposal: FeaturedProposal) => void;
  onDismiss?: () => void;
};

const DISMISS_PREFIX = "board-featured-dismissed-";
const DAY_MS = 24 * 60 * 60 * 1000;

function isDismissed(id: number): boolean {
  try {
    const raw = window.localStorage.getItem(`${DISMISS_PREFIX}${id}`);
    if (!raw) return false;
    const at = Number(raw);
    if (!Number.isFinite(at)) return false;
    return Date.now() - at < DAY_MS;
  } catch {
    return false;
  }
}

function dismissFor(id: number) {
  try {
    window.localStorage.setItem(`${DISMISS_PREFIX}${id}`, String(Date.now()));
  } catch {
    /* noop */
  }
}

function shortAddr(a: string): string {
  if (!a || a.length < 8) return a || "0x????";
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

/**
 * Fetch the currently-featured proposal. Returns null when no active
 * candidate exists or the endpoint is unreachable.
 */
export function useFeaturedProposal(): FeaturedProposal | null {
  const [proposal, setProposal] = useState<FeaturedProposal | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/proposals/featured", { cache: "no-store" });
        if (!res.ok) return;
        const body = (await res.json()) as { proposal: FeaturedProposal | null };
        if (!cancelled && body.proposal) setProposal(body.proposal);
      } catch {
        /* network hiccup — silently stay hidden */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return proposal;
}

export function FeaturedRibbon({ proposal, onView, onVote, onDismiss }: Props) {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (proposal) setDismissed(isDismissed(proposal.id));
  }, [proposal]);

  if (!proposal || dismissed) return null;

  return (
    <div
      role="region"
      aria-label="Featured proposal"
      style={{
        position: "absolute",
        top: 12,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 15,
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "8px 12px 8px 10px",
        background: "linear-gradient(135deg, rgba(15, 6, 36, 0.9), rgba(24, 10, 56, 0.9))",
        border: "1px solid rgba(251, 191, 36, 0.4)",
        borderRadius: 999,
        boxShadow: "0 10px 30px rgba(0,0,0,0.5), 0 0 40px rgba(251, 191, 36, 0.15)",
        backdropFilter: "blur(12px)",
        color: "#fff",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        fontSize: 12,
        maxWidth: "min(92vw, 780px)",
        pointerEvents: "auto",
      }}
    >
      {proposal.imageUrl ? (
        // 32px thumb through the same-origin proxy (right-sized WebP)
        // instead of the raw gateway original, which cost up to 250 KB on
        // every /board load.
        <IpfsImage
          cid={proposal.imageUrl}
          alt=""
          displayWidth={32}
          style={{
            width: 32,
            height: 32,
            flexShrink: 0,
            borderRadius: 6,
            objectFit: "cover",
            border: "1px solid rgba(251, 191, 36, 0.5)",
          }}
        />
      ) : null}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
          flex: 1,
        }}
      >
        <div
          className="foid-label"
          style={{
            color: "#fbbf24",
            fontWeight: 700,
          }}
        >
          proposal of the day
        </div>
        <div
          className="foid-data"
          style={{
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          <span style={{ color: "#74ffeb", fontWeight: 700 }}>#{proposal.id}</span>{" "}
          by {shortAddr(proposal.proposer)} · {proposal.forCount} votes
        </div>
      </div>
      <button
        type="button"
        onClick={() => onView?.(proposal)}
        className="foid-label"
        style={{
          padding: "4px 10px",
          background: "rgba(116, 255, 235, 0.1)",
          border: "1px solid rgba(116, 255, 235, 0.4)",
          color: "#74ffeb",
          fontWeight: 700,
          borderRadius: 6,
          cursor: "pointer",
        }}
        aria-label={`View proposal ${proposal.id}`}
      >
        view
      </button>
      <button
        type="button"
        onClick={() => onVote?.(proposal)}
        className="foid-label"
        style={{
          padding: "4px 10px",
          background: "linear-gradient(135deg, #fbbf24, #f472b6)",
          border: "1px solid rgba(251, 191, 36, 0.6)",
          color: "#0e0f2b",
          fontWeight: 800,
          borderRadius: 6,
          cursor: "pointer",
        }}
        aria-label={`Vote on proposal ${proposal.id}`}
      >
        vote
      </button>
      <button
        type="button"
        onClick={() => {
          dismissFor(proposal.id);
          setDismissed(true);
          onDismiss?.();
        }}
        aria-label="Dismiss featured proposal"
        style={{
          width: 20,
          height: 20,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          background: "transparent",
          border: "none",
          color: "rgba(255,255,255,0.6)",
          fontSize: 14,
          cursor: "pointer",
          padding: 0,
        }}
      >
        ×
      </button>
    </div>
  );
}
