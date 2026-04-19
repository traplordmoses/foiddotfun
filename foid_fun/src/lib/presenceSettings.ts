"use client";

// Tiny external store for the /board ambient-presence opt-out.
// Mirrors the audioSettings.ts shape so useSyncExternalStore consumers
// (PresenceToggle, the usePresence caller in board/page.tsx) can read a
// single source of truth that persists across reloads.
//
// Default is enabled (matches prior behavior). Users who toggle off stop
// broadcasting their cursor and stop receiving peer cursors until they
// flip it back on — the usePresence hook fully unsubscribes when disabled.

export type PresenceSettings = {
  enabled: boolean;
};

const STORAGE_KEY = "foid_presence_settings";

const DEFAULTS: PresenceSettings = {
  enabled: true,
};

function loadFromStorage(): PresenceSettings {
  if (typeof window === "undefined") return { ...DEFAULTS };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw);
    return {
      enabled:
        typeof parsed.enabled === "boolean" ? parsed.enabled : DEFAULTS.enabled,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

let state: PresenceSettings = loadFromStorage();
const listeners = new Set<() => void>();

function saveToStorage() {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore quota errors */
  }
}

function broadcastState(partial: Partial<PresenceSettings>) {
  state = { ...state, ...partial };
  saveToStorage();
  listeners.forEach((fn) => fn());
}

export function getPresenceSettings(): PresenceSettings {
  return state;
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setPresenceEnabled(enabled: boolean) {
  broadcastState({ enabled });
}

export function togglePresence() {
  broadcastState({ enabled: !state.enabled });
}
