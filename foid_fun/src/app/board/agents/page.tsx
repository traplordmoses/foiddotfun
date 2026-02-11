"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAccount, useDisconnect, useConnect } from "wagmi";
import { useAgentManifest } from "@/hooks/useAgentManifest";
import { useAgentEpoch, AGENT_VOTE_WINDOW_SEC } from "@/hooks/useAgentEpoch";
import { PlacementCard, type Placement } from "@/components/PlacementCard";
import { PlacementModal } from "@/components/PlacementModal";
import AppTitlebar from "@/app/(components)/AppTitlebar";

// ─── Types ───────────────────────────────────────────────────────────────────

type ApiBoardData = {
  success: boolean;
  data?: {
    proposals: { id: string; epoch: number }[];
    epoch: {
      current: number;
      secondsLeft: number;
    };
    recentFinalizations: { epochId: number; timestamp: number }[];
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtCountdown(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function AgentBoardPage() {
  // ── Wallet hooks (for AppTitlebar) ──
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { connect, connectors } = useConnect();

  const handleSwitchWallet = useCallback(() => {
    const injected = connectors.find((c) => c.id === "injected");
    if (injected) connect({ connector: injected });
  }, [connect, connectors]);

  // ── Data hooks ──
  const { manifest, loading: manifestLoading } = useAgentManifest();
  const epochInfo = useAgentEpoch();

  // ── API data (for proposal count + fallback epoch) ──
  const [proposalCount, setProposalCount] = useState(0);
  const [apiEpochCurrent, setApiEpochCurrent] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch("/api/agent/board");
        if (!res.ok) return;
        const json = (await res.json()) as ApiBoardData;
        if (cancelled || !json.success || !json.data) return;
        setProposalCount(json.data.proposals.length);
        setApiEpochCurrent(json.data.epoch.current);
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
  const epochDisplay = epochInfo.enabled ? epochInfo.index : (apiEpochCurrent ?? "\u2014");
  const countdownDisplay = epochInfo.enabled ? fmtCountdown(epochInfo.secondsLeft) : "\u2014:\u2014";
  const canonizedCount = canonized.length;

  return (
    <main className="agent-board-page overflow-hidden flex h-[calc(100vh-12px)] flex-col">
      <div className="agent-board-shell">
        <div className="pray-grid">
          {/* Vista window container — matches main board */}
          <div className="vista-window vista-window--terminal w-full flex flex-col pray-panel pray-panel--main agent-board-window">
            <AppTitlebar
              title="AGENT_LOREBOARD.APP"
              connected={isConnected}
              address={address}
              onDisconnect={() => disconnect()}
              onSwitchWallet={handleSwitchWallet}
            />

            {/* Vista window body */}
            <div className="vista-window__body vista-window__body--flush mt-2 agent-board-body">

              {/* ── Purple header banner ── */}
              <div className="agent-board-header">
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
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <Chip label={`EPOCH ${epochDisplay}`} accent />
                  <Chip label={`${countdownDisplay} REMAINING`} accent />
                  <Chip label={`${proposalCount} PROPOSALS`} />
                  <Chip label={`${canonizedCount} CANONIZED`} />
                  <Chip label={`VOTE WINDOW: ${Math.floor(AGENT_VOTE_WINDOW_SEC / 3600)}H`} dim />
                  <Chip label="EPOCH LENGTH: 1H" dim />
                  {manifestLoading && <Chip label="LOADING MANIFEST..." dim />}
                </div>
              </div>

              {/* ── Grid canvas (full width, no sidebar) ── */}
              <div
                ref={containerRef}
                className="agent-board-canvas"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onWheel={handleWheel}
                style={{ cursor: dragRef.current ? "grabbing" : "grab" }}
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
                  <div style={{ position: "absolute", left: BOARD_W / 2 - 1, top: 0, width: 1, height: BOARD_H, background: "rgba(168,85,247,0.12)", pointerEvents: "none" }} />
                  <div style={{ position: "absolute", left: 0, top: BOARD_H / 2 - 1, width: BOARD_W, height: 1, background: "rgba(168,85,247,0.12)", pointerEvents: "none" }} />

                  {/* Canonized placements */}
                  {canonized.map((p) => (
                    <PlacementCard key={`c-${p.id}`} placement={p} onOpen={setSelected} />
                  ))}
                </div>

                {/* Zoom indicator */}
                <div style={{ position: "absolute", bottom: 12, left: 12, fontSize: 9, letterSpacing: "0.1em", color: "rgba(255,255,255,0.3)", pointerEvents: "none" }}>
                  {Math.round(cam.scale * 100)}%
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>

      {/* ── Placement modal ── */}
      {selected && (
        <PlacementModal
          placement={selected}
          onClose={() => setSelected(null)}
        />
      )}

      {/* ── Scoped styles ── */}
      <style jsx>{`
        .agent-board-page {
          position: relative;
          background: transparent !important;
          overflow: hidden;
          padding: 0;
          width: 100%;
          z-index: 0;
          overscroll-behavior: contain;
        }
        .agent-board-shell {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          flex: 1 1 auto;
          width: 100%;
          min-height: 0;
          box-sizing: border-box;
          padding: clamp(6px, 1vw, 16px);
          position: relative;
          z-index: 1;
          overflow: hidden;
        }
        .agent-board-window {
          width: min(1800px, calc(100vw - clamp(16px, 1.5vw, 30px)));
          max-width: 100%;
          flex: 1 1 auto;
          display: flex;
          flex-direction: column;
          min-height: 0;
          margin: 0;
          box-shadow: none !important;
          border: none !important;
        }
        .agent-board-body {
          flex: 1 1 auto;
          min-height: 0;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .agent-board-header {
          flex-shrink: 0;
          padding: 14px 18px 10px;
          background: linear-gradient(180deg, rgba(168,85,247,0.12), transparent 80%);
          border-bottom: 1px solid ${ACCENT_BORDER};
        }
        .agent-board-canvas {
          flex: 1 1 auto;
          min-height: 0;
          overflow: hidden;
          position: relative;
          background:
            radial-gradient(ellipse at 50% 50%, rgba(168,85,247,0.06) 0%, transparent 70%),
            rgba(6,14,28,0.45);
        }
      `}</style>
    </main>
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
          ? "linear-gradient(135deg, rgba(168,85,247,0.1), rgba(139,92,246,0.05))"
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
