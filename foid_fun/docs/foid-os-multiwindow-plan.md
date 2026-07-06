# FOID OS Stage 2 — Multi-Window Integration Plan

**Status:** proposal (no code changed) · **Branch:** `design/foid-os-media` · **Date:** 2026-07-06
**Scope:** several apps (PRAY, BOARD, …) open simultaneously as independent draggable/resizable
windows on one desktop shell, like a real OS.

---

## 0. What production web OSes actually do (research)

Patterns extracted from real projects, with what we should steal:

| Project | Windows are… | Z-order / focus | Worth stealing |
|---|---|---|---|
| **daedalOS** (Next.js) | React component per entry in a `processes` context; an `AppsLoader` maps processes → `<Window>` wrappers (react-rnd for drag/resize) | `stackOrder: string[]` + `foregroundId` in session context; `prependToStack(id)` moves a window to front; z-index derived from array position | The **`stackOrder` array** (not per-window z counters), `contain: strict` on window frames, `?app=FileExplorer&url=…` deep links |
| **Puter** | DOM window factory (`UIWindow`); third-party apps embedded as **iframes** for security isolation | Global `last_window_zindex++` counter on focus | The iframe lesson in reverse: iframes exist for *untrusted third-party* apps. All FOID apps are first-party — iframes would only cost us (see §2) |
| **OS.js** | `proc.createWindow({})` DOM windows; apps render into the window DOM with any framework; iframe mode reserved for sandboxing | WM-managed focus/z | Windows as plain DOM + "bring your own framework" content; session save/restore |
| **WinBox.js** | Standalone HTML5 window lib, no deps | Auto-incrementing z-index on focus; focus/blur callbacks; `no-min/no-max/no-move` flags | Minimal control surface: focus/blur callbacks are the whole contract |
| **react-mosaic** | Tiling (tree of splits), not floating | n/a | Nothing — tiling is the wrong metaphor for FOID OS's Aero-glass identity |

Cross-cutting patterns:

- **Component instances, not iframes, not routes.** Every serious React web-OS renders open
  apps as sibling component instances inside one shell page. Routing is at most a *bootstrap*
  input (daedalOS `?app=`), never the window system.
- **Z-order as an ordered array** (daedalOS `stackOrder`) beats incrementing counters (Puter):
  no unbounded z-index growth, minimize stacks and Alt-Tab ordering fall out for free, and
  the focused window is simply the array tail.
- **Performance = don't pay for hidden windows.** daedalOS puts `contain: strict` on frames;
  CSS `content-visibility` lets the engine skip layout/paint of offscreen/hidden content
  entirely (web.dev measured ~7× initial-render boost on heavy DOM) while keeping it in the
  a11y tree. React 19.2's `<Activity mode="hidden">` unmounts effects but preserves state/DOM
  — **not available to us yet: we're on React 18.3.1 / Next 14.2.35** (`package.json`), so
  background-freeze must be manual (store-driven gating) until a React 19 upgrade.
- **Keyboard/a11y:** keep DOM order stable (mount order) and drive stacking purely with
  z-index — reordering DOM on focus breaks in-window scroll/tab state. Focused window is
  marked visually + `aria-label`ed regions; unfocused windows stay interactive (windows are
  not modals — no `inert`, no focus trap).

