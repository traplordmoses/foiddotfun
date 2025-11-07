// src/hooks/useButterchurn.ts
"use client";
import { useEffect, useRef, useCallback } from "react";
import butterchurnModule from "butterchurn";
import * as presetNS from "butterchurn-presets";

const butterchurn: any = (butterchurnModule as any).default ?? butterchurnModule;
const getAllPresets = () => {
  const mod: any = (presetNS as any)?.getPresets ? presetNS : (presetNS as any).default;
  return (mod as any).getPresets() as Record<string, any>;
};

type Options = {
  /** rotate presets every N ms (set to 0/undefined to disable auto-rotate) */
  rotateMs?: number;
  /** crossfade/blend time between presets in ms */
  blendMs?: number;
};

export function useButterchurn(
  canvasRef: React.RefObject<HTMLCanvasElement>,
  audioCtxRef: React.RefObject<AudioContext | null>,
  { rotateMs = 20000, blendMs = 2000 }: Options = {}
) {
  const visualizerRef = useRef<any>(null);
  const presetsRef = useRef<{ keys: string[]; map: Record<string, any> } | null>(null);
  const currentIdxRef = useRef<number>(0);
  const timerRef = useRef<number | null>(null); // number (browser) fixes TS "never" error

  const loadPresetByIndex = useCallback((i: number) => {
    if (!visualizerRef.current || !presetsRef.current) return;
    const { keys, map } = presetsRef.current;
    const key = keys[i % keys.length];
    visualizerRef.current.loadPreset(map[key], blendMs);
    currentIdxRef.current = i % keys.length;
  }, [blendMs]);

  const loadRandomPreset = useCallback(() => {
    if (!presetsRef.current) return;
    const { keys } = presetsRef.current;
    // avoid immediate repeat
    let next = Math.floor(Math.random() * keys.length);
    if (keys.length > 1 && next === currentIdxRef.current) {
      next = (next + 1) % keys.length;
    }
    loadPresetByIndex(next);
  }, [loadPresetByIndex]);

  const nextPreset = useCallback(() => {
    if (!presetsRef.current) return;
    loadPresetByIndex(currentIdxRef.current + 1);
  }, [loadPresetByIndex]);

  const prevPreset = useCallback(() => {
    if (!presetsRef.current) return;
    const { keys } = presetsRef.current;
    const next = (currentIdxRef.current - 1 + keys.length) % keys.length;
    loadPresetByIndex(next);
  }, [loadPresetByIndex]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const audioCtx = audioCtxRef.current;
    if (!canvas || !audioCtx) return;

    // init visualizer
    const vis = butterchurn.createVisualizer(audioCtx, canvas, {
      width: canvas.clientWidth,
      height: canvas.clientHeight,
      pixelRatio: window.devicePixelRatio || 1,
    });
    visualizerRef.current = vis;

    // presets
    const all = getAllPresets();
    const keys = Object.keys(all);
    presetsRef.current = { keys, map: all };

    // default first preset
    loadRandomPreset();

    // size handling
    const handleResize = () => {
      if (!canvas || !visualizerRef.current) return;
      visualizerRef.current.setRendererSize(canvas.clientWidth, canvas.clientHeight);
    };
    window.addEventListener("resize", handleResize);

    // render loop
    let raf: number;
    const loop = () => {
      visualizerRef.current?.render();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    // auto-rotate
    if (rotateMs && rotateMs > 0) {
      timerRef.current = window.setInterval(() => loadRandomPreset(), rotateMs);
    }

    return () => {
      window.removeEventListener("resize", handleResize);
      if (raf) cancelAnimationFrame(raf);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [canvasRef, audioCtxRef, rotateMs, loadRandomPreset]);

  // expose manual controls
  return { nextPreset, prevPreset, loadRandomPreset };
}
