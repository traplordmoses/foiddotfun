"use client";

export type MusicPanelState = {
  currentTrackName: string;
  progress: number;
  elapsed: number;
  duration: number;
  isPlaying: boolean;
  needsInteraction: boolean;
  shuffle: boolean;
  repeat: boolean;
  volume: number;
};

export type MusicPanelController = {
  getState: () => MusicPanelState;
  subscribe: (listener: () => void) => () => void;
  toggle: () => void;
  play: () => Promise<void>;
  pause: () => void;
  next: () => void;
  prev: () => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  setVolume: (value: number) => void;
  adjustVolume: (delta: number) => void;
  getVolume: () => number;
};

let musicPanelState: MusicPanelState = {
  currentTrackName: "—",
  progress: 0,
  elapsed: 0,
  duration: 0,
  isPlaying: false,
  needsInteraction: true,
  shuffle: false,
  repeat: false,
  volume: 0.5,
};

const listeners = new Set<() => void>();

const notifyListeners = () => {
  listeners.forEach((fn) => fn());
};

export const broadcastMusicState = (partial: Partial<MusicPanelState>) => {
  musicPanelState = { ...musicPanelState, ...partial };
  notifyListeners();
};

export const musicPanelController: MusicPanelController = {
  getState: () => musicPanelState,
  subscribe: (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  toggle: () => broadcastMusicState({ isPlaying: !musicPanelState.isPlaying }),
  play: () => {
    return new Promise<void>((resolve) => {
      broadcastMusicState({ isPlaying: true });
      resolve();
    });
  },
  pause: () => broadcastMusicState({ isPlaying: false }),
  next: () => {},
  prev: () => {},
  toggleShuffle: () => broadcastMusicState({ shuffle: !musicPanelState.shuffle }),
  toggleRepeat: () => broadcastMusicState({ repeat: !musicPanelState.repeat }),
  setVolume: (value: number) => broadcastMusicState({ volume: value }),
  adjustVolume: (delta: number) => broadcastMusicState({ volume: Math.min(1, Math.max(0, musicPanelState.volume + delta)) }),
  getVolume: () => musicPanelState.volume,
};