Sources: [daedalOS repo](https://github.com/DustinBrett/daedalOS) ·
[Dustin Brett, "How I Made a Desktop Environment in the Browser (Part 1: Window Manager)"](https://dev.to/dustinbrett/how-i-made-a-desktop-environment-in-the-browser-part-1-window-manager-197k) ·
[daedalOS session context (stackOrder/foregroundId)](https://raw.githubusercontent.com/DustinBrett/daedalOS/main/contexts/session/useSessionContextState.ts) ·
[live deep link example](https://dustinbrett.com/?app=FileExplorer&url=%2FUsers%2FPublic%2F..) ·
[Puter repo](https://github.com/HeyPuter/puter) · [Puter UIWindow.js](https://github.com/HeyPuter/puter/blob/main/src/gui/src/UI/UIWindow.js) ·
[OS.js manual](https://manual.os-js.org/guide/framework/) · [WinBox.js](https://nextapps-de.github.io/winbox/) ·
[web.dev content-visibility](https://web.dev/articles/content-visibility) ·
[React `<Activity>`](https://react.dev/reference/react/Activity)

---

## 1. Target UX spec

- **Desktop shell at `/`.** The wallpaper stack that already lives in `src/app/layout.tsx`
  (AnimatedBackground, FloatingElements, `.scene-tint`, SkyTint) *is* the desktop. The current
  home launcher window (`src/app/page.tsx`, `FOID_FOUNDATION.EXE`) becomes just another app
  window (`HOME`), open by default for first-time visitors.
- **Apps open from the dock** (`src/components/Dock.tsx`). Desktop behavior changes from
  "navigate route" to "open/focus/restore window". The dock already special-cases
  restore-when-minimized (Dock.tsx:236–239) — that branch generalizes per-app.
- **Window chrome unchanged.** Same `.vista-window` glass frame, same `AppTitlebar`
  (controls + title + wallet pill), same drag/resize feel (rAF-coalesced direct style writes,
  `WindowFrame.tsx`), same genie-minimize. The chrome component moves; its look does not.
- **Focus & z-order:** click anywhere in a window (or its titlebar) brings it to front.
  Focused window keeps today's full-brightness titlebar; unfocused windows get a dimmed
  titlebar + reduced shadow (new `.foid-window--blurred` class). Z-order = `zOrder` array.
- **Minimize to dock:** genie animation as today; the app's dock icon shows the existing
  minimized pulse dot (Dock.tsx:257–265). Clicking the icon restores + focuses. Multiple
  minimized windows = multiple dotted icons (the "minimize stack" is just `status:"minimized"`
  entries in the store, restored in `lastFocusedAt` order via a long-press/hover stack later —
  v1 is one window per app, so one dot per icon).
- **Close** (red control) removes the window from the store (state discarded);
  **minimize** (amber) parks it. Today both minimize (WindowFrame.tsx:230–243) — multi-window
  is where the distinction starts to matter.
- **URL behavior:**
  - Shell lives at `/`. Open windows sync to the query string:
    `/?apps=pray,board&focus=board` via `history.replaceState` (no router churn, no scroll
    reset). Reload restores the layout (plus per-window geometry from `localStorage`).
  - **Deep links:** existing routes keep working forever. `/board?debug=1` on desktop
    becomes a redirect to `/?apps=board&focus=board&board.debug=1`; app-scoped params are
    namespaced `<appId>.<param>` and handed to the app instance on mount. `/vote?proposal=42`
    → `/?apps=vote&focus=vote&vote.proposal=42`.
  - **Back button:** window management does **not** push history (all `replaceState`) — you
    don't back-button between windows in macOS either. Back leaves the desktop (to wherever
    you came from). One exception: the *initial* deep-link redirect uses `replace` so back
    doesn't bounce through the old route.
- **Mobile story: unchanged.** One app per route, no floating windows — exactly the current
  gate (`WindowFrame.tsx:151` — `window.innerWidth < 1024` bails on drag; `.foid-window-edge`
  and `.foid-window-resize` are `display:none` under 1024px, globals.css:5743–5747, 5796–5800).
  On mobile the dock keeps navigating routes, and the route pages keep rendering their
  existing mobile layouts. The shell is a `lg:`-and-up experience only.

---

## 2. Architecture decision

**Recommended: component-instance windows in a desktop shell (daedalOS pattern), rendered
by a client `<Desktop/>` component on the `/` route.** Each open app is a live React
component (`<PrayApp/>`, `<BoardApp/>`) inside an `<OSWindow id=…>` chrome wrapper.

### Why not the alternatives

**(a) Keep-routes-and-fake-it** (current route owns the "focused" window; other apps render
as thumbnails/frozen previews): cheap, but it isn't multi-window — background apps aren't
live (no music-while-board, no chat-while-vote), state still dies on navigation
(`resetForRoute`, windowStore.ts:42), and every fake gets thrown away when we do it
properly. Dead end; skip.

**(b) Iframe windows** (Puter's third-party model): each iframe boots its own wagmi +
WalletConnect + RainbowKit context (`src/providers.tsx` creates config/queryClient at module
scope — per-iframe duplication), its own Supabase client, its own sfx/music singletons
(`src/lib/sfx.ts`, `src/components/musicPanelController.ts`) → double audio, double RPC,
N× memory, and cross-window coordination becomes postMessage. Puter uses iframes because its
apps are *untrusted third-party code*; ours are first-party. Reject.

**(c) Next.js parallel routes:** slots are statically declared in the file tree; N dynamic
windows with runtime open/close/z-order don't map onto `@slot` conventions, and the router
would own state the WM needs to own. Reject.

**(d) Component windows in a shell — recommended.** Everything the pattern needs already
exists here:

- **Providers are global** — verified: `WagmiProvider` + `QueryClientProvider` +
  `RainbowKitProvider` wrap `{children}` in the root layout (`src/app/layout.tsx:111–118`,
  `src/providers.tsx:98–144`). Any app component mounted anywhere under the shell gets
  wallet/query context for free.
- **The MUSIC.EXE / CHAT.EXE precedents prove it works in this codebase:**
  `CompactMusicPlayer` is mounted once at shell level (`ClientLayout.tsx:45`), visibility
  toggled by a zustand store (`src/stores/ampStore.ts`), audio owned by a module singleton
  (`musicPanelController`). The in-flight CHAT.EXE on this branch
  (`src/components/ChatApp.tsx`, mounted in ClientLayout, `chatAppStore` visibility, dock
  tile toggle, MUSIC.EXE's pointer-drag) goes further: its body is the *same*
  `TerminalChat` component the /board sidebar renders, on the same Supabase channel —
  live shared state across two mounted surfaces, which is exactly the multi-window
  contract. Multi-window generalizes this shape to route apps.
- **Window chrome is already portable.** `.vista-window` is a **container-query container**
  (`container: foid-window / inline-size`, globals.css:759), so content reflows with *window*
  size, not viewport — the hard part of "apps in arbitrary-sized windows" is already shipped
  (pray's grid collapses via `@container pray-window (max-width: 899px)`, globals.css:4961).
- **An abandoned prototype already sketched the shell:** `src/components/desktop/Desktop.tsx`
  + `DraggableWindow.tsx` + `src/hooks/useDesktopState.ts` (keyed window map, per-window
  zIndex, localStorage persistence) — orphaned, imported by nothing. Supersede it: take its
  state shape lessons into windowStore v2 and **delete the folder** in Stage A (it drifts
  from the real chrome and confuses grep).

Trade-offs accepted: (1) all open apps share one JS heap and one main thread — mitigated in
§5; (2) route-level code splitting is replaced by `next/dynamic` per-app splitting (same
chunks, different trigger); (3) per-route `loading.tsx` skeletons are replaced by per-window
Suspense fallbacks (the skeleton window markup in `src/app/*/loading.tsx` is reused nearly
verbatim); (4) SSR/SEO for app content moves to the surviving routes (which keep their
`metadata` exports — layouts stay).

---

## 3. windowStore v2 (TypeScript sketch)

Replaces the singleton store — the file already announces this destiny
(“When apps are extracted into a desktop shell (multi-window), this becomes a keyed map”,
`src/stores/windowStore.ts:6–7`).

```ts
// src/stores/windowStore.ts (v2)
import { create } from "zustand";
import { persist } from "zustand/middleware"; // geometry only; see partialize

export type AppId =
  | "home" | "pray" | "board" | "vote" | "mifoid" | "files" | "about" | "gallery";

export type WindowPos = { x: number; y: number };
export type WindowSize = { w: number; h: number };

export type OSWindowState = {
  id: AppId;
  status: "open" | "minimized";
  maximized: boolean;
  /** Drag offset from the window's spawn point (cascade slot). */
  pos: WindowPos;
  /** User-resized dims; null = app's default sizing (the old h-[94vh] role). */
  size: WindowSize | null;
  /** Deep-link params handed to the app instance on open (e.g. vote.proposal). */
  params?: Record<string, string>;
  openedAt: number;
  lastFocusedAt: number;
};

type WindowStoreV2 = {
  windows: Partial<Record<AppId, OSWindowState>>;
  /** Back → front. Focused app = zOrder[zOrder.length - 1]. daedalOS stackOrder, inverted. */
  zOrder: AppId[];

  open: (id: AppId, params?: Record<string, string>) => void; // create | restore, then focus
  close: (id: AppId) => void;        // remove entry (state discarded on unmount)
  focus: (id: AppId) => void;        // move to zOrder tail, restore if minimized
  minimize: (id: AppId) => void;     // status:"minimized"; focus falls to next in zOrder
  toggleMaximize: (id: AppId) => void;
  setPos: (id: AppId, pos: WindowPos) => void;
  setSize: (id: AppId, size: WindowSize | null) => void;

  // Derived, exported as selectors:
  // focusedId()      → AppId | undefined
  // zIndexOf(id)     → WINDOW_Z_BASE + zOrder.indexOf(id)
  // isForeground(id) → focusedId() === id && windows[id]?.status === "open"
};
```

Notes:

- **Z tiers:** windows occupy `--foid-z-raised` space (tokens.css:181–185): `WINDOW_Z_BASE = 10`,
  so 20 windows still sit below the dock (`--foid-z-nav: 40`) and every overlay/modal tier.
  The current maximize rule jumps to `--foid-z-overlay` (globals.css:5719) — v2 keeps
  maximized windows in normal stack order instead (maximize ≠ modal).
- **Focus side contract:** `useWindowActivity(id)` hook returns
  `{ focused, minimized, visible }` — apps gate keyboard listeners, polling, and realtime
  subscriptions on it (§5). This is the WinBox focus/blur-callback contract, store-shaped.
- **Persistence:** `persist` with `partialize` → only `windows` geometry + `zOrder`
  (like the old prototype's `foid_desktop_state_v1`, useDesktopState.ts:4), never `params`.
- **`WindowControls` rewire:** `OSWindow` renders chrome and passes `id` down via context;
  controls call `minimize(id)`/`toggleMaximize(id)` instead of the singleton. The
  `closest(".vista-window")` frame-location trick (WindowFrame.tsx:44) becomes a plain ref —
  `OSWindow` owns the frame element it decorates. `resetForRoute` (windowStore.ts:42,
  wired to `pathname` in WindowFrame.tsx:50–64) is deleted — windows outlive URLs now.
- **URL sync:** a tiny `useDesktopUrlSync()` in the shell serializes
  `zOrder`/`windows` → `?apps=…&focus=…` on change (replaceState) and hydrates once on boot.

---

## 4. Migration path (shippable stages)

### Stage A — shell + two easiest apps, behind a flag (~1 sprint)

Flag: `NEXT_PUBLIC_FOID_DESKTOP=1` (env-driven like `NEXT_PUBLIC_IS_MAINNET`; checked in one
place, e.g. `src/config/desktop.ts`).

1. **windowStore v2** as above (new file content, same path). Keep the old single-window API
   as a thin adapter so un-migrated pages still work during the transition (their
   WindowFrame maps to a fixed `id` = current route).
2. **`<OSWindow id title …>`** — extract frame logic from `WindowFrame.tsx` (drag, edge/corner
   resize, genie minimize, maximize class) into a chrome component that renders
   `.vista-window` + `AppTitlebar` + body. Titlebar wallet props stop being per-page prop
   drilling: `OSWindow` calls `useAccount()`/`useSwitchWallet()` itself (every page wires the
   identical thing today — e.g. vote/page.tsx:373, files/page.tsx:456; `useSwitchWallet`
   already centralizes the disconnect→modal dance).
3. **`<Desktop/>`** rendered by `src/app/page.tsx` when flag+desktop-viewport: maps
   `zOrder` → `<OSWindow>` instances (**stable mount order, z-index from store** — don't
   reorder DOM on focus). Apps lazy-load via `next/dynamic` and render inside per-window
   `<Suspense>` whose fallback reuses the route skeletons (`src/app/*/loading.tsx` markup).
4. **Port MIFOID and FILES** (the S-tier apps, audit below): move page content into
   `src/apps/mifoid/MifoidApp.tsx`, `src/apps/files/FilesApp.tsx`; routes keep rendering them
   full-window (route page becomes `<OSWindowRouteShim><MifoidApp/></…>`) so mobile and
   flag-off behavior is byte-identical. `files.css` import moves from `files/layout.tsx:2` to
   the shell (class prefixes are cleanly namespaced `.files-*` — verified no collisions).
5. **Dock v2:** with flag on + `lg:` viewport, dock items call `open(id)` instead of `Link`
   navigation for migrated apps; unmigrated apps keep navigating. Active state = focused
   window; dot = minimized (existing visuals).
6. **Delete `src/components/desktop/`** (Desktop.tsx, DraggableWindow.tsx,
   LoreboardWindowContent.tsx, RitualWindowContent.tsx) + `src/hooks/useDesktopState.ts`
   (orphaned prototype, superseded).

Ship: flag-on lets the team open MIFOID + FILES + HOME concurrently; everything else behaves
exactly as production.

### Stage B — the real apps (board, pray) + the M-tier ones

Per-app extraction audit (blockers are named; effort assumes Stage A exists):

| App | Effort | What moves | Named blockers |
|---|---|---|---|
| **HOME** | S | Launcher content → `HomeApp` (opens other windows instead of `Link`s) | Sparkle/bubble deco assumes full-window body — fine (container-relative) |
| **MIFOID** | S | mifoid/page.tsx (321 lines), no route CSS, no params | None. Floating mini-windows are absolutely positioned inside the frame — already window-relative |
| **FILES** | S | files/page.tsx (633 lines) + `files.css` import site (files/layout.tsx:2) | MEDIA_PLAYER.EXE overlay uses the shared `<Modal>` primitive — decide window-scoped vs shell-scoped portal (recommend shell-scoped, it's a takeover) |
| **GALLERY** | S–M | gallery/page.tsx (545 lines) | Same shape as files; check its fetch cadence when backgrounded |
| **ABOUT** | M | about/page.tsx (717 lines); imports `files.css` **and** `about.css` via about/layout.tsx:5–6 | `.aboutPane` uses `container-type: size` + `cqh` units (globals.css:4076–4090) — needs a definite height inside a resizable window (it has one today via h-[94vh]; OSWindow default size must guarantee it) |
| **VOTE** | M | vote/page.tsx (630 lines) + `vote-animations.css` (vote/layout.tsx:3) | Full-screen overlays (TxOverlay, VictoryCelebration) should portal to shell layer; sfx fine (singleton); `/vote?proposal=` deep-link param → `params.proposal`; vote/[id] + vote/submit stay as routes initially |
| **PRAY** | L | pray/page.tsx (1,636 lines) + FoidMommyTerminal (2,155 lines) | See below |
| **BOARD** | L | board/page.tsx (1,764 lines) + board.css (856 lines) + hooks | See below |

**PRAY blockers (the honest list):**
- **Double-mount today:** mobile terminal (pray/page.tsx:596–618) and desktop terminal
  (:621–663) are both in the DOM, CSS-switched (`lg:hidden` / `hidden lg:block`). The
  extracted `PrayApp` mounts **only the desktop tree**; the mobile tree stays in the route
  page for the mobile story. This is a net *simplification* — desktop stops paying for the
  mobile instance.
- **Wallet tx pipeline closures:** `ensureWalletReady` / `submitPrayer` / `waitForReceipt`
  are defined in the page and passed into the terminal (pray/page.tsx:600–614). They only
  depend on wagmi hooks + `@/lib/viem` — they move into `PrayApp` unchanged.
- **Full-screen takeovers:** PrayerBoot (mobile-only — stays in route), TierUnlockCinematic
  (pray/page.tsx:530–535) must portal to a shell overlay layer (z-modal tier), not render
  inside the window.
- **styled-jsx page scoping:** pray's base styles are page-scoped styled-jsx with the
  `@container pray-window` rules deliberately parked in globals.css because styled-jsx
  mangles named container queries (globals.css:4954–4960 comment, pray/page.tsx:1005–1008
  declares `container-name: pray-window` on `.pray-window-frame > .vista-window`). Extraction
  keeps the styled-jsx block inside `PrayApp` (it travels with the component) — verify the
  jsx-hash still lands on the same nodes once the wrapper `<main>` is gone.
- **Per-route env overrides:** `?registry=&mirror=` read from `location.search`
  (pray/page.tsx:47–51) → becomes `params.registry`/`params.mirror`.

**BOARD blockers (the honest list):**
- **CSS import site:** `import "./board.css"` at module scope (board/page.tsx:6) moves to the
  shell (or stays — importing CSS from the dynamically-imported `BoardApp` chunk also works
  in App Router). Prefixes are clean (`.board-*`, `.terminal-chat*` — scanned; no collisions
  with `.pray-*`/`.files-*`).
- **Window-level keyboard listeners:** `usePanZoom` binds `window.addEventListener("keydown")`
  for space-pan and arrow/±/0 shortcuts (usePanZoom.ts:289–293, 325–326). With two apps open,
  these **must gate on `isForeground("board")`** or arrows will pan the board while you type
  a prayer. Same review for the `P`-to-propose shortcut and any `document`-level handlers.
  (Wheel zoom is element-scoped — usePanZoom.ts:487 — already safe.)
- **Fixed-position furniture:** `.board-particles` is `position: fixed; inset: 0`
  (board.css:72) — becomes `absolute` within the window body, or retires to the shared
  wallpaper. PaintEditor's `html.cmp-active` clearance and the ghost/HUD layers need a
  position audit (anything `fixed` inside a transformed ancestor silently becomes
  window-relative anyway — the drag transform on `.vista-window` makes `fixed` unreliable
  *today* while dragging; the audit fixes a latent bug class).
- **Background work must pause:** Supabase presence channel (`usePresence` — realtime channel
  per mount), the block watcher poll (`useBoardData` → `BLOCK_POLL_INTERVAL_MS` +
  12s-era safety interval at useBoardData.ts:268) — subscribe/pause on
  `useWindowActivity("board")` (unsubscribe when minimized, keep-alive when merely
  unfocused).
- **Deep-link params:** `?debug=1`, `?celebrate` (board/page.tsx:539–541) → `params`.
- **Cross-app navigation:** `window.open("/vote?proposal=…", "_blank")` from the Featured
  ribbon (board/page.tsx:1418) becomes `open("vote", { proposal })` — the first real
  cross-window interaction and the proof the shell earns its keep.
- **Double-mount today:** board also renders mobile + desktop trees simultaneously
  (board/page.tsx:1728–1739) — same simplification win as pray.
- **`force-dynamic`:** board/layout.tsx exports `dynamic = "force-dynamic"` for indexedDB —
  the shell route (client component behind Suspense) needs the same treatment once BoardApp
  can mount there.

### Stage C — flip the default, deprecate routes (small)

1. Flag default on. `/` renders the desktop for `lg:` viewports; mobile `/` keeps the
   launcher.
2. Routes become **entry points, not homes**: on desktop viewports, `/pray` etc. issue
   `router.replace("/?apps=pray&focus=pray" + namespacedParams)`; on mobile they render the
   app full-screen exactly as today (this is the mobile story permanently — same components,
   two presentations).
3. Route `loading.tsx` files retire where redirects land before paint; `metadata` exports
   stay on the route layouts for SEO/unfurls.
4. Session restore: last desktop layout rehydrates from the persisted store when `/` opens
   with no `?apps=`.

---

## 5. Performance budget & mitigations

**Budget: PRAY + BOARD + MUSIC deck open concurrently at 60fps drag, on a mid laptop.**

Facts from the audit that make this cheaper than it sounds:

- Today's `/pray` mounts **two** FoidMommyTerminal instances (mobile + desktop) and `/board`
  mounts **both** its mobile and desktop trees (board/page.tsx:1728–1739). Shell windows
  mount only the desktop tree each → *pray-in-a-window + board-in-a-window ≈ the DOM cost of
  today's two single-route pages, minus the doubled trees*.
- Board is already virtualized (`useVisiblePlacements`) and already writes pan/zoom
  transforms via rAF outside React (board/page.tsx:1422–1435 comment) — dragging a *window*
  uses the identical technique (WindowFrame.tsx:127–137), so gesture cost doesn't stack.
- Terminal typing already renders one line per frame, memoized (FoidMommyTerminal.tsx:46–49
  comment) and is idle unless Mommy is talking.
- Singletons stay single: sfx, musicPanelController, wagmi config, QueryClient — no
  duplication by design (§2d).

Mitigations to build (in order of value):

1. **Focus/visibility gating (`useWindowActivity`)** — pause on minimize: board presence
   channel + block poll, gallery/vote refetch intervals, any `setInterval` cosmetics.
   Keyboard listeners gate on foreground (§4 board blockers). This is the React-18 substitute
   for `<Activity>`; when the React 19 upgrade lands, minimized windows can switch to
   `<Activity mode="hidden">` and delete most of the manual gating.
2. **CSS containment on frames:** `.vista-window` already has `overflow: hidden` +
   `isolation: isolate` (globals.css:779–781 region); add `contain: layout paint`
   (size containment stays off — the existing comment at globals.css:756–759 explains
   heights aren't always definite). Minimized windows additionally get
   `content-visibility: hidden` so their subtree costs zero layout/paint but keeps state.
3. **Backdrop-filter budget:** every `.vista-window` runs `backdrop-filter: blur`
   (globals.css:766–768) — glass is the single most expensive concurrent-window cost.
   Rule: full blur on the focused window only; unfocused windows drop to a cheaper
   semi-opaque fill (`.foid-window--blurred` swaps the variable). Hard cap via UX: dock
   warns/auto-minimizes beyond ~4 open windows.
4. **Dock clearance stays CSS-owned:** the solved constants — `max-height:
   calc(100dvh - 190px)` (globals.css:200–202) and maximize inset `10px 10px 88px`
   (globals.css:5711–5720) — move into `OSWindow`'s default-size math so nothing regresses on
   laptop heights.
5. **Lazy mount + preheat:** apps load on first open (`next/dynamic`); the dock keeps
   prefetching route chunks (Dock.tsx:229) which are the same chunks the dynamic imports use.

---

## 6. Risks & open questions for the founder

**Risks**
1. **Board `fixed`-position audit is the sneaky one** — every overlay/HUD inside board that
   assumes viewport coordinates misbehaves inside a transformed window frame. Budget real QA
   time on PaintEditor, ghosts, toasts-in-canvas.
2. **styled-jsx hash scoping on pray** — moving the tree can silently drop page-scoped rules;
   the pray container-query comment (globals.css:4954–4960) proves this codebase has already
   fought styled-jsx once. Mitigation: visual snapshot tests per app window (playwright is
   already set up — `test:e2e`).
3. **React 18 ceiling:** without `<Activity>`, "frozen" background windows still run reduced
   effects; discipline lives in `useWindowActivity` adoption. A React 19/Next 15 upgrade is
   the structural fix and should be sequenced *after* Stage A proves the shell (upgrade risk
   compounds otherwise).
4. **Two presentations of one app** (route-mobile + window-desktop) means every app change
   must be checked in both. The extraction actually reduces this risk vs. today's
   double-mounted trees, but it stays a review-checklist item.
5. **Wallet flows inside windows:** RainbowKit modal, NetworkSwitcher, onboarding overlays
   are shell-global (providers.tsx:108–110, ClientLayout.tsx:42–44) — verify they sit above
   the window z-range (they use `--foid-z-modal`/`--foid-z-max`; windows cap well below).

**Open questions**
1. **Close vs. minimize semantics:** today both traffic-light buttons minimize
   (WindowFrame.tsx:230–243). In multi-window, should red *discard* app state (real close)?
   Recommendation: yes on desktop, with PRAY exempt during an in-flight tx.
2. **One window per app, or multiple instances?** (Two FILES windows?) v2 store assumes one
   (AppId-keyed). Multiple instances = keyed by instance id; costs little now, decide before
   Stage A locks the key type.
3. **Default desktop for new visitors:** HOME window alone? HOME + PRAY? This is a
   positioning call (the "onchain home for internet culture" framing suggests the desktop
   itself is the brand moment).
4. **Do `/gallery`, `/dashboard`, `/swipe` (not in dock: Dock.tsx:31–105) become windows,
   stay route-only, or fold into other apps?** Recommendation: window-ify gallery; leave
   dashboard/swipe route-only until they earn dock slots.
5. **Session persistence scope:** restore layout only (recommended), or restore app
   *content* state (board camera, terminal transcript) too? The latter drags per-app
   serialization into scope — punt to Stage D.
6. **`/enter` gate interaction:** does the auth gate wrap the desktop shell once, or
   per-window? (Current priority list has an enter-gate fix in flight — coordinate.)

---

*Verification for this plan: `pnpm typecheck` clean on the branch (no src changes made);
all file:line references checked against `design/foid-os-media` on 2026-07-06.*
