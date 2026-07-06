"use client";

// FOID_MOMMY_TERMINAL.EXE route (/pray) — thin wrapper around the extracted
// PrayAppCore (src/apps/PrayApp.tsx). The app content is shared verbatim
// with the desktop shell's PRAY window (multi-window plan §4): the route
// presentation renders today's page exactly — mobile ritual tree + desktop
// window tree (titlebar, warnings, journal drawer, boot sequence), with
// the page's styled-jsx traveling inside PrayAppCore. Same top-level
// PrayerErrorBoundary as always.

import { PrayerErrorBoundary } from "@/components/PrayerErrorBoundary";
import { PrayAppCore } from "@/apps/PrayApp";

export default function PrayPage() {
  return (
    <PrayerErrorBoundary>
      <PrayAppCore presentation="route" />
    </PrayerErrorBoundary>
  );
}
