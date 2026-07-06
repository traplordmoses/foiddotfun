"use client";

// FILES.EXE route (/files) — thin window wrapper around the extracted
// FilesApp (src/apps/FilesApp.tsx). Stage C: on desktop viewports this
// route hands off to the shell with FILES focused (useDesktopHandoff);
// mobile — and ?standalone=1 — keep the standalone presentation:
// full-viewport main, one vista-window, AppTitlebar wallet wiring
// (useAccount + useSwitchWallet with the /mifoid mounted-guard so the
// server-rendered "disconnected" frame never mismatches a connected
// client).

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { useSwitchWallet } from "@/hooks/useSwitchWallet";
import AppTitlebar from "@/app/(components)/AppTitlebar";
import { useDesktopHandoff } from "@/components/os/useDesktopHandoff";
import FilesApp from "@/apps/FilesApp";

export default function FilesPage() {
  const { address, isConnected } = useAccount();
  const { disconnect, switchWallet } = useSwitchWallet();
  const handedOff = useDesktopHandoff("files");

  /* Hydration fix — server renders disconnected, client may differ */
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  if (handedOff) return null;

  return (
    <main
      className="relative bg-foid-bg text-white/90 overflow-hidden flex items-center justify-center"
      style={{ height: "100vh" }}
    >
      <div className="pointer-events-none fixed inset-0 z-0 vignette" />

      <section className="relative z-10 w-full max-w-full px-2 sm:px-4">
        <div className="mx-auto w-full max-w-6xl">
          <div className="vista-window vista-window--terminal vista-window--enhanced h-[94vh] max-h-[94vh] w-full flex flex-col">
            <AppTitlebar
              title="FILES.EXE"
              connected={mounted && isConnected}
              address={mounted ? address : undefined}
              onDisconnect={() => disconnect()}
              onSwitchWallet={switchWallet}
            />
            <FilesApp />
          </div>
        </div>
      </section>
    </main>
  );
}
