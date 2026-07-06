"use client";

import React, { useState, useEffect, useRef, useCallback, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { CloseIcon, HourglassIcon, SendIcon, SparkleIcon } from "@/components/icons/AeroIcons";
import { supabase, SUPABASE_ENABLED, type BoardMessage } from "@/lib/supabase";
import toast from "react-hot-toast";

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

const MAX_MESSAGE_LENGTH = 280;
const COOLDOWN_MS = 3000;
// In-memory buffer cap. Realtime INSERTs append for as long as the tab
// lives; the display already filters to 24h, so keep the array bounded too.
const MAX_BUFFER = 200;

// Deterministic pastel identity per wallet — regulars get a recognizable
// chip color. FNV-ish string hash; hue drives the gel chip tint (CSS
// --chip-h), a higher bit picks the bubble's cyan/pink glass tint so the
// two don't correlate visually.
function hashSender(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) >>> 0;
  // Avalanche finalizer (murmur3-style): without it, addresses that differ
  // only in the last character land ~1° apart on the hue wheel and read as
  // the same chip color.
  h ^= h >>> 16;
  h = Math.imul(h, 0x45d9f3b) >>> 0;
  h ^= h >>> 16;
  return h >>> 0;
}

// Append-only merge by id — used by the initial load, realtime INSERTs, and
// post-reconnect backfill. Skipping ids we already hold means the realtime
// echo of our own reconciled send never double-enters the buffer.
function mergeMessages(prev: BoardMessage[], incoming: BoardMessage[]): BoardMessage[] {
  const seen = new Set(prev.map((m) => m.id));
  const additions = incoming.filter((m) => !seen.has(m.id));
  if (additions.length === 0) return prev;
  return [...prev, ...additions].slice(-MAX_BUFFER);
}

