// src/stores/floatStore.ts
// Interim click-to-front layering for the floating dock apps (MUSIC.EXE,
// CHAT.EXE) versus the main route window. The full windowStore-v2 layering
// for the shell ships separately — this is the live-today stopgap, so it
// stays deliberately tiny: one focus value, one z ladder.
//
// Z ladder (everything lives INSIDE the .app-viewport stacking context —
// the floaters are DOM children of it, so body-level z games don't apply):
//
//   50  Dock (Tailwind z-50)             — always on top, never contested
//   48  focused floater                  — FLOAT_Z.focused
//   46  unfocused floater                — FLOAT_Z.unfocused
//    5  .vista-window (globals.css)      — the main route window
//    1  both floaters when focus==="main" — FLOAT_Z.behindMain
//
// At z 1 the floaters sit BELOW the route window but still ABOVE plain
// page wrappers (z-auto paints under any positive z), so wherever a
// floater peeks out from behind the window it keeps receiving pointer
// events — clicking that visible sliver pops it back to 48.
import { useEffect } from "react";
import { create } from "zustand";

export type FloatFocus = "main" | "music" | "chat";

type FloatStore = {
  focus: FloatFocus;
  setFocus: (focus: FloatFocus) => void;
};

export const useFloatStore = create<FloatStore>((set) => ({
  // Both floaters start closed, so the main window starts focused.
  focus: "main",
  setFocus: (focus) => set({ focus }),
}));

export const FLOAT_Z = {
  focused: 48,
  unfocused: 46,
  behindMain: 1,
} as const;

/** Resolve the z-index a floater should render at for the current focus. */
export function floatZ(self: Exclude<FloatFocus, "main">, focus: FloatFocus): number {
  if (focus === "main") return FLOAT_Z.behindMain;
  return focus === self ? FLOAT_Z.focused : FLOAT_Z.unfocused;
}

/**
 * Document-level counterpart of the floaters' own pointerdown-capture
 * handlers: any pointerdown on main-window territory refocuses "main".
 * Mounted once by ClientLayout (which also owns both floaters).
 *
 * Capture phase so page content that stopPropagation()s a pointerdown
 * can't swallow the refocus. Excluded targets:
 *  - the floaters themselves (they claim focus via their own capture
 *    handlers — exclusion makes listener ordering irrelevant), and
 *  - the dock (shell chrome: toggling an app open/closed must not first
 *    yank focus back to the main window).
 *
 * Dead-space reachability: several routes wrap their window in full-bleed
 * positioned containers (e.g. Tailwind `relative z-10 w-full`) that
 * hit-test everywhere while painting nothing — so a behind-main floater's
 * visible sliver can't receive the click that should re-raise it. When a
 * press lands OUTSIDE every .vista-window rect but INSIDE a visible
 * floater's chassis rect, the floater is what the user actually sees at
 * that point — raise it instead of refocusing "main". Chat is checked
 * before music: at equal z the later DOM sibling (chat) paints on top.
 */
export function useMainFocusListener() {
  const setFocus = useFloatStore((s) => s.setFocus);
  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target;
      if (!(target instanceof Element)) return;
      if (!target.closest(".app-viewport")) return;
      if (
        target.closest(
          '.cmp-bar-outer, .chat-app, nav[aria-label="Primary navigation"]',
        )
      ) {
        return;
      }

      const { clientX: x, clientY: y } = e;
      const hits = (el: Element | null) => {
        if (!el) return false;
        const r = el.getBoundingClientRect();
        return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
      };
      const overMainWindow = Array.from(
        document.querySelectorAll(".vista-window"),
      ).some(hits);
      if (!overMainWindow) {
        const chat = document.querySelector(".chat-app--open");
        if (hits(chat)) {
          setFocus("chat");
          return;
        }
        const music = document.querySelector(
          ".cmp-bar-outer--visible .cmp-bar, .cmp-bar-outer--visible .cmp-pebble",
        );
        if (hits(music)) {
          setFocus("music");
          return;
        }
      }
      setFocus("main");
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [setFocus]);
}
