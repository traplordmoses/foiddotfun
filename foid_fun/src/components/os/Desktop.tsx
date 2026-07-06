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
import { ErrorBoundary } from "@/components/ErrorBoundary";
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

// Extracted apps (Stage A: FILES + MIFOID · Stage B pt 1: VOTE + ABOUT ·
// Stage B pt 2: PRAY + BOARD). Each entry lazy-loads the same extracted
// component its route page renders — one implementation, two presentations.
const FilesApp = dynamic(() => import("@/apps/FilesApp"), {
  ssr: false,
  loading: () => <AppLoading label="files" />,
});
const MifoidApp = dynamic(() => import("@/apps/MifoidApp"), {
  ssr: false,
  loading: () => <AppLoading label="mifoid" />,
});
const AboutApp = dynamic(() => import("@/apps/AboutApp"), {
  ssr: false,
  loading: () => <AppLoading label="about" />,
});
const VoteAppInner = dynamic(() => import("@/apps/VoteApp"), {
  ssr: false,
  loading: () => <AppLoading label="vote" />,
});
// PRAY + BOARD (the L-tier ports): their default exports already carry the
// same crash boundaries their routes use (PrayerErrorBoundary; board's
// ErrorBoundary + useSearchParams Suspense), so no shell-side wrapper.
const PrayApp = dynamic(() => import("@/apps/PrayApp"), {
  ssr: false,
  loading: () => <AppLoading label="foid mommy" />,
});
const BoardApp = dynamic(() => import("@/apps/BoardApp"), {
  ssr: false,
  loading: () => <AppLoading label="loreboard" />,
});
// Behavior parity with the /vote route, whose layout wraps the page in this
// boundary: a crash in the network-dependent vote deck downs one window,
// not the whole desktop.
function VoteApp() {
  return (
    <ErrorBoundary
      route="vote"
      title="Vote crashed"
      description="Something went wrong loading proposals. Try refreshing the page."
    >
      <VoteAppInner />
    </ErrorBoundary>
  );
}

type DesktopApp = {
  title: string;
  Component: React.ComponentType;
  defaultSize: { w: number; h: number };
  /** Per-app resize floor (OSWindow falls back to its global 480×360). */
  minSize?: { w: number; h: number };
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
  // Card deck — a narrower, taller frame: the SwipeCard column is max-w-md,
  // so a Finder-wide window would just be empty gutters. The taller floor
  // keeps the card + tabs + footer usable at minimum size.
  vote: {
    title: "VOTE.EXE",
    Component: VoteApp,
    defaultSize: { w: 680, h: 820 },
    minSize: { w: 480, h: 560 },
  },
  // Finder chrome (shares files.css wholesale) — same wide default as FILES;
  // its @container foid-window rules reflow the shell below 760/620px.
  about: {
    title: "ABOUT.EXE",
    Component: AboutApp,
    defaultSize: { w: 1060, h: 700 },
  },
  // Terminal + sidebar two-pane. The @container pray-window rules
  // (globals.css) hide the sidebar under ~900px of window width, so the
  // 720px floor is a clean single-pane terminal, not a crushed grid.
  pray: {
    title: "FOID_MOMMY_TERMINAL.EXE",
    Component: PrayApp,
    defaultSize: { w: 1180, h: 760 },
    minSize: { w: 720, h: 560 },
  },
  // Full-bleed canvas — wants all the glass it can get. Its @container
  // foid-window rules compact the floating dock/HUD below 760/560px, and
  // the 820×600 floor keeps the propose affordance + HUD from colliding.
  board: {
    title: "MIFOID_LOREBOARD.APP",
    Component: BoardApp,
    defaultSize: { w: 1280, h: 800 },
    minSize: { w: 820, h: 600 },
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
            minSize={app.minSize}
            frameClassName={app.frameClassName}
          >
            <app.Component />
          </OSWindow>
        );
      })}
    </main>
  );
}
