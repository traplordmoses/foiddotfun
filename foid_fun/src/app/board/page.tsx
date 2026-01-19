// /src/app/board/page.tsx - REDESIGNED v3
// Single seamless container matching foid_mommy_terminal.exe
// Features: Wallet dropdown, iPod music player, terminal chat with status, infinite smooth zoom
"use client";

import React, {
  useCallback,
  useMemo,
  useRef,
  useState,
  useEffect,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { useAccount, useChainId, useSwitchChain, useDisconnect, useConnect } from "wagmi";
import { useBoard } from "@/state/board";
import type { PendingItem } from "@/state/board";
import { TILE, snapRect, rectCells, hasOverlap, type Rect } from "@/lib/grid";
import {
  VIRTUAL_CANVAS_W,
  VIRTUAL_CANVAS_H,
  BOARD_OFFSET_X,
  BOARD_OFFSET_Y,
  WORLD_MAX_X,
  WORLD_MAX_Y,
  worldToContractRect,
} from "@/lib/boardSpace";
import { sniffImageType, mimeFromType } from "@/lib/image";
import { uploadImage } from "@/lib/ipfs";
import { cidToHttpUrl, ipfsToHttp } from "@/lib/ipfsUrl";
import { formatEth } from "@/lib/wei";
import { useEpochCountdown } from "@/hooks/useEpochCountdown";
import { useLatestManifestFromChain } from "@/hooks/useLatestManifestFromChain";
import { usePlacementVotes } from "@/hooks/usePlacementVotes";
import { useVoteOnPlacement } from "@/hooks/useVoteOnPlacement";
import { resolveEpochConfig, currentEpoch } from "@/lib/epoch";
import sfx from "@/lib/sfx";
import type { FinalizedPlacement } from "@/lib/types";
import { getLatestNormalized } from "@/lib/manifest";
import { listProposals } from "@/lib/api";
import type { ProposalSummary } from "@/lib/api";
import { writeProposePlacement } from "@/lib/viem";
import dynamic from "next/dynamic";
import { musicPanelController } from "@/components/musicPanelController";
import { PlacementCard, type Placement } from "@/components/PlacementCard";
import { PlacementModal } from "@/components/PlacementModal";
import AppTitlebar from "@/app/(components)/AppTitlebar";

const MusicPanelLogic = dynamic(() => import("@/components/MusicPanel"), { ssr: false });

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const formatTrackTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

const isBytes32Hex = (value?: string): value is `0x${string}` =>
  typeof value === "string" && /^0x[0-9a-fA-F]{64}$/.test(value);

// ============================================================================
// CONSTANTS
// ============================================================================

const BASE_FEE_PER_CELL_WEI = BigInt(process.env.NEXT_PUBLIC_BASE_FEE_PER_CELL_WEI ?? "0");
const MAX_CELLS_PER_RECT: number = Number(
  process.env.NEXT_PUBLIC_MAX_CELLS_PER_RECT ?? process.env.MAX_CELLS_PER_RECT ?? "400"
);

const GRID_MULTIPLIER = 8;
const STAGE_CANVAS_W = VIRTUAL_CANVAS_W * GRID_MULTIPLIER;
const STAGE_CANVAS_H = VIRTUAL_CANVAS_H * GRID_MULTIPLIER;
const STAGE_PAD_X = (STAGE_CANVAS_W - VIRTUAL_CANVAS_W) / 2;
const STAGE_PAD_Y = (STAGE_CANVAS_H - VIRTUAL_CANVAS_H) / 2;
const GRID_RADIUS_X = Math.floor(WORLD_MAX_X / TILE);
const GRID_RADIUS_Y = Math.floor(WORLD_MAX_Y / TILE);

const BOARD_PASSWORD = process.env.NEXT_PUBLIC_BOARD_PASSWORD ?? "";
const CARD_BORDER = "rgba(82, 255, 201, 0.45)";
const CARD_SHADOW = "0 14px 28px rgba(0,0,0,.32), 0 0 0 1px rgba(82,255,201,.28)";
const FLUENT_CHAIN_ID = 20994;

// Zoom limits - extended for infinite feel
const MIN_SCALE = 0.02;
const MAX_SCALE = 50;

const toStageRect = (rect: Rect): Rect => {
  const boardRect = worldToContractRect(rect);
  return {
    x: boardRect.x + STAGE_PAD_X,
    y: boardRect.y + STAGE_PAD_Y,
    w: boardRect.w,
    h: boardRect.h,
  };
};

// ============================================================================
// TYPES
// ============================================================================

type DropPos = { x: number; y: number };
type DragMeta = { w: number; h: number; mime: "image/png" | "image/jpeg" | null };
type GhostStatus = "ok" | "overlap" | "oversize" | "invalid";
type Ghost = { rect: Rect; cells: number; status: GhostStatus; totalWei: bigint };
type StatusMessage = {
  id: string;
  text: string;
  type: "info" | "success" | "error" | "system";
  timestamp: Date;
  variant?: "chat";
  user?: string;
};

const formatShortAddress = (value?: string) =>
  value ? `${value.slice(0, 6)}…${value.slice(-4)}` : "anon";

function IPodMusicPlayer() {
  const [state, setState] = useState(musicPanelController.getState());

  useEffect(() => {
    const unsubscribe = musicPanelController.subscribe(() => setState(musicPanelController.getState()));
    return unsubscribe;
  }, []);

  const {
    currentTrackName,
    isPlaying,
    progress,
    elapsed,
    duration,
    shuffle,
    repeat,
    needsInteraction,
    volume,
  } = state;

  const progressPercent = Number.isFinite(progress) ? Math.min(1, Math.max(0, progress)) : 0;
  const volumeLabel = Math.round((volume ?? 0) * 100);

  const handleToggle = () => musicPanelController.toggle();
  const handleNext = () => musicPanelController.next();
  const handlePrev = () => musicPanelController.prev();
  const handleShuffle = () => musicPanelController.toggleShuffle();
  const handleRepeat = () => musicPanelController.toggleRepeat();
  const increaseVolume = () => musicPanelController.adjustVolume(0.08);
  const decreaseVolume = () => musicPanelController.adjustVolume(-0.08);

  return (
    <>
      <div className="ipod-music-panel-logic" aria-hidden="true">
        <MusicPanelLogic />
      </div>
      <div className="ipod-player">
        <div className="ipod-wheel">
          <button className="ipod-wheel__vol" type="button" onClick={increaseVolume} title="Volume up">
            +
          </button>
          <div className="ipod-wheel__ring">
            <button
              className="ipod-wheel__btn ipod-wheel__btn--prev"
              type="button"
              onClick={handlePrev}
              title="Previous"
            >
              ⏮
            </button>
            <button
              className="ipod-wheel__center"
              type="button"
              onClick={handleToggle}
              title={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? "⏸" : "▶"}
            </button>
            <button
              className="ipod-wheel__btn ipod-wheel__btn--next"
              type="button"
              onClick={handleNext}
              title="Next"
            >
              ⏭
            </button>
          </div>
          <button className="ipod-wheel__vol" type="button" onClick={decreaseVolume} title="Volume down">
            −
          </button>
        </div>
        <div className="ipod-display">
          <div className="ipod-display__track" title={currentTrackName}>
            {currentTrackName}
          </div>
          <div className="ipod-display__bar">
            <div className="ipod-display__fill" style={{ width: `${progressPercent * 100}%` }} />
            <div className="ipod-display__knob" style={{ left: `${progressPercent * 100}%` }} />
          </div>
          <div className="ipod-display__meta">
            <button
              className={`ipod-display__shuffle ${shuffle ? "ipod-display__shuffle--active" : ""}`}
              onClick={handleShuffle}
              type="button"
              title="Shuffle"
            >
              🔀
            </button>
            <span className="ipod-display__time">
              {formatTrackTime(elapsed)} / {formatTrackTime(duration)}
            </span>
            <button
              className={`ipod-display__repeat ${repeat ? "ipod-display__repeat--active" : ""}`}
              onClick={handleRepeat}
              type="button"
              title="Repeat"
            >
              🔁
            </button>
            <span className="ipod-display__volume" aria-label="Volume level">
              {volumeLabel}%
            </span>
          </div>
          {needsInteraction && <div className="ipod-display__hint">Tap wheel to start</div>}
        </div>
      </div>
    </>
  );
}

// ============================================================================
// TERMINAL CHAT WITH STATUS
// ============================================================================

function TerminalChat({
  statusMessages,
  onSend,
}: {
  statusMessages: StatusMessage[];
  onSend?: (text: string) => void | Promise<void>;
}) {
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [statusMessages]);

  const formatTime = (date: Date) =>
    date.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit" });

  const handleSend = useCallback(async () => {
    if (!onSend) return;
    const trimmed = input.trim();
    if (!trimmed || isSending) return;
    setIsSending(true);
    setInput("");
    try {
      await onSend(trimmed);
    } catch (err) {
      console.error("TerminalChat send failed", err);
    } finally {
      setIsSending(false);
    }
  }, [input, isSending, onSend]);

  const handleKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      void handleSend();
    }
  };

  return (
    <div className="terminal-chat">
      <div ref={scrollRef} className="terminal-chat__messages">
        {statusMessages.map((msg) => {
          const isChat = msg.variant === "chat";
          const isSystem = msg.type === "system" && !isChat;
          const lineClass = isChat ? "terminal-chat__line--chat" : `terminal-chat__line--${msg.type}`;
          const labelClass = isSystem ? "terminal-chat__system" : "terminal-chat__user";
          const labelText = isSystem ? "SYSTEM" : isChat ? "mifoid" : "milady";
          return (
            <div key={msg.id} className={`terminal-chat__line ${lineClass}`}>
              <span className="terminal-chat__time">{formatTime(msg.timestamp)}</span>
              <span className={labelClass}>{labelText}</span>
              <span className="terminal-chat__text">{msg.text}</span>
            </div>
          );
        })}
      </div>
      <div className="terminal-chat__input-row">
        <span className="terminal-chat__prompt">&gt;</span>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="type here..."
          className="terminal-chat__input"
        />
        <button
          type="button"
          className="terminal-chat__send"
          onClick={() => void handleSend()}
          disabled={isSending || !input.trim() || !onSend}
        >
          SEND
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Y2K GLASS ACTION BUTTON
// ============================================================================

function Y2kActionButton({
  onClick,
  label,
  disabled = false,
  variant = "primary",
}: {
  onClick: () => void;
  label: string;
  disabled?: boolean;
  variant?: "primary" | "secondary";
}) {
  const [mousePos, setMousePos] = useState({ x: 0.5, y: 0.5 });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = (e: ReactMouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setMousePos({ x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height });
  };

  const isPrimary = variant === "primary";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onMouseMove={handleMouseMove}
      className={`y2k-btn ${variant === "secondary" ? "y2k-btn--secondary" : ""} ${disabled ? "y2k-btn--disabled" : ""}`}
    >
      <span className="y2k-btn__reflection" />
      {isHovered && !disabled && (
        <span
          className="y2k-btn__highlight"
          style={{
            background: `radial-gradient(ellipse 70% 90% at ${mousePos.x * 100}% ${mousePos.y * 100}%, rgba(255,255,255,0.5) 0%, transparent 65%)`,
          }}
        />
      )}
      <span className="y2k-btn__label">{label}</span>
    </button>
  );
}

