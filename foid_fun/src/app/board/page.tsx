// /src/app/board/page.tsx
"use client";

import React, {
  useCallback,
  useMemo,
  useRef,
  useState,
  useEffect,
} from "react";
import dynamic from "next/dynamic";
import { useBoard } from "@/state/board";
import type { PendingItem } from "@/state/board";
import { TILE, snapRect, rectCells, hasOverlap, type Rect } from "@/lib/grid";
import { sniffImageType, mimeFromType } from "@/lib/image";
import { uploadImage, ipfsUrl } from "@/lib/ipfs";
import { formatEth } from "@/lib/wei";
import { useEpochCountdown } from "@/hooks/useEpochCountdown";
import sfx from "@/lib/sfx";
import { keccak256, stringToHex } from "viem";
import type { FinalizedPlacement } from "@/lib/types";
import {
  finalizeEpoch,
  getManifest,
  proposePlacement,
  listProposals,
  castVote,
} from "@/lib/api";
import type { ProposalSummary } from "@/lib/api";
import { loadLatestFinalized } from "@/lib/manifest";
import { writeProposePlacement } from "@/lib/viem";

const MusicPanel = dynamic(() => import("@/components/MusicPanel"), {
  ssr: false,
});
const ChatDock = dynamic(() => import("@/components/ChatDock"), {
  ssr: false,
});

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BASE_FEE_PER_CELL_WEI =
  BigInt(process.env.NEXT_PUBLIC_BASE_FEE_PER_CELL_WEI ?? "0");

const MAX_CELLS_PER_RECT: number = Number(
  process.env.NEXT_PUBLIC_MAX_CELLS_PER_RECT ??
    process.env.MAX_CELLS_PER_RECT ??
    "400"
);

const OWNER_DEMO =
  "0xDEADBEEFDEADBEEFDEADBEEFDEADBEEFDEADBEEF"; // TODO: replace with connected wallet

const VIRTUAL_CANVAS_W = 1_000_000;
const VIRTUAL_CANVAS_H = 1_000_000;

// ---------------------------------------------------------------------------
// Types for local drag/ghost
// ---------------------------------------------------------------------------

type DropPos = { x: number; y: number };
type DragMeta = {
  w: number;
  h: number;
  mime: "image/png" | "image/jpeg" | null;
};
type GhostStatus = "ok" | "overlap" | "oversize" | "invalid";
type Ghost = {
  rect: Rect;
  cells: number;
  status: GhostStatus;
  totalWei: bigint;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const snapDown = (v: number) => Math.max(TILE, Math.floor(v / TILE) * TILE);

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

/**
 * Optional helper: downscale a too-large image so it fits within MAX_CELLS_PER_RECT
 * (keeps you moving even without a crop UI yet).
 */
async function downscaleToMaxCells(
  file: File,
  maxCells: number,
  tileSize = TILE,
  outputMime: "image/jpeg" | "image/png" = "image/jpeg",
  quality = 0.9
): Promise<File> {
  const url = URL.createObjectURL(file);
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = url;
  });

  try {
    const w0 = img.naturalWidth;
    const h0 = img.naturalHeight;
    const maxPx = maxCells * tileSize * tileSize;
    const area0 = w0 * h0;

    if (area0 <= maxPx) return file;

    const scale = Math.sqrt(maxPx / area0);
    const w1 = Math.max(tileSize, Math.floor(w0 * scale));
    const h1 = Math.max(tileSize, Math.floor(h0 * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w1;
    canvas.height = h1;
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, w1, h1);

    const blob: Blob = await new Promise((resolve) =>
      canvas.toBlob(
        (b) => resolve(b || new Blob()),
        outputMime,
        outputMime === "image/jpeg" ? quality : undefined
      )
    );

    const nameBase = file.name.replace(/\.(png|jpg|jpeg)$/i, "");
    const ext = outputMime === "image/jpeg" ? "jpg" : "png";
    return new File([blob], `${nameBase}.resized.${ext}`, { type: outputMime });
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function getPendingBytes(p: PendingItem): Promise<ArrayBuffer> {
  const res = await fetch(p.previewUrl);
  if (!res.ok) throw new Error("Failed to read pending asset");
  return res.arrayBuffer();
}

async function lockPendingAndPropose(p: PendingItem) {
  // 1) ensure CID (upload only when locking)
  let cid = p.cid;
  if (!cid) {
    try {
      const blob = await fetch(p.previewUrl).then((r) => r.blob());
      // Re-wrap into a File to keep the name/type
      const file = new File([blob], p.name, { type: p.mime });
      const uploaded = await uploadImage(
        p.name,
        file,
        p.mime as "image/png" | "image/jpeg"
      );
      if (!uploaded) {
        throw new Error("IPFS upload disabled.");
      }
      cid = uploaded;
    } catch (e: any) {
      throw new Error(String(e?.message ?? "IPFS upload failed"));
    }
  }
  if (!cid) throw new Error("CID unavailable");

  // 2) compute bid (base + tip)
  const bidPerCellWei = (BASE_FEE_PER_CELL_WEI + p.tipPerCellWei).toString();

  // 3) call /api/propose
  await proposePlacement({
    id: p.id,
    owner: OWNER_DEMO, // replace with connected wallet if available
    cid,
    name: p.name,
    mime: p.mime as "image/png" | "image/jpeg",
    rect: p.rect,
    width: p.width,
    height: p.height,
    bidPerCellWei,
  });

  return cid;
}

// ---------------------------------------------------------------------------

export default function BoardPage() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const pending = useBoard((s) => s.pending);
  const addPending = useBoard((s) => s.addPending);
  const removePending = useBoard((s) => s.removePending);
  const setTipFor = useBoard((s) => s.setTipFor);
  const setRect = useBoard((s) => s.setRect);
  const setFitMode = useBoard((s) => s.setFitMode);
  const clearBoardState = useBoard((s) => s.clearAll);
  const setCidFor = useBoard((s) => s.setCidFor);

  // pan/zoom
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [draggingBoard, setDraggingBoard] = useState(false);
  const boardDragStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  // space-to-pan
  const [spaceDown, setSpaceDown] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0 });
  const panOriginRef = useRef({ x: 0, y: 0 });

  const [dragOver, setDragOver] = useState(false);
  const [message, setMessage] = useState<string>(
    "Drop a PNG/JPG on the board or click to upload."
  );
  const [busy, setBusy] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [devCid, setDevCid] = useState("");
  const [devW, setDevW] = useState(200);
  const [devH, setDevH] = useState(200);
  const [devX, setDevX] = useState(0);
