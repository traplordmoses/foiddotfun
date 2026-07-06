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

import { Component, useCallback, useRef, useState, type ReactNode } from "react";
import { useAccount } from "wagmi";
import { TerminalChat, type StatusMessage } from "@/components/TerminalChat";
import { useChatAppStore } from "@/stores/chatAppStore";

const WINDOW_WIDTH = 360;
const WINDOW_HEIGHT = 480;
// Home anchor — bottom-right, clear of the dock pill (64px + 10px gap).
const HOME_RIGHT = 24;
const HOME_BOTTOM = 92;

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

      const onMove = (ev: PointerEvent) => {
        // Keep the window fully on-screen: home sits at right/bottom, so
        // x can go far left but only a nudge further right; y only up.
        const minX = -(window.innerWidth - WINDOW_WIDTH - HOME_RIGHT - 12);
        const minY = -(window.innerHeight - WINDOW_HEIGHT - HOME_BOTTOM - 12);
        live = {
          x: Math.max(Math.min(minX, 0), Math.min(12, base.x + (ev.clientX - startX))),
          y: Math.max(Math.min(minY, 0), Math.min(0, base.y + (ev.clientY - startY))),
        };
        if (!raf) {
          raf = requestAnimationFrame(() => {
            raf = 0;
            if (el) el.style.transform = `translate(${live.x}px, ${live.y}px)`;
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
      <div
        ref={windowRef}
        className={`chat-app foid-modal--slab ${open ? "chat-app--open" : "chat-app--closed"}`}
        role="dialog"
        aria-label="CHAT.EXE"
        aria-hidden={!open}
        style={{ transform: offset ? `translate(${offset.x}px, ${offset.y}px)` : undefined }}
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
          z-index: 50;
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
          height: 24px;
          padding: 0 8px;
          flex-shrink: 0;
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.1), rgba(0, 0, 0, 0.18));
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          cursor: grab;
          user-select: none;
          -webkit-user-select: none;
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
