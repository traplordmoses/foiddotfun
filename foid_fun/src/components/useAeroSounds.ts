"use client";

import { useCallback, useRef, useEffect } from "react";

interface AeroSounds {
  playHover: () => void;
  playClick: () => void;
  playWindowFocus: () => void;
  playWhoosh: () => void;
}

type AudioContextWindow = Window & { webkitAudioContext?: typeof AudioContext };

export default function useAeroSounds(): AeroSounds {
  const audioContextRef = useRef<AudioContext | null>(null);

  const getContext = useCallback(() => {
    if (typeof window === "undefined") {
      return null;
    }

    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext ||
        (window as AudioContextWindow).webkitAudioContext)();
    }

    if (audioContextRef.current.state === "suspended") {
      audioContextRef.current.resume();
    }

    return audioContextRef.current;
  }, []);

  useEffect(() => {
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  const playHover = useCallback(() => {
    try {
      const ctx = getContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc.type = "sine";
      osc.frequency.setValueAtTime(2800, now);
      osc.frequency.exponentialRampToValueAtTime(1800, now + 0.06);

      filter.type = "lowpass";
      filter.frequency.setValueAtTime(4000, now);
      filter.Q.setValueAtTime(2, now);

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.08, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.1);
    } catch {
      // Silently fail if audio not supported.
    }
  }, [getContext]);

  const playClick = useCallback(() => {
    try {
      const ctx = getContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      const filter1 = ctx.createBiquadFilter();

      osc1.type = "sine";
      osc1.frequency.setValueAtTime(1200, now);
      osc1.frequency.exponentialRampToValueAtTime(400, now + 0.1);

      filter1.type = "bandpass";
      filter1.frequency.setValueAtTime(1000, now);
      filter1.Q.setValueAtTime(3, now);

      gain1.gain.setValueAtTime(0.15, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

      osc1.connect(filter1);
      filter1.connect(gain1);
      gain1.connect(ctx.destination);

      osc1.start(now);
      osc1.stop(now + 0.2);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();

      osc2.type = "sine";
      osc2.frequency.setValueAtTime(150, now);
      osc2.frequency.exponentialRampToValueAtTime(60, now + 0.1);

      gain2.gain.setValueAtTime(0.12, now);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      osc2.connect(gain2);
      gain2.connect(ctx.destination);

      osc2.start(now);
      osc2.stop(now + 0.15);

      const osc3 = ctx.createOscillator();
      const gain3 = ctx.createGain();

      osc3.type = "triangle";
      osc3.frequency.setValueAtTime(3200, now);
      osc3.frequency.exponentialRampToValueAtTime(2000, now + 0.05);

      gain3.gain.setValueAtTime(0.04, now);
      gain3.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

      osc3.connect(gain3);
      gain3.connect(ctx.destination);

      osc3.start(now);
      osc3.stop(now + 0.1);
    } catch {
      // Silently fail.
    }
  }, [getContext]);

  const playWindowFocus = useCallback(() => {
    try {
      const ctx = getContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      const frequencies = [800, 1000, 1300];

      frequencies.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();

        const startTime = now + i * 0.04;

        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, startTime);

        filter.type = "lowpass";
        filter.frequency.setValueAtTime(3000, startTime);
        filter.Q.setValueAtTime(1, startTime);

        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.08 - i * 0.015, startTime + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.25);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        osc.start(startTime);
        osc.stop(startTime + 0.3);
      });
    } catch {
      // Silently fail.
    }
  }, [getContext]);

  const playWhoosh = useCallback(() => {
    try {
      const ctx = getContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      const bufferSize = ctx.sampleRate * 0.3;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);

      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * 0.5;
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(500, now);
      filter.frequency.exponentialRampToValueAtTime(2500, now + 0.15);
      filter.frequency.exponentialRampToValueAtTime(800, now + 0.3);
      filter.Q.setValueAtTime(1.5, now);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.06, now + 0.05);
      gain.gain.linearRampToValueAtTime(0.08, now + 0.15);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      noise.start(now);
      noise.stop(now + 0.4);

      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.exponentialRampToValueAtTime(600, now + 0.15);
      osc.frequency.exponentialRampToValueAtTime(200, now + 0.3);

      oscGain.gain.setValueAtTime(0, now);
      oscGain.gain.linearRampToValueAtTime(0.03, now + 0.05);
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

      osc.connect(oscGain);
      oscGain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.35);
    } catch {
      // Silently fail.
    }
  }, [getContext]);

  return {
    playHover,
    playClick,
    playWindowFocus,
    playWhoosh,
  };
}
