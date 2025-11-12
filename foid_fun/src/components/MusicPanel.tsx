"use client";

import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import butterchurnModule from "butterchurn";
import * as butterchurnPresets from "butterchurn-presets";

const butterchurn: any = (butterchurnModule as any).default ?? butterchurnModule;
const getAllPresets = () => butterchurnPresets.getPresets();

declare global { interface Window { webkitAudioContext?: typeof AudioContext } }

type Track = { name: string; sources: { src: string; type: string }[] };
const TRACKS: Track[] = Array.from({ length: 23 }, (_, i) => {
  const n = i + 1;
  return {
    name: `foidbackground${n}`,
    sources: [
      { src: `/sfx/music/foidbackground${n}.opus`, type: "audio/ogg; codecs=opus" },
      { src: `/sfx/music/foidbackground${n}.m4a`, type: "audio/mp4; codecs=aac" },
    ],
  };
});

const CROSSFADE_SECONDS = 2;

export type MusicPanelProps = React.HTMLAttributes<HTMLDivElement> & {
  compact?: boolean;
};

/* tiny speaker icon (emoji can shift layout) */
function SpeakerIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path fill="currentColor" d="M11 5.5a1 1 0 0 1 1.58-.81l3.92 2.9a1 1 0 0 1 .4.8v6.22a1 1 0 0 1-.4.8l-3.92 2.9A1 1 0 0 1 11 18.5V5.5zM9 9H6.5A1.5 1.5 0 0 0 5 10.5v3A1.5 1.5 0 0 0 6.5 15H9V9z"/>
      <path fill="currentColor" d="M18.5 8.6a.9.9 0 0 1 1.27-.1c1.1.95 1.73 2.32 1.73 3.5s-.63 2.55-1.73 3.5a.9.9 0 1 1-1.17-1.36c.7-.6 1.1-1.5 1.1-2.14s-.4-1.54-1.1-2.14a.9.9 0 0 1-.1-1.26z"/>
    </svg>
  );
}