// Last-24h chat history (max 100 rows). Shared by the mount load and the
// reconnect backfill — messages inserted while the socket was down used to
// be invisible until a full page reload.
async function fetchRecentChat(): Promise<BoardMessage[]> {
  if (!supabase) return [];
  const since = new Date();
  since.setHours(since.getHours() - 24);
  try {
    const { data, error } = await supabase
      .from("board_messages")
      .select("*")
      .eq("type", "chat")
      .gte("created_at", since.toISOString())
      .order("created_at", { ascending: true })
      .limit(100);
    return !error && data ? data : [];
  } catch (err) {
    console.error("Failed to load chat messages:", err);
    return [];
  }
}

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
  const [isCoolingDown, setIsCoolingDown] = useState(false);
  const [supabaseMessages, setSupabaseMessages] = useState<BoardMessage[]>([]);
  const [realtimeStatus, setRealtimeStatus] = useState<"connected" | "disconnected" | "reconnecting">("disconnected");
  const scrollRef = useRef<HTMLDivElement>(null);
  // Scroll anchoring: only follow new messages when the user is already at
  // (or near) the bottom. Someone reading history must never get yanked
  // down by an incoming message; sending your own re-pins (see handleSend).
  const pinnedRef = useRef(true);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    pinnedRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
  }, []);

  // Auto-scroll to bottom when messages change (only while pinned)
  useEffect(() => {
    if (scrollRef.current && pinnedRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [statusMessages, supabaseMessages]);

  // Load recent messages from Supabase on mount (last 24 hours only)
  useEffect(() => {
    if (!enableSupabase || !SUPABASE_ENABLED || !supabase) return;

    let cancelled = false;
    void fetchRecentChat().then((rows) => {
      if (!cancelled && rows.length > 0) {
        setSupabaseMessages((prev) => mergeMessages(prev, rows));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [enableSupabase]);

  // Subscribe to real-time messages with reconnection
  useEffect(() => {
    if (!enableSupabase || !SUPABASE_ENABLED || !supabase) return;

    let cancelled = false;
    let reconnectTimer: ReturnType<typeof setTimeout>;
    let attempt = 0;
    let currentChannel: ReturnType<typeof supabase.channel> | null = null;

    function connect() {
      if (cancelled) return;
      setRealtimeStatus("reconnecting");

      try {
        // Remove previous channel if exists
        if (currentChannel) {
          supabase!.removeChannel(currentChannel);
        }

        const channel = supabase!
          .channel(`board_messages_changes_${Date.now()}`)
          .on<BoardMessage>(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "board_messages",
              filter: "type=eq.chat",
            },
            (payload) => {
              if (payload.new) {
                setSupabaseMessages((prev) => mergeMessages(prev, [payload.new]));
              }
            }
          )
          .subscribe((status) => {
            if (status === "SUBSCRIBED") {
              setRealtimeStatus("connected");
              const wasReconnect = attempt > 0;
              attempt = 0;
              // Backfill anything inserted while the socket was down —
              // postgres_changes has no replay, so a drop is a silent gap
              // until the next reload without this.
              if (wasReconnect) {
                void fetchRecentChat().then((rows) => {
                  if (!cancelled && rows.length > 0) {
                    setSupabaseMessages((prev) => mergeMessages(prev, rows));
                  }
                });
              }
            } else if (status === "CLOSED" || status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
              setRealtimeStatus("disconnected");
              if (!cancelled) {
                const delay = Math.min(1000 * Math.pow(2, attempt), 30000);
                attempt++;
                reconnectTimer = setTimeout(connect, delay);
              }
            }
          });

        currentChannel = channel;
      } catch (err) {
        // WebSocket can throw synchronously on insecure contexts (e.g. ws:// on https:// page).
        // Degrade gracefully — chat will work without real-time updates.
        console.warn("[TerminalChat] Realtime connection failed:", err);
        setRealtimeStatus("disconnected");
      }
    }

    connect();

    return () => {
      cancelled = true;
      clearTimeout(reconnectTimer);
      if (currentChannel) supabase!.removeChannel(currentChannel);
    };
  }, [enableSupabase]);

  const formatTime = (date: Date) =>
    date.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit" });

  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || trimmed.length > MAX_MESSAGE_LENGTH || isSending || isCoolingDown || !walletAddress) return;

    setIsSending(true);
    setInput("");
    // Your own message always scrolls into view, even if you were reading history.
    pinnedRef.current = true;

    // Optimistic: show the message immediately
    const optimisticId = `local-${Date.now()}-${Math.random()}`;
    setSupabaseMessages((prev) => [
      ...prev,
      {
        id: optimisticId,
        created_at: new Date().toISOString(),
        wallet_address: walletAddress,
        message: trimmed,
        type: "chat",
      },
    ]);

    try {
      // Send via API route (server-side validation + rate limiting)
      const res = await fetch("/api/chat/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: walletAddress, message: trimmed }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Send failed" }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      // Reconcile: swap the optimistic entry for the server row so the
      // realtime echo dedupes by id instead of the text+5s heuristic
      // (which showed doubles whenever realtime delivery lagged >5s).
      const payload = (await res.json().catch(() => null)) as { message?: BoardMessage } | null;
      const serverRow = payload?.message;
      if (serverRow && typeof serverRow.id === "string") {
        setSupabaseMessages((prev) =>
          prev.some((m) => m.id === serverRow.id)
            ? prev.filter((m) => m.id !== optimisticId) // realtime echo beat us
            : prev.map((m) => (m.id === optimisticId ? serverRow : m))
        );
      }

      // Call parent callback if provided
      if (onSend) {
        await onSend(trimmed);
      }
    } catch (err) {
      console.error("TerminalChat send failed", err);
      // Remove optimistic message on error
      setSupabaseMessages((prev) =>
        prev.filter((m) => m.id !== optimisticId)
      );
      // Show error toast (use toast() not toast.error() — errors are suppressed in production)
      // A fetch-level TypeError means the request never left (offline/DNS).
      const friendly =
        err instanceof TypeError
          ? "network offline — message not sent"
          : err instanceof Error
            ? err.message
            : "Message failed to send";
      toast(friendly, {
        icon: <CloseIcon size={12} />,
        style: {
          background: "rgba(255, 79, 110, 0.16)",
          color: "#ffeef0",
          border: "1px solid rgba(255, 129, 150, 0.42)",
        },
      });
    } finally {
      setIsSending(false);
      setIsCoolingDown(true);
      setTimeout(() => setIsCoolingDown(false), COOLDOWN_MS);
    }
  }, [input, isSending, isCoolingDown, onSend, walletAddress]);

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
          ? msg.wallet_address.slice(0, 6) + "\u2026" + msg.wallet_address.slice(-4)
          : undefined,
        variant: msg.type === "chat" ? ("chat" as const) : undefined,
        isLocal: false,
      })),
  ]
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
    // Deduplicate by ID first, then by text + timestamp (within 5 seconds)
    .filter((msg, index, arr) => {
      if (index === 0) return true;
      const prev = arr[index - 1];

      // If IDs match, it's definitely a duplicate
      if (msg.id === prev.id) return false;

      // Otherwise, check text + timestamp for potential duplicates
      const timeDiff = Math.abs(msg.timestamp.getTime() - prev.timestamp.getTime());
      return !(msg.text === prev.text && timeDiff < 5000);
    });

  const isSendDisabled = isSending || isCoolingDown || !input.trim() || input.trim().length > MAX_MESSAGE_LENGTH || !walletAddress;

  return (
    <div className={`terminal-chat ${className}`}>
      <div ref={scrollRef} onScroll={handleScroll} className="terminal-chat__messages">
        {realtimeStatus === "reconnecting" && (
          <div className="terminal-chat__reconnecting">reconnecting...</div>
        )}
        {allMessages.map((msg) => {
          const isChat = msg.variant === "chat";
          const isSystem = msg.type === "system" && !isChat;
          const lineClass = isChat ? "terminal-chat__line--chat" : `terminal-chat__line--${msg.type}`;
          const labelClass = isSystem ? "terminal-chat__system" : "terminal-chat__user";
          const labelText = isSystem ? "SYSTEM" : isChat ? (msg.user || "anon") : "milady";

          // Chat rows become glass bubbles: sender hash → pastel chip hue +
          // alternating cyan/pink glass tint, so regulars are recognizable.
          const senderHash = isChat ? hashSender(msg.user || "anon") : 0;
          const bubbleClass = isChat
            ? ` terminal-chat__line--bubble terminal-chat__line--tint-${((senderHash >>> 8) & 1) === 0 ? "a" : "b"}`
            : "";
          const chipStyle = isChat
            ? ({ "--chip-h": String(senderHash % 360) } as React.CSSProperties)
            : undefined;

          return (
            <div key={msg.id} className={`terminal-chat__line ${lineClass}${bubbleClass}`}>
              <span className="terminal-chat__time">{formatTime(msg.timestamp)}</span>
              <span className={labelClass} style={chipStyle}>
                {isSystem && <SparkleIcon size={10} />}
                {labelText}
              </span>
              <span className="terminal-chat__text">{msg.text}</span>
            </div>
          );
        })}
        {!allMessages.some((msg) => msg.variant === "chat") && (
          <div className="terminal-chat__empty">
            <span>it&rsquo;s quiet in here&hellip; say gm</span>
            <SparkleIcon size={13} />
          </div>
        )}
      </div>
      <div className="terminal-chat__input-row">
        <span className="terminal-chat__prompt" aria-hidden="true">&gt;</span>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={walletAddress ? "type here..." : "connect wallet to chat"}
          className="terminal-chat__input"
          disabled={!walletAddress}
          maxLength={MAX_MESSAGE_LENGTH}
          aria-label="Send a chat message to the board"
        />
        <button
          type="button"
          className="terminal-chat__send"
          onClick={() => void handleSend()}
          disabled={isSendDisabled}
          aria-label={isCoolingDown ? "Cooling down — one moment" : "Send message"}
          title={isCoolingDown ? "Cooling down — one moment" : "Send"}
        >
          {isCoolingDown ? <HourglassIcon size={14} /> : <SendIcon size={15} />}
        </button>
      </div>
      {walletAddress && (
        <div
          className="terminal-chat__char-counter"
          data-warn={input.length > 250 ? "" : undefined}
        >
          {input.length}/{MAX_MESSAGE_LENGTH}
        </div>
      )}
    </div>
  );
}
