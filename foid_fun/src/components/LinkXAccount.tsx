"use client";

import { useState } from "react";
import { useXPairing } from "@/hooks/useXPairing";

export default function LinkXAccount() {
  const { handle, isPaired, loading, error, pair, unpair } = useXPairing();
  const [inputHandle, setInputHandle] = useState("");
  const [showInput, setShowInput] = useState(false);

  if (isPaired) {
    return (
      <div className="flex items-center gap-2">
        <span className="foid-data" style={{ color: "var(--foid-text-dim)" }}>
          Linked: <strong style={{ color: "rgba(72,255,171,0.9)" }}>@{handle}</strong>
        </span>
        <button
          type="button"
          onClick={() => { unpair().catch(() => {}); }}
          disabled={loading}
          className="foid-label"
          style={{
            padding: "2px 8px",
            background: "rgba(255,100,100,0.15)",
            border: "1px solid rgba(255,100,100,0.3)",
            borderRadius: "4px",
            color: "rgba(255,150,150,0.9)",
            cursor: loading ? "wait" : "pointer",
          }}
        >
          {loading ? "..." : "Unlink"}
        </button>
      </div>
    );
  }

  if (showInput) {
    return (
      <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
        <input
          type="text"
          placeholder="@handle"
          value={inputHandle}
          onChange={(e) => setInputHandle(e.target.value.replace(/[^A-Za-z0-9_@]/g, ""))}
          maxLength={16}
          className="foid-data"
          style={{
            width: "110px",
            padding: "3px 6px",
            background: "rgba(255,255,255,0.08)",
            border: "1px solid rgba(255,255,255,0.2)",
            borderRadius: "4px",
            outline: "none",
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && inputHandle.trim()) {
              pair(inputHandle).catch(() => {});
            }
            if (e.key === "Escape") {
              setShowInput(false);
              setInputHandle("");
            }
          }}
          autoFocus
        />
        <button
          type="button"
          disabled={loading || !inputHandle.trim()}
          onClick={() => {
            pair(inputHandle).then(() => {
              setShowInput(false);
              setInputHandle("");
            }).catch(() => {});
          }}
          className="foid-label"
          style={{
            padding: "3px 8px",
            background: "rgba(72,255,171,0.15)",
            border: "1px solid rgba(72,255,171,0.3)",
            borderRadius: "4px",
            color: "rgba(72,255,171,0.9)",
            cursor: loading ? "wait" : "pointer",
          }}
        >
          {loading ? "..." : "Sign"}
        </button>
        <button
          type="button"
          onClick={() => { setShowInput(false); setInputHandle(""); }}
          className="foid-label"
          style={{
            padding: "3px 6px",
            background: "transparent",
            border: "none",
            cursor: "pointer",
          }}
        >
          Cancel
        </button>
        {error && (
          <span className="foid-label" style={{ color: "rgba(255,100,100,0.8)" }}>{error}</span>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setShowInput(true)}
      className="foid-label"
      style={{
        padding: "3px 8px",
        background: "rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.15)",
        borderRadius: "4px",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: "4px",
      }}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" fill="currentColor" />
      </svg>
      Link X Account
    </button>
  );
}
