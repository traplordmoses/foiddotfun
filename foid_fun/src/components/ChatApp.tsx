"use client";

// CHAT.EXE — the loreboard chat as a standalone FOID OS dock app.
//
// A floating slab window bottom-right above the dock, opened from the
// dock's Chat tile. The body is the SAME TerminalChat component the /board
// sidebar renders (same Supabase table + realtime channel), so messages
// appear in both places live. Desktop-only: below 1024px the dock tile is
// hidden and mobile keeps the board sidebar chat.
//
// Deliberate non-behaviors:
// - Escape does NOT close it — it's a chat, not a modal. Close orb only.
// - Not resizable. Draggable via the titlebar (MUSIC.EXE's pointer-drag
//   pattern), position remembered in state while it stays open.

import { Component, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useAccount } from "wagmi";
import { TerminalChat, type StatusMessage } from "@/components/TerminalChat";
import { FOID_DESKTOP_ENABLED } from "@/config/desktop";
import { useChatAppStore } from "@/stores/chatAppStore";
import { floatZ, useFloatStore } from "@/stores/floatStore";
import { surfaceZ, useWindowStoreV2 } from "@/stores/windowStore";

const WINDOW_WIDTH = 360;
const WINDOW_HEIGHT = 480;
// Home anchor — bottom-right, clear of the dock pill (64px + 10px gap).
const HOME_RIGHT = 24;
const HOME_BOTTOM = 92;
// Titlebar height — the reachability unit for the drag clamps: the strip
// may touch the viewport edges but never leave them vertically.
const TITLEBAR_HEIGHT = 24;
// At least this much titlebar WIDTH stays on-screen when the window is
// shoved past a horizontal edge, so it can always be pulled back.
const DRAG_KEEP_X = 100;

/** Same job as the board page's ChatErrorBoundary: a WebSocket/chat crash
 *  must never take down the route underneath (this mounts on every route). */
class ChatWindowBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(err: Error) {
    console.warn("[ChatApp]", err.message);
  }
  render() {
    if (this.state.failed) {
      return (
        <p className="chat-app__dead foid-label">
          chat unavailable in this browser
        </p>
      );
    }
    return this.props.children;
  }
}

