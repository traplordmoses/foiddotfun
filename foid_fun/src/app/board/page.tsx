// /src/app/board/page.tsx - REDESIGNED v3
// Single seamless container matching foid_mommy_terminal.exe
// Features: Wallet dropdown, iPod music player, terminal chat with status, infinite smooth zoom
"use client";

import "./board.css";

import React, {
  Suspense,
  startTransition,
  useCallback,
  useMemo,
  useRef,
  useState,
  useEffect,
} from "react";
import { useSearchParams } from "next/navigation";
import { useAccount, useDisconnect } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useBoard } from "@/state/board";
import type { PendingItem } from "@/state/board";
import { TILE, snapRect, rectCells, hasOverlap, isTouching, type Rect } from "@/lib/grid";
import {
  BOARD_OFFSET_X,
  BOARD_OFFSET_Y,
  WORLD_MAX_X,
  WORLD_MAX_Y,
  worldToContractRect,
  contractToWorldRect,
} from "@/lib/boardSpace";
import { sniffImageType, mimeFromType } from "@/lib/image";
import { convertToJpeg } from "@/lib/imageConvert";
import { uploadImage } from "@/lib/ipfs";
import { cidToHttpUrl } from "@/lib/ipfsUrl";
import { formatEth } from "@/lib/wei";
import { listProposals } from "@/lib/api";
import type { ProposalSummary, ListProposalsResponse } from "@/lib/api";
import { useSwipePropose } from "@/hooks/useSwipePropose";
import { PlacementCard, type Placement } from "@/components/PlacementCard";
import { PlacementModal } from "@/components/PlacementModal";
import { celebratePlacement } from "@/effects/celebrate";
import AppTitlebar from "@/app/(components)/AppTitlebar";
import { TARGET_CHAIN_ID } from "@/lib/chain";
import { TerminalChat, type StatusMessage } from "@/components/TerminalChat";
import { Y2kActionButton } from "@/components/Y2kActionButton";
import dynamic from "next/dynamic";
import { useMobile } from "@/hooks/useMobile";
import type { BoardNode } from "@/types/mobile";

const MobileBoard = dynamic(
  () => import("@/components/MobileBoard").then((m) => m.MobileBoard),
  { ssr: false }
);
import { MobileWalletButton } from "@/components/MobileWalletButton";
import { GestureHint } from "@/components/GestureHint";
// MobilePlacementPicker — used only within MobileProposeModal (extracted)
import {
  toStageRect,
  snapDown,
  getBoundsFromRects,
  STAGE_CANVAS_W,
  STAGE_CANVAS_H,
  STAGE_PAD_X,
  STAGE_PAD_Y,
  GRID_RADIUS_X,
  GRID_RADIUS_Y,
  MIN_SCALE,
  MAX_SCALE,
} from "@/lib/boardCoordinates";
import {
  capRectToMaxCells,
  downscaleToMaxCells,
  MAX_CELLS_PER_RECT,
} from "@/lib/boardImages";
import { parseWeb3Error, isUserRejection } from "@/lib/errors";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { PaintEditor } from "@/components/PaintEditor";
import { useSwipeLoreboardGovernance } from "@/hooks/useSwipeLoreboardGovernance";

// ============================================================================
// HELPER FUNCTIONS (extracted to lib/board)
// ============================================================================

import {
  debugWarn,
  normalizeCidString,
  normalizeProposals,
  tryNextGateway,
  getImageSize,
} from "@/lib/board";
import { MobileProposeModal } from "@/components/board/MobileProposeModal";

// ============================================================================
// CONSTANTS
// ============================================================================

const BASE_FEE_PER_CELL_WEI = BigInt(process.env.NEXT_PUBLIC_BASE_FEE_PER_CELL_WEI ?? "0");

const CARD_BORDER = "rgba(116, 255, 235, 0.55)";
const CARD_SHADOW = "0 14px 32px rgba(0, 6, 22, 0.45), 0 0 0 1px rgba(116,255,235,0.3)";
const FLUENT_CHAIN_ID = TARGET_CHAIN_ID;

// ============================================================================
// TYPES
// ============================================================================

type DropPos = { x: number; y: number };
type DragMeta = { w: number; h: number; mime: "image/png" | "image/jpeg" | null };
type GhostStatus = "ok" | "overlap" | "oversize" | "invalid" | "not-touching";
type Ghost = { rect: Rect; cells: number; status: GhostStatus; totalWei: bigint };

