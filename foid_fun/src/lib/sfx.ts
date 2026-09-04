"use client";

import { getAudioSettings } from "@/lib/audioSettings";

type AudioContextConstructor =
  | typeof AudioContext
  | (typeof globalThis extends { webkitAudioContext: infer T } ? T : never);
type AudioContextWindow = Window & { webkitAudioContext?: typeof AudioContext };

// Effects ship as Opus (Chrome, Firefox, modern Safari) with an AAC
// fallback for engines that can't decode Ogg/Opus through decodeAudioData.
// The container is picked once so every effect is a single small request:
// the old WAVs cost 388 KB for the loading sting alone, on every page.
function pickSfxExtension(): "opus" | "m4a" {
  if (typeof document === "undefined") return "m4a";
  try {
    const probe = document.createElement("audio");
    return probe.canPlayType('audio/ogg; codecs="opus"') ? "opus" : "m4a";
  } catch {
    return "m4a";
  }
}
const SFX_EXT = pickSfxExtension();
const sfxUrl = (name: string) => `/sfx/${name}.${SFX_EXT}`;

const PATHS = {
  loading: sfxUrl("loadingfoid"),
  reward: sfxUrl("reward"),
  typing: sfxUrl("typing"),
  error: sfxUrl("error"),

  // background track (adjust the first one to a file you actually have)
  background_primary: "/sfx/music/foidbackground1.opus",

  // --- legacy aliases: older callers ask for enter/spacebar sounds ---
  enter: sfxUrl("typing"),
  spacebar: sfxUrl("typing"),
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

const TYPING_VOLUME = 0.08;

let ctx: AudioContext | null = null;
let unlocked = false;
let fallbackMode = false;
const unlockedListeners = new Set<(value: boolean) => void>();

function notifyUnlockedListeners() {
  if (unlockedListeners.size === 0) return;
  for (const listener of unlockedListeners) {
    try {
      listener(unlocked);
    } catch {
      /* ignore listener failures */
    }
  }
}

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
    typeof (window as AudioContextWindow).webkitAudioContext === "function");

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
      window.AudioContext ?? (window as AudioContextWindow).webkitAudioContext;
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
    } catch (err) {
      console.warn('[sfx] fetchFirst failed for path:', p, err);
    }
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
  // Warm the small effect buffers. SfxInitializer calls this on the first
  // user gesture (nothing can play before one), never on page load.
  // enter/spacebar alias the typing click, so "typing" covers them.
  const keys: SfxKey[] = ["loading", "reward", "typing", "error"];
  await Promise.all(keys.map((k) => loadOne(k).catch(() => {})));
}

export async function unlock(): Promise<void> {
  if (!isBrowser) return;
  unlocked = true;
  notifyUnlockedListeners();
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
  const settings = getAudioSettings();
  if (!settings.sfxEnabled) return;
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
    try { source.detune.value = options.detune; } catch (err) { console.warn('[sfx] detune set non-fatal error:', err); }
  }

  const gain = ac.createGain();
  gain.gain.value = (options.volume ?? 0.9) * settings.sfxVolume;
  source.connect(gain);
  gain.connect(ac.destination);
  source.start();
}