// ============================================================================
// VOTING ITEM
// ============================================================================

function VotingItem({ proposal, addStatus }: { proposal: ProposalSummary; addStatus: (msg: string, type: StatusMessage["type"]) => void }) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync, isPending: switchingChain } = useSwitchChain();

  const computedSecondsLeft = useMemo(() => {
    const { enabled, epochSec } = resolveEpochConfig();
    if (!enabled || epochSec <= 0) return null;
    const nowEpoch = currentEpoch();
    const epochsDiff = proposal.voteEndsAtEpoch - nowEpoch;
    return epochsDiff <= 0 ? 0 : Math.max(0, epochsDiff * epochSec);
  }, [proposal.voteEndsAtEpoch]);

  const hasEpoch = typeof proposal.epochSubmitted === "number";
  const epochCfg = resolveEpochConfig();
  const isPending = proposal.status === "proposed" && epochCfg.enabled && computedSecondsLeft !== null && computedSecondsLeft > 0;
  const placementId = isBytes32Hex(proposal.chainId) ? proposal.chainId : isBytes32Hex(proposal.placementId) ? proposal.placementId : undefined;
  const epochId = proposal.epochSubmitted ?? 0;
  const queryEnabled = isPending && hasEpoch && isBytes32Hex(placementId);
  const epochBigInt = BigInt(epochId || 0);

  const { yes, no, isLoading: votesLoading, refetch: refetchVotes } = usePlacementVotes({
    epochId: epochBigInt,
    placementId: (placementId ?? "0x") as `0x${string}`,
    enabled: queryEnabled,
  });

  const { vote, isWriting, isConfirming, isConfirmed } = useVoteOnPlacement({ epochId: epochBigInt, placementId });

  useEffect(() => { if (isConfirmed) refetchVotes(); }, [isConfirmed, refetchVotes]);

  const wrongChain = Boolean(chainId && chainId !== FLUENT_CHAIN_ID);
  const isVoting = isWriting || isConfirming;
  const canVote = isPending && queryEnabled && !!address && isConnected && !isVoting && !votesLoading && !switchingChain;

  const onVoteClick = async (support: boolean) => {
    if (!queryEnabled || !address) return;
    if (wrongChain) { try { await switchChainAsync?.({ chainId: FLUENT_CHAIN_ID }); } catch { return; } }
    try {
      addStatus(`Voting ${support ? "YES" : "NO"}...`, "info");
      await vote(support);
      await refetchVotes();
      addStatus("Vote submitted ✓", "success");
    } catch (err) {
      addStatus(`Vote failed: ${(err as Error)?.message || "error"}`, "error");
    }
  };

  const displayYes = queryEnabled ? yes : BigInt(proposal.yes ?? 0);
  const displayNo = queryEnabled ? no : BigInt(proposal.no ?? 0);

  return (
    <div className="voting-item">
      <div className="voting-item__thumb">
        {proposal.cid && <img src={cidToHttpUrl(proposal.cid)} alt="" />}
      </div>
      <div className="voting-item__info">
        <span>{proposal.cells} cells</span>
        <span>{computedSecondsLeft !== null ? `${Math.floor(computedSecondsLeft / 60)}m` : "—"}</span>
      </div>
      <span className="voting-item__counts">{displayYes.toString()}↑ {displayNo.toString()}↓</span>
      <div className="voting-item__btns">
        <button onClick={() => onVoteClick(true)} disabled={!canVote} className="voting-item__yes" type="button">✓</button>
        <button onClick={() => onVoteClick(false)} disabled={!canVote} className="voting-item__no" type="button">✕</button>
      </div>
    </div>
  );
}
// ============================================================================
// UTILITY FUNCTIONS (continued from part 1)
// ============================================================================

const snapDown = (v: number) => Math.max(TILE, Math.floor(v / TILE) * TILE);

const normalizeCidString = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const url = new URL(trimmed);
      const parts = url.pathname.replace(/^\/+/, "").split("/");
      const bare = parts.slice(parts[0] === "ipfs" ? 1 : 0).join("/");
      return bare ? `ipfs://${bare}` : "";
    } catch { return trimmed; }
  }
  if (trimmed.startsWith("ipfs://")) return trimmed;
  return `ipfs://${trimmed}`;
};

function capRectToMaxCells(r: Rect, maxCells: number): Rect {
  let w = snapDown(r.w);
  let h = snapDown(r.h);
  let cells = Math.max(1, Math.floor((w / TILE) * (h / TILE)));
  if (cells <= maxCells) return { ...r, w, h };
  const scale = Math.sqrt(maxCells / cells);
  w = snapDown(w * scale);
  h = snapDown(h * scale);
  if (w < TILE) w = TILE;
  if (h < TILE) h = TILE;
  while (Math.floor((w / TILE) * (h / TILE)) > maxCells) {
    if (w >= h) w = snapDown(w - TILE);
    else h = snapDown(h - TILE);
    if (w < TILE) w = TILE;
    if (h < TILE) h = TILE;
  }
  return { ...r, w, h };
}

async function downscaleToMaxCells(file: File, maxCells: number, tileSize = TILE): Promise<File> {
  const url = URL.createObjectURL(file);
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url;
  });
  try {
    const { naturalWidth: w0, naturalHeight: h0 } = img;
    const maxPx = maxCells * tileSize * tileSize;
    if (w0 * h0 <= maxPx) return file;
    const scale = Math.sqrt(maxPx / (w0 * h0));
    const w1 = Math.max(tileSize, Math.floor(w0 * scale));
    const h1 = Math.max(tileSize, Math.floor(h0 * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w1; canvas.height = h1;
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, w1, h1);
    const blob: Blob = await new Promise((resolve) => canvas.toBlob((b) => resolve(b || new Blob()), "image/jpeg", 0.9));
    return new File([blob], file.name.replace(/\.(png|jpg|jpeg)$/i, ".resized.jpg"), { type: "image/jpeg" });
  } finally { URL.revokeObjectURL(url); }
}

function tryNextGateway(el: HTMLImageElement, cid?: string) {
  if (!cid) return;
  const urls = ipfsToHttp(cid);
  const idx = Number(el.dataset.gatewayIndex ?? "-1") + 1;
  if (idx < urls.length) { el.src = urls[idx]; el.dataset.gatewayIndex = String(idx); }
}

async function getPendingBytes(p: PendingItem): Promise<ArrayBuffer> {
  const res = await fetch(p.previewUrl);
  if (!res.ok) throw new Error("Failed to read pending asset");
  return res.arrayBuffer();
}

const asWorldRect = (value: any) => {
  const src = value?.rect ?? value ?? {};
  return { x: Number(src.x ?? 0), y: Number(src.y ?? 0), w: Number(src.w ?? src.width ?? 0), h: Number(src.h ?? src.height ?? 0) };
};

const normalizePlacements = (list: any[]): FinalizedPlacement[] =>
  list.map((p: any) => {
    const coerced = asWorldRect(p?.rect ?? p);
    return { ...p, x: coerced.x, y: coerced.y, w: coerced.w, h: coerced.h, cells: Number(p?.cells ?? 1) } as FinalizedPlacement;
  });

const normalizeProposals = (list: ProposalSummary[] | undefined): ProposalSummary[] =>
  (list ?? []).map((p) => {
    const rect = asWorldRect(p.rect ?? p);
    const placementId = isBytes32Hex(p.chainId) ? p.chainId : isBytes32Hex(p.placementId) ? p.placementId : undefined;
    return { ...p, rect, placementId, epochId: p.epochSubmitted ?? 0 };
  });

// ============================================================================
// MAIN BOARD PAGE COMPONENT
// ============================================================================

