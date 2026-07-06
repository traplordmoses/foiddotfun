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
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  type MotionValue,
} from 'framer-motion';
import { useWindowStore } from '@/stores/windowStore';
import { useAmpStore } from '@/stores/ampStore';

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
  const mouseX = useMotionValue(Infinity);
  const windowMinimized = useWindowStore((s) => s.minimized);
  const restoreWindow = useWindowStore((s) => s.restore);
  const ampOpen = useAmpStore((s) => s.open);
  const toggleAmp = useAmpStore((s) => s.toggle);

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

  return (
    <nav
      className="fixed left-0 right-0 z-50 flex justify-center pointer-events-none"
      style={{ bottom: 'calc(10px + env(safe-area-inset-bottom, 0px))' }}
      aria-label="Primary navigation"
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
          const isActive = !item.external && (item.href === '/' ? pathname === '/' : pathname === item.href || pathname.startsWith(`${item.href}/`));

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
              className="relative flex flex-col items-center justify-center h-full min-w-[64px] px-2 touch-manipulation"
              aria-current={isActive ? "page" : undefined}
              onClick={(e) => {
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
              {/* Minimized indicator — the app is parked in the dock */}
              {isActive && windowMinimized && (
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

        {/* Divider, then FOID AMP — an app tile, not a route. Toggles the
            deck (CompactMusicPlayer). Desktop only: the deck itself is
            hidden on mobile. */}
        <div className="hidden lg:block w-px self-stretch my-3 mx-1" style={{ background: 'rgba(255, 255, 255, 0.14)' }} aria-hidden="true" />
        <button
          type="button"
          onClick={toggleAmp}
          aria-pressed={ampOpen}
          aria-label={ampOpen ? 'Close FOID AMP' : 'Open FOID AMP'}
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
              AMP
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
      </div>
    </nav>
  );
}