// ============================================================================
// COMPONENTS NOW IMPORTED FROM /src/components/
// TerminalChat, Y2kActionButton, VotingItem
// ============================================================================
// ============================================================================
// UTILITY FUNCTIONS
// (Image and coordinate utilities now imported from /src/lib/)
// ============================================================================

// isValidCid, normalizeCidString, tryNextGateway — imported from @/lib/board

async function getPendingBytes(p: PendingItem): Promise<ArrayBuffer> {
  // Prefer using the File object directly if available
  if (p.file) {
    return await p.file.arrayBuffer();
  }
  // Fallback to fetching the blob URL (may fail if revoked)
  const res = await fetch(p.previewUrl);
  if (!res.ok) throw new Error("Failed to read pending asset");
  return res.arrayBuffer();
}

// asWorldRect, normalizeProposals — imported from @/lib/board


// MobileProposeModal — imported from @/components/board/MobileProposeModal

// ============================================================================
// MAIN BOARD PAGE COMPONENT
// ============================================================================

function BoardPageContent() {
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
  const { openConnectModal } = useConnectModal();
  const { propose: proposeLoreboard } = useSwipePropose();
  const handleSwitchWallet = useCallback(() => {
    disconnect();
    setTimeout(() => openConnectModal?.(), 100);
  }, [disconnect, openConnectModal]);

  // Mobile propose modal
  const [showMobilePropose, setShowMobilePropose] = useState(false);

  // Desktop paint editor state
  const [desktopPaintFile, setDesktopPaintFile] = useState<File | null>(null);
  const [desktopPaintPos, setDesktopPaintPos] = useState<DropPos | undefined>(undefined);

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
  const handleChatSend = useCallback(async (_text: string) => {
    // TerminalChat handles insertBoardMessage + optimistic display directly.
    // Nothing extra needed here.
  }, []);

  // Governance - flagging placements
  const { flagPlacement, flagFeeWei } = useSwipeLoreboardGovernance();
  const [flaggedIds, setFlaggedIds] = useState<Set<string>>(new Set());
  const flagFeeEth = (Number(flagFeeWei) / 1e18).toFixed(3);

  const handleFlagPlacement = useCallback(async (placementId: string) => {
    if (!address || !isConnected) {
      openConnectModal?.();
      return;
    }
    try {
      // Convert hex placementId to number for the contract call
      const numericId = Number(BigInt(placementId));
      await flagPlacement(numericId);
      setFlaggedIds(prev => new Set(prev).add(placementId));
      addStatus(`Flagged placement — tx sent`, "success");
    } catch (err: unknown) {
      if (isUserRejection(err)) return;
      const msg = parseWeb3Error(err);
      addStatus(`Flag failed: ${msg}`, "error");
    }
  }, [address, isConnected, openConnectModal, flagPlacement, addStatus]);

  // UI state
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [submittingProposals, setSubmittingProposals] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const searchParams = useSearchParams();
  const debugMode = searchParams?.get("debug") === "1";

  // Mobile detection
  const { isMobile } = useMobile();

  // Board data — proposals are the sole data source
  const [proposals, setProposals] = useState<ProposalSummary[]>([]);
  const [proposalsLoading, setProposalsLoading] = useState(true);
  const [proposalDebug, setProposalDebug] = useState<ListProposalsResponse["debug"] | null>(null);

  // Pending proposals from Swipe contract (voting in progress) — fetched via API
  const [swipeVotingProposals, setSwipeVotingProposals] = useState<Array<{
    id: number; cid: string; x: number; y: number; w: number; h: number;
    proposer: string; votingEndsAt: number; forCount: number; againstCount: number;
  }>>([]);

  // Derive "placed" items from canonized proposals
  const placed = useMemo(
    () => proposals.filter((p) => p.status === "canonized"),
    [proposals]
  );

  const [activePlacement, setActivePlacement] = useState<Placement | null>(null);
  const [selectedProposalId, setSelectedProposalId] = useState<string | null>(null);
  const autoZoomedEpochRef = useRef<number | null>(null);

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

  // Keyboard zoom shortcuts: +/= for zoom in, - for zoom out, 0 for reset
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in input/textarea
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;

      if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        setScale((s) => Math.min(MAX_SCALE, s * 1.2));
      } else if (e.key === "-") {
        e.preventDefault();
        setScale((s) => Math.max(MIN_SCALE, s / 1.2));
      } else if (e.key === "0") {
        e.preventDefault();
        setScale(1);
        const el = containerRef.current;
        if (el) {
          const r = el.getBoundingClientRect();
          setPan({ x: (r.width - STAGE_CANVAS_W) / 2, y: (r.height - STAGE_CANVAS_H) / 2 });
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Pan handlers
  const onContainerPointerDown: React.PointerEventHandler<HTMLDivElement> = (e) => {
    const interactive = (e.target as HTMLElement).closest("figure,button,input,textarea,select,label");
    if (spaceDown) {
      e.preventDefault();
      panStartRef.current = { x: e.clientX, y: e.clientY };
      panOriginRef.current = { ...pan };
      setIsPanning(true);
      e.currentTarget.setPointerCapture?.(e.pointerId);
      return;
    }
    if (interactive) return;
    e.preventDefault();
    boardDragStartRef.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
    setDraggingBoard(true);
    e.currentTarget.setPointerCapture?.(e.pointerId);
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
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

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

  // Cleanup: Revoke blob URLs on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      pending.forEach((item) => {
        if (item.previewUrl && item.previewUrl.startsWith("blob:")) {
          try {
            URL.revokeObjectURL(item.previewUrl);
          } catch (err) {
            debugWarn("Failed to revoke blob URL:", err);
          }
        }
      });
    };
  }, [pending]);

  // getImageSize — imported from @/lib/board

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
    const placedRects = placed.map((pl) => pl.rect);
    const swipeVotingProposalsRects = swipeVotingProposals.map(p => ({ x: p.x, y: p.y, w: p.w, h: p.h }));
    const allOccupiedRects = [...placedRects, ...swipeVotingProposalsRects];
    if (cells > MAX_CELLS_PER_RECT) status = "oversize";
    else if (hasOverlap(rect, allOccupiedRects) || hasOverlap(rect, pending.map(storedRectFor))) status = "overlap";
    else if (!isTouching(rect, [...allOccupiedRects, ...pending.map(storedRectFor)])) status = "not-touching";
    setGhost({ rect, cells, status, totalWei: BigInt(cells) * BASE_FEE_PER_CELL_WEI });
  }, [pending, placed, swipeVotingProposals, storedRectFor]);

  // Debounced ghost refresh to reduce CPU usage during drag
  const ghostDebounceRef = useRef<number | null>(null);
  const debouncedRefreshGhost = useCallback((pos: DropPos) => {
    if (ghostDebounceRef.current !== null) {
      window.clearTimeout(ghostDebounceRef.current);
    }
    ghostDebounceRef.current = window.setTimeout(() => {
      refreshGhostAt(pos);
      ghostDebounceRef.current = null;
    }, 16); // ~60fps
  }, [refreshGhostAt]);

  const onDragOver: React.DragEventHandler<HTMLDivElement> = async (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    await primeGhostMetaFromEvent(e);
    setDragOver(true);
    debouncedRefreshGhost(screenToWorld(e.clientX, e.clientY));
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
      // Auto-convert non-PNG/JPEG to JPEG
      if (!kind) {
        try {
          workingFile = await convertToJpeg(workingFile);
          kind = "jpg";
        } catch { addStatus("Could not process image.", "error"); return; }
      }
      // Open paint editor before placing on board
      setDesktopPaintFile(workingFile);
      setDesktopPaintPos(pos);
    } finally { setBusy(false); setGhost(null); ghostMetaRef.current = null; }
  }, [addStatus]);

  const handleDesktopPaintDone = useCallback(async (editedFile: File) => {
    setDesktopPaintFile(null);
    setBusy(true);
    try {
      let workingFile = editedFile;
      let kind = await sniffImageType(workingFile);
      let mime = kind ? (mimeFromType(kind) as "image/png" | "image/jpeg") : ("image/jpeg" as "image/png" | "image/jpeg");
      const { w, h } = await getImageSize(workingFile);
      const pos = desktopPaintPos;
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
        tipPerCellWei: 0n, previewUrl: URL.createObjectURL(workingFile), file: workingFile, cid: undefined, fitMode: "contain",
      });
      addStatus(`Image added: ${workingFile.name}`, "success");
    } finally { setBusy(false); setDesktopPaintPos(undefined); }
  }, [addPending, clampToCanvas, addStatus, desktopPaintPos]);

  const handleDesktopPaintCancel = useCallback(() => {
    setDesktopPaintFile(null);
    setDesktopPaintPos(undefined);
  }, []);

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
    e.currentTarget.setPointerCapture?.(e.pointerId);
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
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const onMove = (ev: PointerEvent) => {
      if (!startRectRef.current) return;
      const dx = (ev.clientX - startPtRef.current.x) / scale, dy = (ev.clientY - startPtRef.current.y) / scale;
      let w = startRectRef.current.w + dx, h = ev.altKey ? startRectRef.current.h + dy : w / aspectRef.current;
      w = snapDown(w); h = snapDown(h);
      const next = clampToCanvas(capRectToMaxCells({ x: startRectRef.current.x, y: startRectRef.current.y, w, h }, MAX_CELLS_PER_RECT));
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

  // Load proposals (canonized from /api/proposals + voting from /api/swipe/proposals)
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        // Fetch both endpoints in parallel
        const [boardRes, swipeRes] = await Promise.allSettled([
          listProposals(),
          fetch("/api/swipe/proposals").then(r => r.ok ? r.json() : { proposals: [] }),
        ]);

        if (!alive) return;

        // Canonized placements from board API
        const boardData = boardRes.status === "fulfilled" ? boardRes.value : { proposals: [], debug: null };
        const normalized = normalizeProposals(boardData.proposals);

        // Active voting proposals from swipe API (with grid coordinates)
        const swipeData = swipeRes.status === "fulfilled" ? swipeRes.value : { proposals: [] };
        const now = Math.floor(Date.now() / 1000);
        const activeSwipe = (swipeData.proposals ?? [])
          .filter((p: { finalized: boolean; approved: boolean; votingEndsAt: number; gridW?: number }) =>
            !p.finalized && !p.approved && p.votingEndsAt > now && (p.gridW ?? 0) > 0
          )
          .map((p: { id: number; ipfsCid: string; gridX: number; gridY: number; gridW: number; gridH: number; proposer: string; votingEndsAt: number; forCount: number; againstCount: number }) => {
            // Convert from contract space to world space
            const worldRect = contractToWorldRect({ x: p.gridX, y: p.gridY, w: p.gridW, h: p.gridH });
            return {
              id: p.id,
              cid: p.ipfsCid,
              x: worldRect.x,
              y: worldRect.y,
              w: worldRect.w,
              h: worldRect.h,
              proposer: p.proposer,
              votingEndsAt: p.votingEndsAt,
              forCount: p.forCount ?? 0,
              againstCount: p.againstCount ?? 0,
            };
          });

        startTransition(() => {
          setProposals(normalized);
          setProposalDebug(boardData.debug ?? null);
          setSwipeVotingProposals(activeSwipe);
          setProposalsLoading(false);
        });
      } catch {
        if (!alive) return;
        startTransition(() => {
          setProposals([]);
          setProposalDebug(null);
          setSwipeVotingProposals([]);
          setProposalsLoading(false);
        });
      }
    };
    tick();
    const t = setInterval(tick, 12_000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  // Arrow keys
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!activeId || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return;
      const target = pending.find((x) => x.id === activeId);
      if (!target) return;
      const step = e.shiftKey ? TILE : Math.floor(TILE / 4);
      let { x, y } = target.rect;
      const { w, h } = target.rect;
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
      const placedRects = placed.map((pl) => pl.rect);
      const pendingRects = items.map((it) => ({ name: it.name, rect: { ...it.rect } }));
      const overlapNames: string[] = [];
      pendingRects.forEach((c, idx) => {
        const peers = pendingRects.filter((_, j) => j !== idx).map((r) => r.rect);
        if (hasOverlap(c.rect, placedRects) || hasOverlap(c.rect, peers)) overlapNames.push(c.name);
      });
      if (overlapNames.length) throw new Error(`Overlap: ${overlapNames.join(", ")}`);

      const notTouchingNames: string[] = [];
      pendingRects.forEach((c, idx) => {
        const peers = pendingRects.filter((_, j) => j !== idx).map((r) => r.rect);
        if (!isTouching(c.rect, [...placedRects, ...peers])) notTouchingNames.push(c.name);
      });
      if (notTouchingNames.length) throw new Error(`Not touching board: ${notTouchingNames.join(", ")}`);

      if (!address) throw new Error("No wallet connected");
      const account = address;

      let lastTxHash = "";
      let lastProposalId: number | null = null;
      let lastPreviewUrl = "";
      let lastName = "";

      for (const it of items) {
        addStatus(`Uploading ${it.name}...`, "info");
        const onChainRect = worldToContractRect(it.rect);
        // Use the File object directly if available, otherwise fetch bytes
        const file = it.file || new File([await getPendingBytes(it)], it.name, { type: it.mime });
        const cid = await uploadImage(it.name, file, it.mime);
        if (!cid) throw new Error("IPFS upload disabled");
        setCidFor(it.id, cid);

        addStatus(`Submitting ${it.name}...`, "info");
        const normalizedCid = normalizeCidString(cid);
        const onChain = await proposeLoreboard({
          ipfsCid: normalizedCid,
          x: onChainRect.x,
          y: onChainRect.y,
          w: onChainRect.w,
          h: onChainRect.h,
        });

        // Transaction succeeded on-chain!
        addStatus(`${it.name} on-chain ✓ (tx: ${onChain.txHash.slice(0, 10)}...)`, "success");
        lastTxHash = onChain.txHash;
        lastProposalId = onChain.proposalId;
        lastPreviewUrl = it.previewUrl;
        lastName = it.name;
      }

      // Fire celebration BEFORE clearing state (preserves blob URLs)
      if (lastTxHash) {
        celebratePlacement({
          itemName: lastName,
          txHash: lastTxHash,
          proposalId: lastProposalId,
          previewUrl: lastPreviewUrl,
        });
      }

      clearBoardState?.();
      try {
        const response = await listProposals();
        startTransition(() => {
          setProposals(normalizeProposals(response.proposals));
          setProposalDebug(response.debug ?? null);
        });
      } catch {
        startTransition(() => {
          setProposalDebug(null);
        });
      }
      addStatus("All proposals submitted!", "success");
    } catch (e: unknown) {
      // Skip user rejection errors (silent)
      if (isUserRejection(e)) {
        addStatus("Transaction cancelled", "info");
      } else {
        const parsed = parseWeb3Error(e);
        addStatus(parsed.message, "error");
      }
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

  const pendingVotes = proposals.filter((p) => (p.status === "voting" && p.isVotable));
  const firstPending = pendingVotes[0];
  const firstPendingId = firstPending?.id ?? null;
  const firstPendingEpoch = firstPending?.epochSubmitted ?? null;
  const pendingBounds = useMemo(() => getBoundsFromRects(pendingVotes.map((p) => p.rect)), [pendingVotes]);

  useEffect(() => {
    if (!firstPendingId || !pendingBounds || firstPendingEpoch == null) {
      setSelectedProposalId(null);
      if (pendingVotes.length === 0) autoZoomedEpochRef.current = null;
      return;
    }
    setSelectedProposalId(firstPendingId);
    if (autoZoomedEpochRef.current === firstPendingEpoch) return;
    autoZoomedEpochRef.current = firstPendingEpoch;
    zoomToRect(pendingBounds, 64);
  }, [firstPendingId, firstPendingEpoch, pendingBounds, pendingVotes.length, zoomToRect]);

  const selectedProposal = useMemo(
    () =>
      selectedProposalId ? proposals.find((p) => p.id === selectedProposalId) ?? null : null,
    [proposals, selectedProposalId]
  );

  const proposalToPlacement = (p: ProposalSummary): Placement => {
    const sr = toStageRect(p.rect);
    return {
      id:             p.id,
      cid:            p.cid,
      x:              sr.x,
      y:              sr.y,
      width:          sr.w,
      height:         sr.h,
      name:           p.name,
      proposer:       p.owner as `0x${string}`,
      epochId:        p.epochId ?? p.epochSubmitted,
      status:         p.status,
      yesVotes:       p.yesVotes ?? p.yes,
      noVotes:        p.noVotes ?? p.no,
      voters:         p.voters,
      percentYes:     p.percentYes,
      secondsLeft:    p.secondsLeft,
      voteEndsAt:     p.voteEndsAt,
      epochSubmitted: p.epochSubmitted,
      cells:          p.cells,
    };
  };

  // Convert board items to mobile format
  const boardNodes = useMemo<BoardNode[]>(() => {
    const nodes: BoardNode[] = [];

    // Add finalized placements (canonized proposals)
    placed.forEach((p) => {
      nodes.push({
        id: `placed-${p.id}`,
        x: p.rect.x,
        y: p.rect.y,
        width: p.rect.w,
        height: p.rect.h,
        content: p.cid,
        type: 'meme',
        status: 'canonized',
      });
    });

    // Add voting proposals from listProposals
    proposals
      .filter((p) => p.status === "voting" && p.isVotable)
      .forEach((p) => {
        nodes.push({
          id: `proposal-${p.id}`,
          x: p.rect.x,
          y: p.rect.y,
          width: p.rect.w,
          height: p.rect.h,
          content: p.cid,
          type: 'meme',
          status: 'voting',
          forCount: p.yesVotes ?? p.yes ?? 0,
          againstCount: p.noVotes ?? p.no ?? 0,
        });
      });

    // Add pending on-chain proposals (from PlacementProposed events)
    const existingIds = new Set(nodes.map(n => n.id));
    swipeVotingProposals.forEach((p) => {
      const nodeId = `pending-${p.id}`;
      if (existingIds.has(nodeId)) return;
      nodes.push({
        id: nodeId,
        x: p.x,
        y: p.y,
        width: p.w,
        height: p.h,
        content: p.cid,
        type: 'meme',
        status: 'voting',
        forCount: p.forCount,
        againstCount: p.againstCount,
      });
    });

    return nodes;
  }, [placed, proposals, swipeVotingProposals]);

  const mobileView = (
    <div className="h-screen w-screen bg-transparent relative">
      {/* Propose button — floating top-left */}
      <button
        onClick={() => setShowMobilePropose(true)}
        className="absolute top-3 left-3 z-50 px-4 py-2 text-xs font-bold tracking-widest uppercase rounded-xl shadow-lg touch-manipulation"
        style={{
          background: "linear-gradient(135deg, #e040fb, #f06292)",
          color: "#fff",
          border: "1px solid rgba(255,255,255,0.2)",
          boxShadow: "0 4px 16px rgba(224,64,251,0.35)",
        }}
      >
        Propose Meme
      </button>

      {/* Mobile propose modal */}
      {showMobilePropose && (
        <MobileProposeModal
          isConnected={isConnected}
          address={address}
          placedRects={[...placed.map(p => p.rect), ...swipeVotingProposals.map(p => ({ x: p.x, y: p.y, w: p.w, h: p.h }))]}
          onClose={() => setShowMobilePropose(false)}
          onSuccess={(msg) => {
            addStatus(msg, "success");
            setShowMobilePropose(false);
            // Refresh both canonized and voting proposals
            Promise.allSettled([
              listProposals(),
              fetch("/api/swipe/proposals").then(r => r.ok ? r.json() : { proposals: [] }),
            ]).then(([boardRes, swipeRes]) => {
              startTransition(() => {
                if (boardRes.status === "fulfilled") {
                  setProposals(normalizeProposals(boardRes.value.proposals));
                }
                if (swipeRes.status === "fulfilled") {
                  const now = Math.floor(Date.now() / 1000);
                  const active = (swipeRes.value.proposals ?? [])
                    .filter((p: { finalized: boolean; approved: boolean; votingEndsAt: number; gridW?: number }) =>
                      !p.finalized && !p.approved && p.votingEndsAt > now && (p.gridW ?? 0) > 0
                    )
                    .map((p: { id: number; ipfsCid: string; gridX: number; gridY: number; gridW: number; gridH: number; proposer: string; votingEndsAt: number; forCount: number; againstCount: number }) => {
                      const wr = contractToWorldRect({ x: p.gridX, y: p.gridY, w: p.gridW, h: p.gridH });
                      return {
                        id: p.id, cid: p.ipfsCid, x: wr.x, y: wr.y, w: wr.w, h: wr.h,
                        proposer: p.proposer, votingEndsAt: p.votingEndsAt, forCount: p.forCount ?? 0, againstCount: p.againstCount ?? 0,
                      };
                    });
                  setSwipeVotingProposals(active);
                }
              });
            });
          }}
        />
      )}
      <GestureHint
        storageKey="board-gestures-seen"
        hints={[
          "Pinch to zoom in and out",
          "Drag with one finger to pan around",
          "Hold any meme to view details"
        ]}
      />
      <MobileBoard
        nodes={boardNodes}
        onNodeClick={(node) => {
          // Check if it's a finalized placement
          const placementId = node.id.replace('placed-', '');
          const placement = placed.find(p => p.id === placementId);
          if (placement) {
            setActivePlacement({
              id: placement.id,
              cid: placement.cid,
              x: placement.rect.x,
              y: placement.rect.y,
              width: placement.rect.w,
              height: placement.rect.h,
              proposer: (placement.owner ?? "") as `0x${string}`,
              epochId: placement.epochSubmitted ?? 0,
            });
          }
        }}
      />

      {/* Show placement modal if active */}
      {activePlacement && (
        <PlacementModal
          placement={activePlacement}
          onClose={() => setActivePlacement(null)}
        />
      )}

      {/* Mobile wallet button */}
      {isMobile && <MobileWalletButton />}
    </div>
  );

  // ============================================================================
  // MAIN RENDER
  // ============================================================================

  const mainView = (
    <main className="board-page relative overflow-hidden flex items-center justify-center" style={{ height: "100vh" }}>
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

      <section className="relative z-10 w-full max-w-full px-2 sm:px-4">
        <div className="mx-auto w-full max-w-6xl">
          <div className="vista-window vista-window--terminal vista-window--enhanced h-[94vh] max-h-[94vh] w-full flex flex-col board-window">
            <AppTitlebar
              title="MIFOID_LOREBOARD.APP"
              chainId={FLUENT_CHAIN_ID}
              connected={isConnected}
              address={address}
              walletAddress={address as `0x${string}` | undefined}
              onDisconnect={() => disconnect()}
              onSwitchWallet={handleSwitchWallet}
            />

            {/* Main content - align with pray spacing */}
            <div className="vista-window__body vista-window__body--flush mt-2 pray-panel__body board-body">
              <div className="board-grid">
                {/* Canvas */}
                <div className="board-canvas-wrap flex-1 min-h-0">
                  <div
                    ref={containerRef}
                    className="board-canvas flex-1 min-h-0 h-full w-full"
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
                      {/* Finalized (canonized proposals) */}
                    {placed.map((p) => {
                      const sr = toStageRect(p.rect);
                      const isActive = activePlacement?.id === p.id;
                      return (
                        <PlacementCard
                          key={p.id}
                          placement={{ id: p.id, cid: p.cid, x: sr.x, y: sr.y, width: sr.w, height: sr.h, proposer: (p.owner ?? "") as `0x${string}`, epochId: p.epochSubmitted ?? 0, status: "canonized" }}
                          onOpen={setActivePlacement}
                          onFlag={handleFlagPlacement}
                          isFlagged={flaggedIds.has(p.id)}
                          flagLabel={`Flag (${flagFeeEth} ETH)`}
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
                      const color = ghost.status === "ok" ? "rgba(72,255,171,0.9)" : ghost.status === "not-touching" ? "rgba(255,184,0,0.9)" : ghost.status === "invalid" ? "rgba(255,71,87,0.9)" : ghost.status === "overlap" ? "rgba(255,71,87,0.9)" : "rgba(255,184,0,0.9)";
                      return (
                        <div className="board-ghost" style={{ left: sr.x, top: sr.y, width: sr.w, height: sr.h, outlineColor: color, background: color.replace("0.9", "0.08") }}>
                          <span className="board-ghost__label">{ghost.cells} cells · {formatEth(ghost.totalWei)} ETH</span>
                        </div>
                      );
                    })()}

                    {/* Proposals */}
                    {proposals.filter((p) => p.status === "voting" && p.isVotable).map((p) => {
                      const sr = toStageRect(p.rect);
                      const isSelectedProposal = selectedProposal?.id === p.id;
                      return (
                        <figure
                          key={p.id}
                          className={`board-proposal${isSelectedProposal ? " board-proposal--selected" : ""}`}
                          style={{ left: sr.x, top: sr.y, width: sr.w, height: sr.h, cursor: "pointer" }}
                          onClick={() => setActivePlacement(proposalToPlacement(p))}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={cidToHttpUrl(p.cid)} alt={p.name} className="board-proposal__img" draggable={false} loading="lazy" onError={(e) => tryNextGateway(e.currentTarget, p.cid)} />
                          {isSelectedProposal && <span className="board-proposal__badge">selected</span>}
                        </figure>
                      );
                    })}

                    {/* Swipe voting proposals — ghost placement with neon glow */}
                    {swipeVotingProposals.map((p) => {
                      const sr = toStageRect({ x: p.x, y: p.y, w: p.w, h: p.h });
                      return (
                        <figure
                          key={`swipe-${p.id}`}
                          className="board-voting-ghost"
                          style={{
                            left: sr.x, top: sr.y, width: sr.w, height: sr.h,
                            cursor: "pointer",
                          }}
                          title={`Proposal #${p.id} — voting in progress`}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={cidToHttpUrl(p.cid)} alt={`Proposal #${p.id}`} className="board-voting-ghost__img" draggable={false} loading="lazy" onError={(e) => tryNextGateway(e.currentTarget, p.cid)} />
                          <div className="board-voting-ghost__badge">
                            <span>VOTING #{p.id}</span>
                            <div className="board-voting-ghost__votes">
                              <span className="yes">{p.forCount}Y</span>
                              <span className="sep">/</span>
                              <span className="no">{p.againstCount}N</span>
                            </div>
                          </div>
                        </figure>
                      );
                    })}

                    {/* Pending */}
                    {items.map((p) => {
                      const sr = toStageRect(renderRectFor(p));
                      return (
                        <figure key={p.id} className="board-pending" style={{ left: sr.x, top: sr.y, width: sr.w, height: sr.h }}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={p.previewUrl} alt={p.name} className="board-pending__img" draggable={false} loading="lazy" />
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
                <div className="board-sidebar__scroller">
                  {/* Actions */}
                  <div className="board-section board-section--actions">
                    <div className="board-section__header">
                      <span className="board-section__dot" />
                      <span className="board-section__title">ACTIONS</span>
                      <span className="board-section__chip" title="ETH cells are your placement credits">{"\u{1F4B0}"} ETH/CELL: {formatEth(BASE_FEE_PER_CELL_WEI)}</span>
                    </div>
                    <div className="board-actions">
                      <Y2kActionButton onClick={onPickClick} label="PROPOSE IMAGE" variant="primary" />
                      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />
                      <div className="board-actions__divider" />
                      {items.length > 0 && (
                        <span className="board-actions__pending-line">ready to submit ✓</span>
                      )}
                      <Y2kActionButton onClick={handleSubmitProposals} label={submittingProposals ? "SUBMITTING..." : "SUBMIT PROPOSAL"} disabled={!items.length || submittingProposals} variant="secondary" />
                    </div>
                    <div className="board-actions__pricing">
                      0.001 ETH per placement &middot; any size
                    </div>
                  </div>

                  {/* Chat */}
                  <div className="board-section--chat-wrapper">
                    <div className="board-section board-section--chat">
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
                      <TerminalChat
                        className="h-full"
                        statusMessages={statusMessages}
                        onSend={handleChatSend}
                        enableSupabase={true}
                        walletAddress={address}
                      />
                    </div>
                  </div>

                  {/* Music + Epoch removed — music is now global bar, epoch was clutter */}

                  {debugMode && proposalDebug && (
                    <div className="board-section board-section--debug">
                      <div className="board-section__header">
                        <span className="board-section__dot" />
                        <span className="board-section__title">DEBUG</span>
                        <span className="board-section__sub">pending feed</span>
                      </div>
                      <div className="debug-stats">
                        <span>pendingActiveCount: {proposalDebug.pendingActiveCount}</span>
                        <span>boardEventsCount: {proposalDebug.boardEventsCount}</span>
                        <span>joinedRenderableCount: {proposalDebug.joinedRenderableCount}</span>
                        <span>pendingEvents: {proposalDebug.pendingEvents?.length ?? 0}</span>
                      </div>
                      <div className="debug-missing">
                        <strong>missing:</strong>{" "}
                        {proposalDebug.missingBoardPayload.length
                          ? proposalDebug.missingBoardPayload.join(", ")
                          : "none"}
                      </div>
                      <pre className="debug-json">{JSON.stringify(proposalDebug.samplePending ?? [], null, 2)}</pre>
                      <pre className="debug-json">{JSON.stringify(proposalDebug.sampleJoined ?? [], null, 2)}</pre>
                    </div>
                  )}
                </div>
              </div> {/* board-sidebar */}
            </div> {/* board-grid */}
          </div> {/* vista-window__body */}
        </div> {/* board-window */}
      </div> {/* max-w-6xl */}
    </section>

    {activePlacement && <PlacementModal placement={activePlacement} onClose={() => setActivePlacement(null)} />}
    {/* Notifications now live in AppTitlebar via NotificationInbox */}
    {desktopPaintFile && (
      <PaintEditor
        imageFile={desktopPaintFile}
        onDone={handleDesktopPaintDone}
        onCancel={handleDesktopPaintCancel}
      />
    )}
    </main>
  );

  // Render both views, CSS handles which one displays (no flash!)
  return (
    <>
      {/* Mobile view - hidden on desktop */}
      <div className="lg:hidden">
        {mobileView}
      </div>

      {/* Desktop view - hidden on mobile */}
      <div className="hidden lg:block">
        {mainView}
      </div>
    </>
  );
}

export default function BoardPage() {
  return (
    <ErrorBoundary title="Board Error" description="Something went wrong loading the board. This has been logged.">
      <Suspense
        fallback={
          <main className="min-h-screen w-full flex items-center justify-center px-4">
            <div className="font-terminal text-xs uppercase tracking-[0.16em] text-white/70 flex items-center gap-3">
              <span className="inline-block h-4 w-4 rounded-full border-2 border-cyan-100/35 border-t-cyan-100 animate-spin" />
              loading board...
            </div>
          </main>
        }
      >
        <BoardPageContent />
      </Suspense>
    </ErrorBoundary>
  );
}