export default function BoardPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  const pending = useBoard((s) => s.pending);
  const addPending = useBoard((s) => s.addPending);
  const removePending = useBoard((s) => s.removePending);
  const setRect = useBoard((s) => s.setRect);
  const clearBoardState = useBoard((s) => s.clearAll);
  const setCidFor = useBoard((s) => s.setCidFor);

  // Wallet
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { connect, connectors } = useConnect();
  const [walletDropdownOpen, setWalletDropdownOpen] = useState(false);
  const handleSwitchWallet = useCallback(() => {
    disconnect();
    setTimeout(() => { const c = connectors[0]; if (c) connect({ connector: c }); }, 100);
  }, [disconnect, connect, connectors]);

  // Password gate
  const [unlocked, setUnlocked] = useState(false);
  const [pwInput, setPwInput] = useState("");
  const [pwError, setPwError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && window.localStorage.getItem("mifoid-board-unlocked") === "1") setUnlocked(true);
  }, []);

  const handleUnlock = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!BOARD_PASSWORD) { setPwError("Missing password config"); return; }
    if (pwInput.trim() === BOARD_PASSWORD) {
      setUnlocked(true); setPwError(null);
      window.localStorage?.setItem("mifoid-board-unlocked", "1");
      sfx.unlock?.();
    } else setPwError("incorrect password");
  }, [pwInput]);

  // Pan/zoom - smooth infinite
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [spaceDown, setSpaceDown] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [draggingBoard, setDraggingBoard] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0 });
  const panOriginRef = useRef({ x: 0, y: 0 });
  const boardDragStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  // Status messages
  const [statusMessages, setStatusMessages] = useState<StatusMessage[]>([
    { id: "init", text: "welcome to the mifoid loreboard!", type: "system", timestamp: new Date() }
  ]);
  const addStatus = useCallback((text: string, type: StatusMessage["type"] = "info") => {
    setStatusMessages(prev => [...prev, { id: `${Date.now()}-${Math.random()}`, text, type, timestamp: new Date() }]);
  }, []);
  const handleChatSend = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setStatusMessages((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random()}`,
        text: trimmed,
        type: "info",
        timestamp: new Date(),
        variant: "chat",
        user: formatShortAddress(address),
      },
    ]);
  }, [address]);

  // UI state
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [submittingProposals, setSubmittingProposals] = useState(false);

  // Epoch
  const { enabled, index: epochIdx, remainingMs } = useEpochCountdown();
  const fmtCountdown = useMemo(() => {
    if (!enabled) return "—";
    const s = Math.floor(remainingMs / 1000);
    return `${String(Math.floor(s / 3600)).padStart(2, "0")}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  }, [enabled, remainingMs]);

  // Board data
  const [placed, setPlaced] = useState<FinalizedPlacement[]>([]);
  const [placedEpoch, setPlacedEpoch] = useState<number | null>(null);
  const [viewEpoch, setViewEpoch] = useState<number | null>(null);
  const [proposals, setProposals] = useState<ProposalSummary[]>([]);
  const [viewMode] = useState<"latest" | "fixed">("latest");
  const [activePlacement, setActivePlacement] = useState<Placement | null>(null);

  const { manifest: latestManifest, epoch: latestManifestEpoch, loading: latestManifestLoading, error: latestManifestError } = useLatestManifestFromChain();
  const latestFallbackTried = useRef(false);
  const ghostMetaRef = useRef<DragMeta | null>(null);
  const [ghost, setGhost] = useState<Ghost | null>(null);

  const storedRectFor = useCallback((p: PendingItem) => p.rect, []);

  const zoomToRect = useCallback((r: Rect, padding = 32) => {
    const el = containerRef.current;
    if (!el) return;
    const viewW = el.clientWidth || 1, viewH = el.clientHeight || 1;
    const stageRect = toStageRect(r);
    const s = Math.max(MIN_SCALE, Math.min(MAX_SCALE, Math.min(viewW / (stageRect.w + padding * 2), viewH / (stageRect.h + padding * 2))));
    setScale(s);
    setPan({ x: (viewW - stageRect.w * s) / 2 - stageRect.x * s, y: (viewH - stageRect.h * s) / 2 - stageRect.y * s });
  }, []);

  const screenToWorld = useCallback((clientX: number, clientY: number): DropPos => {
    const el = containerRef.current;
    if (!el) return { x: 0, y: 0 };
    const r = el.getBoundingClientRect();
    const stageX = (clientX - r.left - pan.x) / scale;
    const stageY = (clientY - r.top - pan.y) / scale;
    const worldX = stageX - STAGE_PAD_X - BOARD_OFFSET_X;
    const worldY = stageY - STAGE_PAD_Y - BOARD_OFFSET_Y;
    const gridX = Math.max(-GRID_RADIUS_X, Math.min(GRID_RADIUS_X, Math.round(worldX / TILE)));
    const gridY = Math.max(-GRID_RADIUS_Y, Math.min(GRID_RADIUS_Y, Math.round(worldY / TILE)));
    return { x: gridX * TILE, y: gridY * TILE };
  }, [pan, scale]);

  const onPickClick = useCallback(() => fileInputRef.current?.click(), []);

  // Keyboard
  useEffect(() => {
    const down = (e: KeyboardEvent) => { if (e.code === "Space") { e.preventDefault(); setSpaceDown(true); } };
    const up = (e: KeyboardEvent) => { if (e.code === "Space") setSpaceDown(false); };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, []);

  // Pan handlers
  const onContainerPointerDown: React.PointerEventHandler<HTMLDivElement> = (e) => {
    const interactive = (e.target as HTMLElement).closest("figure,button,input,textarea,select,label");
    if (spaceDown) {
      e.preventDefault();
      panStartRef.current = { x: e.clientX, y: e.clientY };
      panOriginRef.current = { ...pan };
      setIsPanning(true);
      (e.currentTarget as Element).setPointerCapture?.((e as any).pointerId);
      return;
    }
    if (interactive) return;
    e.preventDefault();
    boardDragStartRef.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
    setDraggingBoard(true);
    (e.currentTarget as Element).setPointerCapture?.((e as any).pointerId);
  };

  // Smooth infinite zoom
  const onCanvasWheel: React.WheelEventHandler<HTMLDivElement> = (e) => {
    if (e.shiftKey) return;
    e.preventDefault();
    const el = containerRef.current;
    if (!el) return;
    const factor = Math.exp(-e.deltaY * 0.003);
    const nextScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale * factor));
    const r = el.getBoundingClientRect();
    const cx = e.clientX - r.left, cy = e.clientY - r.top;
    const wx = (cx - pan.x) / scale, wy = (cy - pan.y) / scale;
    setScale(nextScale);
    setPan({ x: cx - wx * nextScale, y: cy - wy * nextScale });
  };

  useEffect(() => {
    if (!isPanning) return;
    const onMove = (ev: PointerEvent) => {
      setPan({ x: panOriginRef.current.x + ev.clientX - panStartRef.current.x, y: panOriginRef.current.y + ev.clientY - panStartRef.current.y });
    };
    const onUp = () => setIsPanning(false);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp, { once: true });
    return () => { window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); };
  }, [isPanning]);

  useEffect(() => { if (!spaceDown) setIsPanning(false); }, [spaceDown]);

  useEffect(() => {
    if (!draggingBoard) return;
    const onMove = (ev: PointerEvent) => {
      setPan({ x: boardDragStartRef.current.panX + ev.clientX - boardDragStartRef.current.x, y: boardDragStartRef.current.panY + ev.clientY - boardDragStartRef.current.y });
    };
    const onUp = () => setDraggingBoard(false);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp, { once: true });
    return () => { window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); };
  }, [draggingBoard]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPan({ x: (r.width - STAGE_CANVAS_W) / 2, y: (r.height - STAGE_CANVAS_H) / 2 });
  }, []);

  async function getImageSize(file: File): Promise<{ w: number; h: number }> {
    try {
      const bmp = await (globalThis as any).createImageBitmap?.(file);
      if (bmp) { const w = bmp.width, h = bmp.height; bmp.close?.(); return { w, h }; }
    } catch {}
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
      return { w: img.naturalWidth, h: img.naturalHeight };
    } finally { URL.revokeObjectURL(url); }
  }

  const primeGhostMetaFromEvent = useCallback(async (e: React.DragEvent) => {
    if (ghostMetaRef.current) return ghostMetaRef.current;
    const items = e.dataTransfer?.items;
    if (!items?.length) return null;
    let file: File | null = null;
    for (const it of Array.from(items)) { if (it.kind === "file") { file = it.getAsFile(); if (file) break; } }
    if (!file) return null;
    const kind = await sniffImageType(file);
    const mime = kind ? mimeFromType(kind) : null;
    if (!mime) { ghostMetaRef.current = { w: TILE, h: TILE, mime: null }; return ghostMetaRef.current; }
    const { w, h } = await getImageSize(file);
    ghostMetaRef.current = { w, h, mime };
    return ghostMetaRef.current;
  }, []);

  const refreshGhostAt = useCallback((pos: DropPos) => {
    const meta = ghostMetaRef.current;
    if (!meta) { setGhost(null); return; }
    if (!meta.mime) {
      setGhost({ rect: snapRect({ x: pos.x, y: pos.y, w: TILE, h: TILE }), cells: 1, status: "invalid", totalWei: 0n });
      return;
    }
    const rect = snapRect({ x: pos.x, y: pos.y, w: meta.w, h: meta.h });
    const cells = rectCells(rect);
    let status: GhostStatus = "ok";
    const placedRects = placed.map((pl) => ({ x: pl.x, y: pl.y, w: pl.w, h: pl.h }));
    if (cells > MAX_CELLS_PER_RECT) status = "oversize";
    else if (hasOverlap(rect, placedRects) || hasOverlap(rect, pending.map(storedRectFor))) status = "overlap";
    setGhost({ rect, cells, status, totalWei: BigInt(cells) * BASE_FEE_PER_CELL_WEI });
  }, [pending, placed, storedRectFor]);

  const onDragOver: React.DragEventHandler<HTMLDivElement> = async (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    await primeGhostMetaFromEvent(e);
    setDragOver(true);
    refreshGhostAt(screenToWorld(e.clientX, e.clientY));
  };

  const onDragEnter: React.DragEventHandler<HTMLDivElement> = async (e) => {
    e.preventDefault();
    await primeGhostMetaFromEvent(e);
    setDragOver(true);
  };

  const onDragLeave: React.DragEventHandler<HTMLDivElement> = (e) => {
    if (e.currentTarget === e.target) { setDragOver(false); setGhost(null); ghostMetaRef.current = null; }
  };

  const clampToCanvas = useCallback((r: Rect): Rect => ({
    x: Math.min(Math.max(r.x, -WORLD_MAX_X), WORLD_MAX_X - r.w),
    y: Math.min(Math.max(r.y, -WORLD_MAX_Y), WORLD_MAX_Y - r.h),
    w: r.w, h: r.h,
  }), []);

  const handleSingleFile = useCallback(async (file: File, pos?: DropPos) => {
    addStatus("Processing image...", "info");
    setBusy(true);
    try {
      let workingFile = file;
      let kind = await sniffImageType(workingFile);
      if (!kind) { addStatus("Only PNG or JPG allowed.", "error"); return; }
      let mime = mimeFromType(kind) as "image/png" | "image/jpeg";
      let { w, h } = await getImageSize(workingFile);
      let rect = snapRect({ x: pos?.x ?? 0, y: pos?.y ?? 0, w, h });
      let cells = rectCells(rect);

      if (cells > MAX_CELLS_PER_RECT) {
        workingFile = await downscaleToMaxCells(workingFile, MAX_CELLS_PER_RECT, TILE);
        kind = await sniffImageType(workingFile);
        mime = kind ? (mimeFromType(kind) as "image/png" | "image/jpeg") : "image/jpeg";
        const size2 = await getImageSize(workingFile);
        rect = snapRect({ x: pos?.x ?? 0, y: pos?.y ?? 0, w: size2.w, h: size2.h });
        cells = rectCells(rect);
      }

      rect = clampToCanvas(capRectToMaxCells(rect, MAX_CELLS_PER_RECT));
      addPending({
        name: workingFile.name, mime, width: rect.w, height: rect.h, rect, cells: rectCells(rect),
        tipPerCellWei: 0n, previewUrl: URL.createObjectURL(workingFile), cid: undefined, fitMode: "contain",
      });
      addStatus(`Image added: ${workingFile.name}`, "success");
    } finally { setBusy(false); setGhost(null); ghostMetaRef.current = null; }
  }, [addPending, clampToCanvas, addStatus]);

  const handleFiles = useCallback(async (files: FileList | null, pos?: DropPos) => {
    if (files?.length) await handleSingleFile(files[0], pos);
  }, [handleSingleFile]);

  const onDrop: React.DragEventHandler<HTMLDivElement> = async (e) => {
    e.preventDefault();
    setDragOver(false);
    await handleFiles(e.dataTransfer?.files ?? null, screenToWorld(e.clientX, e.clientY));
  };

  const onFileChange: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    const input = e.currentTarget;
    const el = containerRef.current;
    let pos: DropPos | undefined;
    if (el) {
      const r = el.getBoundingClientRect();
      pos = screenToWorld(r.left + r.width / 2, r.top + r.height / 2);
    }
    await handleFiles(input.files ?? null, pos);
    input.value = "";
  };

  // Move/resize
  const [activeId, setActiveId] = useState<string | null>(null);
  const [liveRect, setLiveRect] = useState<Rect | null>(null);
  const liveRectRef = useRef<Rect | null>(null);
  const startRectRef = useRef<Rect | null>(null);
  const startPtRef = useRef({ x: 0, y: 0 });
  const aspectRef = useRef(1);

  const snap = (v: number) => Math.round(v / TILE) * TILE;

  const beginMove = (p: PendingItem) => (e: React.PointerEvent) => {
    e.preventDefault();
    setActiveId(p.id);
    startRectRef.current = { ...storedRectFor(p) };
    startPtRef.current = { x: e.clientX, y: e.clientY };
    (e.currentTarget as Element).setPointerCapture?.((e as any).pointerId);
    const onMove = (ev: PointerEvent) => {
      if (!startRectRef.current) return;
      const dx = (ev.clientX - startPtRef.current.x) / scale, dy = (ev.clientY - startPtRef.current.y) / scale;
      const next = clampToCanvas({ x: snap(startRectRef.current.x + dx), y: snap(startRectRef.current.y + dy), w: startRectRef.current.w, h: startRectRef.current.h });
      setLiveRect(next); setRect(p.id, next); liveRectRef.current = next;
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp);
      setRect(p.id, liveRectRef.current ?? startRectRef.current!);
      setLiveRect(null); liveRectRef.current = null; setActiveId(null);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp, { once: true });
  };

  const beginResize = (p: PendingItem) => (e: React.PointerEvent) => {
    e.preventDefault();
    setActiveId(p.id);
    startRectRef.current = { ...storedRectFor(p) };
    startPtRef.current = { x: e.clientX, y: e.clientY };
    aspectRef.current = Math.max(1e-6, p.width / p.height);
    (e.currentTarget as Element).setPointerCapture?.((e as any).pointerId);
    const onMove = (ev: PointerEvent) => {
      if (!startRectRef.current) return;
      const dx = (ev.clientX - startPtRef.current.x) / scale, dy = (ev.clientY - startPtRef.current.y) / scale;
      let w = startRectRef.current.w + dx, h = ev.altKey ? startRectRef.current.h + dy : w / aspectRef.current;
      w = snapDown(w); h = snapDown(h);
      let next = clampToCanvas(capRectToMaxCells({ x: startRectRef.current.x, y: startRectRef.current.y, w, h }, MAX_CELLS_PER_RECT));
      setLiveRect(next); setRect(p.id, next); liveRectRef.current = next;
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp);
      setRect(p.id, liveRectRef.current ?? startRectRef.current!);
      setLiveRect(null); liveRectRef.current = null; setActiveId(null);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp, { once: true });
  };

  // Grid background
  const gridSize = `${TILE}px ${TILE}px`;
  const gridBg = useMemo(() => [
    "linear-gradient(to right, rgba(255,255,255,.07) 1px, transparent 1px)",
    "linear-gradient(to bottom, rgba(255,255,255,.07) 1px, transparent 1px)",
    "linear-gradient(to right, rgba(63,221,255,.06) 1px, transparent 1px)",
    "linear-gradient(to bottom, rgba(63,221,255,.06) 1px, transparent 1px)",
    "linear-gradient(to bottom, rgba(255,255,255,.045) 1px, transparent 1px)",
  ].join(", "), []);
  const gridSizes = `${gridSize}, ${gridSize}, ${gridSize}, ${gridSize}, 100% 6px`;

  const renderRectFor = useCallback((p: PendingItem): Rect => (activeId === p.id && liveRect) ? liveRect : p.rect, [activeId, liveRect]);

  const items = pending.map((p) => {
    const r = renderRectFor(p);
    const cellsNow = rectCells(r);
    return { ...p, rect: r, cells: cellsNow, totalWei: BigInt(cellsNow) * (BASE_FEE_PER_CELL_WEI + p.tipPerCellWei) };
  });

  const currentEpochView = viewMode === "fixed" ? viewEpoch : placedEpoch;

  // Load manifest
  useEffect(() => {
    if (!unlocked || viewMode !== "latest") { latestFallbackTried.current = false; return; }
    let alive = true;
    const apply = (placements: FinalizedPlacement[], epochValue: number | null) => {
      if (!alive) return;
      setPlaced(placements); setPlacedEpoch(epochValue); setViewEpoch(epochValue);
      if (placements.length) {
        const last = placements[placements.length - 1];
        zoomToRect({ x: last.x, y: last.y, w: last.w, h: last.h });
      }
    };
    const loadFallback = async () => {
      if (latestFallbackTried.current) return;
      latestFallbackTried.current = true;
      try {
        const latest = await getLatestNormalized();
        if (!alive) return;
        apply(normalizePlacements(latest.manifest?.placements ?? []), typeof latest.epoch === "number" ? latest.epoch : null);
      } catch (e: any) {
        if (!alive) return;
        setPlaced([]); setPlacedEpoch(null); setViewEpoch(null);
        addStatus(String(e?.message ?? "Failed to load"), "error");
      }
    };
    if (latestManifestLoading) return;
    if (latestManifestError) { void loadFallback(); return; }
    if (latestManifest?.placements) {
      const placements = normalizePlacements(latestManifest.placements);
      const epochValue = typeof latestManifestEpoch === "number" ? latestManifestEpoch : typeof latestManifest.epoch === "number" ? latestManifest.epoch : null;
      if (placedEpoch != null && epochValue != null && epochValue < placedEpoch) return;
      apply(placements, epochValue);
      latestFallbackTried.current = false;
      return;
    }
    void loadFallback();
    return () => { alive = false; };
  }, [unlocked, viewMode, latestManifest, latestManifestEpoch, latestManifestLoading, latestManifestError, zoomToRect, placedEpoch, addStatus]);

  // Load proposals
  useEffect(() => {
    if (!unlocked) return;
    let alive = true;
    const tick = async () => {
      try { const { proposals } = await listProposals(); if (alive) setProposals(normalizeProposals(proposals)); }
      catch { if (alive) setProposals([]); }
    };
    tick();
    const t = setInterval(tick, 2000);
    return () => { alive = false; clearInterval(t); };
  }, [unlocked]);

  // Arrow keys
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!activeId || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return;
      const target = pending.find((x) => x.id === activeId);
      if (!target) return;
      const step = e.shiftKey ? TILE : Math.floor(TILE / 4);
      let { x, y, w, h } = target.rect;
      if (e.key === "ArrowLeft") x -= step;
      if (e.key === "ArrowRight") x += step;
      if (e.key === "ArrowUp") y -= step;
      if (e.key === "ArrowDown") y += step;
      const next = clampToCanvas({ x, y, w, h });
      setRect(activeId, next);
      setLiveRect(next);
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeId, pending, clampToCanvas, setRect]);

  // Submit
  const handleSubmitProposals = async () => {
    if (submittingProposals || !items.length) return;
    setSubmittingProposals(true);
    addStatus("Preparing submissions...", "info");
    try {
      const placedRects = placed.map((pl) => ({ x: pl.x, y: pl.y, w: pl.w, h: pl.h }));
      const pendingRects = items.map((it) => ({ name: it.name, rect: { ...it.rect } }));
      const overlapNames: string[] = [];
      pendingRects.forEach((c, idx) => {
        const peers = pendingRects.filter((_, j) => j !== idx).map((r) => r.rect);
        if (hasOverlap(c.rect, placedRects) || hasOverlap(c.rect, peers)) overlapNames.push(c.name);
      });
      if (overlapNames.length) throw new Error(`Overlap: ${overlapNames.join(", ")}`);

      const eth = (globalThis as any)?.ethereum;
      if (!eth) throw new Error("No wallet");
      const [account] = await eth.request({ method: "eth_requestAccounts" });

      for (const it of items) {
        addStatus(`Uploading ${it.name}...`, "info");
        const bytes = await getPendingBytes(it);
        const bidPerCellWei = BASE_FEE_PER_CELL_WEI + it.tipPerCellWei;
        const onChainRect = worldToContractRect(it.rect);
        const file = new File([bytes], it.name, { type: it.mime });
        const cid = await uploadImage(it.name, file, it.mime);
        if (!cid) throw new Error("IPFS upload disabled");
        setCidFor(it.id, cid);

        addStatus(`Submitting ${it.name}...`, "info");
        const normalizedCid = normalizeCidString(cid);
        const onChain = await writeProposePlacement({
          bidder: account as `0x${string}`,
          rect: onChainRect,
          bidPerCellWei,
          cidBytes: new TextEncoder().encode(normalizedCid),
        });

        const res = await fetch("/api/proposals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: onChain.placementId, owner: account, cid: normalizedCid, name: it.name, mime: it.mime,
            rect: it.rect, width: it.width, height: it.height,
            bidPerCellWei: bidPerCellWei.toString(), cells: onChain.cells, filename: it.name,
          }),
        });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Failed");
        addStatus(`${it.name} submitted ✓`, "success");
      }

      clearBoardState?.();
      try { const { proposals } = await listProposals(); setProposals(normalizeProposals(proposals)); } catch {}
      addStatus("All proposals submitted!", "success");
    } catch (e: any) {
      addStatus(String(e?.message ?? e), "error");
    } finally {
      setSubmittingProposals(false);
    }
  };

  const boardParticles = useMemo(
    () =>
      Array.from({ length: 20 }).map(() => ({
        left: Math.random() * 100,
        top: Math.random() * 100,
        delay: Math.random() * 5,
        duration: 8 + Math.random() * 12,
      })),
    [],
  );

  // Password gate UI
  if (!unlocked) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="vista-window max-w-sm w-full">
          <div className="vista-window__titlebar">
            <div className="vista-window__controls">
              <div className="vista-window__control vista-window__control--close" />
              <div className="vista-window__control vista-window__control--minimize" />
              <div className="vista-window__control vista-window__control--restore" />
            </div>
            <div className="vista-window__title"><span>🔒</span><span>LOREBOARD.APP</span></div>
          </div>
          <div className="vista-window__body p-6">
            <h1 className="text-lg font-primary font-semibold text-white text-center mb-1">Mifoid Loreboard</h1>
            <p className="text-xs text-white/70 text-center mb-4">Beta access required.</p>
            <form onSubmit={handleUnlock} className="space-y-3">
              <input type="password" className="w-full" placeholder="••••••••" value={pwInput} onChange={(e) => setPwInput(e.currentTarget.value)} />
              {pwError && <p className="text-[11px] text-foid-candy">{pwError}</p>}
              <button type="submit" className="frutiger-button w-full">Unlock Board</button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  const pendingVotes = proposals.filter((p) => p.status === "proposed");
  // ============================================================================
  // MAIN RENDER
  // ============================================================================

  return (
    <main className="board-page">
      {/* Floating particles */}
      <div className="board-particles">
        {boardParticles.map((cfg, i) => (
          <span
            key={i}
            className="board-particle"
            style={{
              left: `${cfg.left}%`,
              top: `${cfg.top}%`,
              animationDelay: `${cfg.delay}s`,
              animationDuration: `${cfg.duration}s`,
            }}
          />
        ))}
      </div>

      <div className="board-shell pray-shell">
        <div className="pray-grid">
          {/* Single seamless window */}
          <div className="vista-window vista-window--terminal w-full flex flex-col pray-panel pray-panel--main board-window">
            <AppTitlebar
              title="MIFO!D_LOREBOARD.APP"
              chainId={FLUENT_CHAIN_ID}
              connected={isConnected}
              address={address}
              isWalletDropdownOpen={walletDropdownOpen}
              onToggleWallet={() => setWalletDropdownOpen((prev) => !prev)}
              onDisconnect={() => disconnect()}
              onSwitchWallet={handleSwitchWallet}
            />

            {/* Main content - align with pray spacing */}
            <div className="vista-window__body vista-window__body--flush mt-2 pray-panel__body board-body">
              <div className="board-grid">
              {/* Canvas */}
              <div className="board-canvas-wrap">
                  <div
                    ref={containerRef}
                    className="board-canvas"
                    onPointerDown={onContainerPointerDown}
                    onDragOver={onDragOver}
                    onDragEnter={onDragEnter}
                    onDragLeave={onDragLeave}
                    onDrop={onDrop}
                    onWheel={onCanvasWheel}
                    style={{ cursor: spaceDown ? (isPanning ? "grabbing" : "grab") : "default" }}
                  >
                    <div
                    ref={stageRef}
                    className="board-stage"
                    style={{
                      transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
                      transformOrigin: "0 0",
                      backgroundImage: gridBg,
                      backgroundSize: gridSizes,
                      width: STAGE_CANVAS_W,
                      height: STAGE_CANVAS_H,
                    }}
                    >
                      {/* Finalized */}
                    {placed.map((p) => {
                      const sr = toStageRect({ x: p.x, y: p.y, w: p.w, h: p.h });
                      const isActive = activePlacement?.id === p.id;
                      return (
                        <PlacementCard
                          key={p.id}
                          placement={{ id: p.id, cid: p.cid, x: sr.x, y: sr.y, width: sr.w, height: sr.h, proposer: p.owner as `0x${string}`, epochId: currentEpochView ?? placedEpoch }}
                          onOpen={setActivePlacement}
                          frameStyle={{
                            border: `1px solid ${isActive ? "rgba(0,255,213,0.95)" : CARD_BORDER}`,
                            boxShadow: isActive
                              ? "0 0 18px rgba(0,255,213,0.6), 0 0 42px rgba(0,255,213,0.25)"
                              : CARD_SHADOW,
                            background: "rgba(8,18,36,0.35)",
                          }}
                        />
                      );
                    })}

                    {/* Ghost */}
                    {ghost && (() => {
                      const sr = toStageRect(ghost.rect);
                      const color = ghost.status === "ok" ? "rgba(72,255,171,0.9)" : ghost.status === "invalid" ? "rgba(255,71,87,0.9)" : "rgba(255,184,0,0.9)";
                      return (
                        <div className="board-ghost" style={{ left: sr.x, top: sr.y, width: sr.w, height: sr.h, outlineColor: color, background: color.replace("0.9", "0.08") }}>
                          <span className="board-ghost__label">{ghost.cells} cells · {formatEth(ghost.totalWei)} ETH</span>
                        </div>
                      );
                    })()}

                    {/* Proposals */}
                    {proposals.filter((p) => p.status === "proposed").map((p) => {
                      const sr = toStageRect(p.rect);
                      return (
                        <figure key={p.id} className="board-proposal" style={{ left: sr.x, top: sr.y, width: sr.w, height: sr.h }}>
                          <img src={cidToHttpUrl(p.cid)} alt={p.name} className="board-proposal__img" draggable={false} onError={(e) => tryNextGateway(e.currentTarget, p.cid)} />
                        </figure>
                      );
                    })}

                    {/* Pending */}
                    {items.map((p) => {
                      const sr = toStageRect(renderRectFor(p));
                      return (
                        <figure key={p.id} className="board-pending" style={{ left: sr.x, top: sr.y, width: sr.w, height: sr.h }}>
                          <img src={p.previewUrl} alt={p.name} className="board-pending__img" draggable={false} />
                          <button className="board-pending__move" onPointerDown={beginMove(p)} type="button">⠿</button>
                          <button className="board-pending__resize" onPointerDown={beginResize(p)} type="button">↘</button>
                          <button className="board-pending__remove" onClick={() => { URL.revokeObjectURL(p.previewUrl); removePending(p.id); }} type="button">×</button>
                          <span className="board-pending__info">{p.cells} cells · {formatEth(p.totalWei)} ETH</span>
                        </figure>
                      );
                    })}
                    </div>
                    <div className="board-hud">
                      <span>ZOOM: {Math.round(scale * 100)}%</span>
                      <span>PAN: {Math.round(pan.x)}, {Math.round(pan.y)}</span>
                      <span>MODE: {spaceDown ? "PAN" : "PLACE"}</span>
                    </div>
                    <div className="board-hint-bottom" role="note">scroll to zoom • hold space to pan</div>

                  {!items.length && !busy && !ghost && !placed.length && (
                    <div className="board-hint">
                      <span className="board-hint__primary">DROP IMAGE TO PROPOSE</span>
                      <span className="board-hint__sub">space + drag to pan • scroll to zoom</span>
                    </div>
                  )}
                  {dragOver && <div className="board-dragover" />}
                </div>
              </div>

              {/* Sidebar */}
              <div className="board-sidebar">
                {/* Epoch */}
                <div className="board-section board-section--epoch">
                  <div className="board-section__header">
                    <span className="board-section__dot" />
                    <span className="board-section__title">EPOCH</span>
                  </div>
                  <div className="board-epoch">
                    <span className="board-epoch__num">#{enabled ? epochIdx : "—"}</span>
                    <span className="board-epoch__time">{fmtCountdown}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="board-section board-section--actions">
                  <div className="board-section__header">
                    <span className="board-section__dot" />
                    <span className="board-section__title">ACTIONS</span>
                    <span className="board-section__chip">{formatEth(BASE_FEE_PER_CELL_WEI)} ETH/cell</span>
                  </div>
                  <div className="board-actions">
                    <Y2kActionButton onClick={onPickClick} label="PROPOSE IMAGE" variant="primary" />
                    <input ref={fileInputRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={onFileChange} />
                    <Y2kActionButton onClick={handleSubmitProposals} label={submittingProposals ? "SUBMITTING..." : "SUBMIT PROPOSAL"} disabled={!items.length || submittingProposals} variant="secondary" />
                  </div>
                </div>

                {/* Voting */}
                {pendingVotes.length > 0 && (
                  <div className="board-section">
                    <div className="board-section__header">
                      <span className="board-section__dot" />
                      <span className="board-section__title">VOTING</span>
                    </div>
                    <div className="board-voting">
                      {pendingVotes.map((p) => <VotingItem key={p.id} proposal={p} addStatus={addStatus} />)}
                    </div>
                  </div>
                )}

                {/* Music - iPod-style player */}
                <div className="board-section board-section--music">
                  <IPodMusicPlayer />
                </div>

                {/* Chat */}
                <div className="board-section board-section--flex">
                  <div className="board-section__header">
                    <span className="board-section__dot" />
                    <span className="board-section__title">CHAT</span>
                    <span
                      className="board-section__status"
                      data-status={isConnected ? "online" : "offline"}
                    >
                      {isConnected ? "online" : "offline"}
                    </span>
                  </div>
                  <TerminalChat statusMessages={statusMessages} onSend={handleChatSend} />
                </div>
              </div> {/* board-sidebar */}
            </div> {/* board-grid */}
          </div> {/* vista-window__body */}
        </div> {/* board-window */}
      </div> {/* pray-grid */}
    </div> {/* board-shell */}

    {activePlacement && <PlacementModal placement={activePlacement} onClose={() => setActivePlacement(null)} />}

      <style jsx>{`
        /* Layout - more padding and spacing */
        .board-page {
          position: fixed;
          inset: 0;
          background: transparent !important;
          overflow: hidden;
          --board-radius-lg: 14px;
          --board-radius-md: 12px;
          --foid-bg-deepest: #050b12;
          --foid-panel: rgba(8, 18, 28, 0.62);
          --foid-panel-strong: rgba(5, 12, 20, 0.72);
          --foid-glass-highlight: rgba(255, 255, 255, 0.12);
          --foid-glass-border: rgba(120, 235, 255, 0.18);
          --foid-accent: rgba(0, 255, 213, 0.95);
          --foid-accent-soft: rgba(0, 255, 213, 0.18);
          --foid-glow: rgba(0, 255, 213, 0.14);
          --foid-text: rgba(255, 255, 255, 0.85);
          --foid-text-dim: rgba(255, 255, 255, 0.6);
          --foid-warm: rgba(255, 165, 82, 0.22);
          --board-border: 1px solid var(--foid-glass-border);
        }
        .board-shell { display: flex; flex-direction: column; height: 100vh; padding: 16px; position: relative; z-index: 1; }

        .board-window { flex: 1; display: flex; flex-direction: column; min-height: 0; margin: 8px; }
        .board-body { flex: 1; min-height: 0; padding: 18px; }
        .board-grid {
          display: grid;
          grid-template-columns: 1fr 320px;
          gap: 18px;
          padding: 14px;
          box-sizing: border-box;
          height: 100%;
          background:
            linear-gradient(
              to right,
              rgba(255,255,255,0.03) 1px,
              transparent 1px
            ),
            linear-gradient(
              to bottom,
              rgba(255,255,255,0.03) 1px,
              transparent 1px
            ),
            linear-gradient(
              180deg,
              rgba(255,255,255,0.15) 0%,
              rgba(255,255,255,0) 35%,
              rgba(255,255,255,0) 100%
            );
        }

        /* Vignette - matching pray page */
        :global(.vignette) {
          background-color: transparent !important;
          background-image: radial-gradient(ellipse at center, rgba(0,0,0,0) 0%, rgba(0,0,0,0.25) 55%, rgba(0,0,0,0.35) 100%) !important;
          opacity: 0.55;
        }
        
        /* Particles */
        .board-particles { position: fixed; inset: 0; pointer-events: none; z-index: 0; overflow: hidden; }
        :global(.board-particle) { position: absolute; width: 4px; height: 4px; background: rgba(0, 255, 213, 0.22); border-radius: 50%; animation: float-particle linear infinite; filter: blur(1px); }
        @keyframes float-particle { 0% { transform: translateY(0) translateX(0); opacity: 0; } 10% { opacity: 0.6; } 90% { opacity: 0.6; } 100% { transform: translateY(-100vh) translateX(50px); opacity: 0; } }


        /* Canvas */
        .board-canvas-wrap {
          position: relative;
          border-radius: var(--board-radius-lg);
          border: var(--board-border);
          overflow: hidden;
          background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0) 40%),
            var(--foid-panel);
          backdrop-filter: blur(14px) saturate(140%);
        }
        .board-canvas-wrap::before {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: var(--board-radius-lg);
          padding: 1px;
          background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.45), var(--foid-glass-highlight) 30%, rgba(255, 255, 255, 0.05) 38%, rgba(255, 255, 255, 0) 55%, rgba(255, 255, 255, 0.15) 78%, rgba(255, 255, 255, 0.35) 100%);
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          pointer-events: none;
          z-index: 1;
        }
        .board-canvas {
          position: relative;
          width: 100%;
          height: 100%;
          overflow: hidden;
          background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0) 35%),
            var(--foid-panel-strong);
          touch-action: none;
        }
        .board-hud {
          position: absolute;
          top: 12px;
          right: 12px;
          display: flex;
          flex-direction: column;
          gap: 2px;
          padding: 6px 10px;
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0) 35%),
            var(--foid-panel-strong);
          backdrop-filter: blur(14px);
          color: var(--foid-text);
          font-size: 10px;
          font-family: var(--font-mono);
          letter-spacing: 0.18em;
          text-transform: uppercase;
          box-shadow: inset 0 0 14px rgba(0,0,0,0.6);
          pointer-events: none;
        }
        .board-hint-bottom {
          position: absolute;
          left: 12px;
          bottom: 12px;
          padding: 4px 10px;
          border-radius: 10px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(5, 12, 18, 0.6);
          color: var(--foid-text-dim);
          font-size: 9px;
          font-family: var(--font-mono);
          letter-spacing: 0.2em;
          text-transform: uppercase;
          box-shadow: inset 0 0 12px rgba(0,0,0,0.6);
          animation: boardHintFade 4s ease forwards;
          pointer-events: none;
        }
        @keyframes boardHintFade {
          0% { opacity: 1; }
          60% { opacity: 1; }
          100% { opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .board-hint-bottom { animation: none; }
        }
        .board-stage { position: absolute; background-blend-mode: screen; box-shadow: inset 0 0 80px rgba(0,0,0,0.42); }
        .board-hint { position: absolute; inset: 0; display: grid; place-items: center; pointer-events: none; }
        .board-hint__primary, .board-hint__sub {
          display: block;
          text-align: center;
          font-family: var(--font-terminal);
          letter-spacing: 0.2em;
        }
        .board-hint__primary {
          font-size: 12px;
          padding: 12px 28px 6px;
          border-radius: 16px;
          border: 1px solid var(--foid-glass-border);
          background: rgba(255,255,255,0.05);
          color: var(--foid-text);
          text-shadow: 0 0 8px rgba(0,0,0,0.6);
        }
        .board-hint__sub {
          font-size: 10px;
          letter-spacing: 0.08em;
          color: var(--foid-text-dim);
          margin-top: 8px;
        }
        .board-dragover {
          position: absolute;
          inset: 0;
          border-radius: 14px;
          pointer-events: none;
          background: rgba(0, 255, 213, 0.08);
          box-shadow:
            0 0 20px rgba(0, 255, 213, 0.45),
            inset 0 0 28px rgba(0, 255, 213, 0.3);
          animation: dragGlow 3s ease-in-out infinite;
        }
        .board-dragover::before {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: inherit;
          background: linear-gradient(120deg, transparent 20%, rgba(255,255,255,0.25) 50%, transparent 80%);
          opacity: 0.35;
          animation: dragShimmer 4s linear infinite;
        }
        @keyframes dragGlow {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.02); }
        }
        @keyframes dragShimmer {
          0% { transform: translateX(-60%); }
          100% { transform: translateX(60%); }
        }

        /* Ghost */
        .board-ghost { position: absolute; border-radius: 8px; pointer-events: none; outline: 2px dashed; z-index: 3; }
        .board-ghost__label { position: absolute; left: 4px; top: 4px; font-size: 11px; padding: 4px 8px; border-radius: 6px; background: rgba(0,0,0,0.6); color: white; border: 1px solid rgba(255,255,255,0.2); }

        /* Proposal */
        .board-proposal { position: absolute; pointer-events: none; z-index: 2; animation: fadeIn 0.3s; }
        .board-proposal__img { width: 100%; height: 100%; border-radius: 12px; object-fit: contain; outline: 2px dashed rgba(255,200,100,0.8); background: rgba(8,18,36,0.4); }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

        /* Pending */
        .board-pending { position: absolute; z-index: 3; }
        .board-pending__img { width: 100%; height: 100%; border-radius: 8px; border: 2px solid rgba(0,208,255,0.8); box-shadow: 0 0 20px rgba(0,208,255,0.4); object-fit: contain; }
        .board-pending__move, .board-pending__resize, .board-pending__remove { position: absolute; height: 28px; border-radius: 6px; background: rgba(0,0,0,0.6); color: white; border: 1px solid rgba(255,255,255,0.2); font-size: 12px; cursor: pointer; }
        .board-pending__move { left: 4px; top: 4px; width: 32px; cursor: move; }
        .board-pending__resize { right: 4px; bottom: 4px; width: 28px; cursor: se-resize; }
        .board-pending__remove { right: 4px; top: 4px; width: 28px; }
        .board-pending__remove:hover { background: rgba(255,71,87,0.5); }
        .board-pending__info { position: absolute; left: 40px; top: 4px; font-size: 10px; padding: 4px 8px; border-radius: 6px; background: rgba(0,0,0,0.7); color: white; border: 1px solid rgba(255,255,255,0.2); }

        /* Sidebar - more padding and spacing */
        .board-sidebar {
          position: relative;
          display: flex;
          flex-direction: column;
          gap: 12px;
          height: 100%;
          min-height: 0;
          overflow-y: hidden;
          padding: 12px;
          border-radius: var(--board-radius-lg);
          border: var(--board-border);
          background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0) 40%),
            linear-gradient(180deg, rgba(8, 16, 24, 0.94), rgba(4, 10, 18, 0.85)),
            var(--foid-bg-deepest);
          backdrop-filter: blur(24px) saturate(140%);
          box-shadow:
            inset 0 0 25px rgba(255, 255, 255, 0.06),
            inset 0 0 40px rgba(0, 255, 213, 0.05),
            0 20px 40px rgba(0, 0, 0, 0.45);
        }
        .board-sidebar::after {
          content: "";
          position: absolute;
          inset: 8px;
          border-radius: calc(var(--board-radius-lg) - 6px);
          border: 1px solid rgba(255, 255, 255, 0.06);
          pointer-events: none;
        }
        .board-section {
          position: relative;
          border-radius: var(--board-radius-md);
          border: var(--board-border);
          background:
            linear-gradient(180deg, var(--foid-glass-highlight), rgba(255, 255, 255, 0) 40%),
            var(--foid-panel);
          backdrop-filter: blur(14px) saturate(140%);
          box-shadow:
            0 12px 28px rgba(0, 0, 0, 0.45),
            inset 0 1px 0 rgba(255, 255, 255, 0.06),
            inset 0 -1px 0 rgba(0, 0, 0, 0.35);
          padding: 14px;
        }
        .board-section--actions {
          padding: 10px;
        }
        .board-section--actions .board-section__header {
          margin-bottom: 8px;
        }
        .board-section--epoch {
          padding: 12px;
        }
        .board-section--epoch .board-section__header {
          margin-bottom: 8px;
        }
        .board-section:not(:last-child)::after {
          content: "";
          position: absolute;
          left: 12px;
          right: 12px;
          bottom: 0;
          height: 1px;
          background: rgba(255, 255, 255, 0.08);
        }
        .board-section--music { padding: 8px; }
        .board-section--flex { flex: 1; min-height: 260px; display: flex; flex-direction: column; }
        .board-section__header { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
        .board-section__chip {
          margin-left: auto;
          padding: 4px 8px;
          border-radius: 999px;
          border: 1px solid var(--foid-accent-soft);
          background: var(--foid-accent-soft);
          color: var(--foid-accent);
          font-size: 10px;
          letter-spacing: 0.12em;
          font-family: var(--font-mono);
          text-transform: uppercase;
        }
        .board-section__status {
          margin-left: auto;
          padding: 2px 8px;
          border-radius: 999px;
          border: 1px solid var(--foid-glass-border);
          background: rgba(0, 12, 20, 0.6);
          color: var(--foid-accent);
          font-size: 9px;
          font-family: var(--font-mono);
          letter-spacing: 0.2em;
          text-transform: uppercase;
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .board-section__status::before {
          content: "";
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: currentColor;
        }
        .board-section__status[data-status="offline"] {
          color: var(--foid-text-dim);
          border-color: rgba(255, 255, 255, 0.1);
        }
        .board-section__dot { width: 8px; height: 8px; border-radius: 50%; background: var(--foid-accent); box-shadow: 0 0 8px var(--foid-glow), 0 0 16px var(--foid-accent-soft); animation: pulse 2s ease-in-out infinite; }
        .board-section__title { font-size: 10px; font-weight: 600; letter-spacing: 0.18em; color: var(--foid-accent); text-shadow: 0 0 12px var(--foid-accent-soft); opacity: 0.92; }
        .board-section__sub { margin-left: auto; font-size: 10px; color: rgba(255,255,255,0.5); letter-spacing: 0.05em; }

        /* Epoch - slightly smaller for fit */
        .board-epoch { display: flex; align-items: baseline; justify-content: space-between; padding: 4px 0; }
        .board-epoch__num {
          font-size: 22px;
          font-weight: 700;
          font-family: var(--font-mono);
          color: var(--foid-accent);
          text-shadow: 0 0 16px rgba(0, 255, 213, 0.45);
        }
        .board-epoch__time {
          font-size: 16px;
          font-weight: 600;
          font-family: var(--font-mono);
          color: var(--foid-accent-soft);
          text-shadow: 0 0 12px rgba(0, 255, 213, 0.28);
        }

        /* Actions */
        .board-actions { display: flex; flex-direction: column; gap: 8px; }

        /* Y2K Button - luminous lemon with cyan rim */
        :global(.y2k-btn) {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          height: 44px;
          border-radius: 14px;
          border: 2px solid var(--foid-accent-soft);
          background:
            linear-gradient(180deg, rgba(225, 255, 255, 0.95) 0%, rgba(184, 248, 255, 0.9) 40%, rgba(62, 224, 255, 0.75) 100%);
          overflow: hidden;
          cursor: pointer;
          transition: transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease;
          box-shadow:
            0 12px 18px rgba(0, 0, 0, 0.28),
            0 6px 12px rgba(0, 0, 0, 0.2),
            inset 0 1px 0 rgba(255, 255, 255, 0.7),
            inset 0 -3px 6px rgba(255, 255, 255, 0.35),
            inset 0 0 0 1px var(--foid-accent-soft);
        }
        :global(.y2k-btn::after) {
          content: "";
          position: absolute;
          inset: 8px 0 30% 0;
          border-radius: 12px;
          background: linear-gradient(180deg, rgba(255,255,255,0.6), rgba(255,255,255,0));
          opacity: 0.5;
          pointer-events: none;
        }
        :global(.y2k-btn:hover) {
          border-color: var(--foid-accent);
          box-shadow:
            0 18px 30px rgba(0, 162, 188, 0.35),
            inset 0 1px 0 rgba(255, 255, 255, 0.92),
            inset 0 -5px 10px rgba(255, 255, 255, 0.35),
            0 0 18px rgba(59, 225, 255, 0.55);
        }
        :global(.y2k-btn:focus-visible) {
          outline: 2px solid var(--foid-accent);
          outline-offset: 3px;
        }
        :global(.y2k-btn--disabled) {
          opacity: 0.45;
          cursor: not-allowed;
          box-shadow: none;
        }
        :global(.y2k-btn--disabled:hover) {
          transform: none;
          box-shadow: none;
        }
        :global(.y2k-btn__reflection) {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 46%;
          border-radius: 14px 14px 0 0;
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.95) 0%, rgba(255, 255, 255, 0.5) 50%, transparent 100%);
          pointer-events: none;
        }
        :global(.y2k-btn__highlight) { position: absolute; inset: 0; border-radius: 14px; pointer-events: none; }
        :global(.y2k-btn__label) {
          position: relative;
          z-index: 2;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: #e6fbff;
          text-shadow: 0 1px 4px rgba(8, 64, 96, 0.7);
        }
        :global(.y2k-btn--secondary) {
          background:
            linear-gradient(180deg, rgba(12, 44, 59, 0.95) 0%, rgba(8, 25, 40, 0.95) 70%, rgba(8, 25, 40, 0.9) 100%);
          border: 2px solid var(--foid-accent-soft);
          box-shadow:
            0 8px 16px rgba(0, 0, 0, 0.22),
            inset 0 1px 0 rgba(255, 255, 255, 0.4),
            inset 0 -3px 6px rgba(255, 255, 255, 0.2);
        }
        :global(.y2k-btn--secondary:hover) {
          box-shadow:
            0 10px 20px rgba(0, 0, 0, 0.24),
            inset 0 1px 0 rgba(255, 255, 255, 0.45),
            inset 0 -3px 6px rgba(255, 255, 255, 0.25),
            0 0 18px rgba(0, 255, 213, 0.35);
        }

        /* Voting */
        .board-voting { display: flex; flex-direction: column; gap: 6px; max-height: 140px; overflow-y: auto; }
        :global(.voting-item) { display: flex; align-items: center; gap: 6px; padding: 5px; background: rgba(0,0,0,0.2); border-radius: 6px; }
        :global(.voting-item__thumb) { width: 28px; height: 28px; border-radius: 4px; overflow: hidden; background: rgba(255,255,255,0.1); }
        :global(.voting-item__thumb img) { width: 100%; height: 100%; object-fit: cover; }
        :global(.voting-item__info) { display: flex; flex-direction: column; font-size: 9px; color: rgba(255,255,255,0.7); }
        :global(.voting-item__counts) { margin-left: auto; font-size: 9px; color: rgba(255,255,255,0.5); }
        :global(.voting-item__btns) { display: flex; gap: 4px; }
        :global(.voting-item__yes), :global(.voting-item__no) { width: 22px; height: 22px; border-radius: 50%; border: 1px solid; font-size: 10px; cursor: pointer; transition: all 0.15s; background: transparent; }
        :global(.voting-item__yes) { border-color: var(--foid-accent-soft); color: var(--foid-accent); }
        :global(.voting-item__yes:hover:not(:disabled)) { background: var(--foid-accent-soft); }
        :global(.voting-item__no) { border-color: rgba(255,71,87,0.5); color: #ff4757; }
        :global(.voting-item__no:hover:not(:disabled)) { background: rgba(255,71,87,0.2); }
        :global(.voting-item__yes:disabled), :global(.voting-item__no:disabled) { opacity: 0.4; cursor: not-allowed; }
        :global(.voting-item__yes:focus-visible), :global(.voting-item__no:focus-visible) {
          outline: 2px solid var(--foid-accent);
          outline-offset: 3px;
        }

        /* Terminal Chat - SMALLER text for spaciousness */
        :global(.terminal-chat) {
          position: relative;
          flex: 1;
          display: flex;
          flex-direction: column;
          min-height: 0;
          background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0) 30%),
            var(--foid-panel-strong);
          border-radius: var(--board-radius-md);
          border: var(--board-border);
          overflow: hidden;
          font-family: var(--font-terminal);
          box-shadow: inset 0 2px 6px rgba(255, 255, 255, 0.08);
        }
        :global(.terminal-chat::before) {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: inherit;
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.28) 0%, rgba(255, 255, 255, 0) 25%);
          pointer-events: none;
          opacity: 0.2;
          mix-blend-mode: screen;
        }
        :global(.terminal-chat::after) {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: inherit;
          background-image:
            linear-gradient(rgba(255, 255, 255, 0.06) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.06) 1px, transparent 1px);
          background-size: 100% 3px, 3px 100%;
          opacity: 0.15;
          pointer-events: none;
          mix-blend-mode: screen;
          z-index: 0;
        }
        :global(.terminal-chat__messages) { flex: 1; min-height: 0; overflow-y: auto; padding: 10px; font-size: 9px; line-height: 1.5; }
        :global(.terminal-chat__line) { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 3px; }
        :global(.terminal-chat__time) { color: rgba(255,255,255,0.35); font-size: 8px; }
        :global(.terminal-chat__user) { color: var(--foid-accent); font-weight: 600; background: var(--foid-accent-soft); padding: 1px 4px; border-radius: 2px; font-size: 8px; }
        :global(.terminal-chat__system) { color: #ffcc00; font-weight: 600; font-style: italic; font-size: 8px; }
        :global(.terminal-chat__text) { color: rgba(255,255,255,0.85); font-size: 9px; }
        :global(.terminal-chat__line--success .terminal-chat__text) { color: var(--foid-accent); }
        :global(.terminal-chat__line--error .terminal-chat__text) { color: #ff4757; }
        :global(.terminal-chat__input-row) { display: flex; align-items: center; padding: 8px 10px; gap: 8px; border-top: 1px solid var(--foid-accent-soft); background: rgba(0, 12, 26, 0.45); }
        :global(.terminal-chat__prompt) { color: var(--foid-accent); margin-right: 8px; font-weight: 600; font-size: 11px; text-shadow: 0 0 8px var(--foid-glow); }
        :global(.terminal-chat__input) { flex: 1; background: rgba(0,20,30,0.4); border: 1px solid var(--foid-accent-soft); border-radius: 4px; outline: none; color: white; font-family: inherit; font-size: 10px; padding: 6px 10px; transition: border-color 0.2s, box-shadow 0.2s; }
        :global(.terminal-chat__input:focus) { border-color: var(--foid-accent); box-shadow: 0 0 10px var(--foid-glow); }
        :global(.terminal-chat__input:focus-visible) {
          outline: 2px solid var(--foid-accent);
          outline-offset: 3px;
        }
        :global(.terminal-chat__input::placeholder) { color: rgba(255,255,255,0.35); }
        :global(.terminal-chat__line--chat .terminal-chat__text) { color: #ccffd8; }
        :global(.terminal-chat__send) {
          padding: 5px 12px;
          border-radius: 6px;
          border: 1px solid var(--foid-accent-soft);
          background: var(--foid-accent-soft);
          color: var(--foid-accent);
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          cursor: pointer;
          transition: background 0.2s, box-shadow 0.2s, transform 0.2s;
        }
        :global(.terminal-chat__send:hover:not(:disabled)) {
          background: var(--foid-accent);
          box-shadow:
            0 0 10px var(--foid-accent-soft),
            0 0 18px var(--foid-warm);
          transform: translateY(-1px);
        }
        :global(.terminal-chat__send:disabled) {
          opacity: 0.35;
          cursor: not-allowed;
          box-shadow: none;
          transform: none;
        }
        :global(.terminal-chat__send:focus-visible) {
          outline: 2px solid var(--foid-accent);
          outline-offset: 3px;
        }

        /* iPod Music Player */
        :global(.ipod-player) {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 4px 6px;
          background: linear-gradient(180deg, rgba(212, 255, 255, 0.85), rgba(138, 229, 255, 0.75));
          border-radius: var(--board-radius-md);
          border: var(--board-border);
          box-shadow: 0 6px 16px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.6);
        }

        :global(.ipod-wheel) {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
        }

        :global(.ipod-wheel__vol) {
          width: 24px;
          height: 14px;
          font-size: 12px;
          color: rgba(0,0,0,0.4);
          background: transparent;
          border: none;
          cursor: pointer;
          transition: color 0.15s;
        }
        :global(.ipod-wheel__vol:hover) { color: rgba(0,0,0,0.7); }

        :global(.ipod-wheel__ring) {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 52px;
          height: 52px;
          background: linear-gradient(180deg, #f0f0f4, #d8d8e0);
          border-radius: 50%;
          box-shadow:
            inset 0 3px 6px rgba(0,0,0,0.12),
            0 2px 4px rgba(255,255,255,0.5),
            0 4px 8px rgba(0,0,0,0.1);
        }

        :global(.ipod-wheel__btn) {
          position: absolute;
          width: 22px;
          height: 22px;
          font-size: 10px;
          color: rgba(0,0,0,0.5);
          background: transparent;
          border: none;
          cursor: pointer;
          transition: color 0.15s;
        }
        :global(.ipod-wheel__btn:hover) { color: rgba(0,0,0,0.8); }

        :global(.ipod-wheel__btn--prev) { left: 4px; }
        :global(.ipod-wheel__btn--next) { right: 4px; }

        :global(.ipod-wheel__center) {
          width: 24px;
          height: 24px;
          background: linear-gradient(180deg, #fafafa, #e8e8f0);
          border-radius: 50%;
          border: none;
          font-size: 14px;
          color: rgba(0,0,0,0.6);
          cursor: pointer;
          box-shadow: 0 2px 4px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.8);
          transition: all 0.15s;
        }
        :global(.ipod-wheel__center:hover) { background: linear-gradient(180deg, #fff, #f0f0f8); }

        :global(.ipod-display) {
          flex: 1;
          padding: 4px 8px;
          background: linear-gradient(
            180deg,
            rgba(210, 255, 255, 0.85),
            rgba(160, 235, 255, 0.75)
          );
          border-radius: var(--board-radius-md);
          border: var(--board-border);
          box-shadow: inset 0 2px 4px rgba(0,0,0,0.08), 0 1px 0 rgba(255,255,255,0.55);
        }

        :global(.ipod-display__track) {
          font-size: 9px;
          font-weight: 500;
          color: rgba(0,0,0,0.7);
          margin-bottom: 4px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        :global(.ipod-display__bar) {
          position: relative;
          height: 5px;
          background: rgba(0,0,0,0.1);
          border-radius: 3px;
          margin-bottom: 4px;
        }

        :global(.ipod-display__fill) {
          position: absolute;
          left: 0;
          top: 0;
          height: 100%;
          background: linear-gradient(90deg, rgba(0,0,0,0.18), rgba(0,0,0,0.28));
          border-radius: 3px;
        }

        :global(.ipod-display__knob) {
          position: absolute;
          top: 50%;
          width: 12px;
          height: 12px;
          background: white;
          border-radius: 50%;
          box-shadow: 0 1px 4px rgba(0,0,0,0.25);
          transform: translate(-50%, -50%);
        }

        :global(.ipod-display__meta) {
          display: flex;
          align-items: center;
          gap: 6px;
          justify-content: space-between;
        }

        :global(.ipod-display__time) {
          font-family: var(--font-mono);
          font-size: 8px;
          color: rgba(0,0,0,0.5);
          flex: 1;
          text-align: center;
        }

        :global(.ipod-display__volume) {
          font-size: 8px;
          font-family: var(--font-mono);
          color: rgba(0,0,0,0.55);
          padding-left: 6px;
          letter-spacing: 0.15em;
        }

        :global(.ipod-display__shuffle),
        :global(.ipod-display__repeat) {
          background: none;
          border: none;
          cursor: pointer;
          font-size: 12px;
          opacity: 0.55;
          transition: opacity 0.15s;
          padding: 2px;
        }
        :global(.ipod-display__shuffle:hover),
        :global(.ipod-display__repeat:hover) { opacity: 0.85; }
        :global(.ipod-display__shuffle--active),
        :global(.ipod-display__repeat--active) { opacity: 1; color: #1d1d1d; }
        :global(.ipod-wheel__vol:focus-visible),
        :global(.ipod-wheel__btn:focus-visible),
        :global(.ipod-wheel__center:focus-visible),
        :global(.ipod-display__shuffle:focus-visible),
        :global(.ipod-display__repeat:focus-visible) {
          outline: 2px solid var(--foid-accent);
          outline-offset: 3px;
          box-shadow: 0 0 12px var(--foid-glow);
        }

        :global(.ipod-display__hint) {
          margin-top: 6px;
          font-size: 9px;
          color: rgba(0,0,0,0.6);
          text-align: center;
          letter-spacing: 0.2em;
        }

        :global(.ipod-music-panel-logic) {
          position: absolute;
          width: 0;
          height: 0;
          opacity: 0;
          pointer-events: none;
          overflow: hidden;
        }
      `}</style>
    </main>
  );
}
