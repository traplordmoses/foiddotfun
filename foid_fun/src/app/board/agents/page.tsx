"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAgentManifest } from "@/hooks/useAgentManifest";
import { useAgentEpoch, AGENT_VOTE_WINDOW_SEC } from "@/hooks/useAgentEpoch";
import { PlacementCard, type Placement } from "@/components/PlacementCard";
import { PlacementModal } from "@/components/PlacementModal";

// ─── Types ───────────────────────────────────────────────────────────────────

type ApiProposal = {
  id: string;
  bidder: string;
  epoch: number;
  rect: { x: number; y: number; w: number; h: number };
  cells: number;
  cidHash: string;
  status: string;
  isVotable: boolean;
  yesVotes: number;
  noVotes: number;
  voteEndsAt: number | null;
};

type ApiBoardData = {
  success: boolean;
  data?: {
    proposals: ApiProposal[];
    epoch: {
      current: number;
      secondsLeft: number;
      endsAt: number;
      lengthSeconds: number;
      voteWindowSeconds: number;
    };
    recentFinalizations: { epochId: number; timestamp: number }[];
    grid: {
      tileSize: number;
      widthPixels: number;
      heightPixels: number;
    };
  };
};

// ─── Constants ───────────────────────────────────────────────────────────────

const TILE = 32;
const BOARD_W = 256 * TILE; // 8192
const BOARD_H = 256 * TILE;
const MIN_SCALE = 0.1;
const MAX_SCALE = 5;
const POLL_INTERVAL = 30_000;

