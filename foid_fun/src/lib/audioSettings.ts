"use client";

export type AudioSettings = {
  sfxEnabled: boolean;
  sfxVolume: number;
  musicEnabled: boolean;
  musicVolume: number;
};

const STORAGE_KEY = "foid_audio_settings";

const DEFAULTS: AudioSettings = {
  sfxEnabled: true,
  sfxVolume: 0.7,
  musicEnabled: true,
  musicVolume: 0.35,
};

function loadFromStorage(): AudioSettings {
  if (typeof window === "undefined") return { ...DEFAULTS };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw);
    return {
      sfxEnabled: typeof parsed.sfxEnabled === "boolean" ? parsed.sfxEnabled : DEFAULTS.sfxEnabled,
      sfxVolume: typeof parsed.sfxVolume === "number" ? parsed.sfxVolume : DEFAULTS.sfxVolume,
      musicEnabled: typeof parsed.musicEnabled === "boolean" ? parsed.musicEnabled : DEFAULTS.musicEnabled,
      musicVolume: typeof parsed.musicVolume === "number" ? parsed.musicVolume : DEFAULTS.musicVolume,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

let state: AudioSettings = loadFromStorage();
const listeners = new Set<() => void>();

function saveToStorage() {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore quota errors */
  }
}

function broadcastState(partial: Partial<AudioSettings>) {
  state = { ...state, ...partial };
  saveToStorage();
  listeners.forEach((fn) => fn());
}

export function getAudioSettings(): AudioSettings {
  return state;
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setSfxEnabled(enabled: boolean) {
  broadcastState({ sfxEnabled: enabled });
}

export function toggleSfx() {
  broadcastState({ sfxEnabled: !state.sfxEnabled });
}

export function setSfxVolume(volume: number) {
  broadcastState({ sfxVolume: Math.min(1, Math.max(0, volume)) });
}

export function setMusicEnabled(enabled: boolean) {
  broadcastState({ musicEnabled: enabled });
}

export function setMusicVolume(volume: number) {
  broadcastState({ musicVolume: Math.min(1, Math.max(0, volume)) });
}
