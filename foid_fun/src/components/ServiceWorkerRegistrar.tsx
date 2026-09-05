"use client";

import { useEffect } from "react";

// Registers public/sw.js after the page has loaded (production only). The
// worker caches hashed assets and small images; HTML and API traffic stay
// on the network, so a deploy can never strand a client on old chunks.
export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* unsupported or blocked: the site works without it */
      });
    };
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);
  return null;
}
