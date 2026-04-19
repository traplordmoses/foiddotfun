"use client";

import React, { useEffect } from "react";
import type { Rect } from "@/lib/grid";
import { MobilePlacementPicker, type PlacedItem } from "@/components/MobilePlacementPicker";

// ============================================================================
// PREVIEW-ON-BOARD MODAL  (Phase 5 · Step 17)
//
// Wraps MobilePlacementPicker in a dimmed full-screen overlay that sits
// ABOVE the still-mounted PaintEditor. The picker itself is used as-is —
// its own "Back" / "Place Here" buttons drive the modal's two exits:
//
//   onBack    → onBackToPaint      (editor remains mounted, state intact)
//   onConfirm → onPlaceHere        (host treats the preview rect as final)
//
// A thin banner above the picker tells the user that Back returns to the
// paint editor rather than to the file picker — important because the
// picker's button copy is shared with the non-preview flow.
// ============================================================================

interface PreviewOnBoardModalProps {
  previewUrl: string;
  rect: Rect;
  imageAspectRatio?: number;
  placedRects: PlacedItem[];
  pendingRects?: Rect[];
  onRectChange: (r: Rect) => void;
  onBackToPaint: () => void;
  onPlaceHere: () => void;
}

export function PreviewOnBoardModal({
  previewUrl,
  rect,
  imageAspectRatio,
  placedRects,
  pendingRects = [],
  onRectChange,
  onBackToPaint,
  onPlaceHere,
}: PreviewOnBoardModalProps) {
  // Escape closes the preview (back-to-paint) instead of cancelling the
  // whole propose flow, matching the "escape cascade" idea used elsewhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onBackToPaint();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onBackToPaint]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Preview on board"
      // z-index sits above PaintEditor (99999) so the editor stays mounted
      // behind but is visually covered by the backdrop + panel.
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100000,
        background: "rgba(0, 0, 0, 0.72)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "max(12px, env(safe-area-inset-top)) 12px max(12px, env(safe-area-inset-bottom)) 12px",
        animation: "preview-modal-fade 200ms ease-out",
      }}
      onClick={(e) => {
        // Tap on backdrop (but not on the card) returns to paint. Matches
        // the behaviour of MobileProposeModal's outer click-to-close but
        // routes to back-to-paint because we're one level deeper.
        if (e.target === e.currentTarget) onBackToPaint();
      }}
    >
      <div
        style={{
          width: "min(92vw, 420px)",
          maxHeight: "96vh",
          display: "flex",
          flexDirection: "column",
          borderRadius: 20,
          background: "linear-gradient(135deg, rgba(20,10,40,0.96), rgba(10,5,30,0.98))",
          border: "1px solid rgba(224,64,251,0.35)",
          boxShadow:
            "0 8px 32px rgba(0,0,0,0.6), 0 0 60px rgba(224,64,251,0.22), inset 0 1px 0 rgba(255,255,255,0.05)",
          padding: 16,
          overflow: "hidden",
        }}
      >
        {/* Banner — tells the user the picker's "Back" returns to paint */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 10,
            gap: 8,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
            <span
              style={{
                fontSize: 10,
                fontFamily: "var(--font-terminal), monospace",
                letterSpacing: "0.18em",
                fontWeight: 700,
                color: "var(--foid-magenta, #e040fb)",
                textTransform: "uppercase",
              }}
            >
              Preview on board
            </span>
            <span
              style={{
                fontSize: 10,
                color: "rgba(255,255,255,0.55)",
                lineHeight: 1.35,
              }}
            >
              Size and position your meme. Back returns to paint.
            </span>
          </div>
          <button
            onClick={onBackToPaint}
            aria-label="Close preview and return to paint"
            title="Back to paint"
            style={{
              width: 32,
              height: 32,
              flexShrink: 0,
              borderRadius: 999,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(255,255,255,0.08)",
              color: "rgba(255,255,255,0.7)",
              fontSize: 18,
              lineHeight: 1,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 0,
            }}
          >
            &times;
          </button>
        </div>

        {/* Picker — used as-is. Its own Back / Place Here buttons drive the
            two modal exits, which is why we don't duplicate that logic. */}
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
          <MobilePlacementPicker
            previewUrl={previewUrl}
            rect={rect}
            imageAspectRatio={imageAspectRatio}
            placedRects={placedRects}
            pendingRects={pendingRects}
            onRectChange={onRectChange}
            onConfirm={onPlaceHere}
            onBack={onBackToPaint}
          />
        </div>
      </div>

      <style>{`
        @keyframes preview-modal-fade {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
      `}</style>
    </div>
  );
}

export default PreviewOnBoardModal;
