"use client";

import Image from "next/image";
import { useMemo } from "react";
import { WindowControls } from "@/app/(components)/WindowFrame";
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
  /** Override the traffic-light cluster. Route pages keep the default
   *  (singleton-store WindowControls); the desktop shell's OSWindow passes
   *  its own store-v2-driven controls. */
  controls?: React.ReactNode;
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
  controls,
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

  return (
    <div className="app-titlebar">
      <div className="app-titlebar__row">
        {controls ?? <WindowControls />}
        <span className="vista-window__title text-[9px] sm:text-[11px] truncate">
          <Image src="/foidmommy-48.webp" alt="" width={24} height={24} className="inline-block h-5 w-5 sm:h-6 sm:w-6 align-middle mr-1 sm:mr-2 flex-shrink-0" />
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
    </div>
  );
}
