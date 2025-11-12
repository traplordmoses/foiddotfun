"use client";

import { FormEvent, useMemo, useState } from "react";

type Message = {
  id: number;
  user: string;
  text: string;
  ts: number;
};

function randomUser() {
  const tag = Math.random().toString(16).slice(2, 6);
  return `anon-${tag}`;
}

export default function ChatDock() {
  const [username] = useState(() => randomUser());
  const [text, setText] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 0,
      user: "system",
      text: "chat.exe is live — be excellent to each other.",
      ts: Date.now(),
    },
  ]);

  const sorted = useMemo(
    () => [...messages].sort((a, b) => a.ts - b.ts),
    [messages]
  );

  const send = (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setMessages((prev) => [
      ...prev,
      { id: prev.length + 1, user: username, text: text.trim(), ts: Date.now() },
    ]);
    setText("");
  };

  return (
    <div className="flex h-full flex-col text-white/90">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm font-semibold">chat.exe</span>
        <span className="text-xs text-white/60">signed in as {username}</span>
      </div>
      <div className="flex-1 min-h-[200px] rounded-xl border border-white/10 bg-black/30 p-3 space-y-3 overflow-y-auto">
        {sorted.map((m) => (
          <div key={m.id} className="text-sm leading-snug">
            <span className="font-semibold text-white/80">{m.user}</span>
            <span className="text-white/50 text-xs ml-2">
              {new Date(m.ts).toLocaleTimeString()}
            </span>
            <div className="text-white/80">{m.text}</div>
          </div>
        ))}
      </div>
      <form onSubmit={send} className="mt-3 flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.currentTarget.value)}
          placeholder="say something..."
          className="flex-1 rounded-xl border border-white/15 bg-white/90 px-3 py-2 text-black outline-none"
        />
        <button
          type="submit"
          className="rounded-xl bg-cyan-300/90 px-4 py-2 text-black font-semibold disabled:opacity-50"
          disabled={!text.trim()}
        >
          Send
        </button>
      </form>
    </div>
  );
}
