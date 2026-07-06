'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';

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

export function MobileNav() {
  const pathname = usePathname();

  return (
    // FOID OS dock: a floating glass pill, not an edge-docked bar. The nav
    // is the brand's chrome — same material as the windows above it.
    <nav
      className="lg:hidden fixed left-0 right-0 z-50 flex justify-center pointer-events-none"
      style={{ bottom: 'calc(10px + env(safe-area-inset-bottom, 0px))' }}
    >
      <div
        className="pointer-events-auto flex items-center h-16 px-2 rounded-[24px] border border-white/[0.16] backdrop-blur-2xl"
        style={{
          background:
            'linear-gradient(180deg, rgba(90, 150, 200, 0.20), rgba(20, 40, 70, 0.55)), rgba(6, 10, 18, 0.55)',
          boxShadow:
            '0 12px 32px rgba(0, 10, 30, 0.5), 0 0 40px rgba(100, 180, 255, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.18)',
          maxWidth: 'calc(100vw - 20px)',
        }}
      >
        {navItems.map((item) => {
          const isActive = !item.external && (item.href === '/' ? pathname === '/' : pathname === item.href || pathname.startsWith(`${item.href}/`));

          const inner = (
            <motion.div
              className="relative z-10 flex flex-col items-center justify-center"
              whileTap={{ scale: 0.88 }}
              transition={{ duration: 0.1 }}
            >
              <motion.div
                className={`transition-colors duration-200 ${isActive ? 'text-white' : 'text-white/55'}`}
                animate={{ y: isActive ? -1 : 0, scale: isActive ? 1.08 : 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 26 }}
                style={isActive ? { filter: 'drop-shadow(0 0 8px rgba(150, 220, 255, 0.55))' } : undefined}
              >
                {item.icon}
              </motion.div>
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
                className="relative flex flex-col items-center justify-center h-full min-w-[52px] px-1.5 touch-manipulation"
              >
                {inner}
              </a>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className="relative flex flex-col items-center justify-center h-full min-w-[52px] px-1.5 touch-manipulation"
              aria-current={isActive ? "page" : undefined}
            >
              {/* Glass puck slides between items on a spring — dock, not tab strip */}
              {isActive && (
                <motion.div
                  layoutId="dockPuck"
                  className="absolute inset-x-0.5 inset-y-1.5 rounded-2xl border border-white/[0.22]"
                  style={{
                    background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.16), rgba(255, 255, 255, 0.05))',
                    boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.25), 0 0 16px rgba(120, 200, 255, 0.18)',
                  }}
                  transition={{ type: 'spring', stiffness: 500, damping: 32 }}
                />
              )}
              {inner}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
