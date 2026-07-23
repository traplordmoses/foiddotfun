// src/components/os/OSWindow.tsx
// FOID OS window chrome for the multi-window desktop shell (Stage A).
//
// One <OSWindow appId …> per open app: the same .vista-window glass frame
// and AppTitlebar the route pages render, but driven by windowStore v2
// instead of the per-route singleton:
//
//   red orb    → CLOSE (removes the window; app state is discarded)
//   amber orb  → minimize (genie to the dock; dock tile shows the dot)
//   green orb  → maximize (fills the viewport above the dock)
//   titlebar   → drag; right/bottom edges + corner → resize
//   pointerdown anywhere → focus (zOrder tail → z-index; DOM order stable)
//
// Geometry is applied imperatively (rAF-coalesced direct style writes
// during gestures, layout-effect writes from store state) — the identical
// technique WindowFrame.tsx uses for the single-route window, ported to
// per-app state. React's style prop only carries z-index, so re-renders
// never fight the gesture writes.
"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useAccount, useDisconnect } from "wagmi";
import AppTitlebar from "@/app/(components)/AppTitlebar";
import { useSwitchWallet } from "@/hooks/useSwitchWallet";
import { OSWindowAppIdContext } from "@/components/os/windowContext";
import {
  focusedAppId,
  useWindowStoreV2,
  WINDOW_Z_BASE,
  type AppId,
} from "@/stores/windowStore";

const MIN_W = 480;
const MIN_H = 360;

export type OSWindowProps = {
  appId: AppId;
  title: string;
  /** Registry default when the user hasn't resized (the h-[94vh] role). */
  defaultSize: { w: number; h: number };
  /** Per-app resize floor; the global MIN_W/MIN_H guard applies when unset
   *  (e.g. VOTE's card column needs more height than the Finder apps). */
  minSize?: { w: number; h: number };
  /** Extra class(es) on the frame — e.g. "mifoid-page" so the app's
   *  window-width reflow rules (globals.css @container blocks keyed off the
   *  route's page class) apply inside the shell too. */
  frameClassName?: string;
  children: React.ReactNode;
};

/** Traffic lights, store-v2 flavor. Same material classes as the legacy
 *  WindowControls; the semantics follow the founder decisions — red really
 *  closes, amber parks in the dock. */
function OSWindowControls({ appId }: { appId: AppId }) {
  const maximized = useWindowStoreV2(
    (s) => s.windows[appId]?.maximized ?? false,
  );
  const close = useWindowStoreV2((s) => s.close);
  const minimize = useWindowStoreV2((s) => s.minimize);
  const toggleMaximize = useWindowStoreV2((s) => s.toggleMaximize);

  return (
    // macOS order: red close · amber minimize · green zoom. DOM order
    // matches visual order so keyboard Tab walks left → right.
    <div className="vista-window__controls">
      <button
        type="button"
        className="vista-window__control vista-window__control--close"
        aria-label="Close window"
        title="Close"
        onClick={() => close(appId)}
      />
      <button
        type="button"
        className="vista-window__control vista-window__control--minimize"
        aria-label="Minimize window to dock"
        title="Minimize"
        onClick={() => minimize(appId)}
      />
      <button
        type="button"
        className="vista-window__control vista-window__control--restore"
        aria-label={maximized ? "Restore window size" : "Maximize window"}
        title={maximized ? "Restore" : "Maximize"}
        onClick={() => toggleMaximize(appId)}
      />
    </div>
  );
}

