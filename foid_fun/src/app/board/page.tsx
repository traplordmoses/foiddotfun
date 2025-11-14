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
import sfx from "@/lib/sfx";
import { keccak256, stringToHex } from "viem";
import type { FinalizedPlacement } from "@/lib/types";
import {
  getManifest,
  proposePlacement,
  listProposals,
  castVote,
} from "@/lib/api";
import type { ProposalSummary } from "@/lib/api";
import { writeProposePlacement } from "@/lib/viem";

const MusicPanel = dynamic(() => import("@/components/MusicPanel"), {
  ssr: false,
});
const ChatDock = dynamic(() => import("@/components/ChatDock"), {
  ssr: false,
});

function display(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "bigint") return value.toString();
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return String(value);
  }
  try {
    const json = JSON.stringify(value);
    if (json === "{}") return "[object]";
    return json;
  } catch {
    return "[object]";
  }
}

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

const GRID_MULTIPLIER = 8; // fake “infinite” backdrop multiplier
const STAGE_CANVAS_W = VIRTUAL_CANVAS_W * GRID_MULTIPLIER;
const STAGE_CANVAS_H = VIRTUAL_CANVAS_H * GRID_MULTIPLIER;
const STAGE_PAD_X = (STAGE_CANVAS_W - VIRTUAL_CANVAS_W) / 2;
const STAGE_PAD_Y = (STAGE_CANVAS_H - VIRTUAL_CANVAS_H) / 2;
const GRID_RADIUS_X = Math.floor(WORLD_MAX_X / TILE);
const GRID_RADIUS_Y = Math.floor(WORLD_MAX_Y / TILE);

const DEV_UI = process.env.NEXT_PUBLIC_DEV_TOOLS === "1";
const BOARD_PASSWORD = process.env.NEXT_PUBLIC_BOARD_PASSWORD ?? "";

const BoardLockBadge: React.FC<{ unlocked?: boolean }> = ({ unlocked }) => (
  <span className="inline-flex items-center gap-1 rounded-full border border-white/25 bg-white/10 px-2 py-0.5 text-[11px] font-medium text-white/80 align-middle">
    <span className="text-[13px]">{unlocked ? "🔓" : "🔒"}</span>
    <span>{unlocked ? "dev access" : "beta lock"}</span>
  </span>
);

const toStageRect = (rect: Rect): Rect => {
  const boardRect = worldToContractRect(rect);
  return {
    x: boardRect.x + STAGE_PAD_X,
    y: boardRect.y + STAGE_PAD_Y,
    w: boardRect.w,
    h: boardRect.h,
  };
};

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

