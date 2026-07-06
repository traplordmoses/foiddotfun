// src/components/Dock.tsx
// The FOID OS dock — primary navigation on every viewport. Successor to
// MobileNav (the titlebar tab row is gone; nav is the brand's chrome now).
//
// A floating glass pill 10px off the bottom edge. A spring-loaded glass
// puck slides between items; on pointer-fine devices, icons magnify
// macOS-style under the cursor. Touch devices skip magnification and keep
// the plain tap targets. prefers-reduced-motion skips it too.
'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  type MotionValue,
} from 'framer-motion';
import { focusedAppId, useWindowStore, useWindowStoreV2 } from '@/stores/windowStore';
import { useAmpStore } from '@/stores/ampStore';
import { useChatAppStore } from '@/stores/chatAppStore';
import {
  desktopAppForHref,
  DESKTOP_MIN_WIDTH,
  FOID_DESKTOP_ENABLED,
} from '@/config/desktop';
import { claimDockArrival } from '@/lib/foidOsBoot';

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  external?: boolean;
}

const navItems: NavItem[] = [
  {
    href: '/',
    label: 'Home',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    href: '/pray',
    label: 'Pray',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <path d="M12 2L2 7l10 5 10-5-10-5z" />
        <path d="M2 17l10 5 10-5" />
        <path d="M2 12l10 5 10-5" />
      </svg>
    ),
  },
  {
    href: '/board',
    label: 'Board',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <rect x="3" y="3" width="7" height="9" rx="1" />
        <rect x="14" y="3" width="7" height="5" rx="1" />
        <rect x="14" y="12" width="7" height="9" rx="1" />
        <rect x="3" y="16" width="7" height="5" rx="1" />
      </svg>
    ),
  },
  {
    href: '/vote',
    label: 'Vote',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    ),
  },
  {
    href: '/mifoid',
    label: 'MiFOID',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
  {
    href: '/files',
    label: 'Files',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
  {
    href: '/about',
    label: 'About',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="16" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12.01" y2="8" />
      </svg>
    ),
  },
];

// Cursor influence radius and peak icon scale for the magnification.
const MAGNIFY_RADIUS = 90;
const MAGNIFY_SCALE = 1.4;

// Auto-hide: after this long with zero user activity the dock slides off
// the bottom edge (founder #5). Any activity brings it straight back.
const DOCK_HIDE_AFTER_MS = 60_000;
// Cursor within this many px of the bottom edge always reveals the dock —
// belt and suspenders on top of the general activity listeners.
const DOCK_REVEAL_ZONE_PX = 10;

