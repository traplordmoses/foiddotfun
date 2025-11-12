"use client";

type AudioContextConstructor =
  | typeof AudioContext
  | (typeof globalThis extends { webkitAudioContext: infer T } ? T : never);

// IMPORTANT: make sure these files exist under /public
// e.g. public/sfx/typing.wav, public/sfx/reward.wav, etc.
const PATHS = {
  loading: "/sfx/loadingfoid.wav",
  reward: "/sfx/reward.wav",
  typing: "/sfx/typing.wav",
  error: "/sfx/error.wav",

  // background track (adjust the first one to a file you actually have)
  background_primary: "/sfx/music/foidbackground1.opus",

  // --- legacy aliases to kill 404s from older code ---
  enter: "/sfx/typing.wav",            // old code requested /sfx/enter.wav
  spacebar: "/sfx/typing.wav",         // old code requested /sfx/spacebar.wav
  backgroundfoid: "/sfx/music/foidbackground1.opus",
} as const;

type SfxKey = keyof typeof PATHS;

// optional background fallbacks if the primary is missing on disk
const BG_FALLBACKS = [
  PATHS.backgroundfoid,
  "/sfx/music/foidbackground15.opus",
  "/sfx/music/foidbackground1.m4a",
  "/sfx/music/foidbackground15.m4a",
];

const TYPING_VOLUME = 0.4;

let ctx: AudioContext | null = null;
let unlocked = false;
let fallbackMode = false;

const buffers: Partial<Record<SfxKey, AudioBuffer>> = {};
const pendingLoads: Partial<Record<SfxKey, Promise<void>>> = {};

type BackgroundState = {
  source: AudioBufferSourceNode | null;
  gain: GainNode | null;
  offset: number;
  startTime: number;
  playing: boolean;
  volume: number;
  html: HTMLAudioElement | null;
};

const backgroundState: BackgroundState = {
  source: null,
  gain: null,
  offset: 0,
  startTime: 0,
  playing: false,
  volume: 0.35,
  html: null,
};

const typingState: { timer: number | null; active: boolean } = {
  timer: null,
  active: false,
};

const isBrowser = typeof window !== "undefined";
const audioContextSupported =
  isBrowser &&
  (typeof window.AudioContext === "function" ||
    typeof (window as any).webkitAudioContext === "function");

