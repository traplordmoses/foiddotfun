"use client";

import { useCallback } from "react";
import EnterGate from "@/components/EnterGate";

const TWENTY_FOUR_HOURS = 60 * 60 * 24;

export default function EnterPage() {
  const handleEnter = useCallback(() => {
    document.cookie = `foid_entered=1; max-age=${TWENTY_FOUR_HOURS}; path=/; samesite=lax`;
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
