// src/components/os/Desktop.tsx
// FOID OS desktop shell (Stage A, flag: NEXT_PUBLIC_FOID_DESKTOP).
//
// Rendered by the home route when the flag is on: the wallpaper stack in
// the root layout (AnimatedBackground, FloatingElements, scene-tint,
// SkyTint) IS the desktop; this component only contributes the window
// layer. Open windows come from windowStore v2; apps lazy-load via
// next/dynamic so a fresh desktop costs nothing until a dock tile is
// clicked.
//
// Stacking contract: windows mount in openedAt order and NEVER reorder in
// the DOM — focus changes only flip the z-index each OSWindow derives from
// the store's zOrder. (Reordering DOM on focus would reset in-window
// scroll/tab state.)
"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import OSWindow from "@/components/os/OSWindow";
import {
  hydrateWindowStore,
  useWindowStoreV2,
  type AppId,
  type OSWindowState,
} from "@/stores/windowStore";

/** Per-window loading body — the route skeletons' spinner row, inside the
 *  already-visible window chrome. */
function AppLoading({ label }: { label: string }) {
  return (
    <div className="vista-window__body flex items-center justify-center" style={{ flex: 1 }}>
      <div className="flex items-center gap-3 text-xs uppercase tracking-[0.16em] text-white/70">
        <span className="inline-block h-4 w-4 rounded-full border-2 border-cyan-100/35 border-t-cyan-100 animate-spin" />
        loading {label}...
      </div>
    </div>
  );
}

// Stage A apps (the S-tier ports). Each entry lazy-loads the same extracted
// component its route page renders — one implementation, two presentations.
const FilesApp = dynamic(() => import("@/apps/FilesApp"), {
  ssr: false,
  loading: () => <AppLoading label="files" />,
});
const MifoidApp = dynamic(() => import("@/apps/MifoidApp"), {
  ssr: false,
  loading: () => <AppLoading label="mifoid" />,
});

type DesktopApp = {
  title: string;
  Component: React.ComponentType;
  defaultSize: { w: number; h: number };
  /** Frame class carrying the app's window-width reflow rules (the class
   *  the route page puts on its <main>). */
  frameClassName?: string;
};

const DESKTOP_APPS: Partial<Record<AppId, DesktopApp>> = {
  files: {
    title: "FILES.EXE",
    Component: FilesApp,
    defaultSize: { w: 1060, h: 700 },
  },
  mifoid: {
    title: "MIFOID.EXE",
    Component: MifoidApp,
    defaultSize: { w: 1060, h: 700 },
    frameClassName: "mifoid-page",
  },
};

export default function Desktop() {
  const windows = useWindowStoreV2((s) => s.windows);

  // Windows render only after mount: the store's persisted layout hydrates
  // client-side (skipHydration), so SSR markup and the first client render
  // agree on an empty desktop — the wallpaper.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    hydrateWindowStore();
    setMounted(true);
  }, []);

  const openWindows = mounted
    ? (Object.values(windows) as OSWindowState[])
        .filter((w) => DESKTOP_APPS[w.id])
        .sort((a, b) => a.openedAt - b.openedAt) // stable mount order
    : [];

  return (
    <main className="os-desktop" aria-label="FOID OS desktop">
      {mounted && openWindows.length === 0 ? (
        <p className="os-desktop__hint foid-label">
          FOID OS — open an app from the dock
        </p>
      ) : null}
      {openWindows.map((w) => {
        const app = DESKTOP_APPS[w.id]!;
        return (
          <OSWindow
            key={w.id}
            appId={w.id}
            title={app.title}
            defaultSize={app.defaultSize}
            frameClassName={app.frameClassName}
          >
            <app.Component />
          </OSWindow>
        );
      })}
    </main>
  );
}