function clampVolume(value: number) {
  if (Number.isNaN(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function ensureCtx(): AudioContext | null {
  if (!isBrowser) return null;
  if (!audioContextSupported) {
    fallbackMode = true;
    return null;
  }
  if (!ctx) {
    const Ctor: AudioContextConstructor =
      window.AudioContext ?? (window as any).webkitAudioContext;
    ctx = new Ctor();
  }
  return ctx;
}

function ensureBackgroundGain(ac: AudioContext): GainNode {
  if (!backgroundState.gain) {
    const gain = ac.createGain();
    gain.gain.value = backgroundState.volume;
    gain.connect(ac.destination);
    backgroundState.gain = gain;
  }
  return backgroundState.gain;
}

async function fetchFirst(paths: string[]): Promise<ArrayBuffer | null> {
  for (const p of paths) {
    try {
      const res = await fetch(p);
      if (res.ok) return await res.arrayBuffer();
    } catch {}
  }
  return null;
}

async function loadOne(key: SfxKey): Promise<void> {
  if (!isBrowser || buffers[key] || pendingLoads[key]) {
    if (pendingLoads[key]) await pendingLoads[key];
    return;
  }
  const promise = (async () => {
    const ac = ensureCtx();
    if (!ac) return;

    const candidates =
      key === "background_primary"
        ? [PATHS.background_primary, ...BG_FALLBACKS]
        : [PATHS[key]];

    const data = await fetchFirst(candidates);
    if (!data) throw new Error(`Failed to load sfx: ${candidates.join(", ")}`);

    const audioBuffer = await ac.decodeAudioData(data);
    buffers[key] = audioBuffer;
  })();

  pendingLoads[key] = promise;
  try {
    await promise;
  } finally {
    delete pendingLoads[key];
  }
}

// background buffer accessor (uses the "background_primary" key)
async function getBackgroundBuffer(): Promise<AudioBuffer | null> {
  await loadOne("background_primary").catch(() => {});
  return (buffers.background_primary as AudioBuffer | undefined) ?? null;
}

export async function init(): Promise<void> {
  if (!isBrowser) return;
  if (!audioContextSupported) {
    fallbackMode = true;
    return;
  }
  // preload common effects; background lazily loads on first play
  const keys: SfxKey[] = ["loading", "reward", "typing", "error", "enter", "spacebar"];
  await Promise.all(keys.map((k) => loadOne(k).catch(() => {})));
}

export async function unlock(): Promise<void> {
  if (!isBrowser) return;
  unlocked = true;
  if (fallbackMode) return;
  const ac = ensureCtx();
  try {
    await ac?.resume();
  } catch (e) {
    console.warn("Failed to resume AudioContext", e);
  }
}

function playViaBuffer(key: SfxKey, options: { volume?: number; detune?: number } = {}): void {
  if (!isBrowser || !unlocked || fallbackMode) return;
  const ac = ensureCtx();
  if (!ac) return;

  const buffer = buffers[key];
  if (!buffer) {
    void loadOne(key).catch(() => {});
    return;
  }

  const source = ac.createBufferSource();
  source.buffer = buffer;
  if (typeof options.detune === "number" && "detune" in source) {
    try { source.detune.value = options.detune; } catch {}
  }

  const gain = ac.createGain();
  gain.gain.value = options.volume ?? 0.9;
  source.connect(gain);
  gain.connect(ac.destination);
  source.start();
}

function playViaHtmlAudio(key: SfxKey, volume = 0.9): void {
  if (!isBrowser || !unlocked) return;
  const path = PATHS[key];
  const audio = new Audio(path);
  audio.volume = volume;
  void audio.play().catch(() => {});
}

function play(key: SfxKey, options?: { volume?: number; detune?: number }) {
  if (fallbackMode) playViaHtmlAudio(key, options?.volume ?? 0.9);
  else playViaBuffer(key, options);
}

// PUBLIC API (effects)
export function playTypingTick(): void {
  const detune = Math.random() * 60 - 30;
  play("typing", { detune, volume: TYPING_VOLUME });
}
export function playLoading(): void { play("loading", { volume: 1 }); }
export function playReward(): void { play("reward", { volume: 1 }); }
export function playError(): void { play("error", { volume: 0.95 }); }

// background controls
async function playBackground(): Promise<boolean> {
  if (!isBrowser || !unlocked) return false;

  if (fallbackMode) {
    if (!backgroundState.html) {
      backgroundState.html = new Audio(PATHS.background_primary);
      backgroundState.html.loop = true;
    }
    const el = backgroundState.html;
    el.volume = backgroundState.volume;
    try { if (!Number.isNaN(el.duration) && el.duration > 0) el.currentTime = backgroundState.offset % el.duration; } catch {}
    try {
      await el.play();
      backgroundState.offset = el.currentTime || backgroundState.offset;
      backgroundState.playing = true;
      return true;
    } catch {
      backgroundState.playing = false;
      return false;
    }
  }

  const ac = ensureCtx();
  if (!ac) return false;
  const buffer = await getBackgroundBuffer();
  if (!buffer) return false;

  const offset = buffer.duration > 0 ? backgroundState.offset % buffer.duration : 0;
  const source = ac.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  const gain = ensureBackgroundGain(ac);
  source.connect(gain);
  try { source.start(0, offset); } catch { return false; }

  backgroundState.source = source;
  backgroundState.startTime = ac.currentTime;
  backgroundState.offset = offset;
  backgroundState.playing = true;

  source.onended = () => {
    if (backgroundState.source === source) {
      backgroundState.source = null;
      backgroundState.playing = false;
    }
  };
  return true;
}

function pauseBackground(): void {
  if (!isBrowser) return;

  if (fallbackMode) {
    const el = backgroundState.html;
    if (el) {
      try { backgroundState.offset = el.currentTime; } catch { backgroundState.offset = 0; }
      el.pause();
    }
    backgroundState.playing = false;
    return;
  }

  const ac = ensureCtx();
  const source = backgroundState.source;
  if (!ac || !source) { backgroundState.playing = false; return; }

  const buffer = buffers.background_primary as AudioBuffer | undefined;
  if (buffer && buffer.duration > 0) {
    const elapsed = ac.currentTime - backgroundState.startTime;
    backgroundState.offset = (backgroundState.offset + elapsed) % buffer.duration;
  } else {
    backgroundState.offset = 0;
  }

  try { source.stop(); } catch {}
  source.disconnect();
  if (backgroundState.gain) { backgroundState.gain.disconnect(); backgroundState.gain = null; }
  backgroundState.source = null;
  backgroundState.playing = false;
}

function setBackgroundVolume(v: number): void {
  const value = clampVolume(v);
  backgroundState.volume = value;

  if (!isBrowser) return;
  if (fallbackMode) { if (backgroundState.html) backgroundState.html.volume = value; return; }
  if (!ctx) return;
  if (backgroundState.gain) { backgroundState.gain.gain.value = value; return; }
  if (backgroundState.source) {
    const gain = ensureBackgroundGain(ctx);
    backgroundState.source.disconnect();
    backgroundState.source.connect(gain);
    gain.gain.value = value;
  }
}

function getBackgroundVolume(): number { return clampVolume(backgroundState.volume); }
function isBackgroundPlaying(): boolean { return backgroundState.playing; }

// typing loop API
function stopTypingLoop(): void {
  typingState.active = false;
  if (typingState.timer !== null) {
    window.clearTimeout(typingState.timer);
    typingState.timer = null;
  }
}
function typingTick(): void {
  if (!isBrowser || !typingState.active) return;
  const detune = Math.random() * 80 - 40;
  play("typing", { detune, volume: TYPING_VOLUME });
  const delay = 70 + Math.random() * 55;
  typingState.timer = window.setTimeout(typingTick, delay);
}
export const typing = {
  start() {
    if (!isBrowser || typingState.active) return;
    typingState.active = true;
    if (!fallbackMode) void loadOne("typing").catch(() => {});
    typingTick();
  },
  stop() { if (!isBrowser) return; stopTypingLoop(); },
};

export const background = {
  play: playBackground,
  pause: pauseBackground,
  setVolume: setBackgroundVolume,
  getVolume: getBackgroundVolume,
  isPlaying: isBackgroundPlaying,
};

export async function isUnlocked(): Promise<boolean> { return unlocked; }

export default {
  init,
  unlock,
  playLoading,
  playReward,
  playError,
  typing,
  playTypingTick,
  background,
  isUnlocked,
};