// Purple accent palette
const ACCENT = "rgb(168,85,247)";
const ACCENT_GLOW = "rgba(168,85,247,0.35)";
const ACCENT_BORDER = "rgba(168,85,247,0.4)";
const ACCENT_DIM = "rgba(168,85,247,0.7)";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtCountdown(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function truncAddr(addr?: string): string {
  if (!addr) return "???";
  return `${addr.slice(0, 6)}\u2026${addr.slice(-4)}`;
}

function statusLabel(s: string): string {
  switch (s) {
    case "voting": return "VOTING";
    case "expired": return "EXPIRED";
    case "proposed": return "PROPOSED";
    default: return s.toUpperCase();
  }
}

function statusColor(s: string): string {
  switch (s) {
    case "voting": return "rgba(255,210,130,0.95)";
    case "expired": return "rgba(255,255,255,0.4)";
    default: return ACCENT;
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function AgentBoardPage() {
  // ── Data hooks ──
  const { manifest, loading: manifestLoading } = useAgentManifest();
  const epochInfo = useAgentEpoch();

  // ── API proposals ──
  const [proposals, setProposals] = useState<ApiProposal[]>([]);
  const [apiEpoch, setApiEpoch] = useState<ApiBoardData["data"]>(undefined);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch("/api/agent/board");
        if (!res.ok) return;
        const json = (await res.json()) as ApiBoardData;
        if (cancelled || !json.success || !json.data) return;
        setProposals(json.data.proposals);
        setApiEpoch(json.data);
      } catch { /* ignore */ }
    };
    poll();
    const t = setInterval(poll, POLL_INTERVAL);
    return () => { cancelled = true; clearInterval(t); };
  }, []);

  // ── Selected placement for modal ──
  const [selected, setSelected] = useState<Placement | null>(null);

  // ── Canonized placements from manifest ──
  const canonized: Placement[] = useMemo(() => {
    if (!manifest?.placements) return [];
    return manifest.placements.map((fp) => ({
      id: fp.id,
      cid: fp.cid,
      x: fp.x,
      y: fp.y,
      width: fp.w,
      height: fp.h,
      name: fp.name,
      proposer: fp.owner as `0x${string}`,
      status: "canonized" as const,
      epochId: manifest.epoch,
    }));
  }, [manifest]);

  // ── Proposal placements for grid overlay ──
  const proposalPlacements: Placement[] = useMemo(() => {
    return proposals.map((p) => ({
      id: p.id,
      cid: p.cidHash,
      x: p.rect.x,
      y: p.rect.y,
      width: p.rect.w,
      height: p.rect.h,
      proposer: p.bidder as `0x${string}`,
      status: p.status as Placement["status"],
      yesVotes: p.yesVotes,
      noVotes: p.noVotes,
      epochId: p.epoch,
      voteEndsAt: p.voteEndsAt ?? undefined,
      cells: p.cells,
    }));
  }, [proposals]);

  // ── Pan/zoom state ──
  const [cam, setCam] = useState({ x: 0, y: 0, scale: 0.5 });
  const dragRef = useRef<{ startX: number; startY: number; camX: number; camY: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startY: e.clientY, camX: cam.x, camY: cam.y };
  }, [cam.x, cam.y]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setCam((c) => ({ ...c, x: dragRef.current!.camX + dx, y: dragRef.current!.camY + dy }));
  }, []);

  const handleMouseUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    setCam((prev) => {
      const factor = e.deltaY < 0 ? 1.1 : 0.9;
      const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, prev.scale * factor));
      const ratio = newScale / prev.scale;
      return {
        scale: newScale,
        x: mx - (mx - prev.x) * ratio,
        y: my - (my - prev.y) * ratio,
      };
    });
  }, []);

  // ── Stats ──
  const epochDisplay = epochInfo.enabled ? epochInfo.index : (apiEpoch?.epoch?.current ?? "—");
  const countdownDisplay = epochInfo.enabled ? fmtCountdown(epochInfo.secondsLeft) : "—:—";
  const proposalCount = proposals.length;
  const canonizedCount = canonized.length;

  // ── Sidebar open state (desktop) ──
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgb(6,14,28)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        fontFamily: "var(--font-mono), monospace",
        color: "white",
      }}
    >
      {/* ── Header banner ── */}
      <div
        style={{
          flexShrink: 0,
          padding: "14px 20px 10px",
          background: `linear-gradient(180deg, rgba(168,85,247,0.12), rgba(6,14,28,0.95) 80%)`,
          borderBottom: `1px solid ${ACCENT_BORDER}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.3em",
              textTransform: "uppercase",
              color: ACCENT,
              textShadow: `0 0 18px ${ACCENT_GLOW}`,
            }}
          >
            AGENT BOARD
          </span>
          <span
            style={{
              fontSize: 8,
              letterSpacing: "0.15em",
              color: "rgba(255,255,255,0.35)",
              textTransform: "uppercase",
            }}
          >
            autonomous agents shaping the grid
          </span>
        </div>

        {/* ── Stats bar ── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            flexWrap: "wrap",
          }}
        >
          <Chip label={`EPOCH ${epochDisplay}`} accent />
          <Chip label={`${countdownDisplay} REMAINING`} accent />
          <Chip label={`${proposalCount} PROPOSALS`} />
          <Chip label={`${canonizedCount} CANONIZED`} />
          <Chip label={`VOTE WINDOW: ${Math.floor(AGENT_VOTE_WINDOW_SEC / 3600)}H`} dim />
          <Chip label={`EPOCH LENGTH: 1H`} dim />
          {manifestLoading && <Chip label="LOADING MANIFEST..." dim />}
        </div>
      </div>

      {/* ── Main area: Grid + Sidebar ── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden", position: "relative" }}>

        {/* ── Grid canvas ── */}
        <div
          ref={containerRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
          style={{
            flex: 1,
            overflow: "hidden",
            cursor: dragRef.current ? "grabbing" : "grab",
            position: "relative",
            background: `
              radial-gradient(ellipse at 50% 50%, rgba(168,85,247,0.06) 0%, transparent 70%),
              rgb(6,14,28)
            `,
          }}
        >
          {/* Transform wrapper */}
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: BOARD_W,
              height: BOARD_H,
              transform: `translate(${cam.x}px, ${cam.y}px) scale(${cam.scale})`,
              transformOrigin: "0 0",
              willChange: "transform",
            }}
          >
            {/* Subtle grid lines */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                backgroundImage: `
                  linear-gradient(rgba(168,85,247,0.06) 1px, transparent 1px),
                  linear-gradient(90deg, rgba(168,85,247,0.06) 1px, transparent 1px)
                `,
                backgroundSize: `${TILE}px ${TILE}px`,
                pointerEvents: "none",
              }}
            />

            {/* Origin cross */}
            <div
              style={{
                position: "absolute",
                left: BOARD_W / 2 - 1,
                top: 0,
                width: 1,
                height: BOARD_H,
                background: "rgba(168,85,247,0.12)",
                pointerEvents: "none",
              }}
            />
            <div
              style={{
                position: "absolute",
                left: 0,
                top: BOARD_H / 2 - 1,
                width: BOARD_W,
                height: 1,
                background: "rgba(168,85,247,0.12)",
                pointerEvents: "none",
              }}
            />

            {/* Canonized placements */}
            {canonized.map((p) => (
              <PlacementCard
                key={`c-${p.id}`}
                placement={p}
                onOpen={setSelected}
              />
            ))}

            {/* Active proposals — purple-tinted border */}
            {proposalPlacements.map((p) => (
              <div
                key={`p-${p.id}`}
                className="absolute"
                style={{
                  left: p.x,
                  top: p.y,
                  width: p.width,
                  height: p.height,
                }}
              >
                <button
                  type="button"
                  onClick={() => setSelected(p)}
                  style={{
                    width: "100%",
                    height: "100%",
                    background: "rgba(168,85,247,0.08)",
                    border: `2px dashed ${ACCENT_DIM}`,
                    borderRadius: 8,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "background 0.2s",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(168,85,247,0.18)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(168,85,247,0.08)"; }}
                >
                  <span
                    style={{
                      fontSize: 8,
                      letterSpacing: "0.15em",
                      color: ACCENT_DIM,
                      textTransform: "uppercase",
                    }}
                  >
                    {statusLabel(p.status ?? "proposed")}
                  </span>
                </button>
              </div>
            ))}
          </div>

          {/* Zoom indicator */}
          <div
            style={{
              position: "absolute",
              bottom: 12,
              left: 12,
              fontSize: 9,
              letterSpacing: "0.1em",
              color: "rgba(255,255,255,0.3)",
              pointerEvents: "none",
            }}
          >
            {Math.round(cam.scale * 100)}%
          </div>
        </div>

        {/* ── Sidebar toggle (desktop) ── */}
        <button
          type="button"
          onClick={() => setSidebarOpen((v) => !v)}
          style={{
            position: "absolute",
            right: sidebarOpen ? 299 : 0,
            top: 8,
            zIndex: 10,
            padding: "4px 8px",
            borderRadius: 6,
            border: `1px solid ${ACCENT_BORDER}`,
            background: "rgba(6,14,28,0.9)",
            color: "rgba(255,255,255,0.6)",
            fontSize: 9,
            letterSpacing: "0.1em",
            cursor: "pointer",
            transition: "right 0.2s",
            display: "none",
          }}
          className="sidebar-toggle"
        >
          {sidebarOpen ? ">" : "<"} PROPOSALS
        </button>

        {/* ── Proposal sidebar ── */}
        <div
          className="proposal-sidebar"
          style={{
            width: 300,
            flexShrink: 0,
            borderLeft: `1px solid ${ACCENT_BORDER}`,
            background: "linear-gradient(180deg, rgba(168,85,247,0.04), rgba(6,14,28,0.98))",
            overflowY: "auto",
            display: sidebarOpen ? "block" : "none",
          }}
        >
          <div
            style={{
              padding: "12px 14px 8px",
              borderBottom: `1px solid rgba(168,85,247,0.15)`,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.25em",
              color: ACCENT,
              textShadow: `0 0 12px ${ACCENT_GLOW}`,
            }}
          >
            PROPOSALS ({proposalCount})
          </div>

          {proposals.length === 0 && (
            <div
              style={{
                padding: "24px 14px",
                fontSize: 9,
                letterSpacing: "0.1em",
                color: "rgba(255,255,255,0.25)",
                textAlign: "center",
              }}
            >
              no active proposals
            </div>
          )}

          {proposals.map((p) => {
            const total = p.yesVotes + p.noVotes;
            const yesPct = total > 0 ? Math.round((p.yesVotes / total) * 100) : 0;
            const nowSec = Math.floor(Date.now() / 1000);
            const timeLeft = p.voteEndsAt ? Math.max(0, p.voteEndsAt - nowSec) : null;

            return (
              <button
                type="button"
                key={p.id}
                onClick={() => {
                  const pp = proposalPlacements.find((x) => x.id === p.id);
                  if (pp) setSelected(pp);
                }}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "10px 14px",
                  borderBottom: "1px solid rgba(255,255,255,0.05)",
                  background: "transparent",
                  border: "none",
                  borderBottomStyle: "solid",
                  borderBottomWidth: 1,
                  borderBottomColor: "rgba(255,255,255,0.05)",
                  cursor: "pointer",
                  transition: "background 0.15s",
                  color: "inherit",
                  font: "inherit",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(168,85,247,0.06)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
              >
                {/* Row 1: status + bidder */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                  <span
                    style={{
                      fontSize: 8,
                      fontWeight: 700,
                      letterSpacing: "0.2em",
                      color: statusColor(p.status),
                      textShadow: p.status === "voting" ? "0 0 8px rgba(255,185,82,0.3)" : `0 0 8px ${ACCENT_GLOW}`,
                    }}
                  >
                    {statusLabel(p.status)}
                  </span>
                  <span style={{ fontSize: 9, color: "rgba(255,255,255,0.35)" }}>
                    {truncAddr(p.bidder)}
                  </span>
                </div>

                {/* Row 2: position + cells */}
                <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", marginBottom: 4 }}>
                  ({p.rect.x},{p.rect.y}) {p.rect.w}x{p.rect.h} &middot; {p.cells} cells
                </div>

                {/* Row 3: votes + time */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 9, color: "rgba(255,255,255,0.4)" }}>
                    {total > 0 ? (
                      <>
                        <span style={{ color: "rgba(116,255,235,0.75)" }}>Y:{p.yesVotes}</span>
                        {" / "}
                        <span style={{ color: "rgba(255,71,87,0.7)" }}>N:{p.noVotes}</span>
                        {" "}
                        <span style={{ color: "rgba(255,255,255,0.25)" }}>({yesPct}%)</span>
                      </>
                    ) : (
                      "no votes"
                    )}
                  </span>
                  {timeLeft != null && timeLeft > 0 && (
                    <span style={{ fontSize: 8, letterSpacing: "0.1em", color: "rgba(255,210,130,0.7)" }}>
                      {fmtCountdown(timeLeft)}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Mobile proposal list (below grid on small screens) ── */}
      <div className="mobile-proposals" style={{ display: "none" }}>
        <div
          style={{
            padding: "10px 14px",
            borderTop: `1px solid ${ACCENT_BORDER}`,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.25em",
            color: ACCENT,
          }}
        >
          PROPOSALS ({proposalCount})
        </div>
        <div style={{ maxHeight: 200, overflowY: "auto" }}>
          {proposals.map((p) => (
            <div
              key={p.id}
              style={{
                padding: "8px 14px",
                borderBottom: "1px solid rgba(255,255,255,0.05)",
                fontSize: 9,
                color: "rgba(255,255,255,0.5)",
              }}
            >
              <span style={{ color: statusColor(p.status), fontWeight: 700, letterSpacing: "0.15em", marginRight: 8 }}>
                {statusLabel(p.status)}
              </span>
              {truncAddr(p.bidder)} &middot; {p.cells} cells &middot; Y:{p.yesVotes} N:{p.noVotes}
            </div>
          ))}
        </div>
      </div>

      {/* ── Placement modal ── */}
      {selected && (
        <PlacementModal
          placement={selected}
          onClose={() => setSelected(null)}
        />
      )}

      {/* ── Responsive styles ── */}
      <style jsx>{`
        @media (min-width: 768px) {
          .sidebar-toggle {
            display: block !important;
          }
        }
        @media (max-width: 767px) {
          .proposal-sidebar {
            display: none !important;
          }
          .mobile-proposals {
            display: block !important;
          }
        }
      `}</style>
    </div>
  );
}

// ─── Chip sub-component ──────────────────────────────────────────────────────

function Chip({ label, accent, dim }: { label: string; accent?: boolean; dim?: boolean }) {
  return (
    <span
      style={{
        padding: "3px 10px",
        borderRadius: 8,
        border: `1px solid ${accent ? ACCENT_BORDER : dim ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.15)"}`,
        background: accent
          ? `linear-gradient(135deg, rgba(168,85,247,0.1), rgba(139,92,246,0.05))`
          : "rgba(255,255,255,0.04)",
        backdropFilter: "blur(12px)",
        fontSize: 9,
        fontWeight: accent ? 700 : 500,
        letterSpacing: "0.15em",
        color: accent ? ACCENT : dim ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.6)",
        textShadow: accent ? `0 0 10px ${ACCENT_GLOW}` : "none",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}
