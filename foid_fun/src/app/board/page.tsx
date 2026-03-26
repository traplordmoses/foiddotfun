// /src/app/board/page.tsx - REDESIGNED v3
// Single seamless container matching foid_mommy_terminal.exe
// Features: Wallet dropdown, iPod music player, terminal chat with status, infinite smooth zoom
"use client";

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
import { cidToHttpUrl, ipfsToHttp } from "@/lib/ipfsUrl";
import { formatEth } from "@/lib/wei";
import { useLatestManifestFromChain } from "@/hooks/useLatestManifestFromChain";
import type { FinalizedPlacement } from "@/lib/types";
import { getLatestNormalized } from "@/lib/manifest";
import { listProposals } from "@/lib/api";
import type { ProposalSummary, ListProposalsResponse } from "@/lib/api";
import { PlacementCard, type Placement } from "@/components/PlacementCard";
import { PlacementModal } from "@/components/PlacementModal";
import { LoreboardNotification } from "@/components/LoreboardNotification";
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
import { MobilePlacementPicker } from "@/components/MobilePlacementPicker";
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
import { insertBoardMessage } from "@/lib/supabase";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { PaintEditor } from "@/components/PaintEditor";
import { useSwipePropose } from "@/hooks/useSwipePropose";

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

// Debug logger - only logs in development
const debugWarn = (...args: unknown[]) => {
  if (process.env.NODE_ENV !== "production") {
    console.warn(...args);
  }
};

const isBytes32Hex = (value?: string): value is `0x${string}` =>
  typeof value === "string" && /^0x[0-9a-fA-F]{64}$/.test(value);

type EthereumProvider = {
  request: (args: { method: string; params?: readonly unknown[] }) => Promise<unknown>;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

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

/**
 * Validate if a string is a valid IPFS CID
 * CIDv0: starts with "Qm" and is 46 characters (base58)
 * CIDv1: starts with "b" and is variable length (base32)
 */
const isValidCid = (value: string): boolean => {
  const trimmed = value.trim();
  // CIDv0 format: Qm... (46 chars, base58)
  if (/^Qm[1-9A-HJ-NP-Za-km-z]{44}$/.test(trimmed)) return true;
  // CIDv1 format: b... (base32, variable length)
  if (/^b[a-z2-7]{58,}$/.test(trimmed)) return true;
  // Allow dev/test CIDs (for local development)
  if (/^dev-/.test(trimmed)) return true;
  return false;
};

const normalizeCidString = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) throw new Error("Empty CID");

  let cidPart = trimmed;

  // Extract CID from URL
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const url = new URL(trimmed);
      const parts = url.pathname.replace(/^\/+/, "").split("/");
      cidPart = parts.slice(parts[0] === "ipfs" ? 1 : 0)[0] || "";
    } catch {
      throw new Error("Invalid IPFS URL");
    }
  } else if (trimmed.startsWith("ipfs://")) {
    cidPart = trimmed.replace(/^ipfs:\/\//, "");
  }

  // Validate CID format
  if (!isValidCid(cidPart)) {
    throw new Error(`Invalid CID format: ${cidPart.slice(0, 20)}...`);
  }

  return `ipfs://${cidPart}`;
};


function tryNextGateway(el: HTMLImageElement, cid?: string) {
  if (!cid) return;
  const urls = ipfsToHttp(cid);
  const idx = Number(el.dataset.gatewayIndex ?? "-1") + 1;
  if (idx < urls.length) { el.src = urls[idx]; el.dataset.gatewayIndex = String(idx); }
}

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

const asWorldRect = (value: unknown): Rect => {
  if (!isRecord(value)) {
    throw new Error("Invalid rect: expected object");
  }

  const src = value;
  const rect = isRecord(src.rect) ? src.rect : src;

  const x = Number(rect.x);
  const y = Number(rect.y);
  const w = Number(rect.w ?? rect.width);
  const h = Number(rect.h ?? rect.height);

  // Validate all fields are valid numbers
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(w) || !Number.isFinite(h)) {
    throw new Error("Invalid rect: non-numeric or missing coordinates");
  }

  // Validate dimensions are positive
  if (w < 0 || h < 0) {
    throw new Error("Invalid rect: negative dimensions");
  }

  return { x, y, w, h };
};


const normalizePlacements = (list: unknown[]): FinalizedPlacement[] =>
  list.map((p) => {
    const placement = isRecord(p) ? p : {};
    const coerced = asWorldRect(placement.rect ?? placement);
    // Manifests may contain contract-space coordinates (x/y offset by BOARD_OFFSET).
    // In world space x is always < BOARD_OFFSET, so values >= BOARD_OFFSET indicate
    // contract coordinates that need conversion.
    const needsTransform = coerced.x >= BOARD_OFFSET_X || coerced.y >= BOARD_OFFSET_Y;
    const rect = needsTransform ? contractToWorldRect(coerced) : coerced;
    return {
      ...(placement as FinalizedPlacement),
      x: rect.x,
      y: rect.y,
      w: rect.w,
      h: rect.h,
      cells: Number(placement.cells ?? 1),
    };
  });

const normalizeProposals = (list: ProposalSummary[] | undefined): ProposalSummary[] =>
  (list ?? []).map((p) => {
    // API returns CONTRACT coordinates, convert to WORLD coordinates for rendering
    const contractRect = asWorldRect(p.rect ?? p);
    const rect = contractToWorldRect(contractRect);
    const cells = Math.floor((contractRect.w / TILE) * (contractRect.h / TILE));
    // Check p.id first (from API), then p.placementId, then p.chainId (legacy)
    const placementId = isBytes32Hex(p.id) ? p.id : isBytes32Hex(p.placementId) ? p.placementId : isBytes32Hex(p.chainId) ? p.chainId : undefined;
    // Map yesVotes/noVotes to yes/no for backward compatibility
    const yes = p.yesVotes ?? p.yes ?? 0;
    const no = p.noVotes ?? p.no ?? 0;
    return { ...p, rect, cells, placementId, epochId: p.epochSubmitted ?? 0, yes, no };
  });