export default function OSWindow({
  appId,
  title,
  defaultSize,
  minSize,
  frameClassName,
  children,
}: OSWindowProps) {
  const frameRef = useRef<HTMLElement | null>(null);
  // True while a drag or resize gesture owns the frame's geometry. The
  // store-state effect below must NOT write left/top/width/height (or clear
  // the transient drag transform) mid-gesture: pointerdown focus() creates a
  // fresh win object, and re-applying the OLD committed geometry while the
  // transform carries the live delta reads as the window snapping back to
  // its pre-drag spot. Gestures always end in a setPos/setSize commit, so
  // the skipped effect re-runs with final values on release.
  const draggingRef = useRef(false);
  // Minimize/restore choreography state: whether the previous render was
  // minimized (restore should animate) and whether this frame has ever
  // painted (a persisted-minimized window must land hidden, not replay
  // the genie on mount).
  const prevStatusRef = useRef<"open" | "minimized" | null>(null);
  const hasAnimatedRef = useRef(false);
  // Restore-in-flight flag. Rendered into className (NOT classList) because
  // React reassigns className whenever the focused/blurred computation
  // changes, wiping any manually-added class mid-animation. It stays true
  // until the next minimize — reverting the `animation` shorthand to the
  // base foid-window-open would replay the open pop.
  const [restoring, setRestoring] = useState(false);

  const win = useWindowStoreV2((s) => s.windows[appId]);
  const stackIndex = useWindowStoreV2((s) => s.zOrder.indexOf(appId));
  const focused = useWindowStoreV2((s) => focusedAppId(s) === appId);

  // Shell windows own their titlebar wallet wiring (no per-page prop
  // drilling). The shell tree is client-only (dynamic ssr:false), so no
  // hydration mounted-guard is needed here.
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { switchWallet } = useSwitchWallet();

  // ── Store state → frame styles ────────────────────────────────────────
  // Layout effect so spawn position/size land before first paint. Transform
  // carries the genie minimize (and transient drag deltas); left/top carry
  // committed position; width/height carry resize; maximize is class-driven
  // (CSS owns the fixed-inset layout so dock clearance stays in one place).
  useLayoutEffect(() => {
    const el = frameRef.current;
    if (!el || !win) return;
    // A live gesture owns geometry — never fight it (see draggingRef).
    if (draggingRef.current) return;
    const minimized = win.status === "minimized";
    const wasMinimized = prevStatusRef.current === "minimized";
    prevStatusRef.current = win.status;

    if (minimized) {
      if (!wasMinimized) {
        // Genie to this app's own dock tile: measure both rects live and
        // hand the vector to CSS as custom properties — the keyframes
        // (globals.css foid-genie-out/-in) do the pouring. Runs pre-paint
        // (layout effect), so the values land before the animation's first
        // rendered frame.
        const rect = el.getBoundingClientRect();
        const tile = document.querySelector<HTMLElement>(
          `[data-dock-app="${appId}"]`,
        );
        const t = tile?.getBoundingClientRect();
        const targetX = t ? t.left + t.width / 2 : window.innerWidth / 2;
        const targetY = t ? t.top + t.height / 2 : window.innerHeight - 44;
        const s = Math.max(
          0.03,
          Math.min(56 / rect.width, 44 / rect.height),
        );
        el.style.setProperty(
          "--genie-x",
          `${targetX - rect.left - (rect.width * s) / 2}px`,
        );
        el.style.setProperty(
          "--genie-y",
          `${targetY - rect.top - (rect.height * s) / 2}px`,
        );
        el.style.setProperty("--genie-s", `${s}`);
        setRestoring(false);
      }
      // First mount already minimized (persisted layout): skip the theater,
      // land on the final frame.
      if (!wasMinimized && !hasAnimatedRef.current) {
        el.style.animationDuration = "0.001s";
      } else if (!wasMinimized) {
        el.style.animationDuration = "";
      }
      hasAnimatedRef.current = true;
      return;
    }

    if (wasMinimized) {
      // Restore: reverse the genie from the same dock vector. The flag
      // stays set after the animation finishes — swapping the `animation`
      // shorthand back to the base foid-window-open would replay the
      // window-open pop. The next minimize clears it.
      el.style.animationDuration = "";
      setRestoring(true);
    }
    hasAnimatedRef.current = true;

    el.style.pointerEvents = "";
    el.style.opacity = "";
    el.style.transformOrigin = "";
    el.style.transform = "";

    if (win.maximized) {
      // CSS class owns geometry; clear anything we set inline.
      el.style.left = "";
      el.style.top = "";
      el.style.width = "";
      el.style.height = "";
      el.style.maxWidth = "";
      return;
    }

    el.style.left = `${win.pos.x}px`;
    el.style.top = `${win.pos.y}px`;
    // Defensive viewport clamp: geometry stored at a larger viewport must
    // not overflow after the browser window shrinks — and the clamp must
    // account for the window's own origin, or a cascade-offset window
    // still sticks out past the right/bottom edge. (The stylesheet's
    // dock-clearance max-height still applies on top of this.)
    const w = win.size?.w ?? defaultSize.w;
    const h = win.size?.h ?? defaultSize.h;
    const maxW = Math.max(MIN_W, window.innerWidth - Math.max(0, win.pos.x) - 16);
    const maxH = Math.max(MIN_H, window.innerHeight - Math.max(0, win.pos.y) - 104);
    el.style.width = `${Math.min(w, maxW)}px`;
    el.style.height = `${Math.min(h, maxH)}px`;
    el.style.maxWidth = "none";
  }, [win, defaultSize.w, defaultSize.h]);

  // ── Focus: pointerdown anywhere in the frame brings it to front ───────
  // Capture phase so children that stopPropagation (resize handles, app
  // internals) can't swallow the raise. focus() no-ops when already on top.
  const handleFocusDown = useCallback(() => {
    useWindowStoreV2.getState().focus(appId);
  }, [appId]);

  // ── Titlebar drag ──────────────────────────────────────────────────────
  // Attach to the AppTitlebar row inside this frame. Ignore presses on
  // anything interactive so the orbs, wallet pill, and menus keep working.
  // Clamp keeps the window reachable: ≥120px stays inside the viewport
  // horizontally, the titlebar can never cross the top edge, and it can't
  // sink below the dock line. (Ported from WindowFrame.tsx.)
  useEffect(() => {
    const frame = frameRef.current;
    const row = frame?.querySelector<HTMLElement>(".app-titlebar__row");
    if (!frame || !row) return;

    let startX = 0;
    let startY = 0;
    let baseX = 0;
    let baseY = 0;
    let live = { x: 0, y: 0 };
    let raf = 0;
    let dragging = false;

    // Committed (untransformed) frame origin at drag start, so the clamp
    // math is stable while the transient transform changes under us.
    let naturalLeft = 0;
    let naturalTop = 0;
    let winW = MIN_W;

    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      const rawX = baseX + (e.clientX - startX);
      const rawY = baseY + (e.clientY - startY);
      live = {
        x: Math.max(
          -(winW - 120) - naturalLeft,
          Math.min(window.innerWidth - 120 - naturalLeft, rawX),
        ),
        y: Math.max(
          -naturalTop,
          Math.min(window.innerHeight - 160 - naturalTop, rawY),
        ),
      };
      if (!raf) {
        raf = requestAnimationFrame(() => {
          raf = 0;
          // left/top hold the committed pos; the delta rides on transform
          // (composite-only) for 60fps tracking, then commits on release.
          frame.style.transform = `translate(${live.x - baseX}px, ${live.y - baseY}px)`;
        });
      }
    };

    const onUp = () => {
      if (!dragging) return;
      dragging = false;
      // A queued rAF firing after release would re-apply a stale transform
      // on top of the committed left/top — cancel it first.
      if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
      // Settle geometry while transitions are still suppressed: left/top
      // take the committed position and the transient transform clears in
      // the same style flush. The forced reflow makes the browser COMMIT
      // those values with the body's dragging class still on (transition:
      // none) — without it, the single recalc happens after the class is
      // removed, and the base .vista-window transform transition (the genie)
      // animates translate(Δ)→none: the window lands past the drop point by
      // the drag delta and eases back — the live-site "snap-back".
      frame.style.transform = "";
      frame.style.left = `${live.x}px`;
      frame.style.top = `${live.y}px`;
      void frame.offsetWidth; // flush styles inside the no-transition window
      document.body.classList.remove("foid-window-dragging");
      draggingRef.current = false; // before setPos: the commit must apply
      useWindowStoreV2.getState().setPos(appId, live);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };

    const onDown = (e: PointerEvent) => {
      const state = useWindowStoreV2.getState().windows[appId];
      if (!state || state.maximized || state.status === "minimized") return;
      if (window.innerWidth < 1024) return; // mobile: windows don't float
      const target = e.target as HTMLElement;
      if (
        target.closest(
          "button, a, input, select, [role='menu'], [role='menuitem'], .app-titlebar__right",
        )
      )
        return;
      dragging = true;
      draggingRef.current = true;
      startX = e.clientX;
      startY = e.clientY;
      baseX = state.pos.x;
      baseY = state.pos.y;
      live = { x: baseX, y: baseY };
      const rect = frame.getBoundingClientRect();
      naturalLeft = rect.left - baseX;
      naturalTop = rect.top - baseY;
      winW = rect.width;
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
      // Unmounted mid-drag (e.g. the window was closed): release the
      // global gesture state we own.
      if (dragging) {
        dragging = false;
        draggingRef.current = false;
        document.body.classList.remove("foid-window-dragging");
      }
    };
  }, [appId]);

  // ── Resize: right edge (ew), bottom edge (ns), corner (nwse) ──────────
  // Growth caps ported from WindowFrame: the left/top edge stays put, so
  // max size = space between that edge and the viewport edge (16px margin,
  // 100px above the dock line).
  type ResizeMode = "e" | "s" | "se";
  const startResize = useCallback(
    (mode: ResizeMode) => (e: React.PointerEvent<HTMLDivElement>) => {
      const el = frameRef.current;
      const state = useWindowStoreV2.getState().windows[appId];
      if (!el || !state || state.maximized || state.status === "minimized")
        return;
      e.preventDefault();
      e.stopPropagation();

      const startX = e.clientX;
      const startY = e.clientY;
      const rect = el.getBoundingClientRect();
      const baseW = state.size?.w ?? rect.width;
      const baseH = state.size?.h ?? rect.height;
      let live = { w: baseW, h: baseH };
      let raf = 0;

      const cursor =
        mode === "e" ? "ew-resize" : mode === "s" ? "ns-resize" : "nwse-resize";
      document.body.style.cursor = cursor;

      const maxW = window.innerWidth - rect.left - 16;
      const maxH = window.innerHeight - rect.top - 100; // stay above the dock
      const minW = minSize?.w ?? MIN_W;
      const minH = minSize?.h ?? MIN_H;
      const onMove = (ev: PointerEvent) => {
        live = {
          w:
            mode === "s"
              ? baseW
              : Math.min(maxW, Math.max(minW, baseW + (ev.clientX - startX))),
          h:
            mode === "e"
              ? baseH
              : Math.min(maxH, Math.max(minH, baseH + (ev.clientY - startY))),
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
        if (raf) {
          cancelAnimationFrame(raf);
          raf = 0;
        }
        // Hand max-height control back to the stylesheet (dock clearance).
        el.style.maxHeight = "";
        document.body.style.cursor = "";
        document.body.classList.remove("foid-window-dragging");
        draggingRef.current = false; // before setSize: the commit must apply
        useWindowStoreV2.getState().setSize(appId, live);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
      draggingRef.current = true; // same guard as drag: focus() re-renders
      document.body.classList.add("foid-window-dragging");
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    // minSize comes from the module-const app registry — stable identity.
    [appId, minSize],
  );

  if (!win) return null;
  const interactive = win.status === "open" && !win.maximized;

  return (
    <section
      ref={frameRef}
      className={`vista-window vista-window--terminal vista-window--enhanced os-window${
        focused ? "" : " foid-window--blurred"
      }${win.maximized && win.status === "open" ? " foid-window--maximized" : ""}${
        win.status === "minimized" ? " foid-window--minimized" : ""
      }${restoring && win.status === "open" ? " foid-window--restoring" : ""}${
        frameClassName ? ` ${frameClassName}` : ""
      }`}
      style={{ zIndex: WINDOW_Z_BASE + Math.max(0, stackIndex) }}
      aria-label={title}
      onPointerDownCapture={handleFocusDown}
    >
      <AppTitlebar
        title={title}
        connected={isConnected}
        address={address}
        onDisconnect={() => disconnect()}
        onSwitchWallet={switchWallet}
        controls={<OSWindowControls appId={appId} />}
      />
      {/* Apps read their host window's id to gate global keyboard listeners
          on focus (windowContext.ts) — route presentations get null. */}
      <OSWindowAppIdContext.Provider value={appId}>
        {children}
      </OSWindowAppIdContext.Provider>
      {interactive ? (
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
        </>
      ) : null}
    </section>
  );
}