// Icon wrapper that magnifies with cursor proximity. mouseX is Infinity
// whenever the cursor is off the dock (or the device has no fine pointer),
// which resolves to scale 1 — so touch and reduced-motion pay zero cost.
function DockIcon({
  mouseX,
  children,
}: {
  mouseX: MotionValue<number>;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const distance = useTransform(mouseX, (val) => {
    if (val === Infinity) return MAGNIFY_RADIUS;
    const bounds = ref.current?.getBoundingClientRect();
    if (!bounds) return MAGNIFY_RADIUS;
    return Math.abs(val - (bounds.x + bounds.width / 2));
  });
  const scaleRaw = useTransform(distance, [0, MAGNIFY_RADIUS], [MAGNIFY_SCALE, 1]);
  const scale = useSpring(scaleRaw, { stiffness: 380, damping: 26, mass: 0.4 });

  return (
    <motion.div ref={ref} style={{ scale, transformOrigin: 'bottom center' }}>
      {children}
    </motion.div>
  );
}

export function Dock() {
  const pathname = usePathname();
  const router = useRouter();
  const mouseX = useMotionValue(Infinity);
  const windowMinimized = useWindowStore((s) => s.minimized);
  const restoreWindow = useWindowStore((s) => s.restore);
  // FOID OS shell windows — the desktop is the default home now (Stage C),
  // so on lg+ viewports the dock is a real OS dock: open/focus/restore.
  const osWindows = useWindowStoreV2((s) => s.windows);
  const osZOrder = useWindowStoreV2((s) => s.zOrder);
  const ampOpen = useAmpStore((s) => s.open);
  const toggleAmp = useAmpStore((s) => s.toggle);
  const chatOpen = useChatAppStore((s) => s.open);
  const toggleChat = useChatAppStore((s) => s.toggle);

  // Magnification only makes sense with a hovering fine pointer, and only
  // when the user hasn't asked for reduced motion.
  const [magnify, setMagnify] = useState(false);
  useEffect(() => {
    const fine = window.matchMedia('(pointer: fine)');
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setMagnify(fine.matches && !reduce.matches);
    update();
    fine.addEventListener('change', update);
    reduce.addEventListener('change', update);
    return () => {
      fine.removeEventListener('change', update);
      reduce.removeEventListener('change', update);
    };
  }, []);

  // ── Auto-hide (founder #5) ────────────────────────────────────────────
  // 60s with no pointer/keyboard/wheel activity → the dock slides off the
  // bottom edge and fades, leaving wallpaper + windows. ANY activity brings
  // it back instantly and re-arms the timer. Fine-pointer desktops only —
  // on touch the dock is primary navigation and never hides.
  //
  // Cost discipline: one shared timeout, passive capture listeners, and a
  // ref-gated state flip so per-pointermove work while visible is a ref
  // read — zero re-renders.
  const [dockHidden, setDockHidden] = useState(false);
  const dockHiddenRef = useRef(false);
  const dockHoverRef = useRef(false);
  useEffect(() => {
    const fine = window.matchMedia('(pointer: fine)');
    let timer: ReturnType<typeof setTimeout> | undefined;

    const setHidden = (next: boolean) => {
      if (dockHiddenRef.current === next) return;
      dockHiddenRef.current = next;
      setDockHidden(next);
    };
    const schedule = () => {
      clearTimeout(timer);
      if (!fine.matches) return;
      timer = window.setTimeout(hide, DOCK_HIDE_AFTER_MS) as unknown as ReturnType<typeof setTimeout>;
    };
    const hide = () => {
      // Never vanish under the cursor or mid window drag/resize (the body
      // class covers both gestures) — re-arm and retry after another quiet
      // minute instead.
      if (
        dockHoverRef.current ||
        document.body.classList.contains('foid-window-dragging')
      ) {
        schedule();
        return;
      }
      setHidden(true);
    };
    const wake = () => {
      setHidden(false);
      schedule();
    };
    const onPointerMove = (e: PointerEvent) => {
      // Any motion is activity; the bottom edge is ALSO an explicit reveal
      // zone so the dock stays reachable even if the activity set is ever
      // gated harder.
      if (e.clientY >= window.innerHeight - DOCK_REVEAL_ZONE_PX) {
        setHidden(false);
      }
      wake();
    };
    const onFineChange = () => {
      if (!fine.matches) {
        clearTimeout(timer);
        setHidden(false); // touch: dock is primary nav, always visible
      } else {
        schedule();
      }
    };

    window.addEventListener('pointermove', onPointerMove, { capture: true, passive: true });
    window.addEventListener('pointerdown', wake, { capture: true, passive: true });
    window.addEventListener('keydown', wake, { capture: true, passive: true });
    window.addEventListener('wheel', wake, { capture: true, passive: true });
    fine.addEventListener('change', onFineChange);
    schedule();
    return () => {
      clearTimeout(timer);
      window.removeEventListener('pointermove', onPointerMove, true);
      window.removeEventListener('pointerdown', wake, true);
      window.removeEventListener('keydown', wake, true);
      window.removeEventListener('wheel', wake, true);
      fine.removeEventListener('change', onFineChange);
    };
  }, []);

  // Shell viewport flag for the HOME tile (client-only: false on the server
  // and the first paint, so hydration stays consistent). While true and on
  // "/", HOME is "show desktop" — a window toggle, not a navigation.
  const [desktopShell, setDesktopShell] = useState(false);
  useEffect(() => {
    if (!FOID_DESKTOP_ENABLED) return;
    const mq = window.matchMedia(`(min-width: ${DESKTOP_MIN_WIDTH}px)`);
    const update = () => setDesktopShell(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  // ── Arrival (the login → desktop payoff) ──────────────────────────────
  // The dock is unmounted during the /enter boot (ClientLayout), so its
  // first mount this session IS the desktop coming up after the enter
  // click. Play a one-shot slide-up then — but only once per tab session
  // (claimDockArrival), so route hops don't replay it. The class carries a
  // brief `animation`; auto-hide (60s) can't fire inside that window, so it
  // never fights the transform-based hide. Reduced motion no-ops in CSS.
  const [arriving, setArriving] = useState(false);
  useEffect(() => {
    if (!claimDockArrival()) return;
    setArriving(true);
    // Drop the class once the entrance is done so the transform property is
    // handed cleanly back to the auto-hide transition system.
    const t = window.setTimeout(() => setArriving(false), 720);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <nav
      className={`foid-dock fixed left-0 right-0 z-50 flex justify-center pointer-events-none${
        dockHidden ? ' foid-dock--hidden' : ''
      }${arriving ? ' foid-dock--arriving' : ''}`}
      style={{ bottom: 'calc(10px + env(safe-area-inset-bottom, 0px))' }}
      aria-label="Primary navigation"
      // Stays in the DOM while hidden (visibility-based hiding preserves
      // tab order); aria-hidden + non-hit-testability come along for free.
      aria-hidden={dockHidden || undefined}
      onMouseEnter={() => { dockHoverRef.current = true; }}
      onMouseLeave={() => { dockHoverRef.current = false; }}
    >
      <div
        className="pointer-events-auto flex items-center h-16 px-3 rounded-[24px] border border-white/[0.16] backdrop-blur-2xl"
        style={{
          background:
            'linear-gradient(180deg, rgba(90, 150, 200, 0.20), rgba(20, 40, 70, 0.55)), rgba(6, 10, 18, 0.55)',
          boxShadow:
            '0 12px 32px rgba(0, 10, 30, 0.5), 0 0 40px rgba(100, 180, 255, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.18)',
          maxWidth: 'calc(100vw - 20px)',
        }}
        onMouseMove={magnify ? (e) => mouseX.set(e.clientX) : undefined}
        onMouseLeave={magnify ? () => mouseX.set(Infinity) : undefined}
      >
        {navItems.map((item) => {
          const isHome = item.href === '/';
          // HOME in the shell is "show desktop": its puck only lights when
          // the desktop itself is the foreground — on "/" with no window
          // focused (all closed or all parked in the dock).
          const nothingFocused =
            focusedAppId({ windows: osWindows, zOrder: osZOrder }) === undefined;
          const isActive = !item.external && (isHome
            ? pathname === '/' && (!desktopShell || nothingFocused)
            : pathname === item.href || pathname.startsWith(`${item.href}/`));
          // FOID OS shell: app tiles open desktop windows instead of
          // navigating (lg+ only); null when the desktop is opted out
          // (NEXT_PUBLIC_FOID_DESKTOP=0) or the item isn't a shell app.
          const osAppId = desktopAppForHref(item.href);
          const osWin = osAppId ? osWindows[osAppId] : undefined;

          const inner = (
            <motion.div
              className="relative z-10 flex flex-col items-center justify-center"
              whileTap={{ scale: 0.88 }}
              transition={{ duration: 0.1 }}
            >
              <DockIcon mouseX={mouseX}>
                <motion.div
                  className={`transition-colors duration-200 ${isActive ? 'text-white' : 'text-white/55'}`}
                  animate={{ y: isActive ? -1 : 0 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 26 }}
                  style={isActive ? { filter: 'drop-shadow(0 0 8px rgba(150, 220, 255, 0.55))' } : undefined}
                >
                  {item.icon}
                </motion.div>
              </DockIcon>
              <span className={`
                text-[10px] mt-1 font-medium transition-colors duration-200
                ${isActive ? 'text-white' : 'text-white/55'}
              `}>
                {item.label}
              </span>
            </motion.div>
          );

          if (item.external) {
            return (
              <a
                key={item.href}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className="relative flex flex-col items-center justify-center h-full min-w-[64px] px-2 touch-manipulation"
              >
                {inner}
              </a>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              // Explicit prefetch: the dock is always on screen, so every
              // route's chunks + RSC payload are fetched ahead of the click
              // (production only — dev never prefetches).
              prefetch={true}
              className="relative flex flex-col items-center justify-center h-full min-w-[64px] px-2 touch-manipulation"
              aria-current={isActive ? "page" : undefined}
              aria-label={isHome && desktopShell ? 'Show desktop' : undefined}
              onClick={(e) => {
                // FOID OS shell HOME = "show desktop" (macOS F11 feel):
                // on the desktop, genie every open window to the dock;
                // click again with everything parked to bring the same
                // set back. On mobile and from other routes (incl.
                // ?standalone=1 pages) it stays a plain navigation to /.
                if (
                  isHome &&
                  FOID_DESKTOP_ENABLED &&
                  window.innerWidth >= DESKTOP_MIN_WIDTH &&
                  pathname === '/'
                ) {
                  e.preventDefault();
                  const os = useWindowStoreV2.getState();
                  const anyOpen = os.zOrder.some(
                    (id) => os.windows[id]?.status === 'open',
                  );
                  if (anyOpen) os.minimizeAll();
                  else os.restoreAll();
                  return;
                }
                // FOID OS shell: open/focus/restore the app's desktop
                // window instead of navigating (desktop viewports only —
                // mobile keeps route navigation). From another route, jump
                // to the desktop with the window already open.
                if (osAppId && window.innerWidth >= 1024) {
                  e.preventDefault();
                  useWindowStoreV2.getState().open(osAppId);
                  if (pathname !== '/') router.push('/');
                  return;
                }
                // The active app's icon doubles as its dock tile: when the
                // window is minimized, clicking restores it instead of
                // re-navigating.
                if (isActive && windowMinimized) {
                  e.preventDefault();
                  restoreWindow();
                }
              }}
            >
              {/* Glass puck slides between items on a spring — dock, not tab strip */}
              {isActive && (
                <motion.div
                  layoutId="dockPuck"
                  className="absolute inset-x-0.5 inset-y-1.5 rounded-2xl border border-white/[0.22]"
                  style={{
                    background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.16), rgba(255, 255, 255, 0.05))',
                    boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.25), 0 0 16px rgba(120, 200, 255, 0.18)',
                    opacity: windowMinimized ? 0.45 : 1,
                  }}
                  transition={{ type: 'spring', stiffness: 500, damping: 32 }}
                />
              )}
              {inner}
              {/* Minimized indicator — the app is parked in the dock
                  (route window via the legacy store, or a FOID OS shell
                  window via windowStore v2) */}
              {((isActive && windowMinimized) || osWin?.status === 'minimized') && (
                <motion.span
                  aria-hidden="true"
                  className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                  style={{ background: 'rgba(150, 220, 255, 0.95)', boxShadow: '0 0 6px rgba(150, 220, 255, 0.8)' }}
                  animate={{ scale: [1, 1.6, 1] }}
                  transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                />
              )}
            </Link>
          );
        })}

        {/* Divider, then MUSIC.EXE — an app tile, not a route. Toggles the
            deck (CompactMusicPlayer). Desktop only: the deck itself is
            hidden on mobile. */}
        <div className="hidden lg:block w-px self-stretch my-3 mx-1" style={{ background: 'rgba(255, 255, 255, 0.14)' }} aria-hidden="true" />
        <button
          type="button"
          onClick={toggleAmp}
          aria-pressed={ampOpen}
          aria-label={ampOpen ? 'Close MUSIC.EXE' : 'Open MUSIC.EXE'}
          className="relative hidden lg:flex flex-col items-center justify-center h-full min-w-[64px] px-2 touch-manipulation"
        >
          {ampOpen && (
            <span
              aria-hidden="true"
              className="absolute inset-x-0.5 inset-y-1.5 rounded-2xl border border-white/[0.22]"
              style={{
                background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.16), rgba(255, 255, 255, 0.05))',
                boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.25), 0 0 16px rgba(120, 200, 255, 0.18)',
              }}
            />
          )}
          <motion.div
            className="relative z-10 flex flex-col items-center justify-center"
            whileTap={{ scale: 0.88 }}
            transition={{ duration: 0.1 }}
          >
            <DockIcon mouseX={mouseX}>
              <div
                className={`transition-colors duration-200 ${ampOpen ? 'text-white' : 'text-white/55'}`}
                style={ampOpen ? { filter: 'drop-shadow(0 0 8px rgba(150, 220, 255, 0.55))' } : undefined}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                  <path d="M9 18V5l12-2v13" />
                  <circle cx="6" cy="18" r="3" />
                  <circle cx="18" cy="16" r="3" />
                </svg>
              </div>
            </DockIcon>
            <span className={`text-[10px] mt-1 font-medium transition-colors duration-200 ${ampOpen ? 'text-white' : 'text-white/55'}`}>
              Music
            </span>
          </motion.div>
          {ampOpen && (
            <span
              aria-hidden="true"
              className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
              style={{ background: 'rgba(150, 220, 255, 0.95)', boxShadow: '0 0 6px rgba(150, 220, 255, 0.8)' }}
            />
          )}
        </button>

        {/* CHAT.EXE — the loreboard chat as an app tile. Toggles the
            floating chat window (ChatApp). Desktop only: mobile keeps the
            board sidebar chat. */}
        <button
          type="button"
          onClick={toggleChat}
          aria-pressed={chatOpen}
          aria-label={chatOpen ? 'Close CHAT.EXE' : 'Open CHAT.EXE'}
          className="relative hidden lg:flex flex-col items-center justify-center h-full min-w-[64px] px-2 touch-manipulation"
        >
          {chatOpen && (
            <span
              aria-hidden="true"
              className="absolute inset-x-0.5 inset-y-1.5 rounded-2xl border border-white/[0.22]"
              style={{
                background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.16), rgba(255, 255, 255, 0.05))',
                boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.25), 0 0 16px rgba(120, 200, 255, 0.18)',
              }}
            />
          )}
          <motion.div
            className="relative z-10 flex flex-col items-center justify-center"
            whileTap={{ scale: 0.88 }}
            transition={{ duration: 0.1 }}
          >
            <DockIcon mouseX={mouseX}>
              <div
                className={`transition-colors duration-200 ${chatOpen ? 'text-white' : 'text-white/55'}`}
                style={chatOpen ? { filter: 'drop-shadow(0 0 8px rgba(150, 220, 255, 0.55))' } : undefined}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
            </DockIcon>
            <span className={`text-[10px] mt-1 font-medium transition-colors duration-200 ${chatOpen ? 'text-white' : 'text-white/55'}`}>
              Chat
            </span>
          </motion.div>
          {chatOpen && (
            <span
              aria-hidden="true"
              className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
              style={{ background: 'rgba(150, 220, 255, 0.95)', boxShadow: '0 0 6px rgba(150, 220, 255, 0.8)' }}
            />
          )}
        </button>
      </div>
    </nav>
  );
}
