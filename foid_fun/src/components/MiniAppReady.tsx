"use client";

import { useEffect } from "react";

// Farcaster / Base App mini-app handshake (audit G3). Inside a mini-app
// host the splash screen stays up until the app calls sdk.actions.ready().
// The SDK is only imported when we are actually embedded, so the normal
// site never pays for it.
export default function MiniAppReady() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const embedded = window.self !== window.top;
    const flagged = new URLSearchParams(window.location.search).has("miniapp");
    if (!embedded && !flagged) return;
    import("@farcaster/miniapp-sdk")
      .then(({ sdk }) => sdk.actions.ready())
      .catch(() => {
        /* not a mini-app host after all */
      });
  }, []);
  return null;
}
