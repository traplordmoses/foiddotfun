"use client";

import { useCallback, useEffect, useId, useRef, useState, lazy, Suspense } from "react";

const SendEthModal = lazy(() => import("./wallet/SendEthModal"));
import { createPortal } from "react-dom";
import { useBalance } from "wagmi";
import type { Address } from "viem";

const LinkXAccount = lazy(() => import("./LinkXAccount"));

export interface WalletMenuPillProps {
  address?: string;
  isConnected: boolean;
  onSwitchWallet: () => void;
  onDisconnect: () => void;
  className?: string;
}

function shortHash(hash?: string) {
  if (!hash) return "—";
  if (hash.length <= 10) return hash;
  return `${hash.slice(0, 6)}…${hash.slice(-4)}`;
}

export default function WalletMenuPill({
  address,
  isConnected,
  onSwitchWallet,
  onDisconnect,
  className = "",
}: WalletMenuPillProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0, width: 0 });
  const [mounted, setMounted] = useState(false);
  const [exportStatus, setExportStatus] = useState<"idle" | "copied" | "error">("idle");
  const [showSendModal, setShowSendModal] = useState(false);
  const [passkeyStatus, setPasskeyStatus] = useState<boolean | null>(null);
  const isEmbeddedWallet = mounted && typeof window !== "undefined" && localStorage.getItem("foid-embedded-active") === "true";

  const { data: balanceData } = useBalance({
    address: address as Address | undefined,
    query: { enabled: isConnected && !!address },
  });

  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  // Client-side mount check for portal
  useEffect(() => {
    setMounted(true);
  }, []);

  // Check PRF/security status when menu opens for embedded wallet
  useEffect(() => {
    if (!isOpen || !isEmbeddedWallet) return;
    let cancelled = false;
    (async () => {
      try {
        const { load } = await import("@/lib/wallet");
        const wallet = load();
        if (!cancelled) setPasskeyStatus(wallet?.prfActive ?? null);
      } catch {
        if (!cancelled) setPasskeyStatus(null);
      }
    })();
    return () => { cancelled = true; };
  }, [isOpen, isEmbeddedWallet]);

  // Calculate menu position when opened
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const menuWidth = Math.max(rect.width, 200);
      setMenuPosition({
        top: rect.bottom + 8,
        left: rect.right - menuWidth,
        width: menuWidth,
      });
    }
  }, [isOpen]);

  // Click outside handler
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        menuRef.current &&
        !menuRef.current.contains(target) &&
        buttonRef.current &&
        !buttonRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // Keyboard handler
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === "Escape" && isOpen) {
        event.preventDefault();
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    },
    [isOpen]
  );

  // Focus trap within menu
  useEffect(() => {
    if (!isOpen || !menuRef.current) return;

    const menu = menuRef.current;
    const focusableElements = menu.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    function handleTabKey(e: KeyboardEvent) {
      if (e.key !== "Tab") return;

      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement?.focus();
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement?.focus();
      }
    }

    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    }

    menu.addEventListener("keydown", handleTabKey);
    document.addEventListener("keydown", handleEscape);

    // Focus first item when menu opens
    firstElement?.focus();

    return () => {
      menu.removeEventListener("keydown", handleTabKey);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  const handleToggle = () => {
    // If not connected, trigger connect immediately instead of showing menu
    if (!isConnected) {
      onSwitchWallet();
      return;
    }
    setIsOpen((prev) => !prev);
  };

  const handleSwitchWallet = () => {
    onSwitchWallet();
    setIsOpen(false);
  };

  const handleDisconnect = () => {
    onDisconnect();
    setIsOpen(false);
  };

  const handleExportKey = async () => {
    try {
      const { getSession } = await import("@/lib/wallet");
      const session = getSession();
      if (session) {
        await navigator.clipboard.writeText(session.privateKey);
        setExportStatus("copied");
        setTimeout(() => setExportStatus("idle"), 3000);
      } else {
        // Not unlocked — trigger unlock flow
        const { requestWalletUnlock } = await import("@/lib/connectors/onboardingBridge");
        const result = await requestWalletUnlock();
        if (result) {
          const { setSession } = await import("@/lib/wallet");
          setSession(result.privateKey, result.address);
          await navigator.clipboard.writeText(result.privateKey);
          setExportStatus("copied");
          setTimeout(() => setExportStatus("idle"), 3000);
        }
      }
    } catch {
      setExportStatus("error");
      setTimeout(() => setExportStatus("idle"), 3000);
    }
  };

  const handleCopyAddress = async () => {
    if (address) {
      await navigator.clipboard.writeText(address);
    }
    setIsOpen(false);
  };

  const dropdownMenu = isOpen && mounted ? (
    <div
      ref={menuRef}
      id={menuId}
      role="menu"
      aria-label="Wallet actions"
      className="aero-wallet-menu"
      style={{
        position: "fixed",
        top: menuPosition.top,
        left: menuPosition.left,
        width: menuPosition.width,
        zIndex: 99999,
      }}
      onKeyDown={handleKeyDown}
    >
      {/* Balance display */}
      {balanceData && (
        <div className="aero-wallet-menu__balance" style={{
          padding: "8px 12px",
          borderBottom: "1px solid rgba(255,255,255,0.1)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}>
          <span className="foid-label">Balance</span>
          <span className="foid-data" style={{ fontWeight: 700 }}>
            {Number(balanceData.formatted).toFixed(4)} ETH
          </span>
        </div>
      )}
      {/* Passkey protection status for embedded wallet */}
      {isEmbeddedWallet && passkeyStatus !== null && (
        <div className="foid-label" style={{
          padding: "6px 12px",
          borderBottom: "1px solid rgba(255,255,255,0.1)",
          display: "flex",
          alignItems: "center",
          gap: "6px",
          color: passkeyStatus ? "rgba(72,255,171,0.8)" : "rgba(255,184,0,0.8)",
        }}>
          <span style={{ fontSize: 12 }}>{passkeyStatus ? "\u2713" : "\u2713"}</span>
          <span>{passkeyStatus ? "Biometric + PIN" : "PIN encrypted"}</span>
        </div>
      )}
      <button
        type="button"
        role="menuitem"
        className="aero-wallet-menu__item aero-wallet-menu__item--primary"
        onClick={handleSwitchWallet}
      >
        <svg
          className="aero-wallet-menu__icon"
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M6 2L2 6L6 10M10 6L2 6M10 14L14 10L10 6"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Switch Wallet
      </button>
      <button
        type="button"
        role="menuitem"
        className="aero-wallet-menu__item"
        onClick={handleCopyAddress}
      >
        <svg className="aero-wallet-menu__icon" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <rect x="5" y="5" width="9" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
          <path d="M11 5V3C11 2.44772 10.5523 2 10 2H3C2.44772 2 2 2.44772 2 3V10C2 10.5523 2.44772 11 3 11H5" stroke="currentColor" strokeWidth="1.5" />
        </svg>
        Copy Address
      </button>
      <button
        type="button"
        role="menuitem"
        className="aero-wallet-menu__item"
        onClick={() => { setShowSendModal(true); setIsOpen(false); }}
      >
        <svg className="aero-wallet-menu__icon" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M14 2L2 8L7 9.5L9 14L14 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Send ETH
      </button>
      <div style={{
        padding: "6px 12px",
        borderBottom: "1px solid rgba(255,255,255,0.1)",
      }}>
        <Suspense fallback={null}>
          <LinkXAccount />
        </Suspense>
      </div>
      {isEmbeddedWallet && (
        <>
          <button
            type="button"
            role="menuitem"
            className="aero-wallet-menu__item"
            onClick={handleExportKey}
          >
            <svg className="aero-wallet-menu__icon" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M8 2V10M8 10L5 7M8 10L11 7M3 13H13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {exportStatus === "copied" ? "Copied to clipboard!" : exportStatus === "error" ? "Auth required" : "Export Private Key"}
          </button>
          <button
            type="button"
            role="menuitem"
            className="aero-wallet-menu__item"
            onClick={async () => {
              try {
                const { load: loadWallet } = await import("@/lib/wallet");
                const wallet = loadWallet();
                if (!wallet) return;
                const blob = new Blob([JSON.stringify(wallet, null, 2)], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `foid-wallet-${wallet.address.slice(0, 8)}.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
              } catch { /* ignore */ }
              setIsOpen(false);
            }}
          >
            <svg className="aero-wallet-menu__icon" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M2 10V13H14V10M8 2V10M8 10L5 7M8 10L11 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Download Backup
          </button>
        </>
      )}
      <button
        type="button"
        role="menuitem"
        className="aero-wallet-menu__item aero-wallet-menu__item--danger"
        onClick={handleDisconnect}
      >
        <svg
          className="aero-wallet-menu__icon"
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M6 14H3C2.44772 14 2 13.5523 2 13V3C2 2.44772 2.44772 2 3 2H6M11 11L14 8L11 5M6 8H14"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Disconnect
      </button>
    </div>
  ) : null;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={`aero-wallet-pill${isConnected ? " aero-wallet-pill--connected" : ""} ${className}`}
        onClick={handleToggle}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-controls={isOpen ? menuId : undefined}
        aria-label={isConnected ? "Manage wallet" : "Connect wallet"}
      >
        <span className="aero-wallet-pill__shine" aria-hidden="true" />
        <span className="aero-wallet-pill__label">
          {isConnected ? "WALLET" : "CONNECT"}
        </span>
        {address ? (
          <span className="aero-wallet-pill__address">{shortHash(address)}</span>
        ) : null}
        <svg
          className={`aero-wallet-pill__chevron ${isOpen ? "aero-wallet-pill__chevron--open" : ""}`}
          width="10"
          height="6"
          viewBox="0 0 10 6"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M1 1L5 5L9 1"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {mounted && dropdownMenu
        ? createPortal(dropdownMenu, document.body)
        : null}

      {showSendModal && address && mounted && (
        <Suspense fallback={null}>
          <SendEthModal
            address={address}
            onClose={() => setShowSendModal(false)}
          />
        </Suspense>
      )}
    </>
  );
}
