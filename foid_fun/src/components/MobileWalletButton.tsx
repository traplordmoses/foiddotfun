'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useMobile } from '@/hooks/useMobile';
import { motion, AnimatePresence } from 'framer-motion';

type Props = {
  /** When true, render nothing — the caller has placed wallet UI inline. */
  suppress?: boolean;
};

export function MobileWalletButton({ suppress = false }: Props) {
  const { isMobile } = useMobile();

  if (!isMobile || suppress) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 10 }}
        transition={{ duration: 0.2 }}
        className="fixed top-4 right-4 z-[9999] touch-target mobile-wallet-button"
      >
        <ConnectButton
          chainStatus="icon"
          showBalance={false}
          accountStatus={{
            smallScreen: 'avatar',
            largeScreen: 'full',
          }}
        />
      </motion.div>
    </AnimatePresence>
  );
}
