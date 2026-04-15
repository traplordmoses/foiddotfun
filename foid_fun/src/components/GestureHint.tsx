'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';

interface GestureHintProps {
  storageKey: string;
  hints: string[];
}

export function GestureHint({ storageKey, hints }: GestureHintProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Only show on mobile (matches lg:hidden breakpoint at 1024px)
    const mq = window.matchMedia('(max-width: 1023px)');
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    if (!isMobile) return;
    // Check if user has seen this hint before
    const hasSeenHint = localStorage.getItem(storageKey);
    if (!hasSeenHint) {
      // Show hint after a brief delay
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [storageKey, isMobile]);

  const handleDismiss = () => {
    setIsVisible(false);
    localStorage.setItem(storageKey, 'true');
  };

  // Use a portal so fixed positioning isn't broken by ancestor transforms
  const content = (
    <AnimatePresence>
      {isVisible && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="bg-black/60 backdrop-blur-sm"
            style={{ position: 'fixed', inset: 0, zIndex: 9998 }}
            onClick={handleDismiss}
          />

          {/* Hint Card — use inset + margin:auto for centering (avoids transform conflict with framer-motion) */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9999,
              width: '90vw',
              maxWidth: '28rem',
              margin: 'auto',
              height: 'fit-content',
            }}
          >
            <div className="bg-gradient-to-br from-purple-900/95 to-blue-900/95 backdrop-blur-xl border-2 border-purple-400/30 rounded-3xl shadow-2xl p-4 sm:p-6">
              <div className="text-center mb-3 sm:mb-4">
                <div className="text-3xl sm:text-4xl mb-2 sm:mb-3">👆</div>
                <h3 className="text-lg sm:text-xl font-bold text-white mb-1 sm:mb-2">Quick Tutorial</h3>
              </div>

              <div className="space-y-2 sm:space-y-3 mb-4 sm:mb-6">
                {hints.map((hint, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-3 text-white/90 text-sm"
                  >
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-500/30 flex items-center justify-center text-xs font-bold">
                      {index + 1}
                    </span>
                    <p>{hint}</p>
                  </div>
                ))}
              </div>

              <button
                onClick={handleDismiss}
                className="w-full py-3 bg-gradient-to-r from-purple-500 to-blue-500 text-white font-bold rounded-xl shadow-lg hover:shadow-purple-500/50 transition-all active:scale-95"
              >
                Got it!
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  if (!mounted) return null;
  return createPortal(content, document.body);
}
