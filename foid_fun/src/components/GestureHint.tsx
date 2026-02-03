'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface GestureHintProps {
  storageKey: string;
  hints: string[];
}

export function GestureHint({ storageKey, hints }: GestureHintProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check if user has seen this hint before
    const hasSeenHint = localStorage.getItem(storageKey);
    if (!hasSeenHint) {
      // Show hint after a brief delay
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [storageKey]);

  const handleDismiss = () => {
    setIsVisible(false);
    localStorage.setItem(storageKey, 'true');
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={handleDismiss}
          />

          {/* Hint Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-60 w-[90vw] max-w-md"
          >
            <div className="bg-gradient-to-br from-purple-900/95 to-blue-900/95 backdrop-blur-xl border-2 border-purple-400/30 rounded-3xl shadow-2xl p-6">
              <div className="text-center mb-4">
                <div className="text-4xl mb-3">👆</div>
                <h3 className="text-xl font-bold text-white mb-2">Quick Tutorial</h3>
              </div>

              <div className="space-y-3 mb-6">
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
}
