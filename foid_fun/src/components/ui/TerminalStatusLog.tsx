// src/components/ui/TerminalStatusLog.tsx
// Reusable status-log rendering. This is the log-only half of TerminalChat —
// no Supabase, no send input, just the addStatus-fed message list. Pages that
// want a quiet status trail (e.g. /pray, /vote, modals) compose this. Pages
// that also need chat (e.g. /board) can keep using the full TerminalChat
// which already renders identical markup under the hood.
//
// The component re-exports the StatusMessage type for convenience so callers
// can import both from one place.
"use client";

import React, { useEffect, useRef, useState } from "react";
import type { StatusMessage } from "@/components/TerminalChat";

export type { StatusMessage } from "@/components/TerminalChat";

export type TerminalStatusLogProps = {
  messages: StatusMessage[];
  /**
   * Optional send callback. When provided, a minimal text input renders
   * below the log (mirrors TerminalChat's surface, but without Supabase
   * wiring). Omit for a pure log panel.
   */
  onSend?: (text: string) => void | Promise<void>;
  className?: string;
  /**
   * Height of the scrollable region. Defaults to filling the parent.
   * Accepts any CSS length (e.g. "200px", "40vh").
   */
  maxHeight?: string;
  /**
   * When true (default), the log is announced via aria-live="polite" so
   * screen readers narrate new status lines. Set false when status is
   * already mirrored to another live region (e.g. #board-sr-status).
   */
  announce?: boolean;
};

const TYPE_COLOR: Record<StatusMessage["type"], string> = {
  info: "var(--foid-text)",
  success: "var(--tone-ok-text)",
  error: "var(--tone-err-text)",
  system: "var(--tone-info-text)",
};

export function TerminalStatusLog({
  messages,
  onSend,
  className = "",
  maxHeight,
  announce = true,
}: TerminalStatusLogProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState("");

  // Auto-scroll to bottom when messages change (mirrors TerminalChat).
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = async () => {
    const text = input.trim();
    if (!text || !onSend) return;
    setInput("");
    await onSend(text);
  };

  return (
    <div
      className={`ui-status-log${className ? ` ${className}` : ""}`}
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        height: "100%",
      }}
    >
      <div
        ref={scrollRef}
        className="ui-status-log__scroll"
        role={announce ? "log" : undefined}
        aria-live={announce ? "polite" : undefined}
        aria-relevant={announce ? "additions" : undefined}
        aria-label={announce ? "Status log" : undefined}
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          maxHeight,
          padding: "8px 10px",
          fontFamily: "var(--font-terminal, ui-monospace, monospace)",
          fontSize: 11,
          lineHeight: 1.4,
          color: "var(--foid-text-dim)",
        }}
      >
        {messages.map((m) => (
          <div
            key={m.id}
            className={`ui-status-log__line ui-status-log__line--${m.type}`}
            style={{
              display: "flex",
              gap: 8,
              padding: "2px 0",
              color: TYPE_COLOR[m.type],
            }}
          >
            <time
              className="ui-status-log__time"
              dateTime={m.timestamp.toISOString()}
              style={{ opacity: 0.5, flexShrink: 0 }}
            >
              {m.timestamp.toLocaleTimeString(undefined, {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </time>
            {m.user && (
              <span className="ui-status-log__user" style={{ opacity: 0.7 }}>
                {m.user}:
              </span>
            )}
            <span className="ui-status-log__text">{m.text}</span>
          </div>
        ))}
      </div>
      {onSend && (
        <div
          className="ui-status-log__input-row"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 10px",
            borderTop: "1px solid var(--foid-border-mute)",
          }}
        >
          <span aria-hidden="true" style={{ opacity: 0.6 }}>
            &gt;
          </span>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void handleSubmit();
              }
            }}
            aria-label="Send message"
            maxLength={280}
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              color: "var(--foid-text)",
              fontFamily: "var(--font-terminal, ui-monospace, monospace)",
              fontSize: 11,
            }}
          />
        </div>
      )}
    </div>
  );
}
