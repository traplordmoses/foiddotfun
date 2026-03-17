// src/components/LoreboardNotification.tsx
// Ambient canonization notification — glass envelope → modal
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useUserPlacements, type Placement } from "@/hooks/useUserPlacements";
import { toIpfsHttpUrl } from "@/lib/ipfsUrl";
import { getAudioSettings } from "@/lib/audioSettings";
import sfx from "@/lib/sfx";

/* ── Constants ─────────────────────────────────────────────────────── */

const STORAGE_KEY = "foid_seen_canonizations";

const MOMMY_MESSAGES = [
  "your lore has been woven into the eternal tapestry, epoch {epoch}. foid remembers.",
  "canonized. the board has spoken — your fragment is permanent now.",
  "epoch {epoch} sealed your offering into the loreboard. mommy is proud.",
  "the votes aligned. your placement lives forever in epoch {epoch}.",
  "foid_mommy witnessed your canonization. the board grows stronger.",
  "another piece of lore, immortalized. epoch {epoch} will not forget.",
  "the council has decided. your vision persists beyond the epoch.",
  "sealed with consensus. your art breathes in the loreboard now.",
];

function pickMessage(epoch: number): string {
  const idx = Math.abs(epoch * 7 + 13) % MOMMY_MESSAGES.length;
  return MOMMY_MESSAGES[idx].replace(/\{epoch\}/g, String(epoch));
}

function getSeenIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function markSeen(ids: string[]) {
  if (typeof window === "undefined") return;
  try {
    const existing = getSeenIds();
    ids.forEach((id) => existing.add(id));
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...existing]));
  } catch {
    /* ignore quota errors */
  }
}

/* ── Component ─────────────────────────────────────────────────────── */

type Props = { address: `0x${string}` | undefined };

