"use client";

import Image from "next/image";
import { useMemo } from "react";
import TopTabs from "@/app/(components)/TopTabs";
import WalletMenuPill from "@/components/WalletMenuPill";
import { NotificationInbox } from "@/components/NotificationInbox";
import { StatusDot } from "@/components/ui";

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
  walletAddress?: `0x${string}`;
  onDisconnect: () => void;
  onSwitchWallet: () => void;
  warnings?: AppTitlebarWarning[];
};

function StatusIndicator({ connected }: { connected: boolean }) {
  // Uses the shared <StatusDot /> primitive so the wallet-connected indicator
  // stays visually consistent with the sidebar chat header, BoardActions
  // section chip, and any future status pill we add. The surrounding
  // .pray-status-indicator text styling is preserved for backward compat.
  return (
    <div className="pray-status-indicator">
      <StatusDot status={connected ? "online" : "offline"} />
      <span className="pray-status-text">{connected ? "CONNECTED" : "DISCONNECTED"}</span>
    </div>
  );
}

export default function AppTitlebar({
  title,
  chainId,
  connected,
  address,
  walletAddress,
  onDisconnect,
  onSwitchWallet,
  warnings,
}: AppTitlebarProps) {
  void chainId;
  // Derive typed wallet address from the string prop — works across all pages
  const resolvedWallet = useMemo(
    () => walletAddress ?? (address?.startsWith("0x") ? address as `0x${string}` : undefined),
    [walletAddress, address],
  );
  const buildCommit = useMemo(() => {
    const env = typeof globalThis === "object" ? (globalThis as { __ENV__?: Record<string, string> | undefined }).__ENV__ : undefined;
    return (
      env?.RENDER_GIT_COMMIT ??
      process.env.NEXT_PUBLIC_RENDER_GIT_COMMIT ??
      process.env.RENDER_GIT_COMMIT ??
      null
    )?.trim() ?? null;
  }, []);
  const buildLabel = buildCommit ? `BUILD:${buildCommit.slice(0, 7)}` : null;

  const tabItems = useMemo(() => [
    { label: "HOME", href: "/" },
    { label: "PRAY", href: "/pray" },
    { label: "BOARD", href: "/board" },
    { label: "VOTE", href: "/vote" },
    { label: "MIFOID", href: "/mifoid" },
    { label: "ABOUT", href: "/about" },
  ], []);

  return (
    <>
      <div className="app-titlebar">
        {/* Row 1: controls + title + wallet/status */}
        <div className="app-titlebar__row">
          <div className="vista-window__controls" aria-hidden="true">
            <span className="vista-window__control vista-window__control--minimize" />
            <span className="vista-window__control vista-window__control--restore" />
            <span className="vista-window__control vista-window__control--close" />
          </div>
          <span className="vista-window__title text-[9px] sm:text-[11px] truncate">
            <Image src="/foidmommy.gif" alt="" width={24} height={24} className="inline-block h-5 w-5 sm:h-6 sm:w-6 align-middle mr-1 sm:mr-2 flex-shrink-0" />
            <span className="truncate">{title}</span>
          </span>
          <div className="app-titlebar__right">
            {warnings?.length ? (
              <div className="pray-warnings">
                {warnings.map((warning) => (
                  <span key={warning.key} className={`pray-warning${warning.variant ? ` pray-warning--${warning.variant}` : ""}`}>
                    {warning.message}
                  </span>
                ))}
              </div>
            ) : null}
            <NotificationInbox address={resolvedWallet} />
            <StatusIndicator connected={connected} />
            <WalletMenuPill
              address={address}
              isConnected={connected}
              onDisconnect={onDisconnect}
              onSwitchWallet={onSwitchWallet}
            />
            {buildLabel && process.env.NODE_ENV !== 'production' ? (
              <span className="pray-build-tag" title={`Render build ${buildCommit}`}>
                {buildLabel}
              </span>
            ) : null}
            <span className="vista-window__badge" aria-hidden="true">
              <Image src="/icons/skull.png" alt="" width={20} height={20} className="h-5 w-5 rounded-full" />
            </span>
          </div>
        </div>
        {/* Row 2: nav tabs — always full width, scrollable */}
        <div className="app-titlebar__tabs hidden md:block">
          <TopTabs items={tabItems} />
        </div>
      </div>
      <style jsx global>{`
        :global(.app-titlebar) {
          position: relative;
          display: flex;
          flex-direction: column;
          background: linear-gradient(180deg,
            rgba(95, 175, 235, 0.95) 0%,
            rgba(65, 145, 215, 0.92) 50%,
            rgba(45, 125, 195, 0.95) 100%);
          border-bottom: 1px solid rgba(0, 50, 100, 0.25);
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.45),
            inset 0 2px 3px rgba(255, 255, 255, 0.15),
            0 1px 4px rgba(0, 40, 80, 0.2);
          color: rgba(255, 255, 255, 0.95);
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          z-index: 2;
          padding: 0;
        }
        :global(.app-titlebar::before) {
          content: "";
          position: absolute;
          top: 1px;
          left: 10%;
          right: 10%;
          height: 35%;
          border-radius: 0 0 50% 50%;
          background: linear-gradient(180deg,
            rgba(255, 255, 255, 0.45) 0%,
            rgba(255, 255, 255, 0.1) 100%);
          pointer-events: none;
        }

        :global(.app-titlebar__row) {
          position: relative;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 12px;
          min-height: 40px;
          z-index: 1;
        }

        :global(.app-titlebar__right) {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-left: auto;
          flex-shrink: 0;
          font-size: 8px;
        }

        :global(.app-titlebar__tabs) {
          position: relative;
          z-index: 1;
          border-top: 1px solid rgba(255, 255, 255, 0.12);
          padding: 6px 12px;
          background: rgba(0, 30, 70, 0.2);
        }

        :global(.pray-nav-tabs-wrapper) {
          width: 100%;
          display: flex;
          align-items: center;
          overflow: hidden;
          background: transparent;
          box-shadow: none;
        }

        :global(.pray-nav-tabs) {
          display: flex;
          align-items: center;
          gap: 5px;
          padding-bottom: 0;
          overflow-x: auto;
          overflow-y: hidden;
          scrollbar-width: none;
          -ms-overflow-style: none;
          background: transparent;
          border: none;
          box-shadow: none;
        }
        :global(.pray-nav-tabs::-webkit-scrollbar) {
          display: none;
        }

        /* Glass tabs — same aero material as the titlebar they sit in.
           Active = brighter glass with an inner shine, not a color swap. */
        :global(.pray-nav-tab) {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 24px;
          min-width: 0;
          padding: 4px 12px;
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.12em;
          color: rgba(255, 255, 255, 0.82);
          background: rgba(255, 255, 255, 0.10);
          border: 1px solid rgba(255, 255, 255, 0.26);
          border-radius: var(--foid-radius-pill, 999px);
          text-decoration: none;
          transition: background var(--foid-motion-fast, 150ms) ease,
                      border-color var(--foid-motion-fast, 150ms) ease,
                      color var(--foid-motion-fast, 150ms) ease,
                      transform var(--foid-motion-fast, 150ms) ease;
          position: relative;
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.35),
            0 2px 8px rgba(0, 20, 50, 0.18);
          flex-shrink: 0;
          white-space: nowrap;
          text-shadow: 0 1px 2px rgba(0, 20, 50, 0.35);
        }

        :global(.pray-nav-tab:hover) {
          color: #ffffff;
          background: rgba(255, 255, 255, 0.18);
          border-color: rgba(255, 255, 255, 0.42);
          transform: translateY(-1px);
        }

        :global(.pray-nav-tab:focus-visible) {
          outline: 2px solid var(--foid-focus-ring, rgba(160, 255, 240, 0.85));
          outline-offset: 2px;
        }

        :global(.pray-nav-tab--active) {
          color: #ffffff;
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.34), rgba(255, 255, 255, 0.16));
          border-color: rgba(255, 255, 255, 0.6);
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.6),
            0 0 14px rgba(150, 220, 255, 0.35);
          transform: none;
        }

        :global(.pray-nav-tab--active:hover) {
          transform: none;
        }

        :global(.pray-build-tag) {
          padding: 2px 8px;
          border-radius: 8px;
          border: 1px solid rgba(255, 255, 255, 0.3);
          font-size: 8px;
          letter-spacing: 0.28em;
          text-transform: uppercase;
          color: rgba(255, 255, 255, 0.85);
          background: rgba(0, 0, 0, 0.25);
          white-space: nowrap;
        }
      `}</style>
    </>
  );
}
