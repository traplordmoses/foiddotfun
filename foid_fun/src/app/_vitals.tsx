"use client";

// src/app/_vitals.tsx
//
// Web Vitals reporter. Mounted once at the app root. Emits a single
// `web_vital` event per metric with {name, value, rating, route} so the
// PostHog dashboard can chart Core Web Vitals alongside the funnel events.
//
// No-op when analytics is disabled (missing key / DNT) because track()
// is the guard.

import { useReportWebVitals } from "next/web-vitals";
import { usePathname } from "next/navigation";
import { track } from "@/lib/analytics";

export function WebVitalsReporter() {
  const pathname = usePathname();

  useReportWebVitals((metric) => {
    track("web_vital", {
      name: metric.name,
      value: metric.value,
      rating: (metric as unknown as { rating?: string }).rating,
      route: pathname ?? "unknown",
      id: metric.id,
    });
  });

  return null;
}
