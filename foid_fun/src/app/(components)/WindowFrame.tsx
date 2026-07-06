// src/app/(components)/WindowFrame.tsx
// FOID OS window controller — makes the .exe window real. Renders the
// traffic-light controls (now actual buttons) and wires the whole frame:
//
//   minimize → window genies down toward the dock, wallpaper remains;
//              restore from the dock (or the titlebar of the next visit)
//   maximize → fills the viewport above the dock; click again to restore
//   drag     → grab any empty titlebar area and move the window
//   resize   → grab the bottom-right corner handle (desktop only)
//
// Mounted inside AppTitlebar, which lives inside every .vista-window, so
// it finds its frame via closest() and drives it with direct style writes
// (rAF-coalesced during gestures — same approach as the board's pan/zoom).
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { useWindowStore } from "@/stores/windowStore";

const MIN_W = 480;
const MIN_H = 360;

export function WindowControls() {
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const winRef = useRef<HTMLElement | null>(null);
  // State copy of the frame element so the resize-handle portal mounts
  // once the frame is located (a ref alone wouldn't re-render).
  const [winEl, setWinEl] = useState<HTMLElement | null>(null);
  const pathname = usePathname();

  const minimized = useWindowStore((s) => s.minimized);
  const maximized = useWindowStore((s) => s.maximized);
  const pos = useWindowStore((s) => s.pos);
  const size = useWindowStore((s) => s.size);
  const minimize = useWindowStore((s) => s.minimize);
  const toggleMaximize = useWindowStore((s) => s.toggleMaximize);
  const setPos = useWindowStore((s) => s.setPos);
  const setSize = useWindowStore((s) => s.setSize);
  const resetForRoute = useWindowStore((s) => s.resetForRoute);

  // Locate the owning window frame once mounted.
  useEffect(() => {
    const el = (anchorRef.current?.closest(".vista-window") as HTMLElement) ?? null;
    winRef.current = el;
    setWinEl(el);
  }, []);

  // Fresh window per route: clear state and any inline styles we wrote.
  useEffect(() => {
    resetForRoute();
    return () => {
      const el = winRef.current;
      if (!el) return;
      el.style.transform = "";
      el.style.opacity = "";
      el.style.width = "";
      el.style.height = "";
      el.style.maxWidth = "";
      el.style.transformOrigin = "";
      el.style.pointerEvents = "";
      el.classList.remove("foid-window--maximized", "foid-window--minimized");
    };
  }, [pathname, resetForRoute]);

  // Apply store state to the frame. Transform carries drag + minimize;
  // width/height carry resize; maximize is class-driven (CSS owns the
  // fixed-inset layout so the dock clearance stays in one place).
  useEffect(() => {
    const el = winRef.current;
    if (!el) return;

    el.classList.toggle("foid-window--maximized", maximized && !minimized);
    el.classList.toggle("foid-window--minimized", minimized);

    if (minimized) {
      const rect = el.getBoundingClientRect();
      const drop = window.innerHeight - rect.top;
      el.style.transformOrigin = "bottom center";
      el.style.transform = `translate(${pos.x}px, ${drop}px) scale(0.06)`;
      el.style.opacity = "0";
      el.style.pointerEvents = "none";
      return;
    }

    el.style.pointerEvents = "";
    el.style.opacity = "";
    el.style.transformOrigin = "";

    if (maximized) {
      // CSS class owns geometry; clear anything we set inline.
      el.style.transform = "";
      el.style.width = "";
      el.style.height = "";
      el.style.maxWidth = "";
      return;
    }

    el.style.transform =
      pos.x || pos.y ? `translate(${pos.x}px, ${pos.y}px)` : "";
    if (size) {
      el.style.width = `${size.w}px`;
      el.style.height = `${size.h}px`;
      el.style.maxWidth = "none";
    } else {
      el.style.width = "";
      el.style.height = "";
      el.style.maxWidth = "";
    }
  }, [minimized, maximized, pos, size]);

  // ── Titlebar drag ──────────────────────────────────────────────────────
  // Attach to the titlebar row (our parent). Ignore presses on anything
  // interactive so buttons, the wallet pill, and menus keep working.
  useEffect(() => {
    const row = anchorRef.current?.closest(".app-titlebar__row") as HTMLElement | null;
    if (!row) return;

    let startX = 0;
    let startY = 0;
    let baseX = 0;
    let baseY = 0;
    let live = { x: 0, y: 0 };
    let raf = 0;
    let dragging = false;

    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      live = { x: baseX + (e.clientX - startX), y: baseY + (e.clientY - startY) };
      if (!raf) {
        raf = requestAnimationFrame(() => {
          raf = 0;
          const el = winRef.current;
          if (el) el.style.transform = `translate(${live.x}px, ${live.y}px)`;
        });
      }
    };

    const onUp = () => {
      if (!dragging) return;
      dragging = false;
      document.body.classList.remove("foid-window-dragging");
      useWindowStore.getState().setPos(live);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };

    const onDown = (e: PointerEvent) => {
      const state = useWindowStore.getState();
      if (state.maximized || state.minimized) return;
      if (window.innerWidth < 1024) return; // mobile: windows don't float
      const target = e.target as HTMLElement;
      if (target.closest("button, a, input, select, [role='menu'], [role='menuitem'], .app-titlebar__right")) return;
      dragging = true;
      startX = e.clientX;
      startY = e.clientY;
      baseX = state.pos.x;
      baseY = state.pos.y;
      live = { x: baseX, y: baseY };
      document.body.classList.add("foid-window-dragging");
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      e.preventDefault();
    };

    row.addEventListener("pointerdown", onDown);
    row.classList.add("app-titlebar__row--draggable");
    return () => {
      row.removeEventListener("pointerdown", onDown);
      row.classList.remove("app-titlebar__row--draggable");
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, []);

  // ── Resize: right edge (ew), bottom edge (ns), corner (nwse) ──────────
  type ResizeMode = "e" | "s" | "se";
  const startResize = useCallback((mode: ResizeMode) => (e: React.PointerEvent<HTMLDivElement>) => {
    const el = winRef.current;
    const state = useWindowStore.getState();
    if (!el || state.maximized || state.minimized) return;
    e.preventDefault();
    e.stopPropagation();

    const startX = e.clientX;
    const startY = e.clientY;
    const rect = el.getBoundingClientRect();
    const baseW = state.size?.w ?? rect.width;
    const baseH = state.size?.h ?? rect.height;
    let live = { w: baseW, h: baseH };
    let raf = 0;

    const cursor = mode === "e" ? "ew-resize" : mode === "s" ? "ns-resize" : "nwse-resize";
    document.body.style.cursor = cursor;

    const onMove = (ev: PointerEvent) => {
      live = {
        w: mode === "s" ? baseW : Math.max(MIN_W, baseW + (ev.clientX - startX)),
        h: mode === "e" ? baseH : Math.max(MIN_H, baseH + (ev.clientY - startY)),
      };
      if (!raf) {
        raf = requestAnimationFrame(() => {
          raf = 0;
          el.style.width = `${live.w}px`;
          el.style.height = `${live.h}px`;
          el.style.maxWidth = "none";
          el.style.maxHeight = "none";
        });
      }
    };
    const onUp = () => {
      // Hand max-height control back to the stylesheet (dock clearance).
      el.style.maxHeight = "";
      document.body.style.cursor = "";
      useWindowStore.getState().setSize(live);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      document.body.classList.remove("foid-window-dragging");
    };
    document.body.classList.add("foid-window-dragging");
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }, []);

  return (
    <div className="vista-window__controls" ref={anchorRef}>
      <button
        type="button"
        className="vista-window__control vista-window__control--minimize"
        aria-label="Minimize window to dock"
        title="Minimize"
        onClick={minimize}
      />
      <button
        type="button"
        className="vista-window__control vista-window__control--restore"
        aria-label={maximized ? "Restore window size" : "Maximize window"}
        title={maximized ? "Restore" : "Maximize"}
        onClick={toggleMaximize}
      />
      <button
        type="button"
        className="vista-window__control vista-window__control--close"
        aria-label="Close window to dock"
        title="Close (returns to dock)"
        onClick={minimize}
      />
      {winEl && !maximized && !minimized
        ? createPortal(
            <>
              <div
                className="foid-window-edge foid-window-edge--e"
                role="presentation"
                aria-hidden="true"
                onPointerDown={startResize("e")}
              />
              <div
                className="foid-window-edge foid-window-edge--s"
                role="presentation"
                aria-hidden="true"
                onPointerDown={startResize("s")}
              />
              <div
                className="foid-window-resize"
                role="presentation"
                aria-hidden="true"
                onPointerDown={startResize("se")}
              />
            </>,
            winEl,
          )
        : null}
    </div>
  );
}