// ============================================================================
// MOBILE PROPOSE MODAL
// ============================================================================

function MobileProposeModal({
  isConnected,
  address,
  placedRects,
  onClose,
  onSuccess,
}: {
  isConnected: boolean;
  address?: string;
  placedRects: Rect[];
  onClose: () => void;
  onSuccess: (msg: string) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [step, setStep] = useState<"pick" | "paint" | "position" | "uploading" | "submitting" | "done" | "error">("pick");
  const [errorMsg, setErrorMsg] = useState("");
  const [placementRect, setPlacementRect] = useState<Rect | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const placementFee = process.env.NEXT_PUBLIC_PLACEMENT_FEE_WEI ?? "1000000000000000";
  const feeEth = (Number(BigInt(placementFee)) / 1e18).toFixed(4);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      setErrorMsg("Only image files allowed");
      setStep("error");
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      setErrorMsg("File too large (max 10MB)");
      setStep("error");
      return;
    }
    // Auto-convert non-PNG/JPEG to JPEG
    let processed = f;
    if (f.type !== "image/jpeg" && f.type !== "image/png") {
      try {
        processed = await convertToJpeg(f);
      } catch {
        setErrorMsg("Could not process image");
        setStep("error");
        return;
      }
    }
    setFile(processed);
    setPreview(URL.createObjectURL(processed));
    setErrorMsg("");
    setStep("paint");
  };

  const handlePaintDone = async (editedFile: File) => {
    setFile(editedFile);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(editedFile));

    // Compute initial placement rect from image dimensions
    try {
      const { w, h } = await getImageSizeFromFile(editedFile);
      let rect = snapRect({ x: 0, y: 0, w, h });
      rect = capRectToMaxCells(rect, MAX_CELLS_PER_RECT);
      setPlacementRect(rect);
      setStep("position");
    } catch {
      setPlacementRect(snapRect({ x: 0, y: 0, w: TILE, h: TILE }));
      setStep("position");
    }
  };

  const handleSubmit = async () => {
    if (!file || !address || !isConnected || !placementRect) return;

    // Validate placement
    if (hasOverlap(placementRect, placedRects)) {
      setErrorMsg("Placement overlaps an existing meme");
      setStep("error");
      return;
    }
    if (!isTouching(placementRect, placedRects)) {
      setErrorMsg("Placement must touch an existing meme on the board");
      setStep("error");
      return;
    }

    try {
      setStep("uploading");

      // Determine mime type
      const kind = await sniffImageType(file);
      const mime = kind ? mimeFromType(kind) : null;
      if (!mime) throw new Error("Only PNG or JPG images allowed");

      // Upload to IPFS
      const cid = await uploadImage(file.name, file, mime as "image/png" | "image/jpeg");
      if (!cid) throw new Error("IPFS upload disabled — configure PINATA_JWT");

      setStep("submitting");

      const contractRect = worldToContractRect(placementRect);

      const normalizedCid = normalizeCidString(cid);

      // Import and call Swipe.proposeLoreboard() instead of SwipeLoreboard.place()
      const { getWalletClient, fluentTestnet } = await import("@/lib/viem");
      const { SWIPE_ABI } = await import("@/lib/contracts/abis/swipe");
      const { CONTRACTS } = await import("@/lib/contracts/addresses");
      const walletClient = await getWalletClient();
      const swipeAddr = CONTRACTS.SWIPE as `0x${string}`;
      const fee = BigInt(CONTRACTS.SWIPE_SUBMISSION_FEE ?? "1000000000000000");

      await walletClient.writeContract({
        account: (walletClient.account ?? address) as `0x${string}`,
        address: swipeAddr,
        abi: SWIPE_ABI,
        functionName: "proposeLoreboard",
        args: [normalizedCid, contractRect.x, contractRect.y, contractRect.w, contractRect.h],
        value: fee,
        chain: fluentTestnet,
      });

      setStep("done");
      onSuccess(`Proposal submitted! Now in voting queue. (${file.name})`);
    } catch (e: unknown) {
      if (isUserRejection(e)) {
        setStep("pick");
        return;
      }
      const parsed = parseWeb3Error(e);
      setErrorMsg(parsed.message);
      setStep("error");
    }
  };

  // Cleanup preview URL
  useEffect(() => {
    return () => { if (preview) URL.revokeObjectURL(preview); };
  }, [preview]);

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)" }}
      onClick={(e) => { if (e.target === e.currentTarget && step !== "uploading" && step !== "submitting") onClose(); }}
    >
      <div
        className="w-[90vw] max-w-sm rounded-2xl p-5 relative"
        style={{
          background: "linear-gradient(135deg, rgba(20,10,40,0.95), rgba(10,5,30,0.98))",
          border: "1px solid rgba(224,64,251,0.3)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.6), 0 0 60px rgba(224,64,251,0.15)",
        }}
      >
        {/* Close button */}
        {step !== "uploading" && step !== "submitting" && (
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full"
            style={{ background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)" }}
          >
            ×
          </button>
        )}

        <h2 className="text-sm font-bold tracking-widest uppercase mb-4" style={{ color: "#e040fb" }}>
          Propose Meme
        </h2>

        {step === "pick" && (
          <>
            {!isConnected ? (
              <p className="text-xs text-white/60 mb-4">Connect your wallet first to propose a meme.</p>
            ) : (
              <>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileSelect}
                />

                <button
                  onClick={() => fileRef.current?.click()}
                  className="w-full py-8 rounded-xl border-2 border-dashed mb-4 text-sm"
                  style={{ borderColor: "rgba(224,64,251,0.3)", color: "rgba(255,255,255,0.6)", background: "rgba(224,64,251,0.05)" }}
                >
                  Tap to select image
                </button>

                <div className="flex items-center justify-between text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
                  <span>Placement fee</span>
                  <span className="font-bold" style={{ color: "rgba(255,255,255,0.9)" }}>{feeEth} ETH</span>
                </div>
              </>
            )}
          </>
        )}

        {step === "paint" && file && (
          <PaintEditor
            imageFile={file}
            onDone={handlePaintDone}
            onCancel={() => setStep("pick")}
          />
        )}

        {step === "position" && preview && placementRect && (
          <MobilePlacementPicker
            previewUrl={preview}
            rect={placementRect}
            placedRects={placedRects}
            onRectChange={setPlacementRect}
            onConfirm={handleSubmit}
            onBack={() => setStep("pick")}
          />
        )}

        {(step === "uploading" || step === "submitting") && (
          <div className="py-8 flex flex-col items-center gap-4">
            <div className="w-10 h-10 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "#e040fb", borderTopColor: "transparent" }} />
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.8)" }}>
              {step === "uploading" ? "Uploading to IPFS..." : "Confirm transaction in wallet..."}
            </p>
          </div>
        )}

        {step === "done" && (
          <div className="py-8 flex flex-col items-center gap-4">
            <div className="text-4xl">&#10003;</div>
            <p className="text-sm font-bold" style={{ color: "rgba(72,255,171,0.95)" }}>Meme placed on board!</p>
            <button
              onClick={onClose}
              className="px-6 py-2 rounded-xl text-sm font-bold"
              style={{ background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.8)" }}
            >
              Done
            </button>
          </div>
        )}

        {step === "error" && (
          <div className="py-6 flex flex-col items-center gap-4">
            <p className="text-sm text-center" style={{ color: "rgba(255,71,87,0.9)" }}>{errorMsg}</p>
            <button
              onClick={() => { setStep("pick"); setErrorMsg(""); }}
              className="px-6 py-2 rounded-xl text-sm font-bold"
              style={{ background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.8)" }}
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/** Get image dimensions from a File (used by MobileProposeModal) */
async function getImageSizeFromFile(file: File): Promise<{ w: number; h: number }> {
  try {
    const createBitmap = typeof createImageBitmap === "function" ? createImageBitmap : null;
    const bmp = createBitmap ? await createBitmap(file) : null;
    if (bmp) {
      const w = bmp.width, h = bmp.height;
      bmp.close?.();
      return { w, h };
    }
  } catch { /* fall through */ }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = url;
    });
    return { w: img.naturalWidth, h: img.naturalHeight };
  } finally {
    URL.revokeObjectURL(url);
  }
}

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
  const handleSwitchWallet = useCallback(() => {
    disconnect();
    setTimeout(() => openConnectModal?.(), 100);
  }, [disconnect, openConnectModal]);

  // Mobile propose modal
  const [showMobilePropose, setShowMobilePropose] = useState(false);

  // Desktop paint editor state
  const [desktopPaintFile, setDesktopPaintFile] = useState<File | null>(null);
  const [desktopPaintPos, setDesktopPaintPos] = useState<DropPos | undefined>(undefined);
  const [showSubmitSuccess, setShowSubmitSuccess] = useState(false);

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
  const handleChatSend = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || !address) return;

    try {
      // Save to Supabase - real-time subscription will handle display
      await insertBoardMessage({
        wallet_address: address,
        message: trimmed,
        type: "chat",
      });
      // No longer adding to statusMessages - Supabase real-time handles it!
    } catch (error) {
      console.error("Failed to send chat message:", error);
      // Only show error as status message
      addStatus("Failed to send message", "error");
    }
  }, [address, addStatus]);

  // Governance - flagging disabled in v1 (SwipeLoreboard not deployed)
  // Flagging will use FoidTrestGovernance in a future update
  const { proposeLoreboard: swipeProposeLoreboard } = useSwipePropose();
  const [flaggedIds] = useState<Set<string>>(new Set());
  const flagFeeEth = "0.001";

  const handleFlagPlacement = useCallback(async (_placementId: string) => {
    addStatus("Flagging is not available yet — coming soon", "info");
  }, [addStatus]);

  // UI state
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [submittingProposals, setSubmittingProposals] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const searchParams = useSearchParams();
  const debugMode = searchParams?.get("debug") === "1";

  // Mobile detection
  const { isMobile } = useMobile();

  // Board data — finalized placements from ManifestStore, proposals from Swipe
  const [placed, setPlaced] = useState<FinalizedPlacement[]>([]);
  const [placedEpoch, setPlacedEpoch] = useState<number | null>(null);
  const [proposals, setProposals] = useState<ProposalSummary[]>([]);
  const [_proposalsLoading, setProposalsLoading] = useState(true);
  const [proposalDebug, setProposalDebug] = useState<ListProposalsResponse["debug"] | null>(null);

  // ManifestStore hook — reads CID from contract, fetches manifest from IPFS
  const { manifest: latestManifest, epoch: latestManifestEpoch, loading: latestManifestLoading, error: latestManifestError } = useLatestManifestFromChain();
  const latestFallbackTried = useRef(false);

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

  async function getImageSize(file: File): Promise<{ w: number; h: number }> {
    try {
      const createBitmap = typeof createImageBitmap === "function" ? createImageBitmap : null;
      const bmp = createBitmap ? await createBitmap(file) : null;
      if (bmp) {
        const w = bmp.width, h = bmp.height;
        bmp.close?.();
        return { w, h };
      }
    } catch (err) {
      console.warn('[board] createImageBitmap failed, falling back to Image:', err);
    }
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
    else if (!isTouching(rect, [...placedRects, ...pending.map(storedRectFor)])) status = "not-touching";
    setGhost({ rect, cells, status, totalWei: BigInt(cells) * BASE_FEE_PER_CELL_WEI });
  }, [pending, placed, storedRectFor]);

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

  /** Open paint editor with a blank white canvas */
  const handleCreateFromScratch = useCallback(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, 512, 512);
    }
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], "scratch.jpg", { type: "image/jpeg" });
        const el = containerRef.current;
        let pos: DropPos | undefined;
        if (el) {
          const r = el.getBoundingClientRect();
          pos = screenToWorld(r.left + r.width / 2, r.top + r.height / 2);
        }
        setDesktopPaintFile(file);
        setDesktopPaintPos(pos);
      },
      "image/jpeg",
      0.95
    );
  }, [screenToWorld]);

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
  // Adaptive grid: thicker lines at lower zoom so they remain visible
  const gridLineW = scale < 0.5 ? 2 : 1;
  const gridOpacity = Math.min(0.12, 0.07 / Math.max(scale, 0.15));
  const gridBg = useMemo(() => [
    `linear-gradient(to right, rgba(255,255,255,${gridOpacity}) ${gridLineW}px, transparent ${gridLineW}px)`,
    `linear-gradient(to bottom, rgba(255,255,255,${gridOpacity}) ${gridLineW}px, transparent ${gridLineW}px)`,
    `linear-gradient(to right, rgba(63,221,255,${gridOpacity * 0.85}) ${gridLineW}px, transparent ${gridLineW}px)`,
    `linear-gradient(to bottom, rgba(63,221,255,${gridOpacity * 0.85}) ${gridLineW}px, transparent ${gridLineW}px)`,
  ].join(", "), [gridLineW, gridOpacity]);
  const gridSizes = `${gridSize}, ${gridSize}, ${gridSize}, ${gridSize}`;

  const renderRectFor = useCallback((p: PendingItem): Rect => (activeId === p.id && liveRect) ? liveRect : p.rect, [activeId, liveRect]);

  const items = pending.map((p) => {
    const r = renderRectFor(p);
    const cellsNow = rectCells(r);
    return { ...p, rect: r, cells: cellsNow, totalWei: BigInt(cellsNow) * (BASE_FEE_PER_CELL_WEI + p.tipPerCellWei) };
  });

  // Memoize normalized placements to avoid redundant processing
  const normalizedManifestPlacements = useMemo(() => {
    if (!latestManifest?.placements) return [];
    return normalizePlacements(latestManifest.placements);
  }, [latestManifest?.placements]);

  // Load finalized placements from ManifestStore → IPFS
  useEffect(() => {
    let alive = true;
    const apply = (placements: FinalizedPlacement[], epochValue: number | null) => {
      if (!alive) return;
      setPlaced(placements);
      setPlacedEpoch(epochValue);
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
        apply(
          normalizePlacements(latest.manifest?.placements ?? []),
          typeof latest.epoch === "number" ? latest.epoch : null
        );
      } catch (e: unknown) {
        if (!alive) return;
        setPlaced([]);
        setPlacedEpoch(null);
        const parsed = parseWeb3Error(e);
        addStatus(parsed.message, "error");
      }
    };
    if (latestManifestLoading) return;
    if (latestManifestError) { void loadFallback(); return; }
    if (normalizedManifestPlacements.length > 0) {
      const epochValue = typeof latestManifestEpoch === "number"
        ? latestManifestEpoch
        : (latestManifest && typeof latestManifest.epoch === "number" ? latestManifest.epoch : null);
      if (placedEpoch != null && epochValue != null && epochValue < placedEpoch) return;
      apply(normalizedManifestPlacements, epochValue);
      latestFallbackTried.current = false;
      return;
    }
    void loadFallback();
    return () => { alive = false; };
  }, [normalizedManifestPlacements, latestManifest, latestManifestEpoch, latestManifestLoading, latestManifestError, zoomToRect, placedEpoch, addStatus]);

  // Load proposals
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const response = await listProposals();
        if (!alive) return;
        const normalized = normalizeProposals(response.proposals);
        startTransition(() => {
          setProposals(normalized);
          setProposalDebug(response.debug ?? null);
          setProposalsLoading(false);
        });
      } catch {
        if (!alive) return;
        startTransition(() => {
          setProposals([]);
          setProposalDebug(null);
          setProposalsLoading(false);
        });
      }
    };
    tick();
    // Slightly slower polling reduces render churn in this heavy route.
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
      const placedRects = placed.map((pl) => ({ x: pl.x, y: pl.y, w: pl.w, h: pl.h }));
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

      for (const it of items) {
        addStatus(`Uploading ${it.name}...`, "info");
        const onChainRect = worldToContractRect(it.rect);
        // Use the File object directly if available, otherwise fetch bytes
        const file = it.file || new File([await getPendingBytes(it)], it.name, { type: it.mime });
        const cid = await uploadImage(it.name, file, it.mime);
        if (!cid) throw new Error("IPFS upload disabled");
        setCidFor(it.id, cid);

        addStatus(`Submitting proposal for ${it.name}...`, "info");
        const normalizedCid = normalizeCidString(cid);

        const result = await swipeProposeLoreboard({
          ipfsCid: normalizedCid,
          x: onChainRect.x,
          y: onChainRect.y,
          w: onChainRect.w,
          h: onChainRect.h,
        });

        addStatus(`${it.name} proposed! Now in voting queue. (tx: ${result.txHash.slice(0, 10)}...)`, "success");
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
      setShowSubmitSuccess(true);
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

    // Add finalized placements from manifest
    placed.forEach((p) => {
      nodes.push({
        id: `placed-${p.id}`,
        x: p.x,
        y: p.y,
        width: p.w,
        height: p.h,
        content: p.cid,
        type: 'meme',
      });
    });

    // Add voting proposals
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
        });
      });

    return nodes;
  }, [placed, proposals]);

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
          placedRects={placed.map(p => ({ x: p.x, y: p.y, w: p.w, h: p.h }))}
          onClose={() => setShowMobilePropose(false)}
          onSuccess={(msg) => {
            addStatus(msg, "success");
            setShowMobilePropose(false);
            // Refresh proposals
            listProposals().then((response) => {
              startTransition(() => {
                setProposals(normalizeProposals(response.proposals));
              });
            }).catch(() => {});
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
              x: placement.x,
              y: placement.y,
              width: placement.w,
              height: placement.h,
              proposer: (placement.owner ?? "") as `0x${string}`,
              epochId: placedEpoch ?? 0,
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
    <main className="board-page relative bg-foid-bg text-white/90 overflow-hidden flex items-center justify-center" style={{ height: "100vh" }}>
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
            <div className="vista-window__body vista-window__body--flush mt-2 pray-panel__body board-body foid-iridescent">
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
                      {/* Finalized placements from manifest */}
                    {placed.map((p) => {
                      const sr = toStageRect({ x: p.x, y: p.y, w: p.w, h: p.h });
                      const isActive = activePlacement?.id === p.id;
                      return (
                        <PlacementCard
                          key={p.id}
                          placement={{ id: p.id, cid: p.cid, x: sr.x, y: sr.y, width: sr.w, height: sr.h, proposer: (p.owner ?? "") as `0x${string}`, epochId: placedEpoch ?? 0, status: "canonized" }}
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
                      {items.length > 0 && (
                        <>
                          <div className="board-actions__divider" />
                          <span className="board-actions__pending-line">ready to submit ✓</span>
                          <Y2kActionButton onClick={handleSubmitProposals} label={submittingProposals ? "PROPOSING..." : "PROPOSE (0.001 ETH)"} disabled={!items.length || submittingProposals} variant="secondary" />
                        </>
                      )}
                    </div>
                    <div className="board-actions__pricing">
                      0.001 ETH to propose &middot; 72h community voting &middot; 51% to pass
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
    {isConnected && <LoreboardNotification address={address} />}
    {desktopPaintFile && (
      <PaintEditor
        imageFile={desktopPaintFile}
        onDone={handleDesktopPaintDone}
        onCancel={handleDesktopPaintCancel}
      />
    )}

    {/* Post-submission success modal */}
    {showSubmitSuccess && (
      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center"
        style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)" }}
      >
        <div
          className="vista-window"
          style={{ maxWidth: 440, width: "90%" }}
        >
          <div className="vista-window__titlebar">
            <div className="vista-window__controls" aria-hidden="true">
              <span className="vista-window__control vista-window__control--minimize" />
              <span className="vista-window__control vista-window__control--restore" />
              <span className="vista-window__control vista-window__control--close" />
            </div>
            <span className="vista-window__title text-[11px]">proposal_submitted.exe</span>
          </div>
          <div className="vista-window__body">
            <div style={{ padding: "32px 24px", textAlign: "center" }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
              <h2 style={{
                fontSize: 20, fontWeight: 700, letterSpacing: "0.15em",
                textTransform: "uppercase", color: "#fff", marginBottom: 8,
                fontFamily: "var(--font-display)"
              }}>
                Proposal Live!
              </h2>
              <p style={{
                fontSize: 14, color: "rgba(255,255,255,0.6)", lineHeight: 1.6, marginBottom: 24
              }}>
                The community has 72 hours to vote on your submission.
                Head to Vote to help decide what makes it to the board!
              </p>
              <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
                <a
                  href="/vote"
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    padding: "10px 24px", borderRadius: 24,
                    background: "linear-gradient(135deg, rgba(168,85,247,0.4), rgba(255,107,213,0.4))",
                    border: "1px solid rgba(168,85,247,0.4)",
                    color: "#fff", fontSize: 13, fontWeight: 600,
                    letterSpacing: "0.1em", textTransform: "uppercase",
                    textDecoration: "none",
                  }}
                >
                  Go Vote →
                </a>
                <button
                  onClick={() => setShowSubmitSuccess(false)}
                  style={{
                    padding: "10px 24px", borderRadius: 24,
                    background: "rgba(255,255,255,0.08)",
                    border: "1px solid rgba(255,255,255,0.15)",
                    color: "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: 600,
                    letterSpacing: "0.1em", textTransform: "uppercase",
                    cursor: "pointer",
                  }}
                >
                  Stay Here
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )}
      <style jsx>{`
        /* Layout - more padding and spacing */
        .board-page {
          position: relative;
          background: transparent !important;
          overflow: hidden;
          padding: 0;
          width: 100%;
          z-index: 0;
          overscroll-behavior: contain;
          --board-radius-lg: 14px;
          --board-radius-md: 12px;
          --foid-bg-deepest: #030b12;
          --foid-panel: rgba(12, 28, 44, 0.58);
          --foid-panel-strong: rgba(6, 14, 28, 0.78);
          --foid-glass-highlight: rgba(255, 255, 255, 0.16);
          --foid-glass-border: rgba(116, 255, 235, 0.25);
          --foid-accent: rgba(116, 255, 235, 0.95);
          --foid-accent-soft: rgba(116, 255, 235, 0.28);
          --foid-glow: rgba(116, 255, 235, 0.2);
          --foid-text: rgba(255, 255, 255, 0.92);
          --foid-text-dim: rgba(255, 255, 255, 0.65);
          --foid-warm: rgba(255, 165, 82, 0.22);
          --board-border: 1px solid var(--foid-glass-border);
        }
        .board-window {
          min-height: 0;
        }
        .board-body {
          flex: 1 1 auto;
          min-height: 0;
          padding: clamp(12px, 1.5vw, 18px);
          display: flex;
          flex-direction: column;
        }
        .board-grid {
          flex: 1 1 auto;
          min-height: 0;
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(260px, 320px);
          gap: clamp(12px, 1.5vw, 18px);
          padding: clamp(10px, 1.5vw, 16px);
          box-sizing: border-box;
          height: 100%;
          align-items: stretch;
          grid-auto-rows: minmax(0, auto);
          background:
            linear-gradient(
              to right,
              rgba(140, 235, 255, 0.07) 1px,
              transparent 1px
            ),
            linear-gradient(
              to bottom,
              rgba(140, 235, 255, 0.07) 1px,
              transparent 1px
            ),
            linear-gradient(
              180deg,
              rgba(92, 191, 232, 0.18) 0%,
              rgba(8, 18, 30, 0.45) 55%,
              rgba(5, 10, 22, 0.8) 100%
            ),
            linear-gradient(
              180deg,
              rgba(255, 255, 255, 0.05) 0%,
              rgba(255, 255, 255, 0) 65%
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
          border: none;
          flex: 1 1 auto;
          min-height: 0;
          display: flex;
          flex-direction: column;
        }
        .board-canvas-wrap::before { display: none; }
        .board-canvas {
          position: relative;
          width: 100%;
          height: 100%;
          min-height: 0;
          flex: 1 1 auto;
          overflow: hidden;
          background:
            radial-gradient(circle at 20% 0%, rgba(255, 255, 255, 0.12), transparent 45%),
            linear-gradient(180deg, rgba(22, 70, 104, 0.72), rgba(8, 18, 34, 0.9)),
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
        @media (max-width: 1024px) {
          .board-grid {
            grid-template-columns: 1fr;
          }
          .board-sidebar {
            width: 100%;
          }
          .board-section--chat-wrapper {
            min-height: 300px;
            height: auto;
          }
          .board-actions__voting {
            max-height: 120px;
          }
          .board-sidebar__scroller {
            max-height: calc(100svh - 220px - var(--safe-bottom, 0px));
          }
        }
        @media (max-width: 640px) {
          .board-grid {
            padding: 12px;
            gap: 12px;
          }
          .board-section--chat-wrapper {
            min-height: 260px;
          }
          .board-section--chat,
          .board-section--actions,
          .board-section--music {
            padding: 12px;
          }
          .board-sidebar__scroller {
            max-height: none;
          }
          .board-actions__voting {
            max-height: 90px;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .board-hint-bottom { animation: none; }
        }
        .board-stage { position: absolute; background-blend-mode: screen; box-shadow: none; }
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
        .board-proposal--selected {
          outline-color: var(--foid-accent);
          box-shadow: 0 0 18px rgba(0,255,213,0.9), inset 0 0 12px rgba(255,255,255,0.35);
        }
        .board-proposal__badge {
          position: absolute;
          left: 10px;
          bottom: 10px;
          padding: 3px 10px;
          border-radius: 999px;
          font-size: 10px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          background: rgba(0, 0, 0, 0.55);
          border: 1px solid rgba(255, 255, 255, 0.4);
          color: var(--foid-text);
          pointer-events: none;
        }
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
          height: 100%;
          min-height: 0;
          overflow: hidden;
          padding: 14px;
          border-radius: var(--board-radius-lg);
          border: var(--board-border);
          background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0) 40%),
            linear-gradient(180deg, rgba(6, 26, 46, 0.92), rgba(2, 10, 20, 0.95)),
            linear-gradient(180deg, rgba(32, 108, 146, 0.25), rgba(4, 12, 20, 0.7)),
            var(--foid-bg-deepest);
          backdrop-filter: blur(24px) saturate(140%);
          box-shadow:
            inset 0 0 25px rgba(255, 255, 255, 0.06),
            inset 0 0 40px rgba(116, 255, 235, 0.08),
            0 20px 40px rgba(0, 0, 0, 0.45);
        }
        .board-sidebar__scroller {
          flex: 1;
          min-height: 0;
          overflow-y: auto;
          overscroll-behavior: contain;
          display: flex;
          flex-direction: column;
          gap: 14px;
          padding-right: 4px;
        }
        .board-sidebar::after {
          content: none !important;
          display: none !important;
        }
        .board-section {
          position: relative;
          border-radius: var(--board-radius-md);
          border: var(--board-border);
          background:
            linear-gradient(180deg, rgba(12, 58, 80, 0.45), rgba(8, 18, 32, 0.75)),
            linear-gradient(180deg, var(--foid-glass-highlight), rgba(255, 255, 255, 0) 40%),
            var(--foid-panel);
          backdrop-filter: blur(14px) saturate(140%);
          box-shadow:
            0 12px 28px rgba(1, 10, 20, 0.45),
            0 0 16px rgba(116, 255, 235, 0.18),
            inset 0 1px 0 rgba(255, 255, 255, 0.08),
            inset 0 -1px 0 rgba(0, 0, 0, 0.35);
          padding: 14px;
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
        .board-section--epoch {
          padding: 10px 12px;
        }
        .board-section--epoch .board-section__header {
          margin-bottom: 0;
          gap: 6px;
        }
        .board-section--debug .debug-stats {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          font-size: 10px;
          color: rgba(255, 255, 255, 0.8);
        }
        .board-section--debug .debug-stats span {
          padding: 2px 8px;
          border-radius: 6px;
          border: 1px solid rgba(255, 255, 255, 0.18);
          background: rgba(255, 255, 255, 0.04);
          font-family: var(--font-mono);
          letter-spacing: 0.06em;
        }
        .board-section--debug .debug-missing {
          margin-top: 6px;
          font-size: 10px;
          line-height: 1.3;
          color: rgba(255, 138, 255, 0.85);
          word-break: break-word;
        }
        .debug-json {
          margin-top: 8px;
          padding: 6px;
          border-radius: 8px;
          background: rgba(0, 0, 0, 0.45);
          border: 1px solid rgba(255, 255, 255, 0.08);
          font-family: var(--font-mono);
          font-size: 10px;
          max-height: 96px;
          overflow: auto;
          white-space: pre-wrap;
          line-height: 1.4;
        }
        .board-section--music {
          padding: 10px 12px;
        }
        .board-section__header--compact {
          margin-bottom: 6px;
          gap: 6px;
        }
        .board-actions__voting {
          margin-top: 12px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .board-section--chat-wrapper,
        .board-section--music-wrapper {
          flex-shrink: 0;
        }
        .board-section--chat-wrapper {
          min-height: 320px;
          flex: 1 1 60%;
          height: auto;
        }
        .board-section--chat {
          display: flex;
          flex-direction: column;
          min-height: 0;
          overflow: hidden;
          height: 100%;
        }
        .board-section--chat :global(.terminal-chat) {
          flex: 1;
          min-height: 0;
        }
        .board-section__header { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
        .board-section__chip {
          margin-left: auto;
          padding: 1px 6px;
          border-radius: 999px;
          border: 1px solid rgba(255, 210, 235, 0.45);
          background: linear-gradient(135deg, rgba(255, 210, 225, 0.25), rgba(255, 150, 195, 0.2));
          color: rgba(190, 255, 235, 0.9);
          font-size: 8px;
          letter-spacing: 0.06em;
          font-family: var(--font-mono);
          text-transform: uppercase;
          box-shadow: 0 0 6px rgba(255, 150, 190, 0.3);
          backdrop-filter: blur(12px);
        }
        .board-section__status {
          margin-left: auto;
          padding: 1px 6px;
          border-radius: 999px;
          border: 1px solid var(--foid-glass-border);
          background: rgba(0, 12, 20, 0.6);
          color: var(--foid-accent);
          font-size: 9px;
          font-family: var(--font-mono);
          letter-spacing: 0.18em;
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
        .board-section__dot { width: 7px; height: 7px; border-radius: 50%; background: var(--foid-accent); box-shadow: 0 0 6px var(--foid-glow), 0 0 12px var(--foid-accent-soft); animation: pulse 2s ease-in-out infinite; }
        .board-section__title { font-size: 10px; font-weight: 600; letter-spacing: 0.16em; color: var(--foid-accent); text-shadow: 0 0 10px var(--foid-accent-soft); opacity: 0.92; }
        .board-section__sub { margin-left: auto; font-size: 10px; color: rgba(255,255,255,0.5); letter-spacing: 0.05em; }

        .board-epoch {
          display: inline-flex;
          align-items: baseline;
          gap: 6px;
          margin-left: auto;
        }
        .board-section--epoch .board-epoch__num {
          font-size: 10px;
          font-weight: 600;
          font-family: var(--font-mono);
          letter-spacing: 0.2em;
          color: var(--foid-accent);
        }
        .board-section--epoch .board-epoch__time {
          font-size: 10px;
          font-weight: 500;
          font-family: var(--font-mono);
          letter-spacing: 0.18em;
          color: rgba(255, 255, 255, 0.65);
        }

        /* Actions */
        .board-actions__pending-line {
          font-size: 10px;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: rgba(255, 255, 255, 0.6);
        }
        .board-actions { display: flex; flex-direction: column; gap: 5px; }
        .board-actions__divider { height: 1px; background: rgba(255, 255, 255, 0.08); margin: 3px 0; }
        .board-actions__pricing { font-size: 11px; color: rgba(255, 255, 255, 0.4); text-align: center; margin-top: 8px; }
        .board-section--chat :global(.terminal-chat__input-row) {
          border-top: 1px solid rgba(116, 255, 235, 0.12);
          padding: 10px 12px;
        }
        .board-section--chat :global(.terminal-chat__input) {
          height: 36px;
          font-size: 12px;
        }
        .board-section--chat :global(.terminal-chat__send) {
          padding: 8px 14px;
          font-size: 10px;
        }

        /* Y2K Button - pink glass pill */
        :global(.y2k-btn) {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          height: 42px;
          border-radius: 7px;
          border: none;
          background: linear-gradient(135deg, #e040fb, #f06292);
          overflow: hidden;
          cursor: pointer;
          transition: transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease;
          box-shadow:
            0 18px 36px rgba(0, 10, 30, 0.28),
            0 0 32px rgba(255, 150, 190, 0.25),
            inset 0 1px 0 rgba(255, 255, 255, 0.6),
            inset 0 -8px 18px rgba(0, 0, 0, 0.22);
        }
        :global(.y2k-btn::after) {
          content: "";
          position: absolute;
          inset: 8px 0 30% 0;
          border-radius: 12px;
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.65), rgba(255, 255, 255, 0));
          opacity: 0.55;
          pointer-events: none;
        }
        :global(.y2k-btn:hover) {
          border-color: rgba(255, 255, 255, 0.9);
          box-shadow:
            0 20px 40px rgba(0, 5, 25, 0.4),
            0 0 38px rgba(255, 190, 220, 0.45),
            inset 0 1px 0 rgba(255, 255, 255, 0.92),
            inset 0 -10px 20px rgba(255, 255, 255, 0.35);
        }
        :global(.y2k-btn:focus-visible) {
          outline: 2px solid rgba(160, 255, 240, 0.85);
          outline-offset: 3px;
        }
        :global(.y2k-btn--disabled) {
          opacity: 0.55;
          cursor: not-allowed;
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.35),
            inset 0 -8px 18px rgba(0, 0, 0, 0.2);
        }
        :global(.y2k-btn--disabled:hover) {
          transform: none;
          border-color: rgba(255, 255, 255, 0.7);
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.35),
            inset 0 -8px 18px rgba(0, 0, 0, 0.2);
        }
        :global(.y2k-btn__reflection) {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 46%;
          border-radius: 14px 14px 0 0;
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.95) 0%, rgba(255, 255, 255, 0.45) 35%, transparent 100%);
          pointer-events: none;
        }
        :global(.y2k-btn__highlight) { position: absolute; inset: 0; border-radius: 14px; pointer-events: none; }
        :global(.y2k-btn__label) {
          position: relative;
          z-index: 2;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: white;
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
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
        :global(.voting-item__status) { margin-left: 0.5rem; font-size: 8px; border-radius: 999px; padding: 1px 6px; letter-spacing: 0.08em; text-transform: uppercase; color: rgba(255,255,255,0.65); border: 1px solid rgba(255,255,255,0.2); }
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
            linear-gradient(180deg, rgba(16, 36, 55, 0.92), rgba(6, 14, 24, 0.9)),
            linear-gradient(180deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0) 40%),
            var(--foid-panel-strong);
          border-radius: var(--board-radius-md);
          border: var(--board-border);
          overflow: hidden;
          font-family: var(--font-terminal);
          box-shadow:
            inset 0 2px 6px rgba(255, 255, 255, 0.08),
            0 0 20px rgba(116, 255, 235, 0.12);
        }
        :global(.terminal-chat::before) {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: inherit;
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.28) 0%, rgba(255, 255, 255, 0) 35%);
          pointer-events: none;
          opacity: 0.18;
          mix-blend-mode: screen;
          z-index: -1;
        }
        :global(.terminal-chat::after) {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: inherit;
          background-image:
            linear-gradient(rgba(255, 255, 255, 0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.04) 1px, transparent 1px);
          background-size: 100% 3px, 3px 100%;
          opacity: 0.08;
          pointer-events: none;
          mix-blend-mode: screen;
          z-index: -1;
        }
        :global(.terminal-chat__messages) { flex: 1; min-height: 0; overflow-y: auto; padding: 12px; font-size: 11px; line-height: 1.5; position: relative; z-index: 1; }
        :global(.terminal-chat__line) { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 4px; }
        :global(.terminal-chat__time) { color: rgba(255,255,255,0.35); font-size: 9px; }
        :global(.terminal-chat__user) { color: var(--foid-accent); font-weight: 600; background: var(--foid-accent-soft); padding: 1px 5px; border-radius: 2px; font-size: 9px; }
        :global(.terminal-chat__system) { color: #ffcc00; font-weight: 600; font-style: italic; font-size: 9px; }
        :global(.terminal-chat__text) { color: rgba(255,255,255,0.85); font-size: 11px; }
        :global(.terminal-chat__line--success .terminal-chat__text) { color: var(--foid-accent); }
        :global(.terminal-chat__line--error .terminal-chat__text) { color: #ff4757; }
        :global(.terminal-chat__input-row) {
          display: flex;
          align-items: center;
          padding: 10px 12px;
          gap: 8px;
          border-top: 1px solid var(--foid-accent-soft);
          background: rgba(5, 15, 26, 0.85);
          position: sticky;
          bottom: 0;
          backdrop-filter: blur(12px);
          z-index: 2;
          overflow: hidden;
        }
        :global(.terminal-chat__prompt) { color: var(--foid-accent); margin-right: 6px; font-weight: 600; font-size: 12px; text-shadow: 0 0 8px var(--foid-glow); flex-shrink: 0; }
        :global(.terminal-chat__input) { flex: 1; min-width: 0; background: rgba(11,24,38,0.55); border: 1px solid var(--foid-accent-soft); border-radius: 4px; outline: none; color: white; font-family: inherit; font-size: 11px; padding: 6px 10px; transition: border-color 0.2s, box-shadow 0.2s; }
        :global(.terminal-chat__input:focus) { border-color: var(--foid-accent); box-shadow: 0 0 10px var(--foid-glow); }
        :global(.terminal-chat__input:focus-visible) {
          outline: 2px solid var(--foid-accent);
          outline-offset: 3px;
        }
        :global(.terminal-chat__input::placeholder) { color: rgba(255,255,255,0.35); }
        :global(.terminal-chat__line--chat .terminal-chat__text) { color: #ccffd8; }
        :global(.terminal-chat__send) {
          padding: 6px 14px;
          border-radius: 6px;
          border: 1px solid var(--foid-accent-soft);
          background: var(--foid-accent-soft);
          color: var(--foid-accent);
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          cursor: pointer;
          transition: background 0.2s, box-shadow 0.2s, transform 0.2s;
          flex-shrink: 0;
          white-space: nowrap;
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

      `}</style>
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
