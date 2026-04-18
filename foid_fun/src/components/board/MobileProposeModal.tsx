"use client";

import React, { useRef, useState, useEffect, useMemo, useCallback } from "react";
import { TILE, snapRect, hasOverlap, isTouching, type Rect } from "@/lib/grid";
import { sniffImageType, mimeFromType } from "@/lib/image";
import { convertToJpeg } from "@/lib/imageConvert";
import { uploadImage } from "@/lib/ipfs";
import { useSwipePropose } from "@/hooks/useSwipePropose";
import { worldToContractRect, contractToWorldRect } from "@/lib/boardSpace";
import { capRectToMaxCells, MAX_CELLS_PER_RECT } from "@/lib/boardImages";
import { parseWeb3Error, isUserRejection } from "@/lib/errors";
import { PaintEditor } from "@/components/PaintEditor";
import { MobilePlacementPicker, type PlacedItem } from "@/components/MobilePlacementPicker";
import { normalizeCidString } from "@/lib/board/helpers";

// ============================================================================
// HELPERS
// ============================================================================

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
// MOBILE PROPOSE MODAL
// ============================================================================

export function MobileProposeModal({
  isConnected,
  address,
  placedRects,
  onClose,
  onSuccess,
}: {
  isConnected: boolean;
  address?: string;
  placedRects: PlacedItem[];
  onClose: () => void;
  onSuccess: (msg: string) => void;
}) {
  const { propose: proposeLoreboard } = useSwipePropose();

  // Fetch active voting proposals with grid coordinates from the API
  const [pendingVoteRects, setPendingVoteRects] = useState<Rect[]>([]);
  useEffect(() => {
    let alive = true;
    fetch("/api/swipe/proposals")
      .then(r => r.ok ? r.json() : { proposals: [] })
      .then(data => {
        if (!alive) return;
        const now = Math.floor(Date.now() / 1000);
        const rects = (data.proposals ?? [])
          .filter((p: { finalized: boolean; approved: boolean; votingEndsAt: number; gridW?: number }) =>
            !p.finalized && !p.approved && p.votingEndsAt > now && (p.gridW ?? 0) > 0
          )
          .map((p: { gridX: number; gridY: number; gridW: number; gridH: number }) =>
            contractToWorldRect({ x: p.gridX, y: p.gridY, w: p.gridW, h: p.gridH })
          );
        setPendingVoteRects(rects);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  // Include pending vote rects in overlap checks
  const allOccupiedRects = useMemo(() => [...placedRects, ...pendingVoteRects], [placedRects, pendingVoteRects]);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [step, setStep] = useState<"pick" | "paint" | "position" | "uploading" | "submitting" | "done" | "error">("pick");
  const [errorMsg, setErrorMsg] = useState("");
  const [placementRect, setPlacementRect] = useState<Rect | null>(null);
  const [imageAspectRatio, setImageAspectRatio] = useState<number | undefined>(undefined);
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

    try {
      const { w, h } = await getImageSizeFromFile(editedFile);
      setImageAspectRatio(w / h);
      let rect = snapRect({ x: 0, y: 0, w, h });
      rect = capRectToMaxCells(rect, MAX_CELLS_PER_RECT);
      setPlacementRect(rect);
      setStep("position");
    } catch {
      setImageAspectRatio(undefined);
      setPlacementRect(snapRect({ x: 0, y: 0, w: TILE, h: TILE }));
      setStep("position");
    }
  };

  const handleSubmit = async () => {
    if (!file || !address || !isConnected || !placementRect) return;

    if (hasOverlap(placementRect, allOccupiedRects)) {
      setErrorMsg("Placement overlaps an existing or pending meme");
      setStep("error");
      return;
    }
    if (!isTouching(placementRect, allOccupiedRects)) {
      setErrorMsg("Placement must touch an existing meme on the board");
      setStep("error");
      return;
    }

    try {
      setStep("uploading");

      const kind = await sniffImageType(file);
      const mime = kind ? mimeFromType(kind) : null;
      if (!mime) throw new Error("Only PNG or JPG images allowed");

      const cid = await uploadImage(file.name, file, mime as "image/png" | "image/jpeg");
      if (!cid) throw new Error("IPFS upload disabled — configure PINATA_JWT");

      setStep("submitting");

      const contractRect = worldToContractRect(placementRect);
      const normalizedCid = normalizeCidString(cid);
      await proposeLoreboard({
        ipfsCid: normalizedCid,
        x: contractRect.x,
        y: contractRect.y,
        w: contractRect.w,
        h: contractRect.h,
      });

      setStep("done");
      onSuccess(`Meme placed on board! (${file.name})`);
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
        {step !== "uploading" && step !== "submitting" && (
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full"
            style={{ background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)" }}
          >
            x
          </button>
        )}

        <h2 className="text-sm font-bold tracking-widest uppercase mb-4" style={{ color: "var(--foid-magenta)" }}>
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
            imageAspectRatio={imageAspectRatio}
            placedRects={placedRects}
            pendingRects={pendingVoteRects}
            onRectChange={setPlacementRect}
            onConfirm={handleSubmit}
            onBack={() => setStep("pick")}
          />
        )}

        {(step === "uploading" || step === "submitting") && (
          <div className="py-8 flex flex-col items-center gap-4">
            <div className="w-10 h-10 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "var(--foid-magenta)", borderTopColor: "transparent" }} />
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