export default function ChatApp() {
  const open = useChatAppStore((s) => s.open);
  const close = useChatAppStore((s) => s.close);
  const { address } = useAccount();

  // Layering. On the desktop shell ("/") the floater is a surface in
  // windowStore v2's single z-order — clicking any window or floater
  // re-stacks honestly, exactly like an OS. On standalone routes the
  // legacy floatStore ladder still applies (one main window + floaters).
  const pathname = usePathname();
  const onDesktop = FOID_DESKTOP_ENABLED && pathname === "/";
  const floatFocus = useFloatStore((s) => s.focus);
  const zOrder = useWindowStoreV2((s) => s.zOrder);
  const raise = useCallback(() => {
    useFloatStore.getState().setFocus("chat");
    useWindowStoreV2.getState().raiseSurface("chat");
  }, []);
  useEffect(() => {
    if (open) raise();
    else useWindowStoreV2.getState().removeSurface("chat");
  }, [open, raise]);

  // Mount TerminalChat lazily on first open (no idle websocket on routes
  // where chat was never touched), then keep it mounted so history, the
  // realtime subscription, and scroll position survive close/reopen.
  const [everOpened, setEverOpened] = useState(false);
  if (open && !everOpened) setEverOpened(true);

  // One seed line so the window never opens onto a void (also the designed
  // empty state when Supabase env is missing — input stays gated by wallet).
  const [seedMessages] = useState<StatusMessage[]>(() => [
    {
      id: "chat-exe-boot",
      text: "CHAT.EXE online — same channel as the /board sidebar.",
      type: "system",
      timestamp: new Date(),
    },
  ]);

  // ── Titlebar drag (CompactMusicPlayer's handleBarPointerDown pattern):
  // rAF-batched transform while moving, offset committed to state on release.
  const windowRef = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState<{ x: number; y: number } | null>(null);

  const handleBarPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement;
      if (target.closest("button, input, a, select")) return;
      e.preventDefault();

      const startX = e.clientX;
      const startY = e.clientY;
      const base = offset ?? { x: 0, y: 0 };
      let live = base;
      let raf = 0;
      const el = windowRef.current;
      if (!el) return;

      // Full-screen freedom with reachability (same clamp as MUSIC.EXE):
      // measure the chassis once at grab time (live rect − base offset =
      // home geometry) and clamp so the TITLEBAR never leaves the viewport
      // vertically and ≥ DRAG_KEEP_X px of it stays visible horizontally —
      // the window can reach the top corners or hang off a side, but the
      // strip that drags it back always stays grabbable.
      const rect = el.getBoundingClientRect();
      const homeLeft = rect.left - base.x;
      const homeTop = rect.top - base.y;
      const width = rect.width;

      const onMove = (ev: PointerEvent) => {
        const minX = DRAG_KEEP_X - width - homeLeft;
        const maxX = window.innerWidth - DRAG_KEEP_X - homeLeft;
        const minY = -homeTop;
        const maxY = window.innerHeight - TITLEBAR_HEIGHT - homeTop;
        live = {
          x: Math.max(minX, Math.min(maxX, base.x + (ev.clientX - startX))),
          y: Math.max(minY, Math.min(maxY, base.y + (ev.clientY - startY))),
        };
        if (!raf) {
          raf = requestAnimationFrame(() => {
            raf = 0;
            el.style.transform = `translate(${live.x}px, ${live.y}px)`;
          });
        }
      };
      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        document.body.classList.remove("foid-window-dragging");
        setOffset(live);
      };
      document.body.classList.add("foid-window-dragging");
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [offset],
  );

  return (
    <>
      {/* z comes from floatStore: 48 focused / 46 unfocused / 1 behind the
          main window. Pointerdown-capture anywhere on the chassis claims
          focus (no preventDefault — the chat input keeps working). */}
      <div
        ref={windowRef}
        className={`chat-app foid-modal--slab ${open ? "chat-app--open" : "chat-app--closed"}`}
        role="dialog"
        aria-label="CHAT.EXE"
        aria-hidden={!open}
        style={{
          transform: offset ? `translate(${offset.x}px, ${offset.y}px)` : undefined,
          zIndex: onDesktop ? surfaceZ(zOrder, "chat") : floatZ("chat", floatFocus),
        }}
        onPointerDownCapture={raise}
      >
        {/* Titlebar — drag surface + close orb + brand (MUSIC.EXE grammar) */}
        <div className="chat-app__titlebar" onPointerDown={handleBarPointerDown} title="drag to move">
          <button
            type="button"
            className="chat-app__close vista-window__control vista-window__control--close"
            aria-label="Close CHAT.EXE"
            title="Close"
            onClick={close}
          />
          <span className="chat-app__brand">CHAT.EXE</span>
          {/* Right spacer mirrors the orb so the brand stays optically centered */}
          <span className="chat-app__spacer" aria-hidden="true" />
        </div>

        <div className="chat-app__body">
          {everOpened && (
            <ChatWindowBoundary>
              <TerminalChat
                statusMessages={seedMessages}
                enableSupabase={true}
                walletAddress={address}
              />
            </ChatWindowBoundary>
          )}
        </div>
      </div>

      <style jsx global>{`
        .chat-app {
          position: fixed;
          right: ${HOME_RIGHT}px;
          bottom: ${HOME_BOTTOM}px; /* clears the dock (64px pill + 10px gap + breath) */
          /* z-index is inline, driven by floatStore (48/46/1) — see
             src/stores/floatStore.ts for the ladder. */
          width: ${WINDOW_WIDTH}px;
          height: ${WINDOW_HEIGHT}px;
          max-height: calc(100vh - 120px);
          display: flex;
          flex-direction: column;
          border-radius: var(--foid-radius-lg);
          overflow: hidden;
          transition:
            transform 0.35s cubic-bezier(0.22, 1, 0.36, 1),
            opacity 0.3s ease;
        }
        .chat-app--closed {
          /* Slide down past the dock and let go — same exit as MUSIC.EXE.
             visibility gates interaction AND keeps its subtree out of the
             tab order while closed. */
          transform: translateY(calc(100% + 140px)) !important;
          opacity: 0;
          visibility: hidden;
          pointer-events: none;
          transition:
            transform 0.3s ease-in,
            opacity 0.3s ease-in,
            visibility 0s linear 0.3s;
        }
        /* 1:1 cursor tracking while a drag gesture is live — same rule the
           shell applies to .vista-window. Without it every rAF transform
           write rides the 0.35s open/close transition and the window
           trails the pointer like jelly. */
        :global(body.foid-window-dragging) .chat-app {
          transition: none;
        }
        /* Desktop-only — mobile keeps the board sidebar chat */
        @media (max-width: 1023px) {
          .chat-app {
            display: none !important;
          }
        }

        .chat-app__titlebar {
          display: flex;
          align-items: center;
          gap: 8px;
          height: ${TITLEBAR_HEIGHT}px;
          padding: 0 8px;
          flex-shrink: 0;
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.1), rgba(0, 0, 0, 0.18));
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          cursor: grab;
          user-select: none;
          -webkit-user-select: none;
          position: relative;
          overflow: hidden;
        }
        /* Aero shine — a soft specular sweep gliding across the titlebar,
           long idle between passes. Decorative only. */
        .chat-app__titlebar::after {
          content: "";
          position: absolute;
          top: 0;
          bottom: 0;
          left: 0;
          width: 34%;
          background: linear-gradient(
            100deg,
            transparent 0%,
            rgba(255, 255, 255, 0.16) 45%,
            rgba(160, 255, 240, 0.2) 55%,
            transparent 100%
          );
          transform: translateX(-160%) skewX(-18deg);
          animation: chat-app-shine 7s linear infinite;
          pointer-events: none;
        }
        @keyframes chat-app-shine {
          0% { transform: translateX(-160%) skewX(-18deg); }
          18% { transform: translateX(480%) skewX(-18deg); }
          100% { transform: translateX(480%) skewX(-18deg); }
        }
        @media (prefers-reduced-motion: reduce) {
          .chat-app__titlebar::after {
            animation: none;
            opacity: 0;
          }
        }
        .chat-app__close {
          position: static;
          width: 11px !important;
          height: 11px !important;
          flex-shrink: 0;
        }
        .chat-app__spacer {
          width: 11px;
          flex-shrink: 0;
        }
        .chat-app__brand {
          flex: 1;
          text-align: center;
          font-family: var(--font-terminal);
          font-size: 9px;
          letter-spacing: 0.3em;
          text-transform: uppercase;
          color: var(--foid-text-mute);
          pointer-events: none;
        }
        .chat-app__close:focus-visible {
          outline: 2px solid var(--foid-focus-ring);
          outline-offset: 2px;
        }

        .chat-app__body {
          flex: 1;
          min-height: 0;
          display: flex;
          flex-direction: column;
          padding: 8px;
        }
        /* The slab is already the window chrome — flatten the terminal's
           own card border/glow so it reads as the window's body, not a
           card-in-a-card. */
        .chat-app__body .terminal-chat {
          border-radius: calc(var(--foid-radius-lg) - 6px);
          box-shadow: inset 0 2px 6px rgba(255, 255, 255, 0.06);
        }
        .chat-app__dead {
          margin: auto;
          text-align: center;
        }
      `}</style>
    </>
  );
}
