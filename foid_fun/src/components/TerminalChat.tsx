"use client";

import React, { useState, useEffect, useRef, useCallback, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { insertBoardMessage, subscribeToBoardMessages, supabase, type BoardMessage } from "@/lib/supabase";

// ============================================================================
// TYPES
// ============================================================================

export type StatusMessage = {
  id: string;
  text: string;
  type: "info" | "success" | "error" | "system";
  timestamp: Date;
  variant?: "chat";
  user?: string;
};

export type TerminalChatProps = {
  statusMessages: StatusMessage[];
  onSend?: (text: string) => void | Promise<void>;
  className?: string;
  enableSupabase?: boolean;
  walletAddress?: string;
};

// ============================================================================
// COMPONENT
// ============================================================================

export function TerminalChat({
  statusMessages,
  onSend,
  className = "",
  enableSupabase = false,
  walletAddress,
}: TerminalChatProps) {
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [supabaseMessages, setSupabaseMessages] = useState<BoardMessage[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [statusMessages, supabaseMessages]);

  // Load recent messages from Supabase on mount (last 24 hours only)
  useEffect(() => {
    if (!enableSupabase) return;

    const loadMessages = async () => {
      const twentyFourHoursAgo = new Date();
      twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

      try {
        const { data, error } = await supabase
          .from("board_messages")
          .select("*")
          .eq("type", "chat")
          .gte("created_at", twentyFourHoursAgo.toISOString())
          .order("created_at", { ascending: true })
          .limit(100);

        if (data && !error) {
          setSupabaseMessages(data);
        }
      } catch (err) {
        console.error("Failed to load chat messages:", err);
      }
    };

    void loadMessages();
  }, [enableSupabase]);

  // Subscribe to real-time messages
  useEffect(() => {
    if (!enableSupabase) return;

    const unsubscribe = subscribeToBoardMessages((message) => {
      setSupabaseMessages((prev) => [...prev, message]);
    });

    return () => {
      unsubscribe();
    };
  }, [enableSupabase]);

  const formatTime = (date: Date) =>
    date.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit" });

  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isSending) return;

    setIsSending(true);
    setInput("");

    try {
      // Save to Supabase if enabled
      if (enableSupabase) {
        await insertBoardMessage({
          wallet_address: walletAddress || null,
          message: trimmed,
          type: "chat",
        });
      }

      // Call parent callback if provided
      if (onSend) {
        await onSend(trimmed);
      }
    } catch (err) {
      console.error("TerminalChat send failed", err);
    } finally {
      setIsSending(false);
    }
  }, [input, isSending, onSend, enableSupabase, walletAddress]);

  const handleKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      void handleSend();
    }
  };

  // Merge status messages and Supabase messages with 24-hour filter and deduplication
  const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;

  const allMessages = [
    ...statusMessages.map((msg) => ({
      id: msg.id,
      timestamp: msg.timestamp,
      type: msg.type,
      text: msg.text,
      user: msg.user || "system",
      variant: msg.variant,
      isLocal: true,
    })),
    ...supabaseMessages
      .filter((msg) => {
        const msgTime = new Date(msg.created_at).getTime();
        return msgTime >= twentyFourHoursAgo;
      })
      .map((msg) => ({
        id: msg.id,
        timestamp: new Date(msg.created_at),
        type: msg.type as StatusMessage["type"],
        text: msg.message,
        user: msg.wallet_address
          ? msg.wallet_address.slice(0, 6) + "…" + msg.wallet_address.slice(-4)
          : undefined,
        variant: msg.type === "chat" ? ("chat" as const) : undefined,
        isLocal: false,
      })),
  ]
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
    // Deduplicate by text + timestamp (within 5 seconds)
    .filter((msg, index, arr) => {
      if (index === 0) return true;
      const prev = arr[index - 1];
      const timeDiff = Math.abs(msg.timestamp.getTime() - prev.timestamp.getTime());
      return !(msg.text === prev.text && timeDiff < 5000);
    });

  return (
    <div className={`terminal-chat ${className}`}>
      <div ref={scrollRef} className="terminal-chat__messages">
        {allMessages.map((msg) => {
          const isChat = msg.variant === "chat";
          const isSystem = msg.type === "system" && !isChat;
          const lineClass = isChat ? "terminal-chat__line--chat" : `terminal-chat__line--${msg.type}`;
          const labelClass = isSystem ? "terminal-chat__system" : "terminal-chat__user";
          const labelText = isSystem ? "SYSTEM" : isChat ? "mifoid" : "milady";

          return (
            <div key={msg.id} className={`terminal-chat__line ${lineClass}`}>
              <span className="terminal-chat__time">{formatTime(msg.timestamp)}</span>
              <span className={labelClass}>{labelText}</span>
              <span className="terminal-chat__text">{msg.text}</span>
            </div>
          );
        })}
      </div>
      <div className="terminal-chat__input-row">
        <span className="terminal-chat__prompt">&gt;</span>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="type here..."
          className="terminal-chat__input"
        />
        <button
          type="button"
          className="terminal-chat__send"
          onClick={() => void handleSend()}
          disabled={isSending || !input.trim()}
        >
          SEND
        </button>
      </div>
    </div>
  );
}
