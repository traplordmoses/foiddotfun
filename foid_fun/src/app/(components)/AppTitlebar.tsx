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
          {buildLabel ? (
            <span className="pray-build-tag" title={`Render build ${buildCommit}`}>
              {buildLabel}
            </span>
          ) : null}
        </div>
        <span className="vista-window__badge" aria-hidden="true">
          <Image src="/icons/skull.png" alt="" width={20} height={20} className="h-5 w-5 rounded-full" />
        </span>
      </div>
      <style jsx global>{`
        :global(.pray-nav-tabs-wrapper) {
          flex: 0 0 auto;
          min-width: 0;
          margin-left: auto;
          margin-right: 6px;
          display: flex;
          align-items: center;
          overflow: hidden;
        }

        :global(.pray-nav-tabs) {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 6px;
          padding-bottom: 2px;
          overflow: hidden;
        }

        :global(.pray-nav-tab) {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 30px;
          min-width: 60px;
          padding: 6px 10px;
          font-size: 9px;
          font-weight: 600;
          letter-spacing: 0.1em;
          color: rgba(255, 255, 255, 0.85);
          background: transparent;
          border: none;
          border-radius: 8px;
          text-decoration: none;
          transition: all 0.16s ease;
          position: relative;
          box-shadow: none;
          flex-shrink: 0;
          white-space: nowrap;
        }

        :global(.pray-nav-tab:hover) {
          color: rgba(255, 255, 255, 1);
          background: rgba(255, 255, 255, 0.08);
        }

        :global(.pray-nav-tab:focus-visible) {
          outline: 1px solid rgba(255, 255, 255, 0.3);
          outline-offset: 2px;
        }

        :global(.pray-nav-tab--active) {
          color: rgba(255, 255, 255, 1);
          background: rgba(255, 255, 255, 0.12);
        }

        :global(.pray-nav-tab--active)::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 1px;
          background: rgba(255, 255, 255, 0.4);
        }

        :global(.pray-build-tag) {
          padding: 2px 8px;
          border-radius: 8px;
          border: 1px solid rgba(255, 255, 255, 0.3);
          font-size: 9px;
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
