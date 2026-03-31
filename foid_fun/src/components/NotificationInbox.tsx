// src/components/NotificationInbox.tsx
// Notifications inbox — envelope button + slide-out panel
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useNotifications, type Notification, type NotificationType } from "@/hooks/useNotifications";
import { toIpfsHttpUrl } from "@/lib/ipfsUrl";
import { getAudioSettings } from "@/lib/audioSettings";

type Props = { address: `0x${string}` | undefined };

/* ── Relative time ────────────────────────────────────────────────────── */

function timeAgo(ts: number | null): string {
  if (!ts) return "";
  const diff = Math.floor(Date.now() / 1000) - ts;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

/* ── Envelope Button ──────────────────────────────────────────────────── */

function EnvelopeButton({
  unreadCount,
  hasCanonization,
  onClick,
}: {
  unreadCount: number;
  hasCanonization: boolean;
  onClick: () => void;
}) {
  const prevCountRef = useRef(unreadCount);
  const [bounce, setBounce] = useState(false);

  useEffect(() => {
    if (unreadCount > prevCountRef.current) {
      setBounce(true);
      const t = setTimeout(() => setBounce(false), 600);
      return () => clearTimeout(t);
    }
    prevCountRef.current = unreadCount;
  }, [unreadCount]);

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
        className="ni-envelope"
        style={{ animation: bounce ? "ni-bounce 500ms ease" : undefined }}
      >
        <svg width="16" height="13" viewBox="0 0 22 18" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M1 4L11 10L21 4M3 1H19C20.1 1 21 1.9 21 3V15C21 16.1 20.1 17 19 17H3C1.9 17 1 16.1 1 15V3C1 1.9 1.9 1 3 1Z"
            stroke="rgba(255,255,255,0.7)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {unreadCount > 0 && (
          <span
            className="ni-badge"
            style={{
              background: hasCanonization
                ? "linear-gradient(135deg, #FFD700, #FFA500)"
                : "linear-gradient(135deg, #f472b6, #ec4899)",
              boxShadow: hasCanonization
                ? "0 0 8px rgba(255,215,0,0.6)"
                : "0 0 6px rgba(236,72,153,0.5)",
            }}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>
      <style jsx>{`
        .ni-envelope {
          position: relative;
          display: flex; align-items: center; justify-content: center;
          width: 28px; height: 28px;
          background: transparent; border: none; cursor: pointer;
          padding: 0; border-radius: 6px;
          transition: background 150ms;
        }
        .ni-envelope:hover { background: rgba(255,255,255,0.08); }
        .ni-badge {
          position: absolute; top: -2px; right: -4px;
          min-width: 14px; height: 14px; padding: 0 3px;
          border-radius: 7px;
          font-size: 8px; font-weight: 700; font-family: var(--font-mono, monospace);
          color: #000; line-height: 14px; text-align: center;
        }
        @keyframes ni-bounce {
          0%, 100% { transform: translateY(0); }
          30% { transform: translateY(-4px); }
          60% { transform: translateY(1px); }
        }
      `}</style>
    </>
  );
}

/* ── Notification Card ────────────────────────────────────────────────── */

const TYPE_LABELS: Record<NotificationType, string> = {
  proposed: "ENGRAVED",
  voting: "VOTING",
  canonized: "CANONIZED",
  rejected: "REJECTED",
  expired: "EXPIRED",
};