function playViaHtmlAudio(key: SfxKey, volume = 0.9): void {
  if (!isBrowser || !unlocked) return;
  const settings = getAudioSettings();
  if (!settings.sfxEnabled) return;
  const path = PATHS[key];
  const audio = new Audio(path);
  audio.volume = volume * settings.sfxVolume;
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

/** Bright ascending 3-note chord for YES swipe (C5 → E5 → G5) */
export function playSwipeYes(): void {
  if (!isBrowser || !unlocked) return;
  const settings = getAudioSettings();
  if (!settings.sfxEnabled) return;
  const ac = ensureCtx();
  if (!ac) return;
  const vol = 0.14 * settings.sfxVolume;
  const gain = ac.createGain();
  gain.gain.value = vol;
  gain.connect(ac.destination);
  // Note 1: C5
  const osc1 = ac.createOscillator();
  osc1.type = "sine";
  osc1.frequency.value = 523;
  osc1.connect(gain);
  osc1.start(ac.currentTime);
  osc1.stop(ac.currentTime + 0.09);
  // Note 2: E5
  const osc2 = ac.createOscillator();
  osc2.type = "sine";
  osc2.frequency.value = 659;
  osc2.connect(gain);
  osc2.start(ac.currentTime + 0.08);
  osc2.stop(ac.currentTime + 0.17);
  // Note 3: G5 (highest — completing the major triad)
  const osc3 = ac.createOscillator();
  osc3.type = "sine";
  osc3.frequency.value = 784;
  osc3.connect(gain);
  osc3.start(ac.currentTime + 0.15);
  osc3.stop(ac.currentTime + 0.26);
  // Fade out gain
  gain.gain.setValueAtTime(vol, ac.currentTime + 0.20);
  gain.gain.linearRampToValueAtTime(0, ac.currentTime + 0.30);
}

/** Low descending 2-note tone with distortion buzz for NO swipe */
export function playSwipeNo(): void {
  if (!isBrowser || !unlocked) return;
  const settings = getAudioSettings();
  if (!settings.sfxEnabled) return;
  const ac = ensureCtx();
  if (!ac) return;
  const vol = 0.10 * settings.sfxVolume;
  // Distortion waveshaper for buzz
  const distortion = ac.createWaveShaper();
  const curve = new Float32Array(256);
  for (let i = 0; i < 256; i++) {
    const x = (i * 2) / 256 - 1;
    curve[i] = (Math.PI + 8) * x / (Math.PI + 8 * Math.abs(x));
  }
  distortion.curve = curve;
  distortion.oversample = "2x";
  const gain = ac.createGain();
  gain.gain.value = vol;
  distortion.connect(gain);
  gain.connect(ac.destination);
  // Note 1: E4 descending to C4
  const osc1 = ac.createOscillator();
  osc1.type = "sawtooth";
  osc1.frequency.setValueAtTime(330, ac.currentTime);
  osc1.frequency.linearRampToValueAtTime(260, ac.currentTime + 0.10);
  osc1.connect(distortion);
  osc1.start(ac.currentTime);
  osc1.stop(ac.currentTime + 0.12);
  // Note 2: C4 descending to A3 (lower, gritty)
  const osc2 = ac.createOscillator();
  osc2.type = "sawtooth";
  osc2.frequency.setValueAtTime(260, ac.currentTime + 0.10);
  osc2.frequency.linearRampToValueAtTime(185, ac.currentTime + 0.22);
  osc2.connect(distortion);
  osc2.start(ac.currentTime + 0.10);
  osc2.stop(ac.currentTime + 0.24);
  // Fade out gain
  gain.gain.setValueAtTime(vol, ac.currentTime + 0.18);
  gain.gain.linearRampToValueAtTime(0, ac.currentTime + 0.28);
}

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
    try { if (!Number.isNaN(el.duration) && el.duration > 0) el.currentTime = backgroundState.offset % el.duration; } catch (err) { console.warn('[sfx] currentTime set non-fatal error:', err); }
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

  try { source.stop(); } catch (err) { console.warn('[sfx] source.stop non-fatal error:', err); }
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
  const settings = getAudioSettings();
  if (settings.sfxEnabled) {
    const detune = Math.random() * 80 - 40;
    play("typing", { detune, volume: TYPING_VOLUME });
  }
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

export function subscribeUnlocked(listener: (value: boolean) => void): () => void {
  unlockedListeners.add(listener);
  try {
    listener(unlocked);
  } catch {
    /* ignore listener errors */
  }
  return () => {
    unlockedListeners.delete(listener);
  };
}

/** Purple whoosh for skip (upward sweep) */
export function playSkipWhoosh(): void {
  if (!isBrowser || !unlocked) return;
  const settings = getAudioSettings();
  if (!settings.sfxEnabled) return;
  const ac = ensureCtx();
  if (!ac) return;
  const vol = 0.12 * settings.sfxVolume;
  const gain = ac.createGain();
  gain.gain.value = vol;
  gain.connect(ac.destination);
  const osc = ac.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(400, ac.currentTime);
  osc.frequency.exponentialRampToValueAtTime(900, ac.currentTime + 0.12);
  osc.connect(gain);
  osc.start(ac.currentTime);
  osc.stop(ac.currentTime + 0.14);
  gain.gain.setValueAtTime(vol, ac.currentTime + 0.08);
  gain.gain.linearRampToValueAtTime(0, ac.currentTime + 0.14);
}

/** Soft thunk when a new card enters */
export function playCardEnter(): void {
  if (!isBrowser || !unlocked) return;
  const settings = getAudioSettings();
  if (!settings.sfxEnabled) return;
  const ac = ensureCtx();
  if (!ac) return;
  const vol = 0.08 * settings.sfxVolume;
  const gain = ac.createGain();
  gain.gain.value = vol;
  gain.connect(ac.destination);
  const osc = ac.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(140, ac.currentTime);
  osc.frequency.exponentialRampToValueAtTime(80, ac.currentTime + 0.06);
  osc.connect(gain);
  osc.start(ac.currentTime);
  osc.stop(ac.currentTime + 0.08);
  gain.gain.setValueAtTime(vol, ac.currentTime + 0.03);
  gain.gain.linearRampToValueAtTime(0, ac.currentTime + 0.08);
}

/** Reverse whoosh for undo */
export function playUndoWhoosh(): void {
  if (!isBrowser || !unlocked) return;
  const settings = getAudioSettings();
  if (!settings.sfxEnabled) return;
  const ac = ensureCtx();
  if (!ac) return;
  const vol = 0.10 * settings.sfxVolume;
  const gain = ac.createGain();
  gain.gain.value = vol;
  gain.connect(ac.destination);
  const osc = ac.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(800, ac.currentTime);
  osc.frequency.exponentialRampToValueAtTime(350, ac.currentTime + 0.10);
  osc.connect(gain);
  osc.start(ac.currentTime);
  osc.stop(ac.currentTime + 0.12);
  gain.gain.setValueAtTime(vol, ac.currentTime + 0.06);
  gain.gain.linearRampToValueAtTime(0, ac.currentTime + 0.12);
}

/** Triumphant major chord (C4-E4-G4-C5) with shimmer for victory */
export function playVictoryChord(): void {
  if (!isBrowser || !unlocked) return;
  const settings = getAudioSettings();
  if (!settings.sfxEnabled) return;
  const ac = ensureCtx();
  if (!ac) return;
  const vol = 0.16 * settings.sfxVolume;
  const master = ac.createGain();
  master.gain.value = vol;
  master.connect(ac.destination);
  const freqs = [261.6, 329.6, 392.0, 523.3]; // C4 E4 G4 C5
  freqs.forEach((f, i) => {
    const osc = ac.createOscillator();
    osc.type = i === 3 ? "triangle" : "sine";
    osc.frequency.value = f;
    const g = ac.createGain();
    g.gain.value = i === 3 ? 0.5 : 0.7; // top note quieter
    osc.connect(g);
    g.connect(master);
    osc.start(ac.currentTime + i * 0.06);
    osc.stop(ac.currentTime + 1.0 + i * 0.06);
  });
  // Shimmer — high sine sweep
  const shimmer = ac.createOscillator();
  shimmer.type = "sine";
  shimmer.frequency.setValueAtTime(1200, ac.currentTime + 0.3);
  shimmer.frequency.exponentialRampToValueAtTime(2400, ac.currentTime + 0.8);
  const sg = ac.createGain();
  sg.gain.setValueAtTime(0, ac.currentTime + 0.3);
  sg.gain.linearRampToValueAtTime(0.15 * settings.sfxVolume, ac.currentTime + 0.5);
  sg.gain.linearRampToValueAtTime(0, ac.currentTime + 1.0);
  shimmer.connect(sg);
  sg.connect(ac.destination);
  shimmer.start(ac.currentTime + 0.3);
  shimmer.stop(ac.currentTime + 1.1);
  // Fade master
  master.gain.setValueAtTime(vol, ac.currentTime + 0.6);
  master.gain.linearRampToValueAtTime(0, ac.currentTime + 1.2);
}

/** Resonant bell tone when prayer anchors onchain */
export function playAnchorBell(): void {
  if (!isBrowser || !unlocked) return;
  const settings = getAudioSettings();
  if (!settings.sfxEnabled) return;
  const ac = ensureCtx();
  if (!ac) return;
  const vol = 0.18 * settings.sfxVolume;

  // Main tone — C5
  const osc = ac.createOscillator();
  osc.type = "sine";
  osc.frequency.value = 523.25;
  const g = ac.createGain();
  g.gain.setValueAtTime(vol, ac.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 1.8);
  osc.connect(g);
  g.connect(ac.destination);
  osc.start(ac.currentTime);
  osc.stop(ac.currentTime + 2.0);

  // Overtone — C6, quieter
  const osc2 = ac.createOscillator();
  osc2.type = "sine";
  osc2.frequency.value = 1046.5;
  const g2 = ac.createGain();
  g2.gain.setValueAtTime(vol * 0.3, ac.currentTime);
  g2.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 1.2);
  osc2.connect(g2);
  g2.connect(ac.destination);
  osc2.start(ac.currentTime);
  osc2.stop(ac.currentTime + 1.4);
}

