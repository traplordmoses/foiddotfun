"use client";

// FOID_MOMMY_TERMINAL.EXE route (/pray) — thin wrapper around the extracted
// PrayAppCore (src/apps/PrayApp.tsx). Stage C: on desktop viewports this
// route hands off to the shell with PRAY focused (useDesktopHandoff);
// mobile — and ?standalone=1 — keep the standalone presentation: today's
// page exactly — mobile ritual tree + desktop window tree (titlebar,
// warnings, journal drawer, boot sequence), with the page's styled-jsx
// traveling inside PrayAppCore. Same top-level PrayerErrorBoundary.

import { PrayerErrorBoundary } from "@/components/PrayerErrorBoundary";
import { useDesktopHandoff } from "@/components/os/useDesktopHandoff";
import { PrayAppCore } from "@/apps/PrayApp";

export default function PrayPage() {
  const handedOff = useDesktopHandoff("pray");
  if (handedOff) return null;
  return (
    <PrayerErrorBoundary>
      <PrayAppCore presentation="route" />
    </PrayerErrorBoundary>
  );
}
