"use client";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import MiniAppReady from "@/components/MiniAppReady";
import ServiceWorkerRegistrar from "@/components/ServiceWorkerRegistrar";
import type { ReactNode } from "react";
const ApplicationShell = dynamic(() => import("@/components/ApplicationShell"));
/** Keep wallet, music, chat and analytics code out of the entry bundle. */
export default function AppRuntime({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/enter") return <><ServiceWorkerRegistrar /><MiniAppReady />{children}</>;
  return <ApplicationShell>{children}</ApplicationShell>;
}
