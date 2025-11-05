"use client";

type AudioContextConstructor =
  | typeof AudioContext
  | (typeof globalThis extends { webkitAudioContext: infer T } ? T : never);

const PATHS = {
  loading: "/sfx/loadingfoid.wav",
  reward: "/sfx/reward.wav",
  typing: "/sfx/typing.wav",
  error: "/sfx/error.wav",
  background: "/sfx/backgroundfoid.wav",
} as const;

type SfxKey = keyof typeof PATHS;

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

const typingState: {
  timer: number | null;
  active: boolean;
} = {
  timer: null,
  active: false,
};

function clampVolume(value: number) {
  if (Number.isNaN(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

const isBrowser = typeof window !== "undefined";
const audioContextSupported =
  isBrowser && (typeof window.AudioContext === "function" || typeof (window as any).webkitAudioContext === "function");

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

async function loadOne(key: SfxKey): Promise<void> {
  if (!isBrowser) return;
  if (buffers[key]) return;
  if (pendingLoads[key]) {
    await pendingLoads[key];
    return;
  }
  const promise = (async () => {
    const ac = ensureCtx();
    if (!ac) return;
    const response = await fetch(PATHS[key]);
    if (!response.ok) throw new Error(`Failed to load sfx: ${PATHS[key]}`);
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await ac.decodeAudioData(arrayBuffer);
    buffers[key] = audioBuffer;
  })();

  pendingLoads[key] = promise;

  try {
    await promise;
  } finally {
    delete pendingLoads[key];
  }
}

async function getBackgroundBuffer(): Promise<AudioBuffer | null> {
  await loadOne("background").catch(() => {});
  return (buffers.background as AudioBuffer | undefined) ?? null;
}

export async function init(): Promise<void> {
  if (!isBrowser) return;
  if (!audioContextSupported) {
    fallbackMode = true;
    return;
  }
  await Promise.all(
    (Object.keys(PATHS) as SfxKey[]).map((key) =>
      loadOne(key).catch(() => {
        // ignore missing asset; keep app running
      }),
    ),
  );
}

export async function unlock(): Promise<void> {
  if (!isBrowser) return;
  unlocked = true;
  if (fallbackMode) return;
  const ac = ensureCtx();
  if (!ac) return;
  try {
    await ac.resume();
  } catch (error) {
    console.warn("Failed to resume AudioContext", error);
  }
}

function playViaBuffer(
  key: SfxKey,
  options: { volume?: number; detune?: number } = {},
): void {
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
    try {
      source.detune.value = options.detune;
    } catch {
      // ignore unsupported detune
    }
  }

  const gain = ac.createGain();
  gain.gain.value = options.volume ?? 0.9;
  source.connect(gain);
  gain.connect(ac.destination);
  source.start();
}

function playViaHtmlAudio(key: SfxKey, volume = 0.9): void {
  if (!isBrowser || !unlocked) return;
  const audio = new Audio(PATHS[key]);
  audio.volume = volume;
  void audio.play().catch(() => {
    /* ignore autoplay rejection */
  });
}

function play(key: SfxKey, options?: { volume?: number; detune?: number }) {
  if (fallbackMode) {
    playViaHtmlAudio(key, options?.volume ?? 0.9);
  } else {
    playViaBuffer(key, options);
  }
}

async function playBackground(): Promise<boolean> {
  if (!isBrowser || !unlocked) return false;

  if (fallbackMode) {
    if (!backgroundState.html) {
      backgroundState.html = new Audio(PATHS.background);
      backgroundState.html.loop = true;
    }
    const element = backgroundState.html;
    element.volume = backgroundState.volume;
    try {
      if (!Number.isNaN(element.duration) && element.duration > 0) {
        const duration = element.duration;
        const offset = backgroundState.offset % duration;
        element.currentTime = offset;
      }
    } catch {
      /* ignore seek issues */
    }
    try {
      await element.play();
      backgroundState.offset = element.currentTime || backgroundState.offset;
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

  try {
    source.start(0, offset);
  } catch {
    return false;
  }

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
    const element = backgroundState.html;
    if (element) {
      try {
        backgroundState.offset = element.currentTime;
      } catch {
        backgroundState.offset = 0;
      }
      element.pause();
    }
    backgroundState.playing = false;
    return;
  }

  const ac = ensureCtx();
  if (!ac) return;
  const source = backgroundState.source;
  if (!source) {
    backgroundState.playing = false;
    return;
  }

  const buffer = buffers.background as AudioBuffer | undefined;
  if (buffer && buffer.duration > 0) {
    const elapsed = ac.currentTime - backgroundState.startTime;
    const nextOffset = (backgroundState.offset + elapsed) % buffer.duration;
    backgroundState.offset = Number.isFinite(nextOffset) ? nextOffset : 0;
  } else {
    backgroundState.offset = 0;
  }

  try {
    source.stop();
  } catch {
    /* ignore stop errors */
  }
  source.disconnect();
  if (backgroundState.gain) {
    backgroundState.gain.disconnect();
    backgroundState.gain = null;
  }
  backgroundState.source = null;
  backgroundState.playing = false;
}

function setBackgroundVolume(volume: number): void {
  const value = clampVolume(volume);
  backgroundState.volume = value;

  if (!isBrowser) return;

  if (fallbackMode) {
    if (backgroundState.html) {
      backgroundState.html.volume = value;
    }
    return;
  }

  if (!ctx) return;
  if (backgroundState.gain) {
    backgroundState.gain.gain.value = value;
    return;
  }
  if (backgroundState.source) {
    const gain = ensureBackgroundGain(ctx);
    backgroundState.source.disconnect();
    backgroundState.source.connect(gain);
    gain.gain.value = value;
  }
}

function getBackgroundVolume(): number {
  return clampVolume(backgroundState.volume);
}

function isBackgroundPlaying(): boolean {
  return backgroundState.playing;
}

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
  const volume = 0.35 + Math.random() * 0.12;
  play("typing", { detune, volume });

  const delay = 70 + Math.random() * 55;
  typingState.timer = window.setTimeout(typingTick, delay);
}

export const typing = {
  start() {
    if (!isBrowser || typingState.active) return;
    typingState.active = true;
    if (!fallbackMode) {
      void loadOne("typing").catch(() => {});
    }
    typingTick();
  },
  stop() {
    if (!isBrowser) return;
    stopTypingLoop();
  },
};

export function playTypingTick(): void {
  const detune = Math.random() * 60 - 30;
  const volume = 0.3 + Math.random() * 0.1;
  play("typing", { detune, volume });
}

export function playLoading(): void {
  play("loading", { volume: 1 });
}

export function playReward(): void {
  play("reward", { volume: 1 });
}

export function playError(): void {
  play("error", { volume: 0.95 });
}

export const background = {
  play: playBackground,
  pause: pauseBackground,
  setVolume: setBackgroundVolume,
  getVolume: getBackgroundVolume,
  isPlaying: isBackgroundPlaying,
};

export function isUnlocked(): boolean {
  return unlocked;
}

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
