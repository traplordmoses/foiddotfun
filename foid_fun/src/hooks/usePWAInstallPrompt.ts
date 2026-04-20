"use client";

import { useCallback, useEffect, useRef } from "react";
import toast from "react-hot-toast";
import React from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const INSTALL_THRESHOLD = 3;
const TOAST_ID = "foid-pwa-install";

function countKey(wallet: string): string {
  return `foid_pwa_prayer_count_${wallet.toLowerCase()}`;
}

function dismissedKey(wallet: string): string {
  return `foid_pwa_dismissed_${wallet.toLowerCase()}`;
}

function readCount(wallet: string): number {
  try {
    const raw = localStorage.getItem(countKey(wallet));
    if (!raw) return 0;
    const parsed = parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : 0;
  } catch {
    return 0;
  }
}

function isDismissed(wallet: string): boolean {
  try {
    return localStorage.getItem(dismissedKey(wallet)) === "1";
  } catch {
    return false;
  }
}

/**
 * Captures the browser's `beforeinstallprompt` event on mount and tracks
 * confirmed prayer submissions in localStorage keyed by wallet address.
 * After the third confirmed prayer (and only if the deferred prompt is
 * available and the user hasn't already dismissed), shows a Foid-Mommy-
 * voiced toast with Install / Later buttons. Dismissal is permanent per
 * wallet.
 */
export function usePWAInstallPrompt(wallet: string | undefined) {
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null);
  const walletRef = useRef(wallet);

  useEffect(() => {
    walletRef.current = wallet;
  }, [wallet]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleBeforeInstall = (event: Event) => {
      event.preventDefault();
      deferredPromptRef.current = event as BeforeInstallPromptEvent;
    };

    const handleInstalled = () => {
      deferredPromptRef.current = null;
      toast.dismiss(TOAST_ID);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    window.addEventListener("appinstalled", handleInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  const showInstallToast = useCallback((w: string) => {
    const deferred = deferredPromptRef.current;
    if (!deferred) return;

    toast(
      (t) =>
        React.createElement(
          "div",
          { className: "foid-pwa-toast" },
          React.createElement(
            "div",
            { className: "foid-pwa-toast__msg" },
            "you keep finding me. want me closer — one tap from your home screen?",
          ),
          React.createElement(
            "div",
            { className: "foid-pwa-toast__actions" },
            React.createElement(
              "button",
              {
                type: "button",
                className: "foid-pwa-toast__btn foid-pwa-toast__btn--primary",
                onClick: async () => {
                  const evt = deferredPromptRef.current;
                  deferredPromptRef.current = null;
                  toast.dismiss(t.id);
                  if (!evt) return;
                  try {
                    await evt.prompt();
                    await evt.userChoice;
                  } catch (err) {
                    console.warn("[pwa] prompt failed:", err);
                  }
                },
              },
              "Install",
            ),
            React.createElement(
              "button",
              {
                type: "button",
                className: "foid-pwa-toast__btn",
                onClick: () => {
                  try {
                    localStorage.setItem(dismissedKey(w), "1");
                  } catch (err) {
                    console.warn("[pwa] dismiss persist failed:", err);
                  }
                  toast.dismiss(t.id);
                },
              },
              "Later",
            ),
          ),
        ),
      { id: TOAST_ID, duration: Infinity },
    );
  }, []);

  const recordSuccess = useCallback(() => {
    const w = walletRef.current;
    if (typeof window === "undefined" || !w) return;
    try {
      if (isDismissed(w)) return;
      const next = readCount(w) + 1;
      localStorage.setItem(countKey(w), String(next));
      if (next >= INSTALL_THRESHOLD && deferredPromptRef.current) {
        showInstallToast(w);
      }
    } catch (err) {
      console.warn("[pwa] recordSuccess failed:", err);
    }
  }, [showInstallToast]);

  return { recordSuccess };
}