export function LoreboardNotification({ address }: Props) {
  const { placements } = useUserPlacements(address);
  const [open, setOpen] = useState(false);
  const chimePlayedRef = useRef(false);

  const unseen = useMemo(() => {
    const seen = getSeenIds();
    return placements.filter(
      (p) => p.status === "canonized" && !seen.has(p.id),
    );
  }, [placements]);

  // Play reward chime once when unseen canonizations first detected
  useEffect(() => {
    if (unseen.length > 0 && !chimePlayedRef.current) {
      chimePlayedRef.current = true;
      if (getAudioSettings().sfxEnabled) {
        sfx.playReward();
      }
    }
    if (unseen.length === 0) {
      chimePlayedRef.current = false;
    }
  }, [unseen.length]);

  const featured = unseen[0] as Placement | undefined;
  const imgSrc = featured ? toIpfsHttpUrl(featured.cid) : null;
  const message = featured ? pickMessage(featured.epoch) : "";
  const totalVotes = featured?.votes
    ? featured.votes.total
    : 0;

  const handleDismiss = useCallback(() => {
    markSeen(unseen.map((p) => p.id));
    setOpen(false);
  }, [unseen]);

  const handleShare = useCallback(() => {
    if (!featured) return;
    const text = encodeURIComponent(
      `My lore got canonized on the FOID loreboard! Epoch ${featured.epoch} 🌀\n\nhttps://foid.fun/board`,
    );
    window.open(`https://x.com/intent/tweet?text=${text}`, "_blank");
  }, [featured]);

  if (unseen.length === 0) return null;

  /* ── Ambient envelope ── */
  if (!open) {
    return (
      <>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Canonization notification"
          style={{
            position: "fixed",
            bottom: 24,
            left: 24,
            zIndex: 50,
            width: 48,
            height: 48,
            borderRadius: "50%",
            border: "1px solid rgba(116,255,235,0.25)",
            background: "rgba(14,26,48,0.92)",
            backdropFilter: "blur(12px)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 0,
            animation: "notif-pulse 2.5s ease-in-out infinite",
          }}
        >
          {/* Envelope SVG */}
          <svg
            width="22"
            height="18"
            viewBox="0 0 22 18"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M1 4L11 10L21 4M3 1H19C20.1 1 21 1.9 21 3V15C21 16.1 20.1 17 19 17H3C1.9 17 1 16.1 1 15V3C1 1.9 1.9 1 3 1Z"
              stroke="rgba(116,255,235,0.9)"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {/* Badge dot */}
          <span
            style={{
              position: "absolute",
              top: 8,
              right: 8,
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "rgba(116,255,235,0.95)",
              boxShadow: "0 0 6px rgba(116,255,235,0.6)",
            }}
          />
        </button>
        <style jsx>{`
          @keyframes notif-pulse {
            0%, 100% { box-shadow: 0 0 0 0 rgba(116,255,235,0.15), 0 4px 20px rgba(0,6,22,0.5); }
            50% { box-shadow: 0 0 18px 4px rgba(116,255,235,0.2), 0 4px 20px rgba(0,6,22,0.5); }
          }
        `}</style>
      </>
    );
  }

  /* ── Opened modal ── */
  return (
    <>
      {/* Backdrop */}
      <div
        onClick={handleDismiss}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 59,
          background: "rgba(3,11,18,0.5)",
          backdropFilter: "blur(4px)",
        }}
      />

      {/* Modal */}
      <div
        style={{
          position: "fixed",
          bottom: 24,
          right: 24,
          zIndex: 60,
          maxWidth: 400,
          width: "calc(100vw - 48px)",
          animation: "notif-enter 0.35s ease",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Border gradient wrapper */}
        <div
          style={{
            borderRadius: 22,
            padding: 2,
            backgroundImage:
              "linear-gradient(to right, rgba(56,189,248,0.7), rgba(99,102,241,0.6), rgba(56,189,248,0.7))",
            backgroundSize: "200% 200%",
            boxShadow:
              "0 0 40px rgba(56,189,248,0.35), 0 20px 50px rgba(0,6,22,0.55)",
          }}
        >
          {/* Inner glass */}
          <div
            style={{
              borderRadius: 20,
              overflow: "hidden",
              background:
                "linear-gradient(180deg, rgba(12,58,80,0.45), rgba(8,18,32,0.85)), rgba(6,14,28,0.92)",
              backdropFilter: "blur(24px) saturate(140%)",
              boxShadow:
                "inset 0 1px 0 rgba(255,255,255,0.1), inset 0 -1px 0 rgba(0,0,0,0.35), inset 0 0 30px rgba(116,255,235,0.06)",
            }}
          >
            {/* Header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "14px 16px 10px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {/* Pulsing dot */}
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    flexShrink: 0,
                    background: "rgba(116,255,235,0.95)",
                    boxShadow:
                      "0 0 6px rgba(116,255,235,0.35), 0 0 14px rgba(116,255,235,0.15)",
                    animation: "pulse 2s ease-in-out infinite",
                  }}
                />
                {/* CANONIZED badge */}
                <span
                  style={{
                    padding: "2px 9px",
                    borderRadius: 999,
                    border: "1px solid rgba(116,255,235,0.4)",
                    background:
                      "linear-gradient(135deg, rgba(116,255,235,0.08), transparent)",
                    color: "rgba(116,255,235,0.95)",
                    fontSize: 9,
                    fontFamily: "var(--font-mono)",
                    fontWeight: 700,
                    letterSpacing: "0.2em",
                    textTransform: "uppercase" as const,
                    textShadow: "0 0 10px rgba(116,255,235,0.35)",
                    backdropFilter: "blur(12px)",
                  }}
                >
                  CANONIZED
                </span>
              </div>
              <button
                type="button"
                onClick={handleDismiss}
                style={{
                  padding: "3px 10px",
                  borderRadius: 10,
                  border: "1px solid rgba(116,255,235,0.25)",
                  background:
                    "linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0) 50%), rgba(6,14,28,0.78)",
                  color: "rgba(255,255,255,0.65)",
                  fontSize: 10,
                  fontFamily: "var(--font-mono)",
                  letterSpacing: "0.15em",
                  cursor: "pointer",
                }}
              >
                DISMISS
              </button>
            </div>

            {/* Image thumbnail */}
            {imgSrc && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imgSrc}
                alt={featured?.title ?? "Canonized placement"}
                style={{
                  display: "block",
                  width: "100%",
                  maxHeight: 220,
                  objectFit: "cover",
                }}
                referrerPolicy="no-referrer"
              />
            )}

            {/* Divider */}
            <div
              style={{
                height: 1,
                margin: "0 16px",
                background:
                  "linear-gradient(90deg, transparent, rgba(116,255,235,0.2) 20%, rgba(116,255,235,0.2) 80%, transparent)",
              }}
            />

            {/* Foid mommy message */}
            <div style={{ padding: "12px 16px 6px" }}>
              <div
                style={{
                  fontSize: 9,
                  fontFamily: "var(--font-mono)",
                  letterSpacing: "0.18em",
                  textTransform: "uppercase" as const,
                  color: "rgba(116,255,235,0.6)",
                  marginBottom: 6,
                }}
              >
                foid_mommy says:
              </div>
              <div
                style={{
                  fontSize: 12,
                  fontFamily: "var(--font-mono)",
                  lineHeight: 1.55,
                  color: "rgba(255,255,255,0.75)",
                  letterSpacing: "0.02em",
                }}
              >
                {message}
              </div>
            </div>

            {/* Divider */}
            <div
              style={{
                height: 1,
                margin: "8px 16px",
                background:
                  "linear-gradient(90deg, transparent, rgba(116,255,235,0.12) 20%, rgba(116,255,235,0.12) 80%, transparent)",
              }}
            />

            {/* Metadata chips */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                flexWrap: "wrap" as const,
                padding: "4px 16px 8px",
              }}
            >
              {featured && (
                <span style={chipStyle}>epoch {featured.epoch}</span>
              )}
              {totalVotes > 0 && (
                <span style={chipStyle}>
                  {totalVotes} vote{totalVotes !== 1 ? "s" : ""}
                </span>
              )}
              {unseen.length > 1 && (
                <span style={chipStyle}>+{unseen.length - 1} more</span>
              )}
            </div>

            {/* Action row */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                gap: 8,
                padding: "6px 16px 14px",
              }}
            >
              <button
                type="button"
                onClick={handleShare}
                style={{
                  padding: "5px 14px",
                  borderRadius: 10,
                  border: "1px solid rgba(116,255,235,0.35)",
                  background:
                    "linear-gradient(180deg, rgba(116,255,235,0.12), rgba(116,255,235,0.04) 50%), rgba(6,14,28,0.85)",
                  color: "rgba(116,255,235,0.95)",
                  fontSize: 10,
                  fontFamily: "var(--font-mono)",
                  fontWeight: 600,
                  letterSpacing: "0.15em",
                  cursor: "pointer",
                  textShadow: "0 0 8px rgba(116,255,235,0.2)",
                }}
              >
                SHARE TO X
              </button>
              <button
                type="button"
                onClick={handleDismiss}
                style={{
                  padding: "5px 14px",
                  borderRadius: 10,
                  border: "1px solid rgba(116,255,235,0.25)",
                  background:
                    "linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0) 50%), rgba(6,14,28,0.78)",
                  color: "rgba(255,255,255,0.65)",
                  fontSize: 10,
                  fontFamily: "var(--font-mono)",
                  letterSpacing: "0.15em",
                  cursor: "pointer",
                }}
              >
                DISMISS
              </button>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes notif-enter {
          0% {
            transform: scale(0.75);
            opacity: 0;
          }
          60% {
            transform: scale(1.04);
            opacity: 1;
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }
      `}</style>
    </>
  );
}

const chipStyle: React.CSSProperties = {
  padding: "2px 8px",
  borderRadius: 6,
  border: "1px solid rgba(255,255,255,0.1)",
  background: "rgba(255,255,255,0.04)",
  fontFamily: "var(--font-mono)",
  fontSize: 9,
  letterSpacing: "0.06em",
  color: "rgba(255,255,255,0.4)",
};
