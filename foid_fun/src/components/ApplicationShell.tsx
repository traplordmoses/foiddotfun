"use client";
import type { ReactNode } from "react";
import { Providers } from "@/providers";
import { ClientLayout } from "@/components/ClientLayout";
import SfxInitializer from "@/components/SfxInitializer";
import { WebVitalsReporter } from "@/app/_vitals";
export default function ApplicationShell({ children }: { children: ReactNode }) {
  return <Providers><SfxInitializer /><ClientLayout /><WebVitalsReporter />{children}</Providers>;
}
