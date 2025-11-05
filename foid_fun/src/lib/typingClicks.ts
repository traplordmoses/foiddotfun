"use client";

let ctx: AudioContext | null = null;
let unlocked = false;
const buffers: Record<string, AudioBuffer | undefined> = {};

const FILES = {
  typing: "/sfx/typing.wav",
  space: "/sfx/spacebar.wav",
  enter: "/sfx/enter.wav",
} as const;

const TYPING_VOLUME = 0.4;

function ensureCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  return ctx;
}

async function load(name: keyof typeof FILES) {
  const ac = ensureCtx();
  if (!ac) return;
  if (buffers[name]) return;
  try {
    const res = await fetch(FILES[name]);
    if (!res.ok) return;
    const arr = await res.arrayBuffer();
    buffers[name] = await ac.decodeAudioData(arr);
  } catch {
    // ignore load errors
  }
}

export async function initTypingClicks() {
  await Promise.all([load("typing"), load("space"), load("enter")]);
}

export async function unlockAudio() {
  const ac = ensureCtx();
  if (!ac) return;
  try {
    await ac.resume();
  } catch {
    // ignore resume errors
  }
  unlocked = true;
}

function play(buf?: AudioBuffer, volume = TYPING_VOLUME, detuneRange = 40) {
  if (!unlocked || !buf) return;
  const ac = ensureCtx();
  if (!ac) return;
  const src = ac.createBufferSource();
  src.buffer = buf;
  if ((src as any).detune) {
    (src as any).detune.value = (Math.random() * 2 - 1) * detuneRange;
  }
  const gain = ac.createGain();
  const amount = volume;
  gain.gain.value = Math.min(1, Math.max(0, amount));
  src.connect(gain).connect(ac.destination);
  src.start();
}

export function attachTypingClicks(container: HTMLElement) {
  if (typeof window === "undefined") return;

  const unlockHandler = async () => {
    await unlockAudio();
    container.removeEventListener("pointerdown", unlockHandler);
  };

  container.addEventListener("pointerdown", unlockHandler);

  let lastTime = 0;
  const MIN_GAP = 20;

  container.addEventListener("keydown", (event: KeyboardEvent) => {
    const now = performance.now();
    if (now - lastTime < MIN_GAP) return;
    lastTime = now;

    if (event.key === " " && buffers.space) {
      play(buffers.space, TYPING_VOLUME, 20);
      return;
    }
    if ((event.key === "Enter" || event.key === "Return") && buffers.enter) {
      play(buffers.enter, TYPING_VOLUME, 10);
      return;
    }
    play(buffers.typing, TYPING_VOLUME, 50);
  });

  container.addEventListener(
    "input",
    () => {
      const now = performance.now();
      if (now - lastTime < MIN_GAP) return;
      lastTime = now;
      play(buffers.typing, TYPING_VOLUME, 50);
    },
    { capture: true },
  );
}