export default function MusicPanel({
  compact = false,
  className = "",
  ...rest
}: MusicPanelProps) {

  const [currentTrackIndex, setCurrentTrackIndexState] = useState(0);
  const [isPlaying, setIsPlayingState] = useState(false);
  const [needsInteraction, setNeedsInteraction] = useState(false);
  const [volume, setVolume] = useState(0.5);
  const [showVol, setShowVol] = useState(false);

  const currentTrackRef = useRef(0);
  const setCurrentTrackIndex = useCallback((value: number) => {
    currentTrackRef.current = value;
    setCurrentTrackIndexState(value);
  }, []);

  const isPlayingRef = useRef(false);
  const setIsPlaying = useCallback((value: boolean) => {
    isPlayingRef.current = value;
    setIsPlayingState(value);
  }, []);

  type Slot = 0 | 1;

  const audioRefs = useRef<[HTMLAudioElement | null, HTMLAudioElement | null]>([null, null]);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const vizBoxRef = useRef<HTMLDivElement | null>(null);
  const volBtnRef = useRef<HTMLButtonElement | null>(null);
  const volPopRef = useRef<HTMLDivElement | null>(null);

  const acRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const sourceRefs = useRef<[MediaElementAudioSourceNode | null, MediaElementAudioSourceNode | null]>([null, null]);
  const gainRefs = useRef<[GainNode | null, GainNode | null]>([null, null]);
  const slotWiredRef = useRef<[boolean, boolean]>([false, false]);

  const vizRef = useRef<any>(null);
  const rafRef = useRef<number | null>(null);
  const resizeHandlerRef = useRef<(() => void) | null>(null);
  const presetsRef = useRef<{ keys: string[]; map: Record<string, any> } | null>(null);
  const currentPresetIdxRef = useRef<number>(0);

  const vizReadyRef = useRef(false);
  const activeSlotRef = useRef<Slot>(0);
  const isCrossfadingRef = useRef(false);
  const volumeRef = useRef(volume);
  const initializedRef = useRef(false);

  const presetMap = useMemo(() => getAllPresets(), []);

  const loadPresetByIndex = useCallback((i: number) => {
    if (!vizRef.current || !presetsRef.current) return;
    const { keys, map } = presetsRef.current;
    const key = keys[i % keys.length];
    vizRef.current.loadPreset(map[key], 1500); // 1.5s blend
    currentPresetIdxRef.current = i % keys.length;
  }, []);

  const loadRandomPreset = useCallback(() => {
    if (!presetsRef.current) return;
    const { keys } = presetsRef.current;
    if (keys.length === 0) return;
    let next = Math.floor(Math.random() * keys.length);
    // avoid immediate repeat
    if (keys.length > 1 && next === currentPresetIdxRef.current) {
      next = (next + 1) % keys.length;
    }
    loadPresetByIndex(next);
  }, [loadPresetByIndex]);

  const selectSource = (audio: HTMLAudioElement, track: Track) => {
    for (const candidate of track.sources) {
      if (!audio.canPlayType) return candidate;
      const support = audio.canPlayType(candidate.type);
      if (support === "probably" || support === "maybe") return candidate;
    }
    return track.sources[0];
  };

  const ensureAudioGraph = useCallback(() => {
    const AC = window.AudioContext || window.webkitAudioContext!;
    if (!acRef.current) acRef.current = new AC();
    const ac = acRef.current;
    if (!ac) return;

    if (!analyserRef.current) {
      const analyser = ac.createAnalyser();
      analyser.fftSize = 2048;
      analyserRef.current = analyser;
    }

    if (!masterGainRef.current && analyserRef.current) {
      const master = ac.createGain();
      master.gain.setValueAtTime(volumeRef.current, ac.currentTime);
      analyserRef.current.connect(master);
      master.connect(ac.destination);
      masterGainRef.current = master;
    }
  }, []);

  const ensureSlotWired = useCallback((slot: Slot) => {
    const audio = audioRefs.current[slot];
    const ac = acRef.current;
    const analyser = analyserRef.current;
    if (!audio || !ac || !analyser) return;
    if (slotWiredRef.current[slot]) return;

    const source = ac.createMediaElementSource(audio);
    const gain = ac.createGain();
    const initial = slot === activeSlotRef.current ? 1 : 0;
    gain.gain.setValueAtTime(initial, ac.currentTime);

    source.connect(gain);
    gain.connect(analyser);

    sourceRefs.current[slot] = source;
    gainRefs.current[slot] = gain;
    slotWiredRef.current[slot] = true;
  }, []);

  const loadTrackIntoSlot = useCallback(async (slot: Slot, trackIndex: number) => {
    const audio = audioRefs.current[slot];
    if (!audio) return;

    ensureAudioGraph();
    ensureSlotWired(slot);

    const track = TRACKS[trackIndex];
    const candidate = selectSource(audio, track);
    if (audio.src !== candidate.src) audio.src = candidate.src;
    audio.currentTime = 0;
    audio.load();

    await new Promise<void>((resolve) => {
      const handle = () => {
        audio.removeEventListener("canplay", handle);
        audio.removeEventListener("error", handle);
        resolve();
      };
      audio.addEventListener("canplay", handle, { once: true });
      audio.addEventListener("error", handle, { once: true });
    });

    const ac = acRef.current;
    const gain = gainRefs.current[slot];
    if (ac && gain) {
      const now = ac.currentTime;
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(slot === activeSlotRef.current ? 1 : 0, now);
    } else {
      audio.volume = slot === activeSlotRef.current ? volumeRef.current : 0;
    }
  }, [ensureAudioGraph, ensureSlotWired]);

const ensureVisualizer = useCallback(() => {
    if (vizReadyRef.current || !canvasRef.current || !acRef.current) return;
    vizRef.current = butterchurn.createVisualizer(acRef.current, canvasRef.current, {
      width: canvasRef.current.width,
      height: canvasRef.current.height,
      pixelRatio: window.devicePixelRatio || 1,
    });

    // stash presets for randomization
    const keys = Object.keys(presetMap);
    presetsRef.current = { keys, map: presetMap };

    // hook audio into butterchurn so visuals follow the music
    if (analyserRef.current) {
      // butterchurn accepts any AudioNode (AnalyserNode is perfect)
      vizRef.current.connectAudio(analyserRef.current);
    }

    // start with a random preset immediately
    loadRandomPreset();

    const render = () => { vizRef.current?.render(); rafRef.current = requestAnimationFrame(render); };
    rafRef.current = requestAnimationFrame(render);

    const resize = () => {
      if (!canvasRef.current || !vizRef.current || !vizBoxRef.current) return;
      const rect = vizBoxRef.current.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvasRef.current.width  = Math.max(1, Math.floor(rect.width  * dpr));
      canvasRef.current.height = Math.max(1, Math.floor(rect.height * dpr));
      vizRef.current.setRendererSize(canvasRef.current.width, canvasRef.current.height);
    };
    resize();
    window.addEventListener("resize", resize);
    resizeHandlerRef.current = resize;

    vizReadyRef.current = true;
  }, [presetMap, loadRandomPreset]);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (resizeHandlerRef.current) window.removeEventListener("resize", resizeHandlerRef.current);
      vizRef.current = null;
      vizReadyRef.current = false;
    };
  }, []);

  useEffect(() => {
    volumeRef.current = volume;
    const ac = acRef.current;
    const master = masterGainRef.current;
    if (ac && master) {
      const now = ac.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setTargetAtTime(volume, now, 0.05);
    } else {
      const activeAudio = audioRefs.current[activeSlotRef.current];
      if (activeAudio) {
        activeAudio.volume = volume;
        if (activeAudio.muted && volume > 0) activeAudio.muted = false;
      }
    }
  }, [volume]);

  useEffect(() => {
    if (!showVol) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (volPopRef.current?.contains(t) || volBtnRef.current?.contains(t)) return;
      setShowVol(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setShowVol(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [showVol]);

  const play = useCallback(async () => {
    ensureAudioGraph();
    ensureVisualizer();
    const slot = activeSlotRef.current;
    const audio = audioRefs.current[slot];
    if (!audio) return;

    if (!audio.src) await loadTrackIntoSlot(slot, currentTrackRef.current);
    ensureSlotWired(slot);

    try {
      await audio.play();
      await acRef.current?.resume().catch(() => {});
      const ac = acRef.current;
      const gain = gainRefs.current[slot];
      if (ac && gain) {
        const now = ac.currentTime;
        gain.gain.cancelScheduledValues(now);
        gain.gain.setValueAtTime(1, now);
      } else {
        audio.volume = volumeRef.current;
      }
      setIsPlaying(true);
      setNeedsInteraction(false);
    } catch (err) {
      setNeedsInteraction(true);
      setIsPlaying(false);
      throw err;
    }
  }, [ensureAudioGraph, ensureVisualizer, ensureSlotWired, loadTrackIntoSlot, setIsPlaying]);

  const pause = useCallback(() => {
    audioRefs.current.forEach((audio) => audio?.pause());
    setIsPlaying(false);
  }, [setIsPlaying]);

  const toggle = useCallback(() => {
    if (isPlayingRef.current) {
      pause();
    } else {
      void play().catch(() => {});
    }
  }, [pause, play]);

  const crossfadeTo = useCallback(
    async (nextIndex: number, shouldAutoplay?: boolean) => {
      const playTarget = shouldAutoplay ?? isPlayingRef.current;
      const activeSlot = activeSlotRef.current;

      if (!playTarget) {
        await loadTrackIntoSlot(activeSlot, nextIndex);
        const ac = acRef.current;
        const gain = gainRefs.current[activeSlot];
        if (ac && gain) {
          const now = ac.currentTime;
          gain.gain.cancelScheduledValues(now);
          gain.gain.setValueAtTime(1, now);
        } else if (audioRefs.current[activeSlot]) {
          audioRefs.current[activeSlot]!.volume = volumeRef.current;
        }
        setCurrentTrackIndex(nextIndex);
        return;
      }

      if (isCrossfadingRef.current) return;
      isCrossfadingRef.current = true;

      const inactiveSlot = ((activeSlot + 1) % 2) as Slot;

      try {
        ensureAudioGraph();
        ensureVisualizer();
        await loadTrackIntoSlot(inactiveSlot, nextIndex);
        ensureSlotWired(inactiveSlot);

        const newAudio = audioRefs.current[inactiveSlot];
        const oldAudio = audioRefs.current[activeSlot];
        if (!newAudio) return;

        const ac = acRef.current;
        const newGain = gainRefs.current[inactiveSlot];
        const oldGain = gainRefs.current[activeSlot];
        const now = ac?.currentTime ?? 0;
        const fade = CROSSFADE_SECONDS;

        if (ac && newGain) {
          newGain.gain.cancelScheduledValues(now);
          newGain.gain.setValueAtTime(0, now);
          newGain.gain.linearRampToValueAtTime(1, now + fade);
        } else {
          newAudio.volume = 0;
        }

        if (ac && oldGain) {
          const startVal = oldGain.gain.value;
          oldGain.gain.cancelScheduledValues(now);
          oldGain.gain.setValueAtTime(startVal, now);
          oldGain.gain.linearRampToValueAtTime(0, now + fade);
        } else if (oldAudio) {
          oldAudio.volume = 0;
        }

        try {
          await newAudio.play();
          await ac?.resume().catch(() => {});
          setIsPlaying(true);
          setNeedsInteraction(false);
        } catch {
          setNeedsInteraction(true);
          setIsPlaying(false);
          return;
        }

        window.setTimeout(() => {
          if (oldAudio) oldAudio.pause();
          if (ac && oldGain) {
            const t = ac.currentTime;
            oldGain.gain.cancelScheduledValues(t);
            oldGain.gain.setValueAtTime(0, t);
          } else if (oldAudio) {
            oldAudio.volume = 0;
          }
        }, fade * 1000 + 120);

        activeSlotRef.current = inactiveSlot;
        setCurrentTrackIndex(nextIndex);
        loadRandomPreset();
      } finally {
        isCrossfadingRef.current = false;
      }
    },
    [ensureAudioGraph, ensureVisualizer, loadTrackIntoSlot, ensureSlotWired, setIsPlaying, setCurrentTrackIndex, loadRandomPreset],
  );

  const next = useCallback(() => {
    const nextIndex = (currentTrackRef.current + 1) % TRACKS.length;
    void crossfadeTo(nextIndex);
  }, [crossfadeTo]);

  const prev = useCallback(() => {
    const nextIndex = (currentTrackRef.current - 1 + TRACKS.length) % TRACKS.length;
    void crossfadeTo(nextIndex);
  }, [crossfadeTo]);

  const initializePlayback = useCallback(async () => {
    if (initializedRef.current) return;
    if (!audioRefs.current[0] || !audioRefs.current[1]) return;

    initializedRef.current = true;

    ensureAudioGraph();
    ensureSlotWired(0);
    ensureSlotWired(1);
    ensureVisualizer();

    await loadTrackIntoSlot(activeSlotRef.current, currentTrackRef.current);
    setCurrentTrackIndex(currentTrackRef.current);

    try {
      await play();
    } catch {
      // likely requires a user gesture; play already flagged interaction state
    }
  }, [
    ensureAudioGraph,
    ensureSlotWired,
    ensureVisualizer,
    loadTrackIntoSlot,
    setCurrentTrackIndex,
    play,
  ]);

  const registerAudio = useCallback(
    (slot: Slot) => (node: HTMLAudioElement | null) => {
      audioRefs.current[slot] = node;
      if (!node) return;
      node.crossOrigin = "anonymous";
      node.preload = "auto";
      node.loop = false;
      node.volume = slot === activeSlotRef.current ? volumeRef.current : 0;
      if (!initializedRef.current && audioRefs.current[0] && audioRefs.current[1]) {
        void initializePlayback();
      }
    },
    [initializePlayback],
  );

  useEffect(() => {
    void initializePlayback();
  }, [initializePlayback]);

  const handleEnded = useCallback(
    (slot: Slot) => {
      if (slot !== activeSlotRef.current) return;
      const nextIndex = (currentTrackRef.current + 1) % TRACKS.length;
      void crossfadeTo(nextIndex, true);
    },
    [crossfadeTo],
  );

  const handleUserStart = useCallback(async () => {
    try { await acRef.current?.resume(); } catch {}
    try {
      await play();
      setNeedsInteraction(false);
    } catch {
      // still waiting for user gesture
    }
  }, [play]);

  const track = TRACKS[currentTrackIndex];
  const currentTrackName = track?.name ?? "—";

  const audioElements = (
    <>
      {[0, 1].map((slot) => (
        <audio
          key={slot}
          ref={registerAudio(slot as Slot)}
          preload="auto"
          crossOrigin="anonymous"
          onEnded={() => handleEnded(slot as Slot)}
          onPlay={() => setIsPlaying(true)}
          onPause={() => {
            const anyPlaying = audioRefs.current.some((audio) => audio && !audio.paused);
            if (!anyPlaying) setIsPlaying(false);
          }}
          className="hidden"
        />
      ))}
    </>
  );

  if (compact) {
    return (
      <div
        {...rest}
        className={`rounded-xl bg-white/85 text-black px-3 py-2 shadow-sm ${className}`}
      >
        <div className="flex items-center gap-2">
          <button
            onClick={toggle}
            className="rounded px-2 py-1 bg-white/90 text-xs font-semibold border border-black/10"
          >
            {isPlaying ? "Pause" : "Play"}
          </button>
          <div className="text-xs opacity-80 truncate max-w-[120px]">
            {currentTrackName}
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            className="w-24"
            aria-label="Volume"
          />
          <button
            onClick={next}
            className="rounded px-2 py-1 bg-white/70 text-xs font-semibold border border-black/10"
          >
            Next
          </button>
        </div>
        {audioElements}
      </div>
    );
  }

  return (
    <div {...rest} className={`relative rounded-3xl bg-gradient-to-b from-[#98c4ff]/30 to-[#2a5aa0]/40 p-4 backdrop-blur-sm shadow-lg ${className}`}>
      <div className="mb-3 flex items-center justify-center rounded-2xl border border-white/25 bg-[rgba(10,25,55,.55)] px-3 py-1.5 backdrop-blur">
        <div
          className="text-emerald-100 drop-shadow select-none text-center"
          style={{
            /* responsive size that shrinks on narrow panes */
            fontSize: 'clamp(0.68rem, 1.4vw, 0.85rem)',
            letterSpacing: '0.2em',          // a touch tighter so long names fit
            lineHeight: 1,
            whiteSpace: 'nowrap',
          }}
        >
          {track.name.toUpperCase()}
        </div>
      </div>

      <div ref={vizBoxRef} className="relative overflow-hidden rounded-3xl border border-white/15 bg-white/5 h-[260px] sm:h-[300px]">
        {/* make sure slider clicks aren’t eaten */}
        <canvas
          ref={canvasRef}
          onClick={loadRandomPreset}
          className="absolute inset-0 h-full w-full cursor-pointer"
        />
        {audioElements}
      </div>
        <div className="mt-4">
         <div
            className="
              relative mx-auto w-[88%] max-w-[460px]
              rounded-[26px] border border-transparent
              bg-transparent px-6 py-3 shadow-none
            "
          >
            {/* CENTERED TRANSPORT (fixed width so the lane math is stable) */}
          <div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-4 z-10"
            style={{ width: 184 }} /* 3x(44px) + two 16px gaps */
          >

              <button
                onClick={prev}
                className="h-11 w-11 rounded-xl bg-white/20 text-white/90 hover:bg-white/30 font-semibold"
                aria-label="Previous"
              >‹‹</button>

              <button
                onClick={toggle}
                className="h-11 w-11 rounded-xl bg-white/30 text-white hover:bg-white/40 font-bold"
                aria-label={isPlaying ? 'Pause' : 'Play'}
              >{isPlaying ? '❚❚' : '►'}</button>

              <button
                onClick={next}
                className="h-11 w-11 rounded-xl bg-white/20 text-white/90 hover:bg-white/30 font-semibold"
                aria-label="Next"
              >››</button>
            </div>

            {/* RIGHT-SIDE LANE (centers tiny volume between Next and wall) */}
            <div className="absolute left-1/2 right-4 top-1/2 -translate-y-1/2 pointer-events-none">
              <div className="ml-[92px] flex justify-center pointer-events-auto">
                <button
                  ref={volBtnRef}
                  onClick={() => setShowVol(v => !v)}
                  className="h-6 w-6 rounded-md bg-white/15 text-white/90 hover:bg-white/25 grid place-items-center z-20 pointer-events-auto"
                  aria-label="Volume"
                  title="Volume"
                >
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" aria-hidden="true">
                    <path fill="currentColor" d="M11 5.5a1 1 0 0 1 1.58-.81l3.92 2.9a1 1 0 0 1 .4.8v6.22a1 1 0 0 1-.4.8l-3.92 2.9A1 1 0 0 1 11 18.5V5.5zM9 9H6.5A1.5 1.5 0 0 0 5 10.5v3A1.5 1.5 0 0 0 6.5 15H9V9z"/>
                    <path fill="currentColor" d="M18.5 8.6a.9.9 0 0 1 1.27-.1c1.1.95 1.73 2.32 1.73 3.5s-.63 2.55-1.73 3.5a.9.9 0 1 1-1.17-1.36c.7-.6 1.1-1.5 1.1-2.14s-.4-1.54-1.1-2.14a.9.9 0 0 1-.1-1.26z"/>
                  </svg>
                </button>
              </div>

              {showVol && (
                <div
                  ref={volPopRef}
                  className="absolute right-0 bottom-[2.75rem] z-50 rounded-2xl border border-white/25
                            bg-[rgba(15,30,55,.95)] px-3 py-2 backdrop-blur-md shadow-lg pointer-events-auto"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] leading-none text-white/70">vol</span>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.01}
                      value={volume}
                      onChange={(e) => setVolume(parseFloat(e.target.value))}
                      className="vol-h w-[96px] h-3"
                      aria-label="Volume slider"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

      <style jsx>{`
        /* horizontal slider (polished + robust) */
        .vol-h {
          -webkit-appearance: none;
          appearance: none;
          background: transparent;
          cursor: pointer;
        }
        .vol-h::-webkit-slider-runnable-track {
          height: 6px;
          border-radius: 9999px;
          background: linear-gradient(90deg, rgba(255,255,255,.35), rgba(255,255,255,.15));
          border: 1px solid rgba(255,255,255,.25);
          box-shadow: inset 0 1px 2px rgba(0,0,0,.25);
        }
        .vol-h::-moz-range-track {
          height: 6px;
          border-radius: 9999px;
          background: linear-gradient(90deg, rgba(255,255,255,.35), rgba(255,255,255,.15));
          border: 1px solid rgba(255,255,255,.25);
          box-shadow: inset 0 1px 2px rgba(0,0,0,.25);
        }
        .vol-h::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 14px;
          height: 14px;
          border-radius: 9999px;
          margin-top: -4px; /* center on 6px track */
          background: linear-gradient(180deg, #9ce7ff, #45a2ff);
          border: 1px solid rgba(255,255,255,.5);
          box-shadow: 0 4px 10px rgba(0,0,0,.28), inset 0 2px 5px rgba(255,255,255,.35);
        }
        .vol-h::-moz-range-thumb {
          width: 14px;
          height: 14px;
          border-radius: 9999px;
          background: linear-gradient(180deg, #9ce7ff, #45a2ff);
          border: 1px solid rgba(255,255,255,.5);
          box-shadow: 0 4px 10px rgba(0,0,0,.28), inset 0 2px 5px rgba(255,255,255,.35);
        }
      `}</style>
    </div>
  );
}
