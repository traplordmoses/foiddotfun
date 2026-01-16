"use client";

import { useCallback } from "react";
import EnterGate from "@/components/EnterGate";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export default function EnterPage() {
  const handleEnter = useCallback(() => {
    document.cookie = `foid_entered=1; max-age=${ONE_YEAR_SECONDS}; path=/; samesite=lax`;
  }, []);

  return (
    <EnterGate
      destination="/"
      navigationMode="replace"
      onEnter={handleEnter}
      enableGlobalEnter
    />
  );
}