function NotificationCard({
  notification,
  onMarkRead,
}: {
  notification: Notification;
  onMarkRead: (id: string) => void;
}) {
  const imgSrc = toIpfsHttpUrl(notification.placement.cid ?? notification.placement.imageUrl ?? null);
  const label = TYPE_LABELS[notification.type] ?? "UPDATE";

  const handleShare = () => {
    const p = notification.placement;
    const text = encodeURIComponent(
      `My lore got canonized on the FOID loreboard! Epoch ${p.epoch}\n\nhttps://foid.fun/board`,
    );
    window.open(`https://x.com/intent/tweet?text=${text}`, "_blank");
  };

  const handleClick = () => {
    if (!notification.isRead) {
      onMarkRead(notification.id);

      // Trigger celebration for canonization on first open
      if (notification.type === "canonized" && getAudioSettings().sfxEnabled) {
        import("@/effects/BlessingBloom").then(({ showBlessingBloom }) => {
          showBlessingBloom({ message: "CANONIZED" });
        });
        import("@/lib/sfx").then((sfx) => sfx.default.playReward());
      }
    }
  };

  return (
    <>
      <div
        className={`ni-card ${notification.isRead ? "" : "ni-card--unread"}`}
        onClick={handleClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && handleClick()}
      >
        {/* Accent bar */}
        <div className="ni-card__accent" style={{ background: notification.accent }} />

        {/* Thumbnail */}
        {imgSrc && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imgSrc} alt="" className="ni-card__thumb" referrerPolicy="no-referrer" />
        )}

        {/* Content */}
        <div className="ni-card__body">
          <div className="ni-card__header">
            <span className="ni-card__label" style={{ color: notification.accent }}>
              {label}
            </span>
            <span className="ni-card__time">{timeAgo(notification.timestamp)}</span>
          </div>
          <div className="ni-card__message">{notification.message}</div>

          {/* Action buttons */}
          <div className="ni-card__actions">
            {notification.type === "canonized" && (
              <button type="button" className="ni-card__btn ni-card__btn--gold" onClick={(e) => { e.stopPropagation(); handleShare(); }}>
                SHARE TO X
              </button>
            )}
            {notification.type === "rejected" && (
              <a href="/board" className="ni-card__btn ni-card__btn--subtle">
                PLACE AGAIN
              </a>
            )}
          </div>
        </div>
      </div>
      <style jsx>{`
        .ni-card {
          display: flex; gap: 10px; padding: 10px 12px;
          border-radius: 10px; cursor: pointer;
          transition: background 150ms;
          position: relative;
        }
        .ni-card:hover { background: rgba(255,255,255,0.04); }
        .ni-card--unread {
          background: rgba(116,255,235,0.03);
        }
        .ni-card--unread::before {
          content: '';
          position: absolute; left: 0; top: 0; bottom: 0; width: 3px;
          border-radius: 3px 0 0 3px;
          background: rgba(116,255,235,0.4);
        }
        .ni-card__accent {
          width: 4px; min-height: 100%; border-radius: 2px; flex-shrink: 0;
        }
        .ni-card__thumb {
          width: 40px; height: 40px; border-radius: 8px;
          object-fit: cover; flex-shrink: 0;
          border: 1px solid rgba(255,255,255,0.1);
        }
        .ni-card__body { flex: 1; min-width: 0; }
        .ni-card__header {
          display: flex; justify-content: space-between; align-items: center;
          margin-bottom: 3px;
        }
        .ni-card__label {
          font-family: var(--font-mono, monospace);
          font-size: 8px; font-weight: 700;
          letter-spacing: 0.2em; text-transform: uppercase;
        }
        .ni-card__time {
          font-family: var(--font-mono, monospace);
          font-size: 9px; color: rgba(255,255,255,0.3);
        }
        .ni-card__message {
          font-family: var(--font-mono, monospace);
          font-size: 11px; line-height: 1.4;
          color: rgba(255,255,255,0.7);
        }
        .ni-card__actions {
          display: flex; gap: 6px; margin-top: 6px;
        }
        .ni-card__btn {
          padding: 3px 10px; border-radius: 6px;
          font-family: var(--font-mono, monospace);
          font-size: 8px; font-weight: 700;
          letter-spacing: 0.15em; cursor: pointer;
          border: 1px solid rgba(255,255,255,0.15);
          background: rgba(255,255,255,0.04);
          color: rgba(255,255,255,0.6);
          text-decoration: none;
          transition: background 150ms;
        }
        .ni-card__btn:hover { background: rgba(255,255,255,0.08); }
        .ni-card__btn--gold {
          border-color: rgba(255,215,0,0.4);
          background: rgba(255,215,0,0.08);
          color: rgba(255,215,0,0.9);
        }
        .ni-card__btn--gold:hover { background: rgba(255,215,0,0.15); }
        .ni-card__btn--subtle {
          border-color: rgba(156,163,175,0.3);
          color: rgba(156,163,175,0.7);
        }
      `}</style>
    </>
  );
}

/* ── Inbox Panel ──────────────────────────────────────────────────────── */

