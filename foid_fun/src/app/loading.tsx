"use client";

import { usePathname } from "next/navigation";
import { RouteLoadingShell } from "@/components/ui/RouteLoadingShell";

// Fallback for every route without its own loading.tsx. Home shows nothing
// while it loads: phones open on the home screen and desktops on the FOID OS
// shell, and a FOID_FOUNDATION.EXE window flashing on the way there read as
// the wrong app opening.
export default function RootLoading() {
  const pathname = usePathname();
  if (pathname === "/") return null;
  return (
    <RouteLoadingShell
      pageClassName="home-page"
      title={pathname.startsWith("/watch") ? "MIFOID.TV" : "FOID_FOUNDATION.EXE"}
      label="loading..."
    />
  );
}
