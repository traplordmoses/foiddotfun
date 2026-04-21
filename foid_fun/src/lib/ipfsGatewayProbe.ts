// /src/lib/ipfsGatewayProbe.ts
// Parallel gateway racing — finds the fastest gateway for the current user
// by preloading a small test CID across every candidate and declaring the
// first onload the winner.
//
// Why racing instead of sequential:
//   The previous implementation tried gateways one at a time with a 6s stall
//   timeout. On a cold session with a slow first gateway, users waited 6-18s
//   before seeing any images. Racing cuts that to "fastest gateway + ~100ms
//   of probe overhead" — typically 200-800ms.
//
// The winner is persisted via markGatewaySuccess so subsequent page loads
// (and subsequent IpfsImage mounts within the same page) use it directly
// without re-probing. Probe is a singleton — only one runs per page load.
"use client";

import { getIpfsGatewayBases } from "./ipfsUrl";
import { getPreferredGateway, markGatewaySuccess, markGatewayFailure } from "./ipfsGatewayCache";

const PROBE_TIMEOUT_MS = 4000;

let probePromise: Promise<string | null> | null = null;

/**
 * Race an <Image> preload across all candidate gateways for `cid`. First to
 * complete its onload event wins; the rest are aborted (browser may still
 * finish a small amount of in-flight data, which is fine — this runs once
 * per session at most).
 *
 * Returns the base URL of the winner (without `/ipfs/<cid>` suffix) or null
 * if every gateway failed or the timeout elapsed.
 */
export function probeGatewaysForCid(cid: string): Promise<string | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (!cid) return Promise.resolve(null);

  const existing = getPreferredGateway();
  if (existing) return Promise.resolve(existing);
  if (probePromise) return probePromise;

  const bases = getIpfsGatewayBases();
  if (bases.length === 0) return Promise.resolve(null);

  probePromise = new Promise<string | null>((resolve) => {
    const probes: HTMLImageElement[] = [];
    let settled = false;
    let remaining = bases.length;

    const settle = (winnerBase: string | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      // Detach handlers to drop references; the browser will finish whatever
      // bytes were already in flight and move on.
      for (const img of probes) {
        img.onload = null;
        img.onerror = null;
      }
      if (winnerBase) {
        const cleaned = winnerBase.replace(/\/+$/, "");
        markGatewaySuccess(`${cleaned}/ipfs/${cid}`);
      }
      resolve(winnerBase);
    };

    const timer = setTimeout(() => settle(null), PROBE_TIMEOUT_MS);

    for (const base of bases) {
      const cleaned = base.replace(/\/+$/, "");
      const img = new Image();
      img.onload = () => settle(cleaned);
      img.onerror = () => {
        // Don't poison the circuit breaker from a probe — CORS or transient
        // failures here shouldn't lock out the gateway for the real render.
        // Only record success (the fast path); failures just decrement.
        remaining--;
        if (remaining === 0 && !settled) settle(null);
      };
      img.src = `${cleaned}/ipfs/${cid}`;
      probes.push(img);
    }
  });

  return probePromise;
}

/**
 * Test-only — resets the singleton probe promise so unit tests can exercise
 * repeated probing. Never call from production code.
 */
export function __resetProbeForTests(): void {
  probePromise = null;
}

// markGatewayFailure re-export keeps this module the single import site for
// probe-related cache plumbing (callers in tests / instrumentation).
export { markGatewayFailure };