function InboxPanel({
  notifications,
  onClose,
  onMarkRead,
  onMarkAllRead,
}: {
  notifications: Notification[];
  onClose: () => void;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
}) {
  return (
    <>
      {/* Backdrop */}
      <div className="ni-backdrop" onClick={onClose} />

      {/* Panel */}
      <div className="ni-panel">
        {/* Header */}
        <div className="ni-panel__header">
          <span className="ni-panel__title">NOTIFICATIONS</span>
          <div className="ni-panel__header-actions">
            {notifications.some((n) => !n.isRead) && (
              <button type="button" className="ni-panel__btn" onClick={onMarkAllRead}>
                MARK ALL READ
              </button>
            )}
            <button type="button" className="ni-panel__btn" onClick={onClose}>
              CLOSE
            </button>
          </div>
        </div>

        {/* Divider */}
        <div className="ni-divider" />

        {/* Feed */}
        <div className="ni-panel__feed">
          {notifications.length === 0 ? (
            <div className="ni-empty">
              <div className="ni-empty__icon">
                <svg width="32" height="26" viewBox="0 0 22 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M1 4L11 10L21 4M3 1H19C20.1 1 21 1.9 21 3V15C21 16.1 20.1 17 19 17H3C1.9 17 1 16.1 1 15V3C1 1.9 1.9 1 3 1Z"
                    stroke="rgba(255,255,255,0.15)"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <div className="ni-empty__text">
                No notifications yet.
              </div>
              <div className="ni-empty__sub">
                Place something on the board to get started.
              </div>
            </div>
          ) : (
            notifications.map((n) => (
              <NotificationCard key={n.id} notification={n} onMarkRead={onMarkRead} />
            ))
          )}
        </div>
      </div>

      <style jsx>{`
        .ni-backdrop {
          position: fixed; inset: 0; z-index: 90;
          background: rgba(3,11,18,0.4);
          backdrop-filter: blur(2px);
          animation: ni-fade-in 200ms ease;
        }
        @keyframes ni-fade-in { from { opacity: 0; } }

        .ni-panel {
          position: fixed; top: 0; right: 0; bottom: 0;
          z-index: 91;
          width: min(380px, calc(100vw - 16px));
          background:
            linear-gradient(180deg, rgba(12,24,48,0.95), rgba(6,14,28,0.98)),
            rgba(6,14,28,0.99);
          backdrop-filter: blur(24px) saturate(140%);
          border-left: 1px solid rgba(116,255,235,0.12);
          box-shadow:
            -20px 0 60px rgba(0,6,22,0.6),
            inset 1px 0 0 rgba(255,255,255,0.05);
          display: flex; flex-direction: column;
          animation: ni-slide-in 300ms cubic-bezier(.16,.86,.22,1);
        }
        @keyframes ni-slide-in {
          from { transform: translateX(100%); }
        }

        .ni-panel__header {
          display: flex; justify-content: space-between; align-items: center;
          padding: 14px 16px 10px;
          flex-shrink: 0;
        }
        .ni-panel__title {
          font-family: var(--font-mono, monospace);
          font-size: 10px; font-weight: 700;
          letter-spacing: 0.2em; color: rgba(116,255,235,0.8);
          text-transform: uppercase;
        }
        .ni-panel__header-actions {
          display: flex; gap: 6px;
        }
        .ni-panel__btn {
          padding: 3px 10px; border-radius: 8px;
          border: 1px solid rgba(116,255,235,0.2);
          background: rgba(116,255,235,0.04);
          font-family: var(--font-mono, monospace);
          font-size: 9px; font-weight: 600;
          letter-spacing: 0.12em; color: rgba(255,255,255,0.5);
          cursor: pointer;
          transition: background 150ms;
        }
        .ni-panel__btn:hover {
          background: rgba(116,255,235,0.08);
          color: rgba(255,255,255,0.7);
        }

        .ni-divider {
          height: 1px; margin: 0 16px;
          background: linear-gradient(90deg, transparent, rgba(116,255,235,0.15) 20%, rgba(116,255,235,0.15) 80%, transparent);
          flex-shrink: 0;
        }

        .ni-panel__feed {
          flex: 1; overflow-y: auto; padding: 8px;
          display: flex; flex-direction: column; gap: 4px;
        }
        .ni-panel__feed::-webkit-scrollbar { width: 4px; }
        .ni-panel__feed::-webkit-scrollbar-thumb {
          background: rgba(116,255,235,0.15); border-radius: 2px;
        }

        .ni-empty {
          display: flex; flex-direction: column; align-items: center;
          justify-content: center; flex: 1; gap: 8px;
          padding: 40px 20px; text-align: center;
        }
        .ni-empty__icon { opacity: 0.3; }
        .ni-empty__text {
          font-family: var(--font-mono, monospace);
          font-size: 12px; color: rgba(255,255,255,0.4);
        }
        .ni-empty__sub {
          font-family: var(--font-mono, monospace);
          font-size: 10px; color: rgba(255,255,255,0.25);
        }
      `}</style>
    </>
  );
}

/* ── Main Export ──────────────────────────────────────────────────────── */

export function NotificationInbox({ address }: Props) {
  const [open, setOpen] = useState(false);
  const {
    notifications,
    unreadCount,
    hasCanonization,
    markRead,
    markAllRead,
  } = useNotifications(address);

  const handleMarkRead = useCallback(
    (id: string) => {
      markRead([id]);
    },
    [markRead],
  );

  if (!address) return null;

  return (
    <>
      <EnvelopeButton
        unreadCount={unreadCount}
        hasCanonization={hasCanonization}
        onClick={() => setOpen((o) => !o)}
      />
      {open && (
        <InboxPanel
          notifications={notifications}
          onClose={() => setOpen(false)}
          onMarkRead={handleMarkRead}
          onMarkAllRead={markAllRead}
        />
      )}
    </>
  );
}
