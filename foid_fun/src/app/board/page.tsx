// /src/app/board/page.tsx - REDESIGNED v3
// Single seamless container matching foid_mommy_terminal.exe
// Features: Wallet dropdown, iPod music player, terminal chat with status, infinite smooth zoom
"use client";

import "./board.css";

import React, {
  Component,
  Suspense,
  useCallback,
  useMemo,
  useRef,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import { useSearchParams } from "next/navigation";
import { useAccount, useDisconnect } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useBoard } from "@/state/board";
import type { PendingItem } from "@/state/board";
import { TILE, snapRect, rectCells, type Rect } from "@/lib/grid";
import {
  WORLD_MAX_X,
  WORLD_MAX_Y,
} from "@/lib/boardSpace";
import { sniffImageType, mimeFromType } from "@/lib/image";
import { convertToJpeg } from "@/lib/imageConvert";
import { cidToHttpUrl } from "@/lib/ipfsUrl";
import type { ProposalSummary } from "@/lib/api";
import { useSwipePropose } from "@/hooks/useSwipePropose";
import { usePanZoom, type DropPos } from "@/hooks/board/usePanZoom";
import { useViewportZoomLock } from "@/hooks/board/useViewportZoomLock";
import { useGhost } from "@/hooks/board/useGhost";
import { useBoardData } from "@/hooks/board/useBoardData";
import { useProposalSubmit } from "@/hooks/board/useProposalSubmit";
import { useVisiblePlacements } from "@/hooks/board/useVisiblePlacements";
import { BoardHUD } from "@/components/board/BoardHUD";
import { PlacementGhost } from "@/components/board/PlacementGhost";
import { VotingGhost } from "@/components/board/VotingGhost";
import { PendingItemCard } from "@/components/board/PendingItemCard";
import { BoardActions } from "@/components/board/BoardActions";
import { BatchReviewModal } from "@/components/board/BatchReviewModal";
import { SUBMISSION_FEE_WEI } from "@/lib/board/fees";
import {
  toastUploading,
  toastSigning,
  toastConfirmed,
  toastFailed,
  toastInfo,
  toastBatch,
  dismissItemToast,
} from "@/lib/board/toasts";
import { pickPersonalization } from "@/effects/placementPersonalization";
import { useUserPlacements } from "@/hooks/useUserPlacements";
import { PlacementCard, type Placement } from "@/components/PlacementCard";
import { PlacementModal } from "@/components/PlacementModal";
import { celebratePlacement } from "@/effects/celebrate";
import AppTitlebar from "@/app/(components)/AppTitlebar";
import { TARGET_CHAIN_ID } from "@/lib/chain";
import { TerminalChat, type StatusMessage } from "@/components/TerminalChat";
import { StatusDot } from "@/components/ui";
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
} from "@/lib/boardCoordinates";
import {
  capRectToMaxCells,
  downscaleToMaxCells,
  MAX_CELLS_PER_RECT,
} from "@/lib/boardImages";
import { parseWeb3Error, isUserRejection } from "@/lib/errors";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { PaintEditor } from "@/components/PaintEditor";
import { RemovalVotePanel } from "@/components/RemovalVotePanel";
import {
  useSwipeLoreboardGovernance,
  usePlacementFlagCount,
  useHasFlaggedPlacement,
  useActivePlacementVote,
  usePlacementRemovalVote,
} from "@/hooks/useSwipeLoreboardGovernance";

// ============================================================================
// HELPER FUNCTIONS (extracted to lib/board)
// ============================================================================

import { tryNextGateway, getImageSize } from "@/lib/board";
import { MobileProposeModal } from "@/components/board/MobileProposeModal";

// ============================================================================
// CONSTANTS
// ============================================================================

// Visual constants now reference tokens.css — any brand color tweak can
// be done in one place without touching board/page.tsx.
const CARD_BORDER = "var(--foid-border-strong)";
const CARD_SHADOW = "var(--foid-shadow-card)";
const FLUENT_CHAIN_ID = TARGET_CHAIN_ID;

// ============================================================================
// TYPES
// ============================================================================

// DropPos/Ghost types moved to hooks/board/*

// ============================================================================
// COMPONENTS NOW IMPORTED FROM /src/components/
// TerminalChat, Y2kActionButton, VotingItem
// ============================================================================

