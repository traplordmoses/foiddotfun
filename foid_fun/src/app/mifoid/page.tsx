"use client";

// MIFOID.EXE route (/mifoid) — thin window wrapper around the extracted
// MifoidApp (src/apps/MifoidApp.tsx). Stage C: on desktop viewports this
// route hands off to the shell with MIFOID focused (useDesktopHandoff);
// mobile — and ?standalone=1 — keep the standalone presentation:
// full-viewport main (.mifoid-page hangs the window-width reflow rules),
// one vista-window, titlebar wallet wiring.

import { useCallback, useEffect, useState } from "react";
import { useAccount, useDisconnect } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import AppTitlebar from "@/app/(components)/AppTitlebar";
import { useDesktopHandoff } from "@/components/os/useDesktopHandoff";
import MifoidApp from "@/apps/MifoidApp";

export default function MiFOIDPage() {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { openConnectModal } = useConnectModal();
  const handedOff = useDesktopHandoff("mifoid");

  /* Hydration fix — server renders disconnected, client may differ */
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const handleSwitchWallet = useCallback(() => {
    disconnect();
    setTimeout(() => openConnectModal?.(), 100);
  }, [disconnect, openConnectModal]);

  if (handedOff) return null;

  return (
    <main
      className="mifoid-page relative bg-foid-bg text-white/90 overflow-hidden flex items-center justify-center"
      style={{ height: "100vh" }}
    >
      <div className="pointer-events-none fixed inset-0 z-0 vignette" />

      <section className="relative z-10 w-full max-w-full px-2 sm:px-4">
        <div className="mx-auto w-full max-w-6xl">
          <div className="vista-window vista-window--terminal vista-window--enhanced h-[94vh] max-h-[94vh] w-full flex flex-col">
            <AppTitlebar
              title="MIFOID.EXE"
              connected={mounted && isConnected}
              address={mounted ? address : undefined}
              onDisconnect={() => disconnect()}
              onSwitchWallet={handleSwitchWallet}
            />
            <MifoidApp />
          </div>
        </div>
      </section>
    </main>
  );
}
