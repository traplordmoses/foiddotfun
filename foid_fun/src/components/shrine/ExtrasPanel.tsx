"use client";

import Link from "next/link";
import { useCallback } from "react";

interface ExtrasPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const EXTRAS_LINKS = [
  { href: "/", label: "Dashboard", description: "Launcher + music" },
  { href: "/pray", label: "Prayer Terminal", description: "Daily ritual" },
  { href: "/board", label: "Loreboard", description: "Culture canvas" },
  { href: "/about", label: "About", description: "Project notes" },
  {
    href: "https://github.com/traplordmoses/foiddotfun",
    label: "GitHub",
    description: "View source",
    external: true,
  },
  {
    href: "https://x.com/foidfun",
    label: "X / @foidfun",
    description: "Follow us",
    external: true,
  },
];

export default function ExtrasPanel({ isOpen, onClose }: ExtrasPanelProps) {
  const handleBackdropClick = useCallback(() => {
    onClose();
  }, [onClose]);

  const handleLinkClick = useCallback(() => {
    onClose();
  }, [onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={`extras-backdrop ${isOpen ? "extras-backdrop--visible" : ""}`}
        onClick={handleBackdropClick}
        aria-hidden="true"
      />

      {/* Panel */}
      <aside
        className={`extras-panel ${isOpen ? "extras-panel--open" : ""}`}
        aria-label="Extras navigation"
        role="dialog"
        aria-modal="true"
      >
        <div className="extras-panel__header">
          <h2 className="extras-panel__title">{"//extras"}</h2>
        </div>

        <nav className="extras-panel__nav">
          {EXTRAS_LINKS.map((link) =>
            link.external ? (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="extras-panel__link"
                onClick={handleLinkClick}
              >
                <span>{link.label}</span>
                <span style={{ opacity: 0.5, fontSize: "0.85em" }}>
                  {link.description}
                </span>
              </a>
            ) : (
              <Link
                key={link.href}
                href={link.href}
                className="extras-panel__link"
                onClick={handleLinkClick}
              >
                <span>{link.label}</span>
                <span style={{ opacity: 0.5, fontSize: "0.85em" }}>
                  {link.description}
                </span>
              </Link>
            )
          )}
        </nav>

        <div className="extras-panel__footer" style={{ padding: "1.5rem 2rem", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
          <button
            onClick={onClose}
            className="extras-panel__link"
            style={{ width: "100%", justifyContent: "center" }}
          >
            Close
          </button>
        </div>
      </aside>
    </>
  );
}
