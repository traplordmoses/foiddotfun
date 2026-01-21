"use client";

import Image from "next/image";
import { useMemo } from "react";
import { usePathname } from "next/navigation";
import TopTabs from "@/app/(components)/TopTabs";
import WalletMenuPill from "@/components/WalletMenuPill";

export type AppTitlebarWarning = {
  key: string;
  message: string;
  variant?: "error" | "mint";
};

type AppTitlebarProps = {
  title: string;
  chainId?: number | string;
  connected: boolean;
  address?: string;
  onDisconnect: () => void;
  onSwitchWallet: () => void;
  warnings?: AppTitlebarWarning[];
};

function StatusIndicator({ connected }: { connected: boolean }) {
  return (
    <div className="pray-status-indicator">
      <span className={`pray-status-dot ${connected ? "pray-status-dot--online" : "pray-status-dot--offline"}`} />
      <span className="pray-status-text">{connected ? "CONNECTED" : "DISCONNECTED"}</span>
    </div>
  );
}

export default function AppTitlebar({
  title,
  chainId,
  connected,
  address,
  onDisconnect,
  onSwitchWallet,
  warnings,
}: AppTitlebarProps) {
  void chainId;
  const pathname = usePathname();

  const tabItems = useMemo(() => {
    const isPrayRoute = pathname === "/pray" || pathname.startsWith("/pray/");
    const isBoardRoute = pathname === "/board" || pathname.startsWith("/board/");
    const items = [
      { label: "HOME", href: "/" },
      ...(isPrayRoute ? [] : [{ label: "PRAY", href: "/pray" }]),
      ...(isBoardRoute ? [] : [{ label: "BOARD", href: "/board" }]),
    ];
    if (pathname !== "/about") {
      items.push({ label: "ABOUT", href: "/about" });
    }
    return items;
  }, [pathname]);

  return (
    <>
      <div className="vista-window__titlebar">
        <div className="vista-window__controls" aria-hidden="true">
          <span className="vista-window__control vista-window__control--minimize" />
          <span className="vista-window__control vista-window__control--restore" />
          <span className="vista-window__control vista-window__control--close" />
        </div>
        <span className="vista-window__title">
          <Image src="/foidmommy.gif" alt="" width={24} height={24} className="inline-block h-6 w-6 align-middle mr-2" />
          {title}
        </span>
        <div className="vista-window__tabs">
          <TopTabs items={tabItems} />
        </div>
        <div className="vista-window__meta">
          <StatusIndicator connected={connected} />
          <WalletMenuPill
            address={address}
            isConnected={connected}
            onDisconnect={onDisconnect}
            onSwitchWallet={onSwitchWallet}
          />
          {warnings?.length ? (
            <div className="pray-warnings">
              {warnings.map((warning) => (
                <span key={warning.key} className={`pray-warning${warning.variant ? ` pray-warning--${warning.variant}` : ""}`}>
                  {warning.message}
                </span>
              ))}
            </div>
          ) : null}
        </div>
        <span className="vista-window__badge" aria-hidden="true">
          <Image src="/icons/skull.png" alt="" width={20} height={20} className="h-5 w-5 rounded-full" />
        </span>
      </div>
      <style jsx global>{`
        :global(.pray-nav-tabs-wrapper) {
          flex: 1 1 0;
          min-width: 0;
          margin: 0 6px;
          display: flex;
          align-items: stretch;
          overflow: hidden;
        }

        :global(.pray-nav-tabs) {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 8px;
          padding-bottom: 2px;
          overflow-x: auto;
          overscroll-behavior: contain;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none;
          white-space: nowrap;
        }

        :global(.pray-nav-tabs::-webkit-scrollbar) {
          display: none;
        }

        :global(.pray-nav-tab) {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 44px;
          min-width: 90px;
          padding: 10px 18px;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.08em;
          color: #1a1a1a;
          background: linear-gradient(180deg, rgba(233, 221, 80, 0.95), rgba(214, 180, 52, 0.95));
          border: 1px solid rgba(26, 26, 26, 0.4);
          border-bottom: none;
          border-radius: 12px;
          text-decoration: none;
          transition: all 0.16s ease;
          position: relative;
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.5),
            0 4px 12px rgba(0, 0, 0, 0.25);
          flex-shrink: 0;
          white-space: nowrap;
        }

        :global(.pray-nav-tab:hover) {
          color: #0f0f0f;
          background: linear-gradient(180deg, rgba(253, 232, 120, 0.97), rgba(233, 221, 80, 0.98));
          border-color: rgba(26, 26, 26, 0.6);
        }

        :global(.pray-nav-tab:focus-visible) {
          outline: 2px solid rgba(26, 26, 26, 0.6);
          outline-offset: 2px;
          box-shadow: 0 0 0 2px rgba(26, 26, 26, 0.25);
        }

        :global(.pray-nav-tab--active) {
          color: #1a1a1a;
          background: linear-gradient(180deg, rgba(26, 26, 26, 1), rgba(20, 20, 20, 0.95));
          border-color: rgba(26, 26, 26, 0.8);
        }

        :global(.pray-nav-tab--active)::after {
          content: '';
          position: absolute;
          bottom: -1px;
          left: 0;
          right: 0;
          height: 2px;
          background: #e9dd50;
          box-shadow: 0 0 8px rgba(233, 221, 80, 0.6);
        }
      `}</style>
    </>
  );
}
