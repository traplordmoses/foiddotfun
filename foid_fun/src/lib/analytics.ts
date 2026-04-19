// src/lib/analytics.ts
//
// PostHog wrapper. Every export is a safe no-op when:
//   - NEXT_PUBLIC_POSTHOG_KEY is not set (dev, self-host, privacy-preserving
//     forks).
//   - The user has Do-Not-Track enabled.
//   - We're running on the server (no-ops are safe to import from RSC).
//
// Boot lives in <AnalyticsBoot /> (mounted once at the provider root). This
// file owns the imperative surface — track/identify/reset — plus helpers
// used by the boot component.
//
// Wallet addresses MUST NOT be sent to PostHog in raw form. Use
// hashedDistinctId() before passing an address to identify().

import posthog from "posthog-js";

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY ?? "";
const POSTHOG_HOST =
  process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";

let booted = false;
let optedOut = false;

function hasDntEnabled(): boolean {
  if (typeof window === "undefined") return false;
  const nav = window.navigator;
  const dnt =
    nav.doNotTrack ??
    (nav as unknown as { msDoNotTrack?: string }).msDoNotTrack ??
    (window as unknown as { doNotTrack?: string }).doNotTrack;
  return dnt === "1" || dnt === "yes";
}

/**
 * Whether analytics should actually dispatch. Checked on every call so a
 * user toggling DNT mid-session stops being tracked without a reload.
 */
export function analyticsEnabled(): boolean {
  if (!POSTHOG_KEY) return false;
  if (typeof window === "undefined") return false;
  if (hasDntEnabled()) return false;
  if (optedOut) return false;
  return booted;
}

/**
 * Boot PostHog. Idempotent — safe to call from StrictMode double-mount.
 * No-ops silently when the key is missing or DNT is on.
 */
export function bootAnalytics(): void {
  if (booted) return;
  if (!POSTHOG_KEY) return;
  if (typeof window === "undefined") return;
  if (hasDntEnabled()) {
    optedOut = true;
    return;
  }
  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    capture_pageview: true,
    capture_pageleave: true,
    persistence: "localStorage+cookie",
    autocapture: false,
    disable_session_recording: true,
    loaded: () => {
      booted = true;
    },
  });
  // PostHog resolves `loaded` asynchronously; mark booted immediately so
  // early events queue into posthog-js's internal buffer rather than being
  // dropped by analyticsEnabled().
  booted = true;
}

/**
 * Emit an event. Properties are forwarded as-is; caller is responsible for
 * ensuring no PII (raw wallet addresses, tokens, signatures) leaks in.
 */
export function track(
  event: string,
  properties?: Record<string, unknown>,
): void {
  if (!analyticsEnabled()) return;
  posthog.capture(event, properties);
}

/**
 * Associate the current session with a stable identifier. `distinctId`
 * should already be hashed — never pass a raw 0x... address here.
 */
export function identify(
  distinctId: string,
  traits?: Record<string, unknown>,
): void {
  if (!analyticsEnabled()) return;
  posthog.identify(distinctId, traits);
}

/**
 * Clear identity — call on wallet disconnect / explicit sign-out so the
 * next session starts with a fresh anonymous id.
 */
export function reset(): void {
  if (!analyticsEnabled()) return;
  posthog.reset();
}

/**
 * SHA-256 of `wallet || sessionId`, hex-encoded. Wallet address is never
 * sent anywhere in raw form. Falls back to a deterministic non-crypto hash
 * in environments where `crypto.subtle` is unavailable (old browsers, tests).
 */
export async function hashedDistinctId(input: string): Promise<string> {
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const data = new TextEncoder().encode(input);
    const digest = await crypto.subtle.digest("SHA-256", data);
    const bytes = new Uint8Array(digest);
    let hex = "";
    for (let i = 0; i < bytes.length; i++) {
      hex += bytes[i].toString(16).padStart(2, "0");
    }
    return `wh_${hex}`;
  }
  // Deterministic non-crypto fallback. 32-bit FNV-1a is good enough for a
  // stable pseudonymous id when WebCrypto is missing (old mobile Safari,
  // jsdom tests). The `wx_` prefix makes the fallback path distinguishable
  // from the real hash in the PostHog UI.
  let h = 2166136261 >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return `wx_${h.toString(16).padStart(8, "0")}`;
}
