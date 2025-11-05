"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Track = { name: string; sources: { src: string; type: string }[] };

const TRACKS: Track[] = Array.from({ length: 6 }, (_, i) => {
  const n = i + 1;
  return {
    name: `foidbackground${n}`,
    sources: [
      { src: `/sfx/music/foidbackground${n}.opus`, type: "audio/ogg; codecs=opus" },
      { src: `/sfx/music/foidbackground${n}.m4a`, type: "audio/mp4" },
    ],
  };
});

const STORAGE_KEYS = { index: "bg_idx", volume: "bg_vol" };

function readStoredNumber(key: string, fallback: number): number {
  if (typeof window === "undefined") return fallback;
  const raw = window.localStorage.getItem(key);
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

export default function MusicPanel({ className = "" }: { className?: string }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [idx, setIdx] = useState(() => {
    const stored = readStoredNumber(STORAGE_KEYS.index, 0) % TRACKS.length;
    return stored < 0 ? 0 : stored;
  });
  const [volume, setVolume] = useState(() => {
    const v = readStoredNumber(STORAGE_KEYS.volume, 0.5);
    return Math.min(1, Math.max(0, Number.isFinite(v) ? v : 0.5));
  });
  const [playing, setPlaying] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  useEffect(() => { if (mounted) localStorage.setItem(STORAGE_KEYS.index, String(idx)); }, [idx, mounted]);
  useEffect(() => { if (mounted) localStorage.setItem(STORAGE_KEYS.volume, String(volume)); }, [volume, mounted]);

  // keep element volume in sync
  useEffect(() => { const a = audioRef.current; if (a) a.volume = volume; }, [volume]);

  // swap source when index changes
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    a.pause();
    a.currentTime = 0;
    a.load();
    if (playing) a.play().catch(() => setPlaying(false));
  }, [idx, playing]);

  // gentle autoplay once; never forces play again after user pauses
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;

    const tryPlay = async () => {
      try { await a.play(); setPlaying(true); } catch {}
    };

    tryPlay();
    const onFirst = () => { tryPlay(); };
    window.addEventListener("pointerdown", onFirst, { once: true });
    window.addEventListener("keydown", onFirst, { once: true });
    return () => {
      window.removeEventListener("pointerdown", onFirst);
      window.removeEventListener("keydown", onFirst);
    };
  }, []);

  // stay in sync with actual element state
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onEnded = () => setIdx((i) => (i + 1) % TRACKS.length);
    const onPlay  = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    a.addEventListener("ended", onEnded);
    a.addEventListener("play", onPlay);
    a.addEventListener("pause", onPause);
    return () => {
      a.removeEventListener("ended", onEnded);
      a.removeEventListener("play", onPlay);
      a.removeEventListener("pause", onPause);
    };
  }, []);

  const displayName = useMemo(() => TRACKS[idx].name, [idx]);

  const toggle = useCallback(async () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) { a.pause(); setPlaying(false); }   // immediate UI flip
    else { try { await a.play(); setPlaying(true); } catch {} }
  }, [playing]);

  const next = useCallback(() => setIdx((i) => (i + 1) % TRACKS.length), []);
  const prev = useCallback(() => setIdx((i) => (i - 1 + TRACKS.length) % TRACKS.length), []);

  // vertical slider: rotate -90deg so UP = louder (no upside-down)
  const onVol = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Number(e.target.value);
    if (!Number.isFinite(v)) return;
    setVolume(Math.min(1, Math.max(0, v)));
  }, []);

  if (!mounted) return null;

  return (
    <div className={`min-w-0 w-full ${className}`}>
      <div className="rounded-xl border border-white/20 bg-white/5 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,.5)] backdrop-blur">
        {/* track chip — mint text, small, centered */}
        <div className="mx-auto mb-3 w-full max-w-[360px] rounded-full border border-white/30 bg-white/10 px-4 py-1.5 shadow-[inset_0_1px_0_#fff]">
          <div
            className="truncate text-[12px] font-semibold uppercase tracking-[0.26em]"
            style={{ color: "#9efbca" }}
          >
            {displayName}
          </div>
        </div>

        <div className="grid grid-cols-[1fr_auto] items-center gap-3">
          {/* transport */}
          <div className="mx-auto w-full max-w-[380px] rounded-2xl border border-white/30 bg-white/45 px-3 py-2 shadow-[inset_0_1px_0_#fff,0_6px_18px_rgba(0,80,120,.15)]">
            <div className="flex items-center justify-center gap-3 text-[15px]">
              <button onClick={prev} aria-label="previous"
                className="rounded-full px-2 leading-none transition hover:scale-105">⏮️</button>
              <button onClick={toggle} aria-label="play-pause"
                className="rounded-full px-3 text-[18px] leading-none transition hover:scale-110">
                {playing ? "⏸️" : "▶️"}
              </button>
              <button onClick={next} aria-label="next"
                className="rounded-full px-2 leading-none transition hover:scale-105">⏭️</button>
            </div>
          </div>

          {/* vertical volume (rotated horizontal range) */}
          <div className="rounded-2xl border border-white/30 bg-white/20 p-2 shadow-[inset_0_1px_0_#fff]">
            <div className="flex h-[112px] w-8 items-center justify-center">
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={volume}
                onChange={onVol}
                aria-label="volume"
                className="-rotate-90 h-6 w-[100px] origin-center cursor-pointer accent-foid-cyan"
              />
            </div>
          </div>
        </div>
      </div>

      {/* audio element */}
      <audio
        ref={audioRef}
        preload="auto"
        loop
        onCanPlay={() => { const a = audioRef.current; if (a) a.volume = volume; }}
        className="hidden"
      >
        {TRACKS[idx].sources.map((s) => (
          <source key={s.type} src={s.src} type={s.type} />
        ))}
      </audio>
    </div>
  );
}
