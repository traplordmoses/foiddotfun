import type { ReactNode } from "react";
import AppChrome from "@/components/AppChrome";

export default function AppLayout({ children }: { children: ReactNode }) {
  return <AppChrome>{children}</AppChrome>;
}
