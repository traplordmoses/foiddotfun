"use client";

import { useCallback, useEffect, useState } from "react";
import EnterGate from "@/components/EnterGate";
import { ENTERED_COOKIE } from "@/lib/foidOsBoot";

// One boot per device (audit P7). The cookie used to last 24 hours, which
// replayed the ceremony every day; a year matches "first visit moment".
const ONE_YEAR = 60 * 60 * 24 * 365;

export default function EnterPage() {
  const handleEnter = useCallback(() => {
    document.cookie = `${ENTERED_COOKIE}=1; max-age=${ONE_YEAR}; path=/; samesite=lax`;
  }, []);

  // The boot lands on the desktop shell — and carries any deep-link query
  // along with it (middleware + the desktop gate preserve ?apps=…&focus=…
  // when they bounce an un-booted visit through /enter, so a shared
  // /?apps=pray,board link still restores after the ceremony). `boot` is
  // the gate's own QA override; it stops here.
  const [destination, setDestination] = useState("/");
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    params.delete("boot");
    const query = params.toString();
    if (query) setDestination(`/?${query}`);
  }, []);

  return (
    <EnterGate
      destination={destination}
      navigationMode="replace"
      onEnter={handleEnter}
      enableGlobalEnter
    />
  );
}