const [devY, setDevY] = useState(0);
  const zoomToRect = useCallback(
    (r: Rect, padding = 32) => {
      const el = containerRef.current;
      if (!el) return;
      const viewW = el.clientWidth || 1;
      const viewH = el.clientHeight || 1;
      const targetW = r.w + padding * 2;
      const targetH = r.h + padding * 2;
      const s = Math.max(0.25, Math.min(4, Math.min(viewW / targetW, viewH / targetH)));
      const x = (viewW - r.w * s) / 2 - r.x * s;
      const y = (viewH - r.h * s) / 2 - r.y * s;
      setScale(s);
      setPan({ x, y });
    },
    []
  );

  // ---- Epoch (hydration-safe) ----
  const { enabled, index: epochIdx, remainingMs } = useEpochCountdown();
  const fmtCountdown = useMemo(() => {
    if (!enabled) return "—";
    const s = Math.floor(remainingMs / 1000);
    const hh = String(Math.floor(s / 3600)).padStart(2, "0");
    const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
    const ss = String(s % 60).padStart(2, "0");
    return `T-${hh}:${mm}:${ss}`;
  }, [enabled, remainingMs]);
  const epochLabel = enabled ? " #" + epochIdx : "";

  // ---- Ghost for DnD ----
  const ghostMetaRef = useRef<DragMeta | null>(null);
  const [ghost, setGhost] = useState<Ghost | null>(null);

  const storedRectFor = useCallback((p: PendingItem) => p.rect, []);

  const screenToWorld = useCallback(
    (clientX: number, clientY: number): DropPos => {
      const el = containerRef.current;
      if (!el) return { x: 0, y: 0 };
      const r = el.getBoundingClientRect();
      const x = (clientX - r.left - pan.x) / scale;
      const y = (clientY - r.top - pan.y) / scale;
      return { x: Math.max(0, x), y: Math.max(0, y) };
    },
    [pan, scale]
  );

  const onPickClick = useCallback(() => fileInputRef.current?.click(), []);

  const getDropPos = useCallback(
    (clientX: number, clientY: number) => screenToWorld(clientX, clientY),
    [screenToWorld]
  );

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        setSpaceDown(true);
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        setSpaceDown(false);
      }
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  const onContainerPointerDown: React.PointerEventHandler<HTMLDivElement> = (e) => {
    const interactive = (e.target as HTMLElement).closest(
      "figure,button,input,textarea,select,label"
    );
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
    boardDragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      panX: pan.x,
      panY: pan.y,
    };
    setDraggingBoard(true);
    (e.currentTarget as Element).setPointerCapture?.((e as any).pointerId);
  };

  useEffect(() => {
    if (!isPanning) return;
    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - panStartRef.current.x;
      const dy = ev.clientY - panStartRef.current.y;
      setPan({
        x: panOriginRef.current.x + dx,
        y: panOriginRef.current.y + dy,
      });
    };
    const onUp = () => setIsPanning(false);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp, { once: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [isPanning]);

  useEffect(() => {
    if (!spaceDown) setIsPanning(false);
  }, [spaceDown]);

  useEffect(() => {
    if (!draggingBoard) return;
    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - boardDragStartRef.current.x;
      const dy = ev.clientY - boardDragStartRef.current.y;
      setPan({
        x: boardDragStartRef.current.panX + dx,
        y: boardDragStartRef.current.panY + dy,
      });
    };
    const onUp = () => setDraggingBoard(false);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp, { once: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [draggingBoard]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (r.width - VIRTUAL_CANVAS_W) / 2;
    const y = (r.height - VIRTUAL_CANVAS_H) / 2;
    setPan({ x, y });
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const wheelHandler = (e: WheelEvent) => {
      if (e.shiftKey) return;
      e.preventDefault();
      const factor = Math.exp(-e.deltaY * 0.001);
      const nextScale = Math.min(4, Math.max(0.25, scale * factor));
      const r = el.getBoundingClientRect();
      const cx = e.clientX - r.left;
      const cy = e.clientY - r.top;
      const wx = (cx - pan.x) / scale;
      const wy = (cy - pan.y) / scale;
      setScale(nextScale);
      setPan({ x: cx - wx * nextScale, y: cy - wy * nextScale });
    };

    el.addEventListener("wheel", wheelHandler, { passive: false });
    return () => el.removeEventListener("wheel", wheelHandler as any);
  }, [scale, pan]);
  async function getImageSize(file: File): Promise<{ w: number; h: number }> {
    try {
      // @ts-ignore
      const bmp = await (globalThis as any).createImageBitmap?.(file);
      if (bmp) {
        const w = bmp.width,
          h = bmp.height;
        bmp.close?.();
        return { w, h };
      }
    } catch {}
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.onerror = reject;
        i.src = url;
      });
      return { w: img.naturalWidth, h: img.naturalHeight };
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  const primeGhostMetaFromEvent = useCallback(async (e: React.DragEvent) => {
    if (ghostMetaRef.current) return ghostMetaRef.current;
    const items = e.dataTransfer?.items;
    if (!items || items.length === 0) return null;

    let file: File | null = null;
    for (const it of Array.from(items)) {
      if (it.kind === "file") {
        const f = it.getAsFile();
        if (f) {
          file = f;
          break;
        }
      }
    }
    if (!file) return null;

    const kind = await sniffImageType(file);
    const mime = kind ? mimeFromType(kind) : null;
    if (!mime) {
      ghostMetaRef.current = { w: TILE, h: TILE, mime: null };
      return ghostMetaRef.current;
    }
    const { w, h } = await getImageSize(file);
    ghostMetaRef.current = { w, h, mime };
    return ghostMetaRef.current;
  }, []);

  const refreshGhostAt = useCallback(
    (pos: DropPos) => {
      const meta = ghostMetaRef.current;
      if (!meta) {
        setGhost(null);
        return;
      }

      if (!meta.mime) {
        const rect = snapRect({ x: pos.x, y: pos.y, w: TILE, h: TILE });
        const cells = rectCells(rect);
        setGhost({ rect, cells, status: "invalid", totalWei: 0n });
        return;
      }

      const rect = snapRect({ x: pos.x, y: pos.y, w: meta.w, h: meta.h });
      const cells = rectCells(rect);

      let status: GhostStatus = "ok";
      if (cells > MAX_CELLS_PER_RECT) status = "oversize";
      else if (hasOverlap(rect, pending.map((p) => storedRectFor(p))))
        status = "overlap";

      const totalWei = BigInt(cells) * BASE_FEE_PER_CELL_WEI;
      setGhost({ rect, cells, status, totalWei });
    },
    [pending, storedRectFor]
  );

  // ---- DnD ----
  const onDragOver: React.DragEventHandler<HTMLDivElement> = async (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    await primeGhostMetaFromEvent(e);
    setDragOver(true);
    refreshGhostAt(getDropPos(e.clientX, e.clientY));
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
      ghostMetaRef.current = null;
    }
  };

