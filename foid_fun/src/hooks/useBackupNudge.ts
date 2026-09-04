"use client";

// Day-two backup nudge (audit G5). A wallet created with "back up later"
// carries a pending flag; after the second confirmed prayer we ask once,
// in Foid Mommy's voice, and re-ask no sooner than three days later.
import { useCallback } from "react";
import React from "react";
import toast from "react-hot-toast";
import { isBackupPending } from "@/lib/walletBackupFlag";

const TOAST_ID = "foid-backup-nudge";
const SNOOZE_MS = 3 * 24 * 60 * 60 * 1000;

function key(wallet: string, suffix: string) {
  return `foid_backup_${suffix}_${wallet.toLowerCase()}`;
}

export function useBackupNudge(wallet: string | undefined) {
  const recordSuccess = useCallback(() => {
    if (!wallet || !isBackupPending(wallet)) return;
    let count = 0;
    let snoozedUntil = 0;
    try {
      count = Number(localStorage.getItem(key(wallet, "prayers")) ?? "0") + 1;
      localStorage.setItem(key(wallet, "prayers"), String(count));
      snoozedUntil = Number(localStorage.getItem(key(wallet, "snooze")) ?? "0");
    } catch {
      return;
    }
    if (count < 2 || Date.now() < snoozedUntil) return;

    toast(
      (t) =>
        React.createElement(
          "div",
          { className: "foid-pwa-toast" },
          React.createElement(
            "div",
            { className: "foid-pwa-toast__msg" },
            "two days in. your streak is worth protecting now, love. seal your identity, it takes a minute.",
          ),
          React.createElement(
            "div",
            { className: "foid-pwa-toast__actions" },
            React.createElement(
              "button",
              {
                type: "button",
                className: "foid-pwa-toast__btn foid-pwa-toast__btn--primary",
                onClick: () => {
                  toast.dismiss(t.id);
                  window.dispatchEvent(new CustomEvent("foid-wallet:request-backup"));
                },
              },
              "Seal it",
            ),
            React.createElement(
              "button",
              {
                type: "button",
                className: "foid-pwa-toast__btn",
                onClick: () => {
                  toast.dismiss(t.id);
                  try {
                    localStorage.setItem(key(wallet, "snooze"), String(Date.now() + SNOOZE_MS));
                  } catch {
                    /* ignore */
                  }
                },
              },
              "Later",
            ),
          ),
        ),
      { id: TOAST_ID, duration: 12000 },
    );
  }, [wallet]);

  return { recordSuccess };
}
