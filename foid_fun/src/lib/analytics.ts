// /src/lib/analytics.ts
// Thin analytics wrapper. No-op shell for now; swap the `emit` body
// with PostHog / Mixpanel / Segment later without touching call sites.
//
// Usage:
//   import { track } from "@/lib/analytics";
//   track("onboarding_completed");
//   track("retro_mode_triggered", { source: "konami" });
//
// In dev, events are logged to the console so you can verify wiring.

type Props = Record<string, unknown>;

const isBrowser = typeof window !== "undefined";
const isDev = process.env.NODE_ENV !== "production";

function emit(event: string, props?: Props): void {
  if (isDev && isBrowser) {
    // Deliberate console surface — keeps wiring verifiable until a real backend lands.
    // eslint-disable-next-line no-console
    console.debug(`[analytics] ${event}`, props ?? {});
  }
  // TODO(obs): wire to PostHog via window.posthog?.capture(event, props).
}

export function track(event: string, props?: Props): void {
  try {
    emit(event, props);
  } catch {
    // Never let analytics throw into the UI.
  }
}

export default { track };
