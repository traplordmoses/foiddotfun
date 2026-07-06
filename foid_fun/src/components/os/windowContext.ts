"use client";

// src/components/os/windowContext.ts
// Which shell window (if any) an app instance is mounted in.
//
// <OSWindow> provides its appId here; extracted apps consume it to gate
// window-level keyboard listeners on focus, so two open windows never
// fight over global keys (the plan's useWindowActivity contract, §3 —
// this is the minimal Stage-B slice of it). Kept in its own module so
// apps don't pull the whole window chrome into their chunk.
import { createContext, useContext } from "react";
import {
  focusedAppId,
  useWindowStoreV2,
  type AppId,
} from "@/stores/windowStore";

/** null = standalone route presentation (the app is the only window). */
export const OSWindowAppIdContext = createContext<AppId | null>(null);

/** True when this app may own window-level keyboard shortcuts:
 *  always in the route presentation; only while foreground in the shell. */
export function useOSWindowFocused(): boolean {
  const appId = useContext(OSWindowAppIdContext);
  return useWindowStoreV2((s) => (appId ? focusedAppId(s) === appId : true));
}
