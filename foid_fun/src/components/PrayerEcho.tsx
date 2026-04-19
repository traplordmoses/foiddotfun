"use client";

import { useEffect, useMemo, useState } from "react";

type PrayerEchoProps = {
  text: string;
  active: boolean;
  onDone?: () => void;
};

/**
 * PrayerEcho
 * ----------
 * Briefly echoes the user's prayer text back, reversed character-by-character,
 * at low opacity over the terminal — then dissolves. A witness, then gone.
 *
 * Timing (non-reduced-motion):
 *   - 2s: characters appear one at a time, reversed
 *   - 1s: fade to 0 opacity
 *   - 3s total, then onDone fires
 *
 * Respects prefers-reduced-motion (shows full text static, fades out).
 * pointer-events: none so it never blocks interactions.
 */
export default function PrayerEcho({ text, active, onDone }: PrayerEchoProps) {
  const [visibleChars, setVisibleChars] = useState(0);
  const [fading, setFading] = useState(false);
  const reversed = useMemo(() => [...text].reverse().join(""), [text]);
  const prefersReduced = usePrefersReducedMotion();

  useEffect(() => {
    if (!active || !text) {
      setVisibleChars(0);
      setFading(false);
      return;
    }

    if (prefersReduced) {
      setVisibleChars(text.length);
      setFading(false);
      const fadeTimer = window.setTimeout(() => setFading(true), 1500);
      const doneTimer = window.setTimeout(() => {
        setVisibleChars(0);
        setFading(false);
        onDone?.();
      }, 2500);
      return () => {
        window.clearTimeout(fadeTimer);
        window.clearTimeout(doneTimer);
      };
    }

    setVisibleChars(0);
    setFading(false);
    const total = text.length;
    const perChar = Math.max(16, Math.floor(2000 / Math.max(1, total)));
    let i = 0;
    const interval = window.setInterval(() => {
      i += 1;
      setVisibleChars(i);
      if (i >= total) window.clearInterval(interval);
    }, perChar);

    const fadeTimer = window.setTimeout(() => setFading(true), 2000);
    const doneTimer = window.setTimeout(() => {
      setVisibleChars(0);
      setFading(false);
      onDone?.();
    }, 3000);

    return () => {
      window.clearInterval(interval);
      window.clearTimeout(fadeTimer);
      window.clearTimeout(doneTimer);
    };
  }, [active, text, prefersReduced, onDone]);

  if (!active || !text || visibleChars === 0) return null;

  const shown = reversed.slice(0, visibleChars);

  return (
    <div
      className={`prayer-echo${fading ? " prayer-echo--fading" : ""}`}
      aria-hidden
    >
      <div className="prayer-echo__text">{shown}</div>
    </div>
  );
}

function usePrefersReducedMotion() {
  const [prefers, setPrefers] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = () => setPrefers(mq.matches);
    handler();
    if (mq.addEventListener) {
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    }
    // Safari < 14 fallback
    mq.addListener(handler);
    return () => mq.removeListener(handler);
  }, []);
  return prefers;
}