/** Ambient hum during prayer crafting. Returns { stop } to fade out. */
export function playAmbientHum(): { stop: () => void } {
  const noop = { stop: () => {} };
  if (!isBrowser || !unlocked) return noop;
  const settings = getAudioSettings();
  if (!settings.sfxEnabled) return noop;
  const ac = ensureCtx();
  if (!ac) return noop;
  const vol = 0.05 * settings.sfxVolume;

  const master = ac.createGain();
  master.gain.setValueAtTime(0, ac.currentTime);
  master.gain.linearRampToValueAtTime(vol, ac.currentTime + 2.0);
  master.connect(ac.destination);

  // Sub-bass drone — C2
  const bass = ac.createOscillator();
  bass.type = "sine";
  bass.frequency.value = 65.41;
  bass.connect(master);
  bass.start(ac.currentTime);

  // Quiet shimmer — C6
  const shimmer = ac.createOscillator();
  shimmer.type = "sine";
  shimmer.frequency.value = 1046.5;
  const sg = ac.createGain();
  sg.gain.value = 0.15; // relative to master
  shimmer.connect(sg);
  sg.connect(master);
  shimmer.start(ac.currentTime);

  let stopped = false;

  return {
    stop() {
      if (stopped) return;
      stopped = true;
      const now = ac.currentTime;
      master.gain.setValueAtTime(master.gain.value, now);
      master.gain.linearRampToValueAtTime(0, now + 1.0);
      setTimeout(() => {
        try { bass.stop(); } catch { /* already stopped */ }
        try { shimmer.stop(); } catch { /* already stopped */ }
      }, 1200);
    },
  };
}

