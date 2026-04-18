// src/components/PlacementModal.tsx
// Metadata overlay — Frutiger Aero glass treatment
import { useMemo, useState } from "react";
import { ipfsToHttp } from "@/lib/ipfsUrl";
import type { Placement } from "./PlacementCard";
import { IconButton, NeonBadge, StatusDot, type NeonBadgeTone } from "@/components/ui";

type Props = {
  placement: Placement;
  onClose: () => void;
};

/* ── Helpers ──────────────────────────────────────────────────────── */

function truncateAddress(addr?: string): string {
  if (!addr) return "unknown";
  return `${addr.slice(0, 6)}\u2026${addr.slice(-4)}`;
}

function formatTimeLeft(seconds?: number): string {
  if (seconds == null || seconds <= 0) return "ended";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m left`;
  return `${m}m left`;
}

type StatusKey = NonNullable<Placement["status"]>;

// Each placement status maps to a <NeonBadge /> tone. The old STATUS_STYLES
// table encoded the same four-color quad (bg/border/text/glow) inline per
// status; moving to tones folds those into tokens.css so a design-system
// tweak doesn't require touching this file.
const STATUS_TONE: Record<StatusKey, { label: string; tone: NeonBadgeTone }> = {
  canonized: { label: "CANONIZED", tone: "info" },
  voting:    { label: "IN VOTING", tone: "warn" },
  proposed:  { label: "PROPOSED",  tone: "info" },
  accepted:  { label: "ACCEPTED",  tone: "ok" },
  rejected:  { label: "REJECTED",  tone: "err" },
  expired:   { label: "EXPIRED",   tone: "info" },
};

/* ── Component ───────────────────────────────────────────────────── */

export function PlacementModal({ placement, onClose }: Props) {
  const { cid, name, proposer, status, yesVotes, noVotes, voters, secondsLeft, epochId, epochSubmitted, cells } = placement;

  const urls = useMemo(() => ipfsToHttp(cid), [cid]);
  const [gatewayIdx, setGatewayIdx] = useState(0);
  const src = urls[gatewayIdx] ?? `https://ipfs.io/ipfs/${cid}`;

  const handleError = () => {
    const next = gatewayIdx + 1;
    if (next < urls.length) setGatewayIdx(next);
  };

  const sCfg = status ? STATUS_TONE[status] : null;
  const hasVotes = yesVotes != null && noVotes != null;
  const totalVotes = (yesVotes ?? 0) + (noVotes ?? 0);
  const yesPercent = hasVotes && totalVotes > 0 ? ((yesVotes ?? 0) / totalVotes) * 100 : 0;
  const isVoting = status === "voting";

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center"
      onClick={onClose}
      style={{
        background: "rgba(3,11,18,0.72)",
        backdropFilter: "blur(8px) saturate(120%)",
      }}
    >
      <div
        className="relative max-h-[90vh] max-w-[90vw]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header row ── */}
        <div
          className="mb-3 flex items-center justify-between"
          style={{ fontFamily: "var(--font-terminal)", fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase" as const }}
        >
          <span style={{ color: "rgba(116,255,235,0.95)", textShadow: "0 0 12px rgba(116,255,235,0.28)" }}>
            FOID LORE
          </span>
          {/* Close uses <IconButton> so keyboard + screen-reader users get an
              accessible name and focus ring without custom handling. */}
          <IconButton
            icon="×"
            label="Close placement detail"
            onClick={onClose}
            size="sm"
          />
        </div>

        {/* ── Aero border wrapper — contains BOTH image and metadata ── */}
        <div
          className="animate-aero-border"
          style={{
            borderRadius: 22,
            padding: 2,
            backgroundImage: "linear-gradient(to right, rgba(56,189,248,0.7), rgba(99,102,241,0.6), rgba(56,189,248,0.7))",
            backgroundSize: "200% 200%",
            boxShadow: "0 0 40px rgba(56,189,248,0.35), 0 20px 50px rgba(0,6,22,0.55)",
          }}
        >
          {/* Inner glass container */}
          <div
            style={{
              borderRadius: 20,
              overflow: "hidden",
              background: "linear-gradient(180deg, rgba(12,58,80,0.45), rgba(8,18,32,0.85)), linear-gradient(180deg, rgba(255,255,255,0.1), rgba(255,255,255,0) 35%), rgba(6,14,28,0.92)",
              backdropFilter: "blur(24px) saturate(140%)",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.1), inset 0 -1px 0 rgba(0,0,0,0.35), inset 0 0 30px rgba(116,255,235,0.06)",
            }}
          >
            {/* Image — natural sizing, shrink-wraps to content */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={name ?? ""}
              style={{ display: "block", maxHeight: "70vh", maxWidth: "85vw", width: "auto", height: "auto" }}
              onError={handleError}
              referrerPolicy="no-referrer"
            />

            {/* ── Divider line ── */}
            <div style={{ height: 1, margin: "0 16px", background: "linear-gradient(90deg, transparent, rgba(116,255,235,0.2) 20%, rgba(116,255,235,0.2) 80%, transparent)" }} />

            {/* ── Metadata section ── */}
            <div style={{ padding: "14px 20px 16px", minWidth: 280 }}>

              {/* Row 1: Status badge + Epoch + Proposer */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {/* Pulsing dot — StatusDot gives us a single animation source. */}
                  <StatusDot status={status === "rejected" || status === "expired" ? "offline" : "online"} />
                  {/* Status badge — <NeonBadge /> pulls its tone from tokens. */}
                  {sCfg && (
                    <NeonBadge tone={sCfg.tone} live>
                      {sCfg.label}
                    </NeonBadge>
                  )}
                  {epochId != null && (
                    <span
                      style={{
                        fontSize: 9,
                        fontFamily: "var(--font-terminal)",
                        fontWeight: 600,
                        letterSpacing: "0.18em",
                        color: "rgba(116,255,235,0.7)",
                      }}
                    >
                      EPOCH&nbsp;{epochId}
                    </span>
                  )}
                </div>

                {proposer && (
                  <span style={{ fontSize: 10, fontFamily: "var(--font-terminal)", letterSpacing: "0.06em", color: "rgba(255,255,255,0.45)" }}>
                    by{" "}
                    <span style={{ color: "rgba(190,255,235,0.85)", textShadow: "0 0 8px rgba(116,255,235,0.2)" }}>
                      {truncateAddress(proposer)}
                    </span>
                  </span>
                )}
              </div>

              {/* Row 2: Vote bar — only when vote data exists */}
              {hasVotes && (
                <div style={{ marginBottom: 10 }}>
                  {/* Labels row */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontSize: 9, fontFamily: "var(--font-terminal)", letterSpacing: "0.1em", color: "rgba(255,255,255,0.4)" }}>
                      {totalVotes} vote{totalVotes !== 1 ? "s" : ""}
                      {voters != null && ` \u00b7 ${voters} voter${voters !== 1 ? "s" : ""}`}
                    </span>
                    {isVoting && secondsLeft != null && (
                      <span style={{ fontSize: 9, fontFamily: "var(--font-terminal)", letterSpacing: "0.12em", color: "rgba(255,210,130,0.8)", textShadow: "0 0 8px rgba(255,185,82,0.2)" }}>
                        {formatTimeLeft(secondsLeft)}
                      </span>
                    )}
                  </div>

                  {/* Bar track — matches the music player progress bar style */}
                  <div
                    style={{
                      height: 5,
                      borderRadius: 999,
                      background: "rgba(255,255,255,0.06)",
                      overflow: "hidden",
                      boxShadow: "inset 0 1px 2px rgba(0,0,0,0.3)",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        borderRadius: 999,
                        width: `${yesPercent}%`,
                        background: "linear-gradient(90deg, rgba(116,255,238,0.9), rgba(84,219,255,0.85))",
                        boxShadow: "0 0 8px rgba(84,219,255,0.5)",
                        transition: "width 0.5s ease",
                      }}
                    />
                  </div>

                  {/* Yes / No labels */}
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5 }}>
                    <span style={{ fontSize: 9, fontFamily: "var(--font-terminal)", fontWeight: 600, letterSpacing: "0.15em", color: "rgba(116,255,235,0.75)", textShadow: "0 0 6px rgba(116,255,235,0.2)" }}>
                      YES {yesVotes ?? 0}
                    </span>
                    <span style={{ fontSize: 9, fontFamily: "var(--font-terminal)", fontWeight: 600, letterSpacing: "0.15em", color: "rgba(255,71,87,0.7)", textShadow: "0 0 6px rgba(255,71,87,0.15)" }}>
                      NO {noVotes ?? 0}
                    </span>
                  </div>
                </div>
              )}

              {/* Row 3: Subtle metadata chips — styled like debug-stats spans */}
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" as const }}>
                {cells != null && (
                  <span style={chipStyle}>
                    {cells} cell{cells !== 1 ? "s" : ""}
                  </span>
                )}
                {epochSubmitted != null && (
                  <span style={chipStyle}>
                    submitted epoch {epochSubmitted}
                  </span>
                )}
                {name && (
                  <span style={{ ...chipStyle, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
                    {name}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* Reusable chip style matching the board debug-stats pattern */
const chipStyle: React.CSSProperties = {
  padding: "2px 8px",
  borderRadius: 6,
  border: "1px solid rgba(255,255,255,0.1)",
  background: "rgba(255,255,255,0.04)",
  fontFamily: "var(--font-terminal)",
  fontSize: 9,
  letterSpacing: "0.06em",
  color: "rgba(255,255,255,0.4)",
};
