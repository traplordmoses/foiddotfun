// src/components/os/Desktop.tsx
// FOID OS desktop shell — THE home experience on lg+ viewports (Stage C;
// NEXT_PUBLIC_FOID_DESKTOP=0 is the emergency opt-out).
//
// Rendered by the home route: the wallpaper stack in the root layout
// (AnimatedBackground, FloatingElements, scene-tint, SkyTint) IS the
// desktop; this component only contributes the window layer. Open windows
// come from windowStore v2; apps lazy-load via next/dynamic so a fresh
// desktop costs nothing until a dock tile is clicked.
//
// URL contract (Stage C): open windows sync to /?apps=pray,board&focus=board
// via history.replaceState — shareable, reload-safe, zero history spam. On
// mount, ?apps= seeds the store (validated ids, one instance per app,
// capped); with no ?apps=, the last persisted layout rehydrates instead.
//
// Stacking contract: windows mount in openedAt order and NEVER reorder in
// the DOM — focus changes only flip the z-index each OSWindow derives from
// the store's zOrder. (Reordering DOM on focus would reset in-window
// scroll/tab state.)
"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import OSWindow from "@/components/os/OSWindow";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { parseDesktopAppsParam } from "@/config/desktop";
import {
  focusedAppId,
  hydrateWindowStore,
  isFloaterId,
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

/** localStorage flag: the visitor closed the welcome card. Per device, like
 *  the boot flag, because every action on the card also lives in the dock
 *  (Board, Pray, About), so a closed card hides nothing. */
const WELCOME_DISMISSED_KEY = "foid_os_welcome_dismissed";

/** Exit fade length; matches the .os-welcome transition in globals.css. */
const WELCOME_EXIT_MS = 160;

function readWelcomeDismissed(): boolean {
  try {
    return window.localStorage.getItem(WELCOME_DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

function persistWelcomeDismissed(): void {
  try {
    window.localStorage.setItem(WELCOME_DISMISSED_KEY, "1");
  } catch {
    /* private mode: the card still closes for this page view */
  }
}

/** Serialize the open windows into the shell query (?apps=…&focus=…) and
 *  replaceState it onto the URL — reload restores the layout, copy-paste
 *  shares it, and no history entries pile up (you don't back-button between
 *  windows in macOS either). App-scoped params already in the query ride
 *  along untouched. */
function useDesktopUrlSync(mounted: boolean) {
  const zOrder = useWindowStoreV2((s) => s.zOrder);
  const windows = useWindowStoreV2((s) => s.windows);
  const lastWrittenRef = useRef<string | null>(null);

  useEffect(() => {
    if (!mounted) return;
    // The shell only lives at "/" — never rewrite another route's URL
    // (e.g. a store tick racing a client navigation away).
    if (window.location.pathname !== "/") return;

    const ids = zOrder.filter(
      (id): id is AppId => !isFloaterId(id) && Boolean(DESKTOP_APPS[id]),
    );
    const url = new URL(window.location.href);
    if (ids.length) {
      url.searchParams.set("apps", ids.join(","));
      const focus = focusedAppId({ windows, zOrder });
      if (focus) url.searchParams.set("focus", focus);
      else url.searchParams.delete("focus"); // everything minimized
    } else {
      url.searchParams.delete("apps");
      url.searchParams.delete("focus");
    }

    // Keep the shareable form literal — URLSearchParams percent-encodes the
    // comma, but "?apps=pray,board" is the documented grammar and both read
    // back identically.
    const next =
      url.pathname + url.search.replace(/%2C/gi, ",") + url.hash;
    const current =
      window.location.pathname + window.location.search + window.location.hash;
    if (next === current || next === lastWrittenRef.current) return;
    lastWrittenRef.current = next;
    // Native replaceState is router-integrated on Next 14.2+, so
    // useSearchParams stays truthful for apps that read deep-link params.
    window.history.replaceState(window.history.state, "", next);
  }, [mounted, zOrder, windows]);
}

export default function Desktop() {
  const windows = useWindowStoreV2((s) => s.windows);

  // Windows render only after mount: layout state is client-side only
  // (skipHydration on the persisted store), so SSR markup and the first
  // client render agree on an empty desktop — the wallpaper.
  //
  // Seeding order: an ?apps= deep link wins outright (open exactly what
  // the link says — open() merges into anything this session already
  // opened); only a bare "/" restores the last persisted layout.
  const [mounted, setMounted] = useState(false);
  // Read in the same effect that flips `mounted`, so a visitor who closed
  // the welcome card never sees it flash back for a frame.
  const [welcomeDismissed, setWelcomeDismissed] = useState(false);
  const [welcomeClosing, setWelcomeClosing] = useState(false);
  useEffect(() => {
    const { apps, focus } = parseDesktopAppsParam(window.location.search);
    if (apps.length) {
      const store = useWindowStoreV2.getState();
      for (const id of apps) store.open(id);
      if (focus) store.focus(focus);
    } else {
      hydrateWindowStore();
    }
    setWelcomeDismissed(readWelcomeDismissed());
    setMounted(true);
  }, []);

  const desktopRef = useRef<HTMLElement>(null);
  const welcomeTimerRef = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (welcomeTimerRef.current !== null) {
        window.clearTimeout(welcomeTimerRef.current);
      }
    },
    [],
  );

  const closeWelcome = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (welcomeClosing) return;
    persistWelcomeDismissed();
    // The close button is about to unmount; hand keyboard focus to the
    // desktop instead of dropping it on <body>.
    const hadFocus = document.activeElement === event.currentTarget;
    const finish = () => {
      welcomeTimerRef.current = null;
      setWelcomeDismissed(true);
      const desktop = desktopRef.current;
      if (!hadFocus || !desktop) return;
      // Focusable only for this hand-off, so clicks inside windows keep
      // their usual focus behavior afterwards.
      desktop.setAttribute("tabindex", "-1");
      desktop.addEventListener(
        "blur",
        () => desktop.removeAttribute("tabindex"),
        { once: true },
      );
      desktop.focus({ preventScroll: true });
    };
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      finish();
      return;
    }
    setWelcomeClosing(true);
    welcomeTimerRef.current = window.setTimeout(finish, WELCOME_EXIT_MS);
  };

  useDesktopUrlSync(mounted);

  const openWindows = mounted
    ? (Object.values(windows) as OSWindowState[])
        .filter((w) => DESKTOP_APPS[w.id])
        .sort((a, b) => a.openedAt - b.openedAt) // stable mount order
    : [];

  return (
    <main
      ref={desktopRef}
      className="os-desktop"
      aria-label="FOID OS desktop"
      aria-busy={!mounted}
    >
      {mounted && openWindows.length === 0 && !welcomeDismissed ? (
        <section
          className={`os-welcome${welcomeClosing ? " os-welcome--closing" : ""}`}
          aria-label="Welcome to FOID"
        >
          <button
            type="button"
            className="os-welcome__close"
            aria-label="Close welcome"
            title="Close"
            onClick={closeWelcome}
          >
            <span aria-hidden="true">×</span>
          </button>
          <span>FOID FOUNDATION</span>
          <h1>The internet’s permanent memory</h1>
          <p>A community canvas for memes and culture. Explore the board, check in with Foid Mommy, and vote on what stays.</p>
          <button onClick={() => useWindowStoreV2.getState().open("board")}>Explore the board →</button>
          <button onClick={() => useWindowStoreV2.getState().open("pray")}>Start a daily prayer</button>
          <a href="/about?doc=getting-started">How it works</a>
        </section>
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
