"use client";

import * as React from "react";

export type ChatMsg = {
  id: string;
  user: string;
  text: string;
  ts: number;
  room: string;
};

const storeKey = (room: string) => `chat/${room}`;

const persistMessages = (room: string, msgs: ChatMsg[]) => {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(storeKey(room), JSON.stringify(msgs.slice(-500)));
  } catch {
    /* ignore quota errors */
  }
};

export function formatTime(ts: number) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function useChat(room = "global") {
  const [messages, setMessages] = React.useState<ChatMsg[]>([]);
  const chanRef = React.useRef<BroadcastChannel | null>(null);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = JSON.parse(localStorage.getItem(storeKey(room)) || "[]");
      if (Array.isArray(stored)) setMessages(stored);
    } catch {
      /* ignore bad data */
    }
  }, [room]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("BroadcastChannel" in window)) return;

    const chan = new BroadcastChannel(`mifoid-chat:${room}`);
    chan.onmessage = (ev) => {
      const msg = ev.data as ChatMsg;
      setMessages((m) => {
        const next = [...m, msg];
        persistMessages(room, next);
        return next;
      });
    };
    chanRef.current = chan;
    return () => {
      chan.close();
      if (chanRef.current === chan) chanRef.current = null;
    };
  }, [room]);

  const send = React.useCallback(
    (user: string, text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      const msg: ChatMsg = {
        id: crypto.randomUUID(),
        user: user || "anon",
        text: trimmed,
        ts: Date.now(),
        room,
      };

      setMessages((m) => {
        const next = [...m, msg];
        persistMessages(room, next);
        return next;
      });

      chanRef.current?.postMessage(msg);
    },
    [room]
  );

  return { messages, send };
}