function tryNextGateway(el: HTMLImageElement, cid?: string) {
  if (!cid) return;
  const urls = ipfsToHttp(cid);
  if (!urls.length) return;
  const currentIdx = Number(el.dataset.gatewayIndex ?? "-1");
  const nextIdx = currentIdx + 1;
  if (nextIdx >= urls.length) return;
  el.src = urls[nextIdx];
  el.dataset.gatewayIndex = String(nextIdx);
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

const asWorldRect = (value: any) => {
  const src = value?.rect ?? value ?? {};
  return {
    x: Number(src.x ?? 0),
    y: Number(src.y ?? 0),
    w: Number(src.w ?? src.width ?? 0),
    h: Number(src.h ?? src.height ?? 0),
  };
};

const normalizePlacements = (list: any[]): FinalizedPlacement[] =>
  list.map((p: any) => {
    const { rect, ...rest } = p ?? {};
    const coerced = asWorldRect(rect ?? p);
    return {
      ...rest,
      x: coerced.x,
      y: coerced.y,
      w: coerced.w,
      h: coerced.h,
      cells: Number(p?.cells ?? 1),
    } as FinalizedPlacement;
  });

const normalizeProposals = (list: ProposalSummary[] | undefined): ProposalSummary[] =>
  (list ?? []).map((p) => {
    const rect = asWorldRect(p.rect ?? p);
    return {
      ...p,
      rect,
    };
  });

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

  // --- simple password gate ---
  const [unlocked, setUnlocked] = useState(false);
  const [pwInput, setPwInput] = useState("");
  const [pwError, setPwError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem("mifoid-board-unlocked");
    if (stored === "1") {
      setUnlocked(true);
    }
  }, []);

  const handleUnlock = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!BOARD_PASSWORD) {
        setPwError(
          "Missing NEXT_PUBLIC_BOARD_PASSWORD – set it in your env to use this gate."
        );
        return;
      }
      if (pwInput.trim() === BOARD_PASSWORD) {
        setUnlocked(true);
        setPwError(null);
        if (typeof window !== "undefined") {
          window.localStorage.setItem("mifoid-board-unlocked", "1");
        }
        try {
          sfx.unlock?.();
        } catch {
          /* noop */
        }
      } else {
        setPwError("incorrect password");
      }
    },
    [pwInput]
  );

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
  const [finalizing, setFinalizing] = useState(false);
  const [finalizeResult, setFinalizeResult] = useState<string | null>(null);
  const [latestDebug, setLatestDebug] = useState<string | null>(null);
  const [submittingProposals, setSubmittingProposals] = useState(false);
  const zoomToRect = useCallback(
    (r: Rect, padding = 32) => {
      const el = containerRef.current;
      if (!el) return;
      const viewW = el.clientWidth || 1;
      const viewH = el.clientHeight || 1;
      const stageRect = toStageRect(r);
      const targetW = stageRect.w + padding * 2;
      const targetH = stageRect.h + padding * 2;
      const s = Math.max(0.25, Math.min(4, Math.min(viewW / targetW, viewH / targetH)));
      const x = (viewW - stageRect.w * s) / 2 - stageRect.x * s;
      const y = (viewH - stageRect.h * s) / 2 - stageRect.y * s;
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
      const stageX = (clientX - r.left - pan.x) / scale;
      const stageY = (clientY - r.top - pan.y) / scale;
      const boardX = stageX - STAGE_PAD_X;
      const boardY = stageY - STAGE_PAD_Y;
      const worldX = boardX - BOARD_OFFSET_X;
      const worldY = boardY - BOARD_OFFSET_Y;
      const gridX = Math.round(worldX / TILE);
      const gridY = Math.round(worldY / TILE);
      const clampedGridX = Math.max(-GRID_RADIUS_X, Math.min(GRID_RADIUS_X, gridX));
      const clampedGridY = Math.max(-GRID_RADIUS_Y, Math.min(GRID_RADIUS_Y, gridY));
      return {
        x: clampedGridX * TILE,
        y: clampedGridY * TILE,
      };
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

  const onCanvasWheel: React.WheelEventHandler<HTMLDivElement> = (e) => {
    if (e.shiftKey) return;
    e.preventDefault();
    const el = containerRef.current;
    if (!el) return;
    const factor = Math.exp(-e.deltaY * 0.001);
    const nextScale = Math.min(4, Math.max(0.25, scale * factor));
    const r = el.getBoundingClientRect();
    const cx = e.clientX - r.left;
    const cy = e.clientY - r.top;
    const wx = (cx - pan.x) / scale;
    const wy = (cy - pan.y) / scale;
    setScale(nextScale);
    setPan({
      x: cx - wx * nextScale,
      y: cy - wy * nextScale,
    });
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
    const x = (r.width - STAGE_CANVAS_W) / 2;
    const y = (r.height - STAGE_CANVAS_H) / 2;
    setPan({ x, y });
  }, []);

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

  const clampToCanvas = useCallback((r: Rect): Rect => {
    // allow symmetric placement around 0,0 instead of clamping to only +x/+y
    const minX = -WORLD_MAX_X;
    const maxX = WORLD_MAX_X - r.w;
    const minY = -WORLD_MAX_Y;
    const maxY = WORLD_MAX_Y - r.h;

    return {
      x: Math.min(Math.max(r.x, minX), maxX),
      y: Math.min(Math.max(r.y, minY), maxY),
      w: r.w,
      h: r.h,
    };
  }, []);

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

        // 1) measure original image
        let { w, h } = await getImageSize(workingFile);

        // initial rect at drop position, snapped to grid
        let rect = snapRect({
          x: pos?.x ?? 0,
          y: pos?.y ?? 0,
          w,
          h,
        });

        let cells = rectCells(rect);

        // 2) if huge, downscale the image once toward the cell cap
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
          mime = kind
            ? (mimeFromType(kind) as "image/png" | "image/jpeg")
            : ("image/jpeg" as const);

          const size2 = await getImageSize(resized);
          rect = snapRect({
            x: pos?.x ?? 0,
            y: pos?.y ?? 0,
            w: size2.w,
            h: size2.h,
          });
          cells = rectCells(rect);
        }

        // 3) Force the rect underneath the cell cap and keep it on the canvas
        rect = capRectToMaxCells(rect, MAX_CELLS_PER_RECT);
        rect = clampToCanvas(rect);
        const cellsNow = rectCells(rect);

        const previewUrl = URL.createObjectURL(workingFile);

        addPending({
          name: workingFile.name,
          mime,
          width: rect.w,
          height: rect.h,
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
    [addPending, clampToCanvas]
  );

  const handleFiles = useCallback(
    async (files: FileList | null, pos?: DropPos) => {
      if (!files || files.length === 0) return;
      await handleSingleFile(files[0], pos);
    },
    [handleSingleFile]
  );

  const onDrop: React.DragEventHandler<HTMLDivElement> = async (e) => {
    e.preventDefault();
    setDragOver(false);
    await handleFiles(
      e.dataTransfer?.files ?? null,
      getDropPos(e.clientX, e.clientY)
    );
  };

  const onFileChange: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    const input = e.currentTarget;

    let pos: DropPos | undefined;
    const el = containerRef.current;
    if (el) {
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      pos = screenToWorld(cx, cy);
    }

    await handleFiles(input.files ?? null, pos);
    input.value = "";
  };

  // ======== Finalized + proposals state ========
  const [placed, setPlaced] = useState<FinalizedPlacement[]>([]);
  const [placedEpoch, setPlacedEpoch] = useState<number | null>(null);
  const [viewEpoch, setViewEpoch] = useState<number | "latest">("latest");
  const [proposals, setProposals] = useState<ProposalSummary[]>([]);

  const handleFinalizeClick = useCallback(async () => {
    try {
      setFinalizing(true);
      setFinalizeResult(null);

      const res = await fetch("/api/operator/finalize?force=1", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFinalizeResult(`Error: ${json?.error ?? res.statusText}`);
        return;
      }

      const epoch = json?.epoch ?? "latest";
      const winnersCount =
        json?.winners ??
        (Array.isArray(json?.accepted) ? json.accepted.length : "—");
      const txHash = json?.txHash ?? "n/a";
      const manifestRoot = json?.manifestRoot ?? "n/a";

      const man = await getManifest("latest");
      const placements: FinalizedPlacement[] = normalizePlacements(
        man.manifest?.placements ?? []
      );
      setPlaced(placements);
      setPlacedEpoch(man.epoch);
      setViewEpoch("latest");
      clearBoardState?.();

      try {
        const { proposals } = await listProposals();
        setProposals(normalizeProposals(proposals ?? []));
      } catch {
        /* ignore */
      }

      setFinalizeResult(
        `Finalized epoch ${epoch} • winners=${winnersCount} • tx=${txHash} • manifest=${manifestRoot}`
      );
      document
        .querySelector("#referendum")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (e: any) {
      setFinalizeResult(`Error: ${e?.message ?? "Unknown error"}`);
    } finally {
      setFinalizing(false);
    }
  }, [
    clearBoardState,
    setPlaced,
    setPlacedEpoch,
    setViewEpoch,
    setProposals,
  ]);

  // ======== MOVE / RESIZE ========
  const [activeId, setActiveId] = useState<string | null>(null);
  const [liveRect, setLiveRect] = useState<Rect | null>(null);
  const liveRectRef = useRef<Rect | null>(null);
  const startRectRef = useRef<Rect | null>(null);
  const startPtRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const aspectRef = useRef<number>(1);

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
    if (!unlocked) return;
    let alive = true;

    const load = async () => {
      const requestingLatest = viewEpoch === "latest";
      try {
        const man = await getManifest(viewEpoch);
        if (!alive) return;
        if (DEV_UI) {
          setLatestDebug(JSON.stringify(man, null, 2));
        } else {
          setLatestDebug(null);
        }
        const placements: FinalizedPlacement[] = normalizePlacements(
          man.manifest?.placements ?? []
        );
        setPlaced(placements);
        setPlacedEpoch(man.epoch ?? null);
        if (requestingLatest && placements.length) {
          const first = placements[0];
          zoomToRect({ x: first.x, y: first.y, w: first.w, h: first.h });
        }
      } catch (e: any) {
        if (!alive) return;
        setPlaced([]);
        setPlacedEpoch(null);
        setLatestDebug(null);
        console.error("LATEST_LOAD_FAIL", e);
        setMessage(String(e?.message ?? "Failed to load manifest"));
      }
    };

    load();

    return () => {
      alive = false;
    };
  }, [viewEpoch, zoomToRect, unlocked]);

  useEffect(() => {
    if (!unlocked) return;
    let alive = true;

    const tick = async () => {
      try {
        const { proposals } = await listProposals();
        if (alive) setProposals(normalizeProposals(proposals));
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
  }, [unlocked]);

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

  if (!unlocked) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4">
        <div className="relative max-w-sm w-full rounded-3xl border border-white/20 bg-gradient-to-b from-white/15 via-white/5 to-white/0 backdrop-blur-xl p-6 shadow-[0_18px_60px_rgba(0,0,0,.55)]">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-300/90 via-sky-400/90 to-blue-500/90 shadow-[0_0_0_1px_rgba(255,255,255,.6),0_16px_30px_rgba(0,0,0,.5)]">
            <span className="text-2xl">🔒</span>
          </div>

          <h1 className="text-lg font-semibold text-white text-center">
            Mifoid Loreboard
          </h1>
          <p className="mt-1 text-xs text-white/70 text-center">
            this board is still in beta. enter the access word to continue.
          </p>

          <form onSubmit={handleUnlock} className="mt-4 space-y-3">
            <label className="block text-xs text-white/75">
              access password
              <input
                type="password"
                className="mt-1 w-full rounded-xl border border-white/25 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:border-cyan-300/80 focus:ring-1 focus:ring-cyan-300/80"
                placeholder="••••••••"
                value={pwInput}
                onChange={(e) => setPwInput(e.currentTarget.value)}
              />
            </label>

            {pwError && (
              <p className="text-[11px] text-rose-300/90">{pwError}</p>
            )}

            <button
              type="submit"
              className="mt-1 w-full rounded-xl px-4 py-2 text-sm font-semibold bg-cyan-300/95 text-black hover:bg-cyan-200 transition shadow-[0_10px_30px_rgba(0,0,0,.6)]"
            >
              unlock board
            </button>

            <p className="mt-2 text-[10px] text-white/50 text-center">
              tip: set{" "}
              <code className="font-mono text-[10px]">
                NEXT_PUBLIC_BOARD_PASSWORD
              </code>{" "}
              in your env.
            </p>
          </form>
        </div>
      </div>
    );
  }

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
        onWheel={onCanvasWheel}
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
          className="absolute top-0 left-0"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
            transformOrigin: "0 0",
            backgroundImage: gridBg,
            backgroundSize: gridSize,
            width: STAGE_CANVAS_W,
            height: STAGE_CANVAS_H,
          }}
        >
          {/* finalized placements (bottom layer) */}
        {placed.map((p) => {
          const stageRect = toStageRect({
            x: p.x,
            y: p.y,
            w: p.w,
            h: p.h,
          });
          return (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={p.id}
              src={cidToHttpUrl(p.cid)}
              alt={p.id}
              className="absolute rounded-md pointer-events-none"
              style={{
                left: stageRect.x,
                top: stageRect.y,
                width: stageRect.w,
                height: stageRect.h,
                zIndex: 0,
                outline: "2px solid rgba(72,255,171,.55)",
                background: "rgba(72,255,171,.04)",
                borderRadius: "6px",
              }}
              referrerPolicy="no-referrer"
              data-gateway-index="0"
              onError={(e) => tryNextGateway(e.currentTarget, p.cid)}
            />
          );
        })}

        {/* ghost preview */}
        {ghost ? (() => {
          const stageRect = toStageRect(ghost.rect);
          return (
          <div
            className="absolute rounded-md pointer-events-none"
            style={{
              left: stageRect.x,
              top: stageRect.y,
              width: stageRect.w,
              height: stageRect.h,
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
        );
        })() : null}

        {/* proposals (top of accepted layer, dashed while voting) */}
        {proposals
          .filter((p) => p.status === "proposed")
          .map((p) => {
            const stageRect = toStageRect(p.rect);
            return (
            <figure
              key={p.id}
              className="absolute pointer-events-none"
              style={{
                left: stageRect.x,
                top: stageRect.y,
                width: stageRect.w,
                height: stageRect.h,
                zIndex: 2,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={cidToHttpUrl(p.cid)}
                alt={p.name}
                referrerPolicy="no-referrer"
                className="w-full h-full rounded-md object-contain"
                draggable={false}
                data-gateway-index="0"
                onError={(e) => tryNextGateway(e.currentTarget, p.cid)}
                style={{
                  outlineWidth: 2,
                  outlineStyle: "dashed",
                  outlineColor: "rgba(255,184,0,.9)",
                  background: "rgba(255,184,0,.06)",
                }}
              />

              <figcaption className="absolute left-1 top-1 text-[11px] px-2 py-1 rounded-md bg-black/60 text-white border border-white/20 flex items-center gap-2">
                <span>{display(p.cells)} cells</span>
                <span>·</span>
                <span>bid {display(p.bidPerCellWei)}/cell</span>
                <span>·</span>
                <span>{display(Math.round(Number(p.percentYes ?? 0) * 100))}% yes</span>
                <span>·</span>
                <span>{display(p.voters)} voters</span>
                <span>·</span>
                <span>{display(p.secondsLeft)}s left</span>
              </figcaption>
            </figure>
          );
          })}

        {/* pending items (top layer) */}
        {items.map((p) => {
          const r = renderRectFor(p);
          const stageRect = toStageRect(r);
          const cellsNow = rectCells(r);
          const totalNow =
            BigInt(cellsNow) * (BASE_FEE_PER_CELL_WEI + p.tipPerCellWei);

          return (
            <figure
              key={p.id}
              className="absolute"
              style={{
                left: stageRect.x,
                top: stageRect.y,
                width: stageRect.w,
                height: stageRect.h,
                zIndex: 3,
              }}
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
                data-gateway-index="-1"
                onError={(e) => tryNextGateway(e.currentTarget, p.cid)}
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
          <h2 className="font-semibold mb-2 flex items-center gap-2">
            Mifoid Loreboard
            <BoardLockBadge unlocked={unlocked} />
          </h2>
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

          {DEV_UI && (
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
                  const capped = capRectToMaxCells(
                    { x: devX, y: devY, w: devW, h: devH },
                    MAX_CELLS_PER_RECT
                  );
                  const rect = clampToCanvas(capped);
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

              {latestDebug && (
                <pre className="mt-3 max-h-56 overflow-auto rounded-lg bg-black/40 p-2 text-[11px] leading-tight text-white/70 whitespace-pre-wrap">
                  {latestDebug}
                </pre>
              )}
            </div>
          )}

          <button
            className="mt-2 w-full rounded-xl px-4 py-2 bg-cyan-300/90 text-black font-semibold disabled:opacity-50"
            disabled={!items.length || submittingProposals}
            type="button"
          onClick={async () => {
            if (submittingProposals) return;
            setSubmittingProposals(true);
            setMessage("Preparing submissions...");
            try {
              // 1) ensure wallet (MetaMask pop)
              const eth = (globalThis as any)?.ethereum;
              if (!eth) throw new Error("No wallet detected");
              const [account] = await eth.request({ method: "eth_requestAccounts" });

              for (const it of items) {
                setMessage(`Submitting ${it.name} on-chain...`);
                const bytes = await getPendingBytes(it);
                const byteArray = new Uint8Array(bytes);
                const cidHash = keccak256(byteArray) as `0x${string}`;
                const id = keccak256(stringToHex(it.id)) as `0x${string}`;

                  const bidPerCellWei = BASE_FEE_PER_CELL_WEI + it.tipPerCellWei;
                  const epoch = typeof epochIdx === "number" ? epochIdx : 0;

                  const onChainRect = worldToContractRect(it.rect);

                  await writeProposePlacement({
                    id,
                    bidder: account as `0x${string}`,
                    rect: {
                      x: onChainRect.x,
                      y: onChainRect.y,
                      w: onChainRect.w,
                      h: onChainRect.h,
                    },
                    cells: it.cells,
                    bidPerCellWei,
                    cidHash,
                    epoch,
                  });

                  setMessage(`Uploading ${it.name} to IPFS...`);
                  const file = new File([bytes], it.name, { type: it.mime });
                  const cid = await uploadImage(it.name, file, it.mime);
                  if (!cid) throw new Error("IPFS upload disabled.");
                  setCidFor(it.id, cid);

                  const normalizedCid = cid.replace(/^ipfs:\/\//, "");
                  setMessage(`Saving ${it.name} to operator store...`);
                  const res = await fetch("/api/proposals", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      id,
                      owner: account,
                      cid: normalizedCid,
                      name: it.name,
                      mime: it.mime,
                      rect: it.rect,
                      width: it.width,
                      height: it.height,
                      bidPerCellWei: bidPerCellWei.toString(),
                      cells: it.cells,
                      filename: it.name,
                    }),
                  });
                  if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    throw new Error(err?.error ?? "Failed to persist proposal");
                  }
                }

                clearBoardState?.();
                try {
                  const { proposals } = await listProposals();
                  setProposals(normalizeProposals(proposals));
                } catch {
                  /* ignore */
                }
                setMessage("Proposed on-chain ✓ and files uploaded to IPFS");
              } catch (e: any) {
                setMessage(String(e?.message ?? e));
              } finally {
                setSubmittingProposals(false);
              }
            }}
          >
            {submittingProposals ? "Submitting..." : "Submit proposal(s)"}
          </button>

          <button
            className="mt-2 w-full rounded-xl px-4 py-2 bg-white/20 text-white font-semibold hover:bg-white/25 disabled:opacity-60"
            type="button"
            disabled={finalizing}
            onClick={handleFinalizeClick}
          >
            {finalizing ? "Finalizing..." : "Finalize epoch (dev)"}
          </button>
          {finalizeResult && (
            <p className="mt-1 text-xs text-foid-mint/80">{finalizeResult}</p>
          )}

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
                      {display(p.cells)} cells · bid {display(p.bidPerCellWei)}/cell
                    </span>
                    <span>{display(Math.round(Number(p.percentYes ?? 0) * 100))}% yes</span>
                  </div>
                  <div className="flex justify-between mt-1">
                    <span>{display(p.voters)} voters</span>
                    <span>
                      {p.status === "proposed"
                        ? `${display(p.secondsLeft)}s left`
                        : display(p.status)}
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
                          setProposals(normalizeProposals(proposals));
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
                          setProposals(normalizeProposals(proposals));
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
