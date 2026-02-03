'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useMobile } from '@/hooks/useMobile';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';

export function MobileWalletButton() {
  const { isMobile } = useMobile();
  const [show, setShow] = useState(false);

  // Delay showing to avoid flash on page load
  useEffect(() => {
    const timer = setTimeout(() => setShow(true), 500);
    return () => clearTimeout(timer);
  }, []);

  if (!isMobile || !show) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
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
