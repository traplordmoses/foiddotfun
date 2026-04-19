"use client";

// src/components/AnalyticsBoot.tsx
//
// Client-only component that boots PostHog once on mount. Renders nothing.
// Must sit inside <Providers /> so wallet state is observable here — we
// identify the connected account (hashed) and reset on disconnect.

import { useEffect } from "react";
import { useAccount } from "wagmi";
import {
  bootAnalytics,
  identify,
  reset,
  hashedDistinctId,
} from "@/lib/analytics";

export function AnalyticsBoot() {
  useEffect(() => {
    bootAnalytics();
  }, []);

  const { address, status } = useAccount();

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (status === "disconnected") {
        reset();
        return;
      }
      if (!address) return;
      // Hash wallet || sessionId. sessionStorage may not exist in RSC/test
      // contexts; guard the read.
      const sessionId =
        (typeof window !== "undefined" &&
          window.sessionStorage?.getItem?.("foid_session_id")) ||
        "";
      const distinctId = await hashedDistinctId(`${address}|${sessionId}`);
      if (cancelled) return;
      identify(distinctId, {
        // Never include raw address. Chain id is coarse enough to be safe.
        chain: "fluent",
      });
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [address, status]);

  return null;
}
