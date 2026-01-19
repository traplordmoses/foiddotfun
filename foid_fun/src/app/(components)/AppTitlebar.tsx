"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import TopTabs from "@/app/(components)/TopTabs";

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
  isWalletDropdownOpen: boolean;
  onToggleWallet: () => void;
  onDisconnect: () => void;
  onSwitchWallet: () => void;
  warnings?: AppTitlebarWarning[];
};

function shortHash(hash?: string) {
  if (!hash) return "–";
  if (hash.length <= 10) return hash;
  return `${hash.slice(0, 6)}…${hash.slice(-4)}`;
}

function StatusIndicator({ connected }: { connected: boolean }) {
  return (
    <div className="pray-status-indicator">
      <span className={`pray-status-dot ${connected ? "pray-status-dot--online" : "pray-status-dot--offline"}`} />
      <span className="pray-status-text">{connected ? "CONNECTED" : "DISCONNECTED"}</span>
    </div>
  );
}

function WalletDropdown({
  address,
  isOpen,
  onToggle,
  onDisconnect,
  onSwitchWallet,
}: {
  address: string | undefined;
  isOpen: boolean;
  onToggle: () => void;
  onDisconnect: () => void;
  onSwitchWallet: () => void;
}) {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0, width: 0 });

  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const menuWidth = Math.max(rect.width, 180);
      setMenuPosition({
        top: rect.bottom + 6,
        left: rect.right - menuWidth,
        width: menuWidth,
      });
    }
  }, [isOpen]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        if (isOpen) onToggle();
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, onToggle]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="pray-wallet-pill"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <span className="pray-wallet-pill__label">WALLET</span>
        <span className="pray-wallet-pill__address">{address ? shortHash(address) : "—"}</span>
        <svg className={`pray-wallet-chevron ${isOpen ? "pray-wallet-chevron--open" : ""}`} width="10" height="6" viewBox="0 0 10 6" fill="none">
          <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {isOpen && (
        <div
          ref={dropdownRef}
          className="pray-wallet-menu"
          style={{ position: "fixed", top: menuPosition.top, left: menuPosition.left, width: menuPosition.width, zIndex: 9999 }}
        >
          <button type="button" className="pray-wallet-menu__item" onClick={() => { onSwitchWallet(); onToggle(); }}>
            Switch Wallet
          </button>
          <button type="button" className="pray-wallet-menu__item pray-wallet-menu__item--danger" onClick={() => { onDisconnect(); onToggle(); }}>
            Disconnect
          </button>
        </div>
      )}
    </>
  );
}

export default function AppTitlebar({
  title,
  chainId,
  connected,
  address,
  isWalletDropdownOpen,
  onToggleWallet,
  onDisconnect,
  onSwitchWallet,
  warnings,
}: AppTitlebarProps) {
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
        <TopTabs
          items={[
            { label: "HOME", href: "/" },
          ]}
        />
        <div className="vista-window__meta">
          <StatusIndicator connected={connected} />
          <div className="pray-chain-pill">
            <span className="pray-chain-pill__label">CHAIN</span>
            <span className="pray-chain-pill__value">{chainId ?? "?"}</span>
          </div>
          <WalletDropdown
            address={address}
            isOpen={isWalletDropdownOpen}
            onToggle={onToggleWallet}
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
        :global(.pray-nav-tabs) {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-left: 8px;
          margin-right: auto;
          margin-top: 2px;
        }

        :global(.pray-nav-tab) {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 30px;
          padding: 5px 12px;
          font-size: 9px;
          font-weight: 500;
          letter-spacing: 0.08em;
          color: rgba(255, 255, 255, 0.5);
          background: linear-gradient(180deg, rgba(14, 28, 36, 0.92), rgba(8, 16, 22, 0.75));
          border: 1px solid rgba(0, 255, 213, 0.18);
          border-bottom: none;
          border-radius: 9px;
          text-decoration: none;
          transition: all 0.15s ease;
          position: relative;
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.14),
            inset 0 -1px 0 rgba(0, 0, 0, 0.2),
            0 4px 10px rgba(0, 0, 0, 0.22);
        }

        :global(.pray-nav-tab:hover) {
          color: rgba(255, 255, 255, 0.8);
          background: linear-gradient(180deg, rgba(18, 38, 48, 0.95), rgba(10, 20, 28, 0.8));
          border-color: rgba(0, 255, 213, 0.28);
        }

        :global(.pray-nav-tab:focus-visible) {
          outline: 2px solid rgba(0, 255, 213, 0.6);
          outline-offset: 2px;
          box-shadow: 0 0 0 2px rgba(0, 255, 213, 0.2);
        }

        :global(.pray-nav-tab--active) {
          color: rgba(255, 255, 255, 0.95);
          background: linear-gradient(180deg, rgba(28, 60, 72, 0.98), rgba(10, 20, 28, 0.9));
          border-color: rgba(0, 255, 213, 0.4);
          text-shadow: 0 0 10px rgba(0, 255, 213, 0.45);
        }

        :global(.pray-nav-tab--active)::after {
          content: '';
          position: absolute;
          bottom: -1px;
          left: 0;
          right: 0;
          height: 2px;
          background: #00ffd5;
          box-shadow: 0 0 8px rgba(0, 255, 213, 0.6);
        }
      `}</style>
    </>
  );
}
