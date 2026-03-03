'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useMobile } from '@/hooks/useMobile';

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
    href: '/swipe',
    label: 'Swipe',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <path d="M6 4l12 8-12 8V4z" />
        <line x1="18" y1="4" x2="18" y2="20" />
      </svg>
    ),
  },
  {
    href: '/gallery',
    label: 'Gallery',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <rect x="2" y="2" width="20" height="20" rx="2" />
        <path d="M2 10h20" />
        <path d="M10 2v20" />
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
    href: 'https://faucet.dev.thefluent.xyz/',
    label: 'Faucet',
    external: true,
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <path d="M12 2v6" />
        <path d="M8 8h8l-1 4H9L8 8z" />
        <path d="M12 12v4" />
        <circle cx="12" cy="19" r="3" />
      </svg>
    ),
  },
];

export function MobileNav() {
  const pathname = usePathname();
  const { isIOS } = useMobile();

  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-black/95 backdrop-blur-xl border-t border-white/10"
      style={{
        paddingBottom: isIOS ? 'env(safe-area-inset-bottom)' : '0',
      }}
    >
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          const isActive = !item.external && (item.href === '/' ? pathname === '/' : pathname === item.href || pathname.startsWith(`${item.href}/`));

          const inner = (
            <motion.div
              className="flex flex-col items-center justify-center"
              whileTap={{ scale: 0.9 }}
              transition={{ duration: 0.1 }}
            >
              <div className={`
                transition-colors duration-200
                ${isActive ? 'text-white' : 'text-white/50'}
              `}>
                {item.icon}
              </div>
              <span className={`
                text-[10px] mt-1 font-medium transition-colors duration-200
                ${isActive ? 'text-white' : 'text-white/50'}
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
                className="relative flex flex-col items-center justify-center flex-1 h-full min-w-[48px] touch-manipulation"
              >
                {inner}
              </a>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className="relative flex flex-col items-center justify-center flex-1 h-full min-w-[48px] touch-manipulation"
            >
              {inner}
              {isActive && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-1 bg-white rounded-full"
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