const handleSingleFile = useCallback(
  async (file: File, pos?: DropPos) => {
    setMessage("");
    setBusy(true);
    try {
      let workingFile = file;
      let kind = await sniffImageType(workingFile);
      if (!kind) {
        setMessage("Only PNG or JPG allowed.");
        return;
      }
      let mime = mimeFromType(kind) as "image/png" | "image/jpeg";
      let { w, h } = await getImageSize(workingFile);

      let rect = snapRect({ x: pos?.x ?? 0, y: pos?.y ?? 0, w, h });
      let cells = rectCells(rect);

      if (cells > MAX_CELLS_PER_RECT) {
        const resized = await downscaleToMaxCells(
          workingFile,
          MAX_CELLS_PER_RECT,
          TILE,
          "image/jpeg",
          0.9
        );
        workingFile = resized;
        kind = await sniffImageType(resized);
        mime = kind ? (mimeFromType(kind) as "image/png" | "image/jpeg") : "image/jpeg";
        const size2 = await getImageSize(resized);
        w = size2.w;
        h = size2.h;
        rect = snapRect({ x: pos?.x ?? 0, y: pos?.y ?? 0, w, h });
        cells = rectCells(rect);
        if (cells > MAX_CELLS_PER_RECT) {
          setMessage(`Too large after resize: ${cells} cells > max ${MAX_CELLS_PER_RECT}.`);
          return;
        }
      }

      rect = capRectToMaxCells(rect, MAX_CELLS_PER_RECT);
      w = rect.w;
      h = rect.h;
      const cellsNow = rectCells(rect);
      if (cellsNow > MAX_CELLS_PER_RECT) {
        setMessage(
          `Too large after cap: ${cellsNow} cells > max ${MAX_CELLS_PER_RECT}.`
        );
        return;
      }

      const previewUrl = URL.createObjectURL(workingFile);

      // Create a pending item (no upload yet; user can move/resize)
      const created = addPending({
        name: workingFile.name,
        mime,
        width: w,
        height: h,
        rect,
        cells: cellsNow,
        tipPerCellWei: 0n,
        previewUrl,
        cid: undefined,
        fitMode: "contain",
      });

      setMessage('Set size/position, then click "Lock" on the piece to propose.');
    } finally {
      setBusy(false);
      setGhost(null);
      ghostMetaRef.current = null;
    }
  },
  []
);


  const onDrop: React.DragEventHandler<HTMLDivElement> = async (e) => {
    e.preventDefault();
    setDragOver(false);
    if (!e.dataTransfer?.files?.length) return;
    await handleSingleFile(
      e.dataTransfer.files[0],
      getDropPos(e.clientX, e.clientY)
    );
  };

  const onFileChange: React.ChangeEventHandler<HTMLInputElement> = async (
    e
  ) => {
    const input = e.currentTarget;
    const f = input.files?.[0];
    if (f) await handleSingleFile(f, { x: 0, y: 0 });
    input.value = "";
  };

  // ======== Finalized + proposals state ========
  const [placed, setPlaced] = useState<FinalizedPlacement[]>([]);
  const [placedEpoch, setPlacedEpoch] = useState<number | null>(null);
  const [viewEpoch, setViewEpoch] = useState<number | "latest">("latest");
  const [proposals, setProposals] = useState<ProposalSummary[]>([]);

  // ======== MOVE / RESIZE ========
  const [activeId, setActiveId] = useState<string | null>(null);
  const [liveRect, setLiveRect] = useState<Rect | null>(null);
  const liveRectRef = useRef<Rect | null>(null);
  const startRectRef = useRef<Rect | null>(null);
  const startPtRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const aspectRef = useRef<number>(1);

  const clampToCanvas = useCallback((r: Rect): Rect => {
    const w = Math.max(TILE, r.w);
    const h = Math.max(TILE, r.h);
    const x = Math.max(0, r.x);
    const y = Math.max(0, r.y);
    return { x, y, w, h };
  }, []);
  const snap = (v: number) => Math.round(v / TILE) * TILE;

  const beginMove = (p: PendingItem) => (e: React.PointerEvent) => {
    e.preventDefault();
    setActiveId(p.id);
    startRectRef.current = { ...storedRectFor(p) };
    startPtRef.current = { x: e.clientX, y: e.clientY };
    (e.currentTarget as Element).setPointerCapture?.((e as any).pointerId);

    const onMove = (ev: PointerEvent) => {
      if (!startRectRef.current) return;
      const dx = (ev.clientX - startPtRef.current.x) / scale;
      const dy = (ev.clientY - startPtRef.current.y) / scale;
      const next = clampToCanvas({
        x: snap(startRectRef.current.x + dx),
        y: snap(startRectRef.current.y + dy),
        w: startRectRef.current.w,
        h: startRectRef.current.h,
      });
      setLiveRect(next);
      setRect(p.id, next);
      liveRectRef.current = next;
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      const finalRect = liveRectRef.current ?? startRectRef.current!;
      setRect(p.id, finalRect);
      setLiveRect(null);
      liveRectRef.current = null;
      setActiveId(null);
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
      const dx = (ev.clientX - startPtRef.current.x) / scale;
      const dy = (ev.clientY - startPtRef.current.y) / scale;

      const keepAspect = !ev.altKey;
      let w = startRectRef.current.w + dx;
      let h = keepAspect ? w / aspectRef.current : startRectRef.current.h + dy;

      w = snapDown(w);
      h = snapDown(h);

      let next = capRectToMaxCells(
        { x: startRectRef.current.x, y: startRectRef.current.y, w, h },
        MAX_CELLS_PER_RECT
      );

      next = clampToCanvas(next);

      setLiveRect(next);
      setRect(p.id, next);
      liveRectRef.current = next;
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      const finalRect = liveRectRef.current ?? startRectRef.current!;
      setRect(p.id, finalRect);
      setLiveRect(null);
      liveRectRef.current = null;
      setActiveId(null);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp, { once: true });
  };

  // ---- Visuals ----
  const gridBg = useMemo(
    () =>
      `linear-gradient(to right, rgba(255,255,255,.12) 1px, transparent 1px),
       linear-gradient(to bottom, rgba(255,255,255,.12) 1px, transparent 1px)`,
    []
  );
  const gridSize = `${TILE}px ${TILE}px`;

  // Resolve the rect we should render for an item (live drag > override > original)
  const renderRectFor = useCallback(
    (p: PendingItem): Rect => {
      if (activeId === p.id && liveRect) return liveRect;
      return p.rect;
    },
    [activeId, liveRect]
  );

  // Derive "view" items reflecting move/resize overrides
  const items = pending.map((p) => {
    const r = renderRectFor(p);
    const cellsNow = rectCells(r);
    const totalNow =
      BigInt(cellsNow) * (BASE_FEE_PER_CELL_WEI + p.tipPerCellWei);
    return { ...p, rect: r, cells: cellsNow, totalWei: totalNow };
  });

  const totalWei = items.reduce((acc, p) => acc + p.totalWei, 0n);
  const canStepPrev = typeof placedEpoch === "number" && placedEpoch > 0;

  // ---- load manifest ----
  useEffect(() => {
    let alive = true;

    const load = async () => {
      try {
        if (viewEpoch === "latest") {
          const last = await loadLatestFinalized();
          if (!last) {
            if (alive) {
              setPlaced([]);
              setPlacedEpoch(null);
            }
            return;
          }
          const cidPath = last.manifestCID.replace(/^ipfs:\/\//, "");
          const url = `https://ipfs.io/ipfs/${cidPath}?_=${Date.now()}`;
          const res = await fetch(url, { cache: "no-store" });
          if (!res.ok) throw new Error("manifest fetch failed");
          const man = await res.json();
          if (!alive) return;
          const winnersRaw = man.winners ?? [];
          const withCid = await Promise.all(
            winnersRaw.map(async (w: any) => {
              if (!w.cid && w.id) {
                try {
                  const res = await fetch(`/api/cid-by-id?id=${encodeURIComponent(w.id)}`);
                  if (res.ok) {
                    const data = await res.json();
                    if (data.cid) w.cid = data.cid;
                  }
                } catch {
                  /* ignore */
                }
              }
              return w;
            })
          );
          const placements: FinalizedPlacement[] = withCid.map((w: any) => {
            const rect = w.rect ?? { x: w.x, y: w.y, w: w.w, h: w.h };
            const cells = w.cells ?? rectCells(rect);
            return {
              id: w.id ?? "",
              owner: w.owner ?? "",
              cid: w.cid ?? "",
              x: rect.x,
              y: rect.y,
              w: rect.w,
              h: rect.h,
              cells,
            };
          });
          setPlaced(placements);
          if (placements.length) {
            zoomToRect({
              x: placements[0].x,
              y: placements[0].y,
              w: placements[0].w,
              h: placements[0].h,
            });
          }
          setPlacedEpoch(last.epoch);
        } else {
          const man = await getManifest(viewEpoch);
          if (!alive) return;
          setPlaced(man.manifest?.placements ?? []);
          setPlacedEpoch(man.epoch);
        }
      } catch {
        if (!alive) return;
        setPlaced([]);
        setPlacedEpoch(null);
      }
    };

    load();

    return () => {
      alive = false;
    };
  }, [viewEpoch]);

  useEffect(() => {
    let alive = true;

    const tick = async () => {
      try {
        const { proposals } = await listProposals();
        if (alive) setProposals(proposals ?? []);
      } catch {
        if (alive) setProposals([]);
      }
    };

    tick();
    const t = setInterval(tick, 2000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        !activeId ||
        !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)
      ) {
        return;
      }
      const target = pending.find((x) => x.id === activeId);
      if (!target) return;
      const step = e.shiftKey ? TILE : Math.max(1, Math.floor(TILE / 4));
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

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="relative z-10 max-w-7xl mx-auto px-4 py-6 grid gap-6 grid-cols-1 md:grid-cols-[minmax(0,1fr)_340px]">
      {/* Canvas */}
      <div
        ref={containerRef}
        className="relative min-w-0 rounded-2xl border border-white/20 overflow-hidden select-none"
        onClick={() => sfx.unlock()}
        onPointerDown={onContainerPointerDown}
        onDragOver={onDragOver}
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        style={{
          cursor: spaceDown ? (isPanning ? "grabbing" : "grab") : "default",
          backgroundColor: "rgba(14,15,43,0.7)",
          minHeight: "70vh",
          paddingBottom: "2rem",
          touchAction: "none",
        }}
      >
        <div
          ref={stageRef}
          className="absolute inset-0"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
            transformOrigin: "0 0",
            backgroundImage: gridBg,
            backgroundSize: gridSize,
            width: VIRTUAL_CANVAS_W,
            height: VIRTUAL_CANVAS_H,
          }}
        >
          {/* finalized placements (bottom layer) */}
        {placed.map((p) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={p.id}
            src={ipfsUrl(p.cid)}
            alt={p.id}
            className="absolute rounded-md pointer-events-none"
            style={{
              left: p.x,
              top: p.y,
              width: p.w,
              height: p.h,
              zIndex: 0,
              outline: "2px solid rgba(72,255,171,.55)",
              background: "rgba(72,255,171,.04)",
              borderRadius: "6px",
            }}
            referrerPolicy="no-referrer"
            onError={(e) => {
              const el = e.currentTarget as HTMLImageElement;
              const tried = el.dataset.tried ?? "0";
              if (tried === "0") {
                el.src = `https://cloudflare-ipfs.com/ipfs/${p.cid}`;
                el.dataset.tried = "1";
              } else if (tried === "1") {
                el.src = `https://ipfs.io/ipfs/${p.cid}`;
                el.dataset.tried = "2";
              }
            }}
          />
        ))}

        {/* ghost preview */}
        {ghost ? (
          <div
            className="absolute rounded-md pointer-events-none"
            style={{
              left: ghost.rect.x,
              top: ghost.rect.y,
              width: ghost.rect.w,
              height: ghost.rect.h,
              outlineWidth: 2,
              outlineStyle: "dashed",
              outlineColor:
                ghost.status === "ok"
                  ? "rgba(72, 255, 171, 0.9)"
                  : ghost.status === "invalid"
                  ? "rgba(255, 71, 87, 0.9)"
                  : "rgba(255, 184, 0, 0.9)",
              background:
                ghost.status === "ok"
                  ? "rgba(72, 255, 171, 0.08)"
                  : ghost.status === "invalid"
                  ? "rgba(255, 71, 87, 0.08)"
                  : "rgba(255, 184, 0, 0.08)",
              zIndex: 3,
            }}
          >
            <div className="absolute left-1 top-1 text-[11px] px-2 py-1 rounded-md bg-black/60 text-white border border-white/20 flex items-center gap-2">
              <span>{ghost.cells} cells</span>
              <span>·</span>
              <span title={ghost.totalWei.toString() + " wei"}>
                {formatEth(ghost.totalWei)} ETH
              </span>
              {ghost.status !== "ok" && (
                <>
                  <span>·</span>
                  <span>
                    {ghost.status === "overlap"
                      ? "overlap"
                      : ghost.status === "oversize"
                      ? "too large"
                      : "invalid type"}
                  </span>
                </>
              )}
            </div>
          </div>
        ) : null}

        {/* proposals (top of accepted layer, dashed while voting) */}
        {proposals
          .filter((p) => p.status === "proposed")
          .map((p) => (
            <figure
              key={p.id}
              className="absolute pointer-events-none"
              style={{
                left: p.rect.x,
                top: p.rect.y,
                width: p.rect.w,
                height: p.rect.h,
                zIndex: 2,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={ipfsUrl(p.cid)}
                alt={p.name}
                referrerPolicy="no-referrer"
                className="w-full h-full rounded-md object-contain"
                draggable={false}
                style={{
                  outlineWidth: 2,
                  outlineStyle: "dashed",
                  outlineColor: "rgba(255,184,0,.9)",
                  background: "rgba(255,184,0,.06)",
                }}
              />

              <figcaption className="absolute left-1 top-1 text-[11px] px-2 py-1 rounded-md bg-black/60 text-white border border-white/20 flex items-center gap-2">
                <span>{p.cells} cells</span>
                <span>·</span>
                <span>bid {p.bidPerCellWei}/cell</span>
                <span>·</span>
                <span>{Math.round(p.percentYes * 100)}% yes</span>
                <span>·</span>
                <span>{p.voters} voters</span>
                <span>·</span>
                <span>{p.secondsLeft}s left</span>
              </figcaption>
            </figure>
          ))}

        {/* pending items (top layer) */}
        {items.map((p) => {
          const r = renderRectFor(p);
          const cellsNow = rectCells(r);
          const totalNow =
            BigInt(cellsNow) * (BASE_FEE_PER_CELL_WEI + p.tipPerCellWei);

          return (
            <figure
              key={p.id}
              className="absolute"
              style={{ left: r.x, top: r.y, width: r.w, height: r.h, zIndex: 3 }}
            >
              {/* image */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.previewUrl}
                alt={p.name}
                referrerPolicy="no-referrer"
                className={`w-full h-full rounded-md ${
                  p.fitMode === "cover" ? "object-cover" : "object-contain"
                }`}
                draggable={false}
                onError={(e) => {
                  if (p.cid) {
                    const el = e.currentTarget as HTMLImageElement;
                    const tried = el.dataset.tried ?? "0";
                    if (tried === "0") {
                      el.src = `https://cloudflare-ipfs.com/ipfs/${p.cid}`;
                      el.dataset.tried = "1";
                    } else if (tried === "1") {
                      el.src = `https://ipfs.io/ipfs/${p.cid}`;
                      el.dataset.tried = "2";
                    }
                  }
                }}
              />
              {/* MOVE handle */}
              <button
                className="absolute left-1 top-1 h-7 px-2 rounded-md bg-black/60 text-white border border-white/20 cursor-move"
                onPointerDown={beginMove(p)}
                title="Move"
                type="button"
              >
                ⠿
              </button>

              {/* RESIZE handle */}
              <button
                className="absolute right-1 bottom-1 h-7 w-7 rounded-md bg-black/60 text-white border border-white/20 cursor-se-resize"
                onPointerDown={beginResize(p)}
                title="Resize (Shift = free)"
                type="button"
              >
                ↘︎
              </button>

              {/* badge */}
              <figcaption className="absolute left-10 top-1 text-[11px] px-2 py-1 rounded-md bg-black/60 text-white border border-white/20 flex items-center gap-2">
                <span>{cellsNow} cells</span>
                <span>·</span>
                <span title={totalNow.toString() + " wei"}>
                  {formatEth(totalNow)} ETH
                </span>
              </figcaption>

              {/* duplicate */}
              <button
                onClick={() => {
                  const offset = TILE;
                  const rect = clampToCanvas({
                    x: r.x + offset,
                    y: r.y + offset,
                    w: r.w,
                    h: r.h,
                  });
                  const cells = rectCells(rect);
                  const dupe = addPending({
                    name: `${p.name}-copy`,
                    mime: p.mime,
                    width: p.width,
                    height: p.height,
                    rect,
                    cells,
                    tipPerCellWei: p.tipPerCellWei,
                    previewUrl: p.previewUrl,
                    cid: p.cid,
                    fitMode: p.fitMode,
                  });
                }}
                className="absolute top-1 h-7 w-7 rounded-md bg-black/60 text-white border border-white/20 hover:bg-black/70 right-[4.5rem]"
                title="Duplicate"
                type="button"
              >
                ⧉
              </button>

              {/* remove */}
              <button
                onClick={() => {
                  if (p.previewUrl.startsWith("blob:")) {
                    try {
                      URL.revokeObjectURL(p.previewUrl);
                    } catch {}
                  }
                  removePending(p.id);
                }}
                className="absolute right-10 top-1 h-7 w-7 rounded-md bg-black/60 text-white border border-white/20 hover:bg-black/70"
                title="Remove"
                type="button"
              >
                ×
              </button>

              {/* tip + fit/fill */}
              <div className="absolute left-1 bottom-10 flex items-center gap-2 text-[11px]">
                <label className="px-2 py-1 rounded-md bg-black/60 text-white border border-white/20">
                  tip / cell (wei)
                </label>
                <input
                  className="px-2 py-1 rounded-md bg-white/80 text-black w-40 outline-none"
                  type="number"
                  min={0}
                  step={1}
                  value={p.tipPerCellWei.toString()}
                  onChange={(e) => {
                    const v = e.currentTarget.value.trim();
                    const next =
                      v === "" ? 0n : BigInt(Math.max(0, Number(v)));
                    setTipFor(p.id, next);
                  }}
                />

                <div className="ml-2 flex rounded-md overflow-hidden border border-white/20">
                  <button
                    className={`px-2 py-1 ${
                      p.fitMode !== "cover"
                        ? "bg-white/80 text-black"
                        : "bg-black/50 text-white"
                    }`}
                    onClick={() => setFitMode(p.id, "contain")}
                    title="Fit"
                    type="button"
                  >
                    Fit
                  </button>
                  <button
                    className={`px-2 py-1 ${
                      p.fitMode === "cover"
                        ? "bg-white/80 text-black"
                        : "bg-black/50 text-white"
                    }`}
                    onClick={() => setFitMode(p.id, "cover")}
                    title="Fill (crop)"
                    type="button"
                  >
                    Fill
                  </button>
                </div>
              </div>
            </figure>
          );
        })}
        </div>

        {/* hint */}
        {!items.length && !busy && !ghost && placed.length === 0 && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <div className="backdrop-blur-md bg-white/8 px-4 py-2 rounded-xl border border-white/15 text-white/85 text-sm">
              Drop a PNG/JPG onto the board — or click “pick an image”
            </div>
          </div>
        )}

        {/* drag overlay */}
        {dragOver && (
          <div className="absolute inset-0 border-4 border-cyan-300/70 rounded-2xl pointer-events-none" />
        )}
      </div>

      {/* Right rail */}
      <aside className="w-full self-start">
        <div className="rounded-2xl border border-white/15 bg-white/6 backdrop-blur-md p-4 text-white/90 shadow-[0_8px_30px_rgba(0,0,0,.18)]">
          <h2 className="font-semibold mb-2">Mifoid Loreboard</h2>
          <p className="text-white/75 text-sm">
            Base fee:{" "}
            <code className="text-white/90">
              {BASE_FEE_PER_CELL_WEI.toString()}
            </code>{" "}
            wei / cell
          </p>
          <p className="text-white/75 text-sm mb-3">
            Max size:{" "}
            <code className="text-white/90">{MAX_CELLS_PER_RECT}</code> cells /
            piece
          </p>

          <button
            onClick={onPickClick}
            className="w-full mb-3 rounded-xl px-4 py-2 bg-cyan-300/90 hover:bg-cyan-200 text-black font-medium transition"
            type="button"
          >
            pick an image (propose)
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg"
            className="hidden"
            onChange={onFileChange}
          />

          <div className="mt-3 p-3 rounded-xl border border-white/15 bg-white/5 text-xs text-white/80 space-y-2">
            <div className="text-white/70">Add finalized by CID (dev)</div>
            <input
              className="w-full px-2 py-1 rounded bg-white/80 text-black text-sm"
              placeholder="ipfs://... or CID"
              value={devCid}
              onChange={(e) => setDevCid(e.currentTarget.value.trim())}
            />
            <div className="grid grid-cols-4 gap-2">
              <input
                className="px-2 py-1 rounded bg-white/80 text-black text-sm"
                type="number"
                value={devW}
                onChange={(e) => setDevW(Number(e.currentTarget.value) || TILE)}
                placeholder="w"
              />
              <input
                className="px-2 py-1 rounded bg-white/80 text-black text-sm"
                type="number"
                value={devH}
                onChange={(e) => setDevH(Number(e.currentTarget.value) || TILE)}
                placeholder="h"
              />
              <input
                className="px-2 py-1 rounded bg-white/80 text-black text-sm"
                type="number"
                value={devX}
                onChange={(e) => setDevX(Number(e.currentTarget.value) || 0)}
                placeholder="x"
              />
              <input
                className="px-2 py-1 rounded bg-white/80 text-black text-sm"
                type="number"
                value={devY}
                onChange={(e) => setDevY(Number(e.currentTarget.value) || 0)}
                placeholder="y"
              />
            </div>
            <button
              className="w-full rounded-md px-3 py-2 bg-white/80 text-black font-semibold"
              type="button"
              onClick={() => {
                if (!devCid) return;
                const rect = capRectToMaxCells(
                  { x: devX, y: devY, w: devW, h: devH },
                  MAX_CELLS_PER_RECT
                );
                const cells = rectCells(rect);
                setPlaced((prev) => [
                  ...prev,
                  {
                    id: `dev:${Date.now()}`,
                    owner: "0xdev",
                    cid: devCid.replace(/^ipfs:\/\//, ""),
                    x: rect.x,
                    y: rect.y,
                    w: rect.w,
                    h: rect.h,
                    cells,
                  },
                ]);
                zoomToRect(rect);
              }}
            >
              Add to board
            </button>
          </div>

          <button
            className="mt-2 w-full rounded-xl px-4 py-2 bg-cyan-300/90 text-black font-semibold disabled:opacity-50"
            disabled={!items.length}
            type="button"
            onClick={async () => {
              try {
                // 1) ensure wallet (MetaMask pop)
                const eth = (globalThis as any)?.ethereum;
                if (!eth) throw new Error("No wallet detected");
                const [account] = await eth.request({ method: "eth_requestAccounts" });

                for (const it of items) {
                  const bytes = await getPendingBytes(it);
                  const byteArray = new Uint8Array(bytes);
                  const cidHash = keccak256(byteArray) as `0x${string}`;
                  const id = keccak256(stringToHex(it.id)) as `0x${string}`;

                  const bidPerCellWei = BASE_FEE_PER_CELL_WEI + it.tipPerCellWei;
                  const epoch = typeof epochIdx === "number" ? epochIdx : 0;

                  await writeProposePlacement({
                    id,
                    bidder: account as `0x${string}`,
                    rect: {
                      x: it.rect.x,
                      y: it.rect.y,
                      w: it.rect.w,
                      h: it.rect.h,
                    },
                    cells: it.cells,
                    bidPerCellWei,
                    cidHash,
                    epoch,
                  });

                  const file = new File([bytes], it.name, { type: it.mime });
                  const cid = await uploadImage(it.name, file, it.mime);
                  if (!cid) throw new Error("IPFS upload disabled.");
                  setCidFor(it.id, cid);
                }

                clearBoardState?.();
                try {
                  const { proposals } = await listProposals();
                  setProposals(proposals ?? []);
                } catch {
                  /* ignore */
                }
                setMessage("Proposed on-chain ✓ and files uploaded to IPFS");
              } catch (e: any) {
                setMessage(String(e?.message ?? e));
              }
            }}
          >
            Submit proposal(s)
          </button>

          <button
            className="mt-2 w-full rounded-xl px-4 py-2 bg-white/20 text-white font-semibold hover:bg-white/25"
            type="button"
            onClick={async () => {
              try {
                const { epoch, manifestCID } = await finalizeEpoch(true); // dev
                const man = await getManifest("latest");
                setPlaced(man.manifest?.placements ?? []);
                setPlacedEpoch(man.epoch);
                setViewEpoch("latest");
                clearBoardState?.();
                try {
                  const { proposals } = await listProposals();
                  setProposals(proposals ?? []);
                } catch {
                  /* ignore */
                }
                setMessage(
                  manifestCID
                    ? `Epoch #${epoch} finalized ✓ · CID: ${manifestCID}`
                    : `Epoch #${epoch} finalized ✓`
                );
                document
                  .querySelector("#referendum")
                  ?.scrollIntoView({ behavior: "smooth", block: "start" });
              } catch (e: any) {
                setMessage(String(e?.message ?? e));
              }
            }}
          >
            Finalize epoch (dev)
          </button>

          <div className="mt-4 rounded-2xl border border-white/15 bg-white/6 backdrop-blur-md p-4 text-white/85">
            <div className="flex items-center gap-2">
              <button
                className="px-2 py-1 rounded border border-white/20 bg-white/10 disabled:opacity-50"
                disabled={!canStepPrev}
                onClick={() =>
                  placedEpoch != null && setViewEpoch(Math.max(0, placedEpoch - 1))
                }
              >
                ◀ Prev
              </button>
              <button
                className="px-2 py-1 rounded border border-white/20 bg-white/10"
                onClick={() => setViewEpoch("latest")}
              >
                Latest
              </button>
              <button
                className="px-2 py-1 rounded border border-white/20 bg-white/10"
                onClick={() =>
                  placedEpoch != null && setViewEpoch(placedEpoch + 1)
                }
              >
                Next ▶
              </button>
              <div className="ml-auto text-sm">
                Viewing epoch {placedEpoch ?? "—"}
              </div>
            </div>
          </div>

          <div
            id="referendum"
            className="mt-4 rounded-2xl border border-white/15 bg-white/6 backdrop-blur-md p-4 text-white/85"
          >
            <h3 className="font-semibold mb-2">Referendum</h3>
            <p className="text-xs text-white/70 -mt-1 mb-2">
              Passing rule: ≥51% yes &amp; quorum (demo env-configured)
            </p>
            <div className="space-y-2 text-xs max-h-48 overflow-auto">
              {proposals.length === 0 && (
                <div className="text-white/60">No proposals yet.</div>
              )}
              {proposals.map((p) => (
                <div
                  key={p.id}
                  className="border border-white/10 rounded-lg p-2"
                >
                  <div className="flex justify-between">
                    <span>
                      {p.cells} cells · bid {p.bidPerCellWei}/cell
                    </span>
                    <span>{Math.round(p.percentYes * 100)}% yes</span>
                  </div>
                  <div className="flex justify-between mt-1">
                    <span>{p.voters} voters</span>
                    <span>
                      {p.status === "proposed"
                        ? `${p.secondsLeft}s left`
                        : p.status}
                    </span>
                  </div>
                  <div className="mt-2 flex gap-2">
                    <button
                      className="px-2 py-1 rounded bg-white/80 text-black disabled:opacity-50"
                      disabled={!(p.status === "proposed" && p.secondsLeft > 0)}
                      onClick={async () => {
                        if (!(p.status === "proposed" && p.secondsLeft > 0))
                          return;
                        try {
                          await castVote({
                            proposalId: p.id,
                            voter: "demo:0xYOU",
                            vote: true,
                          });
                          const { proposals } = await listProposals();
                          setProposals(proposals ?? []);
                        } catch {
                          /* demo only */
                        }
                      }}
                    >
                      Yes
                    </button>
                    <button
                      className="px-2 py-1 rounded bg-white/10 disabled:opacity-50"
                      disabled={!(p.status === "proposed" && p.secondsLeft > 0)}
                      onClick={async () => {
                        if (!(p.status === "proposed" && p.secondsLeft > 0))
                          return;
                        try {
                          await castVote({
                            proposalId: p.id,
                            voter: "demo:0xYOU",
                            vote: false,
                          });
                          const { proposals } = await listProposals();
                          setProposals(proposals ?? []);
                        } catch {
                          /* demo only */
                        }
                      }}
                    >
                      No
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="text-xs text-white/70">
            {busy ? "uploading / processing..." : message}
          </div>
        </div>

        {/* Epoch + Totals */}
        <div className="mt-4 rounded-2xl border border-white/15 bg-white/6 backdrop-blur-md p-4 text-white/85">
          <div className="flex items-baseline justify-between">
            <div className="text-sm font-medium">
              <span>Epoch</span>
              <span suppressHydrationWarning>{epochLabel}</span>
            </div>
            <div
              className="text-2xl tabular-nums"
              suppressHydrationWarning
              title="Countdown"
            >
              {fmtCountdown}
            </div>
          </div>

          {/* Total + Submit (client) */}
          <div className="mt-3 rounded-xl border border-white/15 bg-white/5 p-3 text-white/80">
            <div className="flex items-center justify-between">
              <span className="text-sm">Total</span>
              <span className="text-lg tabular-nums">
                {formatEth(totalWei)} ETH
              </span>
            </div>

            <button
              className="mt-3 w-full rounded-xl px-4 py-2 bg-foid-mint/90 text-black font-semibold disabled:opacity-50"
              disabled={!items.length}
              type="button"
              onClick={() => {
                const payload = {
                  epoch: enabled ? epochIdx : null,
                  items: items.map((p) => ({
                    cid: p.cid,
                    name: p.name,
                    mime: p.mime,
                    rect: p.rect, // adjusted
                    fitMode: p.fitMode ?? "contain",
                    tipPerCellWei: p.tipPerCellWei.toString(),
                    cells: p.cells, // adjusted
                  })),
                  totalWei: totalWei.toString(),
                };
                console.log("SUBMIT_PAYLOAD", payload);
                // TODO: replace with writeContract(...) when ready
              }}
            >
              Log payload (dev)
            </button>

            <button
              className="mt-2 w-full rounded-xl px-4 py-2 bg-white/10 text-white font-medium hover:bg-white/15"
              type="button"
              onClick={() => clearBoardState?.()}
            >
              Clear board
            </button>

            <div className="mt-3 text-xs text-white/70">
              {placedEpoch != null
                ? `Showing finalized epoch #${placedEpoch}`
                : "No finalized epochs yet."}
            </div>
          </div>
        </div>

        {/* Chat trigger under Epoch card */}
        <button
          className="mt-3 w-full rounded-xl px-4 py-2 bg-white/10 text-white hover:bg-white/15"
          type="button"
          onClick={() => setShowChat((v) => !v)}
        >
          {showChat ? "Close chat.exe" : "Open chat.exe"}
        </button>
      </aside>
      {/* chat/media section below the board; pushes layout down */}
      {showChat && (
        <div className="md:col-span-2 col-span-1 mt-4 rounded-2xl border border-white/15 bg-white/6 backdrop-blur-md p-4">
          <div className="grid gap-4 md:grid-cols-[1fr_360px]">
            <div className="rounded-xl border border-white/10 p-3 min-h-[320px]">
              {/* drop your actual chat UI inside ChatDock */}
              <ChatDock />
            </div>
            <div className="rounded-xl border border-white/10 p-3">
              <MusicPanel />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
