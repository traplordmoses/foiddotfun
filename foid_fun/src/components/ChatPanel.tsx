"use client";

import * as React from "react";
import { useChat, formatTime } from "@/lib/chatBus";

type Props = {
  open: boolean;
  onClose: () => void;
  username: string;
  room?: string;
  /** Optional extra footer content like compact music controls */
  footerExtra?: React.ReactNode;
};

export default function ChatPanel({
  open,
  onClose,
  username,
  room = "global",
  footerExtra,
}: Props) {
  const { messages, send } = useChat(room);
  const [text, setText] = React.useState("");
  const scrollerRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!open) return;
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [open, messages.length]);

  return (
    <aside
      aria-hidden={!open}
      className="self-start w-full md:w-[380px] rounded-2xl border border-white/15 bg-white/8 backdrop-blur-xl shadow-[0_8px_30px_rgba(0,0,0,.18)] text-white/90 flex flex-col"
    >
      <div className="flex items-center gap-2 p-3 border-b border-white/10">
        <div className="text-sm font-semibold">Live chat</div>
        <div className="ml-2 text-xs text-white/60">room: {room}</div>
        <div className="ml-auto">
          <button
            onClick={onClose}
            className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-xs"
            type="button"
          >
            Close
          </button>
        </div>
      </div>

      <div ref={scrollerRef} className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2">
        {messages.length === 0 ? (
          <div className="text-sm text-white/60 mt-2">No messages yet. Say hi 👋</div>
        ) : (
          messages.map((m) => (
            <div key={m.id} className="flex gap-2 items-start">
              <div className="mt-1 h-2 w-2 rounded-full bg-white/50" />
              <div className="min-w-0">
                <div className="text-[11px] text-white/60">
                  <span className="font-medium text-white/80">{m.user}</span> · {formatTime(m.ts)}
                </div>
                <div className="mt-0.5 text-sm leading-snug break-words">{m.text}</div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="sticky bottom-0 bg-white/5 border-t border-white/10">
        {footerExtra ? <div className="p-3 border-b border-white/10">{footerExtra}</div> : null}

        <form
          className="p-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!text.trim()) return;
            send(username || "anon", text);
            setText("");
            requestAnimationFrame(() => {
              const el = scrollerRef.current;
              if (el) el.scrollTop = el.scrollHeight;
            });
          }}
        >
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="message…"
            className="w-full px-3 py-2 rounded-xl bg-white/80 text-black outline-none"
          />
          <div className="mt-2 flex justify-end">
            <button
              className="px-3 py-1.5 rounded-xl bg-cyan-300/90 text-black font-medium disabled:opacity-50"
              disabled={!text.trim()}
              type="submit"
            >
              Send
            </button>
          </div>
        </form>
      </div>
    </aside>
  );
}
