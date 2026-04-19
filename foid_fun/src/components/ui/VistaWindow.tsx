// src/components/ui/VistaWindow.tsx
// Wraps the ubiquitous `.vista-window.vista-window--terminal.vista-window--enhanced`
// frame + AppTitlebar combo used on every page-level shell (/board, /pray,
// /vote, /mifoid, /about, /gallery, …). Keeps markup consistent and gives
// future pages a one-import way to get the frame.
"use client";

import React, { type ReactNode } from "react";
import AppTitlebar, { type AppTitlebarWarning } from "@/app/(components)/AppTitlebar";

export type VistaWindowProps = {
  title: string;
  chainId?: number | string;
  connected: boolean;
  address?: string;
  walletAddress?: `0x${string}`;
  onDisconnect: () => void;
  onSwitchWallet: () => void;
  warnings?: AppTitlebarWarning[];
  children: ReactNode;
  /** Additional className on the outer window element (e.g. a page-specific layout modifier). */
  className?: string;
  /** Additional className on the body. Defaults to the standard spacing used on /board + /pray. */
  bodyClassName?: string;
  /**
   * When true (default), adds `vista-window--enhanced` for the accented-glow
   * variant. Set false for quieter variants (e.g. modal shells).
   */
  enhanced?: boolean;
  /** When true (default), uses the terminal dark variant (`vista-window--terminal`). */
  terminal?: boolean;
  /**
   * Optional id applied to the body container so aria-describedby /
   * role="main" association can hang off it without an extra wrapper.
   */
  bodyId?: string;
};

export function VistaWindow({
  title,
  chainId,
  connected,
  address,
  walletAddress,
  onDisconnect,
  onSwitchWallet,
  warnings,
  children,
  className,
  bodyClassName,
  enhanced = true,
  terminal = true,
  bodyId,
}: VistaWindowProps) {
  const frameClass = [
    "vista-window",
    terminal ? "vista-window--terminal" : null,
    enhanced ? "vista-window--enhanced" : null,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const bodyClass =
    "vista-window__body vista-window__body--flush mt-2 pray-panel__body" +
    (bodyClassName ? ` ${bodyClassName}` : "");

  return (
    <div className={frameClass}>
      <AppTitlebar
        title={title}
        chainId={chainId}
        connected={connected}
        address={address}
        walletAddress={walletAddress}
        onDisconnect={onDisconnect}
        onSwitchWallet={onSwitchWallet}
        warnings={warnings}
      />
      <div id={bodyId} className={bodyClass}>
        {children}
      </div>
    </div>
  );
}