/** Lightweight boundary so a chat/WebSocket crash can't take down the board */
class ChatErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(err: Error) { console.warn("[ChatErrorBoundary]", err.message); }
  render() {
    if (this.state.failed) return (
      <div className="board-section--chat-wrapper">
        <div className="board-section board-section--chat" style={{ opacity: 0.6 }}>
          <div className="board-section__header">
            <StatusDot status="offline" />
            <span className="board-section__title">CHAT</span>
            <span className="board-section__status ml-auto" data-status="offline">offline</span>
          </div>
          <p style={{ padding: 12, fontSize: 11, color: "rgba(255,255,255,0.5)" }}>
            Chat unavailable in this browser. Try opening foid.fun directly.
          </p>
        </div>
      </div>
    );
    return this.props.children;
  }
}

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

  // Pan/zoom — extracted to a headless hook
  const {
    scale,
    pan,
    spaceDown,
    isPanning,
    onContainerPointerDown,
    onCanvasWheel,
    zoomToRect,
    screenToWorld,
    bindStage,
    subscribeViewport,
  } = usePanZoom(containerRef);

  // Bind the stage DOM node so transform writes bypass React during gestures
  // (Phase 2 · Step 5).
  const stageCallbackRef = useCallback(
    (el: HTMLDivElement | null) => {
      (stageRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
      bindStage(el);
    },
    [bindStage]
  );

  // Viewport-virtualization state (Phase 2 · Step 7). Only commits when the
  // visible AABB has drifted far enough that the culled set could have changed.
  const [visibleRect, setVisibleRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const lastVisibleRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null);
  useEffect(() => {
    const unsubscribe = subscribeViewport((v) => {
      // Guard: the first fire can land before the container has been
      // measured. A 0-area viewport would make visiblePlaced's AABB filter
      // reject every placement — don't commit until we have real dims.
      if (v.w <= 0 || v.h <= 0) return;
      const last = lastVisibleRef.current;
      const sigX = v.w * 0.25;
      const sigY = v.h * 0.25;
      if (
        !last ||
        Math.abs(v.x - last.x) > sigX ||
        Math.abs(v.y - last.y) > sigY ||
        Math.abs(v.w - last.w) > sigX ||
        Math.abs(v.h - last.h) > sigY
      ) {
        lastVisibleRef.current = v;
        setVisibleRect(v);
      }
    });
    return unsubscribe;
  }, [subscribeViewport]);

  // Page-level browser zoom lock (pinch/Ctrl+wheel/double-tap) — its own hook
  useViewportZoomLock();

  // Status messages
  const [statusMessages, setStatusMessages] = useState<StatusMessage[]>([
    { id: "init", text: "welcome to the mifoid loreboard!", type: "system", timestamp: new Date() }
  ]);
  // Screen-reader-only announcement mirror. TerminalChat is visual-only
  // (scrollable list), so assistive tech needs its own live region with a
  // single latest message. We clear+set on a microtask so repeated identical
  // announcements still get re-spoken by the AT — otherwise SR users miss
  // back-to-back duplicate toasts like "Uploading foo.png" → "Uploading foo.png".
  const [srAnnouncement, setSrAnnouncement] = useState("");
  const srClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const announceSr = useCallback((text: string) => {
    if (srClearTimerRef.current) clearTimeout(srClearTimerRef.current);
    setSrAnnouncement("");
    // Next paint — giving the DOM a tick to commit the empty state means
    // ARIA live regions always fire, even when the text is unchanged.
    srClearTimerRef.current = setTimeout(() => setSrAnnouncement(text), 16);
  }, []);
  const addStatus = useCallback((text: string, type: StatusMessage["type"] = "info") => {
    setStatusMessages(prev => [...prev, { id: `${Date.now()}-${Math.random()}`, text, type, timestamp: new Date() }]);
    // Mirror everything except debug "info" into the SR live region. Keep
    // the AT chatty during submit so blind users know what's happening.
    if (type !== "info" || text.match(/Uploading|Submitting|cancelled|on-chain|failed/i)) {
      announceSr(text);
    }
  }, [announceSr]);
  const handleChatSend = useCallback(async (_text: string) => {
    // TerminalChat handles insertBoardMessage + optimistic display directly.
    // Nothing extra needed here.
  }, []);

  // Governance - flagging placements
  const { flagPlacement, flagFeeWei, flagThreshold } = useSwipeLoreboardGovernance();
  const [flaggedIds, setFlaggedIds] = useState<Set<string>>(new Set());
  // Track flag counts per placement (keyed by placement id string)
  const [flagCounts, setFlagCounts] = useState<Record<string, number>>({});
  const flagFeeEth = (Number(flagFeeWei) / 1e18).toFixed(3);

  const handleFlagPlacement = useCallback(async (placementId: string) => {
    if (!address || !isConnected) {
      openConnectModal?.();
      return;
    }
    try {
      const numericId = Number(BigInt(placementId));
      await flagPlacement(numericId);
      setFlaggedIds(prev => new Set(prev).add(placementId));
      // Optimistically increment local flag count
      setFlagCounts(prev => ({ ...prev, [placementId]: (prev[placementId] ?? 0) + 1 }));
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
  const searchParams = useSearchParams();
  const debugMode = searchParams?.get("debug") === "1";
  const celebrateParam = searchParams?.get("celebrate") ?? null;

  // Mobile detection
  const { isMobile } = useMobile();

  // Unified board data — polling with AbortController, one source of truth
  const {
    proposals,
    voting: swipeVotingProposals,
    debug: proposalDebug,
    refetch: refetchBoardData,
  } = useBoardData();

  // Derive "placed" items from canonized proposals
  const placed = useMemo(
    () => proposals.filter((p) => p.status === "canonized"),
    [proposals]
  );

  // Viewport virtualization — Phase β upgrade.
  // The previous implementation ran `placed.filter()` every viewport update,
  // O(n) in placement count. On mainnet (5k+ placements) that linear scan
  // dominated every pan tick. `useVisiblePlacements` builds a grid-bucketed
  // spatial index once per dataset and serves queries in O(k) where k is
  // the bucket count intersecting the viewport (typically 4–16).
  //
  // Both `p.rect` and `visibleRect` are world-space; the 200px viewport
  // buffer inside the hook covers the ~stage-padding drift the old
  // toStageRect-based filter absorbed implicitly.
  const visiblePlacedRaw = useVisiblePlacements(placed, visibleRect);
  const visiblePlaced = useMemo(() => {
    // Tab-order stability: sort by (y, x) so keyboard users tab through
    // placements in spatial reading order — WCAG 1.3.2 (Meaningful Sequence).
    return [...visiblePlacedRaw].sort((a, b) => {
      if (a.rect.y !== b.rect.y) return a.rect.y - b.rect.y;
      return a.rect.x - b.rect.x;
    });
  }, [visiblePlacedRaw]);

  const votingSource = useMemo(
    () => proposals.filter((p) => p.status === "voting" && p.isVotable),
    [proposals],
  );
  const visibleVotingProposals = useVisiblePlacements(votingSource, visibleRect);

  // On-chain swipe voting proposals carry x/y/w/h flat (not `.rect`), so we
  // pass a rect accessor. Virtualizing these matters most on mainnet where
  // many proposals may be in-flight at once.
  const visibleSwipeVoting = useVisiblePlacements(
    swipeVotingProposals,
    visibleRect,
    undefined,
    (p) => ({ x: p.x, y: p.y, w: p.w, h: p.h }),
  );

  const [activePlacement, setActivePlacement] = useState<Placement | null>(null);
  const [selectedProposalId, setSelectedProposalId] = useState<string | null>(null);
  const autoZoomedEpochRef = useRef<number | null>(null);

  const storedRectFor = useCallback((p: PendingItem) => p.rect, []);

  const onPickClick = useCallback(() => fileInputRef.current?.click(), []);

  // Blob URL revocation is owned by the store: `removePending` revokes on
  // removal, `clearAll` revokes the whole batch. useProposalSubmit hands the
  // celebration a pre-stabilized data URL, so a revoke during cleanup can
  // never leave the hero image broken. See audit notes P0-1 and P1-7.

  // getImageSize — imported from @/lib/board

  // Ghost: rects all live in the same occupied/pending lists used by submit,
  // so validation is consistent across ghost preview and pre-flight check.
  const occupiedRects = useMemo<Rect[]>(
    () => [
      ...placed.map((pl) => pl.rect),
      ...swipeVotingProposals.map((p) => ({ x: p.x, y: p.y, w: p.w, h: p.h })),
    ],
    [placed, swipeVotingProposals]
  );
  const pendingRectsForGhost = useMemo<Rect[]>(
    () => pending.map(storedRectFor),
    [pending, storedRectFor]
  );
  const {
    ghost,
    setGhost,
    primeGhostMetaFromEvent,
    debouncedRefreshGhost,
    clearGhostMeta,
  } = useGhost({
    occupiedRects,
    pendingRects: pendingRectsForGhost,
    submissionFeeWei: SUBMISSION_FEE_WEI,
  });

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
    if (e.currentTarget === e.target) {
      setDragOver(false);
      setGhost(null);
      clearGhostMeta();
    }
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
    } finally {
      setBusy(false);
      setGhost(null);
      clearGhostMeta();
    }
  }, [addStatus, setGhost, clearGhostMeta]);

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
    let rafId = 0;
    const onMove = (ev: PointerEvent) => {
      if (!startRectRef.current) return;
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        if (!startRectRef.current) return;
        const dx = (ev.clientX - startPtRef.current.x) / scale, dy = (ev.clientY - startPtRef.current.y) / scale;
        const next = clampToCanvas({ x: snap(startRectRef.current.x + dx), y: snap(startRectRef.current.y + dy), w: startRectRef.current.w, h: startRectRef.current.h });
        setLiveRect(next); liveRectRef.current = next;
      });
    };
    const onUp = () => {
      cancelAnimationFrame(rafId);
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
    let rafId = 0;
    const onMove = (ev: PointerEvent) => {
      if (!startRectRef.current) return;
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        if (!startRectRef.current) return;
        const dx = (ev.clientX - startPtRef.current.x) / scale, dy = (ev.clientY - startPtRef.current.y) / scale;
        let w = startRectRef.current.w + dx, h = ev.altKey ? startRectRef.current.h + dy : w / aspectRef.current;
        w = snapDown(w); h = snapDown(h);
        const next = clampToCanvas(capRectToMaxCells({ x: startRectRef.current.x, y: startRectRef.current.y, w, h }, MAX_CELLS_PER_RECT));
        setLiveRect(next); liveRectRef.current = next;
      });
    };
    const onUp = () => {
      cancelAnimationFrame(rafId);
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
    // Flat submission fee + any per-cell tip the user attached. Tips default to 0.
    const tipTotal = BigInt(cellsNow) * p.tipPerCellWei;
    return { ...p, rect: r, cells: cellsNow, totalWei: SUBMISSION_FEE_WEI + tipTotal };
  });

  // Proposals + voting: unified via `useBoardData()` above.

  // Share-to-celebration deep link: `/board?celebrate=<proposalId>` re-fires
  // the celebration so visitors clicking a share link see the same animation
  // the original proposer saw. Fires exactly once — we clear the query param
  // after to prevent re-fires on back/forward nav.
  const celebrationFiredRef = useRef(false);
  useEffect(() => {
    // B4: proposals refetches every ~12s, which re-runs this effect. Once
    // we've fired the celebration, there's nothing left to do — skip the
    // .find() scans entirely so we don't hot-loop over the full proposal
    // list every poll tick.
    if (celebrationFiredRef.current) return;
    if (!celebrateParam) return;
    // Match against all proposals (both voting + canonized use the same id namespace).
    const match =
      proposals.find((p) => String(p.id) === celebrateParam) ??
      proposals.find((p) => String(p.epochSubmitted ?? "") === celebrateParam);
    // Also look in the active-voting list (contract-side numeric ids).
    const votingMatch = swipeVotingProposals.find((p) => String(p.id) === celebrateParam);

    if (match) {
      celebrationFiredRef.current = true;
      celebratePlacement({
        itemName: match.name,
        txHash: "",
        proposalId: Number(celebrateParam),
        previewUrl: cidToHttpUrl(match.cid),
        ipfsCid: match.cid,
      });
    } else if (votingMatch) {
      celebrationFiredRef.current = true;
      celebratePlacement({
        itemName: `Proposal #${votingMatch.id}`,
        txHash: "",
        proposalId: votingMatch.id,
        previewUrl: cidToHttpUrl(votingMatch.cid),
        ipfsCid: votingMatch.cid,
      });
    }
    // If no match yet (data still loading), this effect will re-run when
    // `proposals` or `swipeVotingProposals` updates on the next tick.
  }, [celebrateParam, proposals, swipeVotingProposals]);

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

  // User placement count: feeds milestone detection in the celebration
  // ("FIRST ENGRAVING" / "100 ENGRAVED" etc.). The hook is cheap and
  // already used elsewhere in the app.
  //
  // B2 hotfix — this ref is initialized at mount from `userPlacements.length`
  // and then ONLY incremented locally inside `onItemConfirmed`. We
  // intentionally do NOT sync it from `userPlacements.length` on every
  // change: `useUserPlacements` polls the subgraph, and a stale response
  // can return a lower count mid-batch, which would regress the ref and
  // misfire milestone headlines for items 2+ in the batch.
  const { placements: userPlacements } = useUserPlacements(address);
  const userPlacementCountAtSubmitStart = useRef(userPlacements.length);

  // Submit pipeline — FSM in useProposalSubmit. Each item transitions through
  // validating → uploading → signing → confirmed (or rejected/failed/queued).
  // We route status into TWO channels:
  //   - Toasts (contextual, auto-dismissing) — owned by lib/board/toasts.ts
  //   - Sidebar log (debug trail, persists) — the existing addStatus channel
  const {
    submitting: submittingProposals,
    submit: runSubmit,
    statuses: submitStatuses,
    cancelItem,
  } =
    useProposalSubmit({
      address,
      propose: proposeLoreboard,
      items,
      occupiedRects,
      onItemProgress: (s) => {
        // Keep the sidebar log in sync for debugging / history.
        if (s.state === "uploading") addStatus(`Uploading ${s.name}...`, "info");
        else if (s.state === "signing") addStatus(`Submitting ${s.name}...`, "info");
        else if (s.state === "confirmed") {
          addStatus(
            `${s.name} on-chain ✓${s.txHash ? ` (tx: ${s.txHash.slice(0, 10)}...)` : ""}`,
            "success"
          );
          if (s.cid) setCidFor(s.id, s.cid);
        } else if (s.state === "rejected") {
          addStatus("Transaction cancelled", "info");
        } else if (s.state === "queued") {
          addStatus(`${s.name} kept in tray for retry`, "info");
        } else if (s.state === "failed") {
          addStatus(s.detail ?? `${s.name} failed`, "error");
        }

        // Contextual toasts — keyed by item id so later states REPLACE prior ones.
        if (s.state === "uploading") toastUploading(s.id, s.name);
        else if (s.state === "signing") toastSigning(s.id, s.name);
        else if (s.state === "confirmed") toastConfirmed(s.id, s.name, s.txHash);
        else if (s.state === "failed") toastFailed(s.id, s.name, s.detail);
        else if (s.state === "rejected") toastInfo(s.id, "Transaction cancelled");
        else if (s.state === "queued") toastInfo(s.id, `${s.name} kept for retry`);
      },
      onItemConfirmed: (status, item) => {
        if (!status.txHash) return;
        // Milestone detection runs against the count *before* this item
        // landed — that way item #100 says "100 ENGRAVED", not #101.
        const prevCount = userPlacementCountAtSubmitStart.current;
        const personalization = pickPersonalization(status.proposalId ?? null, prevCount);
        userPlacementCountAtSubmitStart.current = prevCount + 1;

        celebratePlacement({
          itemName: item.name,
          txHash: status.txHash,
          proposalId: status.proposalId ?? null,
          previewUrl: status.stablePreviewUrl || item.previewUrl,
          ipfsCid: status.cid,
          personalization,
        });
      },
      onBatchDone: ({ confirmed, failed, rejected }) => {
        if (confirmed.length && !failed.length && !rejected.length) {
          addStatus("All proposals submitted!", "success");
          toastBatch(
            confirmed.length === 1
              ? "Placement engraved ✓"
              : `${confirmed.length} placements engraved ✓`,
            "success"
          );
          clearBoardState?.();
        } else if (confirmed.length) {
          const msg = `${confirmed.length} placed · ${failed.length} failed · ${rejected.length} cancelled`;
          addStatus(msg, failed.length ? "error" : "info");
          toastBatch(msg, failed.length ? "error" : "info");
          for (const c of confirmed) {
            dismissItemToast(c.id);
            removePending(c.id);
          }
        } else {
          addStatus("No placements submitted.", "info");
        }
        void refetchBoardData();
      },
    });

  // Review modal gate: clicking SUBMIT PROPOSAL opens the dry-run preview,
  // and only the modal's "SIGN & ENGRAVE" actually kicks off the submit FSM.
  const [showReviewModal, setShowReviewModal] = useState(false);

  // `openSubmitReview` is the entry point from the sidebar button.
  const openSubmitReview = useCallback(() => {
    if (submittingProposals || !items.length) return;
    setShowReviewModal(true);
  }, [items.length, submittingProposals]);

  // `runSubmitFromReview` is what the modal's primary CTA calls.
  const runSubmitFromReview = useCallback(async () => {
    setShowReviewModal(false);
    try {
      addStatus("Preparing submissions...", "info");
      await runSubmit();
    } catch (e: unknown) {
      if (isUserRejection(e)) {
        addStatus("Transaction cancelled", "info");
      } else {
        addStatus(parseWeb3Error(e).message, "error");
      }
    }
  }, [addStatus, runSubmit]);

  // Stable cancel callback so the modal's keydown effect doesn't re-bind
  // on every parent render. (Audit note P1-8.)
  const closeReviewModal = useCallback(() => setShowReviewModal(false), []);

  // Global keyboard shortcut: "P" opens the file picker (same effect as
  // clicking PROPOSE IMAGE). Ignored when an input/textarea/contentEditable
  // has focus so users typing in chat don't accidentally open a dialog.
  // WCAG 2.1.1 (Keyboard) — provides a keyboard-only path to the proposal
  // flow that doesn't require drag-and-drop.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "p" && e.key !== "P") return;
      if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
      const t = e.target as HTMLElement | null;
      if (!t) return;
      const tag = t.tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        t.isContentEditable
      ) {
        return;
      }
      if (busy || submittingProposals || showReviewModal || desktopPaintFile) return;
      e.preventDefault();
      fileInputRef.current?.click();
      announceSr("File picker opened. Choose an image to propose.");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, submittingProposals, showReviewModal, desktopPaintFile, announceSr]);

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
      {/* Propose button — floating top-left, fixed so it stays during zoom/pan */}
      <button
        onClick={() => setShowMobilePropose(true)}
        className="fixed top-3 left-3 z-50 px-4 py-2 text-xs font-bold tracking-widest uppercase rounded-xl shadow-lg touch-manipulation"
        style={{
          background: "linear-gradient(135deg, var(--foid-magenta), var(--foid-pink-soft))",
          color: "var(--foid-text)",
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
          placedRects={[...placed.map(p => ({ ...p.rect, cid: p.cid })), ...swipeVotingProposals.map(p => ({ x: p.x, y: p.y, w: p.w, h: p.h, cid: p.cid }))]}
          onClose={() => setShowMobilePropose(false)}
          onSuccess={(msg) => {
            addStatus(msg, "success");
            setShowMobilePropose(false);
            void refetchBoardData();
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
              onDisconnect={() => disconnect()}
              onSwitchWallet={handleSwitchWallet}
            />

            {/* Main content - align with pray spacing */}
            <div className="vista-window__body vista-window__body--flush mt-2 pray-panel__body board-body">
              <div className="board-grid">
                {/* Canvas */}
                <div className="board-canvas-wrap flex-1 min-h-0">
                  {/* Visually-hidden live region for screen reader narration.
                      Populated by addStatus() via the submit pipeline and by
                      ad-hoc announcements (e.g. "Proposal #42 moved to voting").
                      WCAG 4.1.3 (Status Messages) — messages must reach AT
                      without stealing focus; aria-live="polite" is the right
                      tool for non-urgent state. */}
                  <div
                    id="board-sr-status"
                    role="status"
                    aria-live="polite"
                    aria-atomic="true"
                    style={{
                      position: "absolute",
                      width: 1,
                      height: 1,
                      padding: 0,
                      margin: -1,
                      overflow: "hidden",
                      clip: "rect(0 0 0 0)",
                      whiteSpace: "nowrap",
                      border: 0,
                    }}
                  >
                    {srAnnouncement}
                  </div>
                  <div
                    ref={containerRef}
                    role="application"
                    aria-label={`Loreboard canvas, ${placed.length} placement${placed.length === 1 ? "" : "s"}. Press P to propose, arrow keys to pan, +/- to zoom, 0 to reset.`}
                    tabIndex={0}
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
                    ref={stageCallbackRef}
                    className="board-stage"
                    style={{
                      // transform / transformOrigin are written directly to
                      // this element by usePanZoom via rAF — see Step 5. We
                      // intentionally leave them out of the inline style so
                      // React renders don't fight the ref-based writes.
                      backgroundImage: gridBg,
                      backgroundSize: gridSizes,
                      width: STAGE_CANVAS_W,
                      height: STAGE_CANVAS_H,
                    }}
                    >
                      {/* Finalized (canonized proposals) — virtualized */}
                    {visiblePlaced.map((p) => {
                      const sr = toStageRect(p.rect);
                      const isActive = activePlacement?.id === p.id;
                      return (
                        <PlacementCard
                          key={p.id}
                          placement={{ id: p.id, cid: p.cid, x: sr.x, y: sr.y, width: sr.w, height: sr.h, proposer: (p.owner ?? "") as `0x${string}`, epochId: p.epochSubmitted ?? 0, status: "canonized" }}
                          onOpen={setActivePlacement}
                          onFlag={handleFlagPlacement}
                          isFlagged={flaggedIds.has(p.id)}
                          flagCount={flagCounts[p.id] ?? 0}
                          flagThreshold={flagThreshold}
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
                    {ghost && <PlacementGhost ghost={ghost} />}

                    {/* Proposals — virtualized */}
                    {visibleVotingProposals.map((p) => {
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

                    {/* Swipe voting proposals — ghost placement with neon glow.
                         Virtualized: only renders items whose AABB intersects
                         the current viewport (+200px buffer). */}
                    {visibleSwipeVoting.map((p) => (
                      <VotingGhost
                        key={`swipe-${p.id}`}
                        id={p.id}
                        cid={p.cid}
                        x={p.x}
                        y={p.y}
                        w={p.w}
                        h={p.h}
                        forCount={p.forCount}
                        againstCount={p.againstCount}
                      />
                    ))}

                    {/* Pending */}
                    {items.map((p) => (
                      <PendingItemCard
                        key={p.id}
                        id={p.id}
                        name={p.name}
                        rect={renderRectFor(p)}
                        previewUrl={p.previewUrl}
                        cells={p.cells}
                        totalWei={p.totalWei}
                        submitState={submitStatuses[p.id]?.state}
                        onBeginMove={beginMove(p)}
                        onBeginResize={beginResize(p)}
                        onRemove={() => {
                          // B1: cancel BEFORE removing from the store. The
                          // submit loop uses id-based lookups against its
                          // captured items array, so flipping the cancelled
                          // flag first guarantees the next pre-upload /
                          // pre-propose check sees the removal — even if
                          // the user clicks × while a request is in flight.
                          cancelItem(p.id);
                          dismissItemToast(p.id);
                          removePending(p.id);
                        }}
                      />
                    ))}
                    </div>
                    <BoardHUD scale={scale} pan={pan} mode={spaceDown ? "PAN" : "PLACE"} />
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
                  <BoardActions
                    submissionFeeWei={SUBMISSION_FEE_WEI}
                    onPickImage={onPickClick}
                    onSubmit={openSubmitReview}
                    hasPending={items.length > 0}
                    hasPlaced={placed.length > 0}
                    submitting={submittingProposals}
                    proposeDisabledReason={
                      items.length > 0
                        ? "Submit or remove pending item first"
                        : null
                    }
                    fileInputRef={fileInputRef}
                    onFileChange={onFileChange}
                  />

                  {/* Removal vote cards — only shown when active votes exist */}
                  <RemovalVotePanel placementIds={placed.map((p) => p.id)} />

                  {/* Chat — wrapped in its own boundary so a WebSocket failure
                       (common in mobile in-app browsers) can't crash the whole board */}
                  <ChatErrorBoundary>
                    <div className="board-section--chat-wrapper">
                      <div className="board-section board-section--chat">
                        <div className="board-section__header">
                          <StatusDot status={isConnected ? "online" : "offline"} />
                          <span className="board-section__title">CHAT</span>
                          <span
                            className="board-section__status ml-auto"
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
                  </ChatErrorBoundary>

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
    {showReviewModal && (
      <BatchReviewModal
        items={items.map((it) => ({
          id: it.id,
          name: it.name,
          previewUrl: it.previewUrl,
          rect: it.rect,
        }))}
        address={address}
        submissionFeeWei={SUBMISSION_FEE_WEI}
        votingWindowSeconds={72 * 60 * 60}
        approvalThresholdBps={5100}
        onConfirm={runSubmitFromReview}
        onCancel={closeReviewModal}
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