// ============================================================================
// Phase γ — Board state-transition SFX
// All synthesized inline. Each one returns early if audio is unlocked=false
// or sfxEnabled=false, and scales output by sfxVolume.
// ============================================================================

/** Short upward chime when a placement drops on a valid cell. */
export function playDropValid(): void {
  if (!isBrowser || !unlocked) return;
  const settings = getAudioSettings();
  if (!settings.sfxEnabled) return;
  const ac = ensureCtx();
  if (!ac) return;
  const vol = 0.18 * settings.sfxVolume;
  const now = ac.currentTime;
  const osc = ac.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(660, now);
  osc.frequency.exponentialRampToValueAtTime(880, now + 0.08);
  const g = ac.createGain();
  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(vol, now + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
  osc.connect(g);
  g.connect(ac.destination);
  osc.start(now);
  osc.stop(now + 0.14);
}

/** Muted buzz when a placement drops on an invalid cell. */
export function playDropInvalid(): void {
  if (!isBrowser || !unlocked) return;
  const settings = getAudioSettings();
  if (!settings.sfxEnabled) return;
  const ac = ensureCtx();
  if (!ac) return;
  const vol = 0.14 * settings.sfxVolume;
  const now = ac.currentTime;
  const osc = ac.createOscillator();
  osc.type = "sawtooth";
  osc.frequency.value = 110;
  const filt = ac.createBiquadFilter();
  filt.type = "lowpass";
  filt.frequency.value = 400;
  const g = ac.createGain();
  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(vol, now + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
  osc.connect(filt);
  filt.connect(g);
  g.connect(ac.destination);
  osc.start(now);
  osc.stop(now + 0.1);
}

/** Short click when the paint editor tool changes. */
export function playPaintToolChange(): void {
  if (!isBrowser || !unlocked) return;
  const settings = getAudioSettings();
  if (!settings.sfxEnabled) return;
  const ac = ensureCtx();
  if (!ac) return;
  const vol = 0.12 * settings.sfxVolume;
  const now = ac.currentTime;
  const osc = ac.createOscillator();
  osc.type = "square";
  osc.frequency.value = 1200;
  const g = ac.createGain();
  g.gain.setValueAtTime(vol, now);
  g.gain.exponentialRampToValueAtTime(0.0001, now + 0.035);
  osc.connect(g);
  g.connect(ac.destination);
  osc.start(now);
  osc.stop(now + 0.04);
}

/** Ascending bleep when a wallet signature is requested. */
export function playSignatureRequested(): void {
  if (!isBrowser || !unlocked) return;
  const settings = getAudioSettings();
  if (!settings.sfxEnabled) return;
  const ac = ensureCtx();
  if (!ac) return;
  const vol = 0.16 * settings.sfxVolume;
  const now = ac.currentTime;
  const osc = ac.createOscillator();
  osc.type = "square";
  osc.frequency.setValueAtTime(400, now);
  osc.frequency.exponentialRampToValueAtTime(800, now + 0.18);
  const g = ac.createGain();
  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(vol, now + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
  osc.connect(g);
  g.connect(ac.destination);
  osc.start(now);
  osc.stop(now + 0.24);
}

/** Bell tone when a signature is confirmed onchain. */
export function playSignatureConfirmed(): void {
  if (!isBrowser || !unlocked) return;
  const settings = getAudioSettings();
  if (!settings.sfxEnabled) return;
  const ac = ensureCtx();
  if (!ac) return;
  const vol = 0.18 * settings.sfxVolume;
  const now = ac.currentTime;
  // Fundamental — A5 triangle
  const fund = ac.createOscillator();
  fund.type = "triangle";
  fund.frequency.value = 880;
  const fg = ac.createGain();
  fg.gain.setValueAtTime(vol, now);
  fg.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);
  fund.connect(fg);
  fg.connect(ac.destination);
  fund.start(now);
  fund.stop(now + 0.44);
  // Overtone — A6 sine, quieter
  const over = ac.createOscillator();
  over.type = "sine";
  over.frequency.value = 1760;
  const og = ac.createGain();
  og.gain.setValueAtTime(vol * 0.35, now);
  og.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);
  over.connect(og);
  og.connect(ac.destination);
  over.start(now);
  over.stop(now + 0.34);
}

/** Descending blip when a signature is rejected. */
export function playSignatureRejected(): void {
  if (!isBrowser || !unlocked) return;
  const settings = getAudioSettings();
  if (!settings.sfxEnabled) return;
  const ac = ensureCtx();
  if (!ac) return;
  const vol = 0.15 * settings.sfxVolume;
  const now = ac.currentTime;
  const osc = ac.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(500, now);
  osc.frequency.exponentialRampToValueAtTime(200, now + 0.14);
  const g = ac.createGain();
  g.gain.setValueAtTime(vol, now);
  g.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
  osc.connect(g);
  g.connect(ac.destination);
  osc.start(now);
  osc.stop(now + 0.17);
}

const sfx = {
  init,
  unlock,
  playLoading,
  playReward,
  playError,
  playSwipeYes,
  playSwipeNo,
  playSkipWhoosh,
  playCardEnter,
  playUndoWhoosh,
  playVictoryChord,
  playAnchorBell,
  playAmbientHum,
  // Phase γ additions
  playDropValid,
  playDropInvalid,
  playPaintToolChange,
  playSignatureRequested,
  playSignatureConfirmed,
  playSignatureRejected,
  typing,
  playTypingTick,
  background,
  isUnlocked,
  subscribeUnlocked,
};

export default sfx;
