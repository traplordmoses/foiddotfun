"use client";

// src/hooks/os/useWindowActivity.ts
// The shell-activity contract for extracted apps (multi-window plan §3/§5):
// a store-shaped version of WinBox's focus/blur callbacks, extended with
// the dock-parking state.
//
//   focused   — this app may own window-level keyboard shortcuts and other
//               "the user is HERE" behaviors. True when the app is the
//               foreground shell window, and ALWAYS true in the standalone
//               route presentation (the app is the only window on the page).
//   minimized — the window is genie'd into the dock: invisible,
//               pointer-events off, but still mounted (state preserved).
//               Apps use this to pause background work that only exists to
//               keep the VISIBLE canvas fresh — polling loops, presence
//               broadcasting, cosmetic intervals. Realtime SUBSCRIPTIONS
//               should stay alive (they're cheap and make restore instant);
//               it's the outbound/heavyweight work that pauses. Always
//               false in the route presentation.
//
// This supersedes useOSWindowFocused() for apps that need both bits;
// the focused semantics are identical.
import { useContext } from "react";
import { OSWindowAppIdContext } from "@/components/os/windowContext";
import { focusedAppId, useWindowStoreV2 } from "@/stores/windowStore";

export type WindowActivity = {
  focused: boolean;
  minimized: boolean;
};

export function useWindowActivity(): WindowActivity {
  const appId = useContext(OSWindowAppIdContext);
  const focused = useWindowStoreV2((s) =>
    appId ? focusedAppId(s) === appId : true,
  );
  const minimized = useWindowStoreV2((s) =>
    appId ? s.windows[appId]?.status === "minimized" : false,
  );
  return { focused, minimized };
}
