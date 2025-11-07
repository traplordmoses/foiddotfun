// src/components/AnimatedBackground.tsx
"use client";

import { useEffect, useRef } from "react";

interface LayerOptions {
  isMobile?: boolean;
}

/* ───────────────── Shadertoy background ───────────────── */
const SHADERTOY_SOURCE = String.raw`
#define TAU 6.28318530718
#define MAX_ITER 5
void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    // gentler background speed
    #define SPEED 0.1
    float time = iTime * SPEED + 23.0;
    vec2 uv = fragCoord.xy / iResolution.xy;
    vec2 p = mod(uv*TAU, TAU) - 250.0;

    vec2 i = vec2(p);
    float c = 1.0;
    float inten = .005;

    for (int n = 0; n < MAX_ITER; n++) {
        float t = time * (1.0 - (3.5 / float(n+1)));
        i = p + vec2(cos(t - i.x) + sin(t + i.y),
                     sin(t - i.y) + cos(t + i.x));
        c += 1.0/length(vec2(p.x / (sin(i.x+t)/inten),
                             p.y / (cos(i.y+t)/inten)));
    }
    c /= float(MAX_ITER);
    c = 1.17 - pow(c, 1.4);

    vec3 colour = vec3(pow(abs(c), 8.0));
    colour = clamp(colour + vec3(0.0, 0.35, 0.5), 0.0, 1.0);
    fragColor = vec4(colour, 1.0);
}
`;

type Cleanup = () => void;

function fallbackMediaQuery(query: string): MediaQueryList {
  return {
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  } as MediaQueryList;
}
function createMatchMedia(query: string): MediaQueryList {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return fallbackMediaQuery(query);
  }
  return window.matchMedia(query);
}

export default function AnimatedBackground() {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const detectMobile = () => {
      if (typeof window === "undefined") return false;
      return (
        window.matchMedia("(pointer: coarse)").matches ||
        window.matchMedia("(max-width: 768px)").matches
      );
    };

    let disposed = false;
    let glCleanup: Cleanup | undefined;
    let fxCleanup: Cleanup | undefined;
    let htCleanup: Cleanup | undefined;

    const ensureFallback = () => {
      if (!container.classList.contains("foid-background--fallback")) {
        container.classList.add("foid-background--fallback");
      }
    };

    const initializeLayers = () => {
      if (!container || disposed) return;
      try {
        container.classList.remove("foid-background--fallback");

        // Ensure the background stack is fixed full-screen and never eats clicks.
        container.style.position = "fixed";
        container.style.top = "0";
        container.style.right = "0";
        container.style.bottom = "0";
        container.style.left = "0";
        container.style.zIndex = "0";
        container.style.pointerEvents = "none";

        // GL (bottom)
        const glCanvas = document.createElement("canvas");
        glCanvas.className = "foid-bg-layer foid-bg-layer--gl";
        glCanvas.style.position = "absolute";
        glCanvas.style.top = "0";
        glCanvas.style.right = "0";
        glCanvas.style.bottom = "0";
        glCanvas.style.left = "0";
        glCanvas.style.zIndex = "0";

        // FX (middle)
        const fxCanvas = document.createElement("canvas");
        fxCanvas.className = "foid-bg-layer foid-bg-layer--fx";
        fxCanvas.style.position = "absolute";
        fxCanvas.style.top = "0";
        fxCanvas.style.right = "0";
        fxCanvas.style.bottom = "0";
        fxCanvas.style.left = "0";
        fxCanvas.style.zIndex = "1";

        container.appendChild(glCanvas);
        container.appendChild(fxCanvas);

        const isMobile = detectMobile();

        glCleanup = setupWebGL(glCanvas, { isMobile }) || undefined;
        fxCleanup = setupFX(fxCanvas, { isMobile }) || undefined;

        if (!isMobile) {
          const htCanvas = document.createElement("canvas");
          htCanvas.className = "foid-bg-layer foid-bg-layer--halftone";
          htCanvas.style.position = "absolute";
          htCanvas.style.top = "0";
          htCanvas.style.right = "0";
          htCanvas.style.bottom = "0";
          htCanvas.style.left = "0";
          htCanvas.style.zIndex = "2";
          htCanvas.style.pointerEvents = "none";
          (htCanvas.style as any).mixBlendMode = "multiply";
          htCanvas.style.opacity = "0.35";
          container.appendChild(htCanvas);
          htCleanup = setupHalftone(htCanvas) || undefined;
        } else {
          htCleanup = undefined;
        }

        if (!glCleanup && !fxCleanup) ensureFallback();
      } catch (err) {
        console.error("foid background init failed", err);
        ensureFallback();
      }
    };


    const reqIdle: any =
      (typeof window !== "undefined" && (window as any).requestIdleCallback) || null;
    const cancelIdle: any =
      (typeof window !== "undefined" && (window as any).cancelIdleCallback) || null;

    let idleHandle: number | null = null;
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

    const scheduleInit = () => {
      if (typeof window === "undefined") return initializeLayers();
      if (typeof reqIdle === "function") {
        idleHandle = reqIdle(
          () => {
            idleHandle = null;
            initializeLayers();
          },
          { timeout: 1200 }
        );
      } else {
        timeoutHandle = window.setTimeout(() => {
          timeoutHandle = null;
          initializeLayers();
        }, 120);
      }
    };

    scheduleInit();

    return () => {
      disposed = true;
      if (idleHandle !== null) cancelIdle?.(idleHandle);
      if (timeoutHandle !== null) window.clearTimeout(timeoutHandle);
      glCleanup?.();
      fxCleanup?.();
      htCleanup?.();
      if (container) {
        container.innerHTML = "";
        ensureFallback();
      }
    };
  }, []);

  return <div ref={containerRef} className="foid-background" aria-hidden="true" />;
}

/* ────────────────────────────────────────────────────────────────────────────
   WEBGL LAYER — Shadertoy wrapper
   ──────────────────────────────────────────────────────────────────────────── */
function setupWebGL(canvas: HTMLCanvasElement, opts?: LayerOptions): Cleanup | undefined {
  const gl = canvas.getContext("webgl", {
    antialias: true, depth: false, stencil: false, alpha: true, premultipliedAlpha: true,
  });
  if (!gl) { console.warn("WebGL not available."); return undefined; }

  const maxDpr = opts?.isMobile ? 1 : 2;
  const getDpr = () => Math.min(window.devicePixelRatio || 1, maxDpr);
  const resize = () => {
    const dpr = getDpr();
    const w = Math.floor(window.innerWidth * dpr);
    const h = Math.floor(window.innerHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w; canvas.height = h;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      gl.viewport(0, 0, w, h);
    }
  };
  resize();
  window.addEventListener("resize", resize, { passive: true });

  const quadVS = `
    attribute vec2 a_position;
    void main(){ gl_Position = vec4(a_position, 0.0, 1.0); }
  `;
  const stFS = `
    precision highp float;
    uniform vec2 iResolution;
    uniform float iTime;
    ${SHADERTOY_SOURCE}
    void main() {
      vec4 color = vec4(0.0);
      mainImage(color, gl_FragCoord.xy);
      gl_FragColor = color;
    }
  `;

  const compile = (type: number, src: string) => {
    const sh = gl.createShader(type)!;
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(sh) || "shader compile error");
      gl.deleteShader(sh);
      return null;
    }
    return sh;
  };

  const vs = compile(gl.VERTEX_SHADER, quadVS);
  const fs = compile(gl.FRAGMENT_SHADER, stFS);
  let program: WebGLProgram | null = null;

  if (vs && fs) {
    program = gl.createProgram()!;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error(gl.getProgramInfoLog(program) || "program link error");
      program = null;
    }
  }

  if (!program) {
    const flatFS = `
      precision highp float; uniform vec2 iResolution; uniform float iTime;
      void main(){
        vec2 uv=gl_FragCoord.xy/iResolution;
        gl_FragColor=vec4(mix(vec3(0.02,0.05,0.12), vec3(0.03,0.20,0.55), uv.y),1.0);
      }
    `;
    const fs2 = compile(gl.FRAGMENT_SHADER, flatFS);
    if (!vs || !fs2) { window.removeEventListener("resize", resize); return undefined; }
    program = gl.createProgram()!;
    gl.attachShader(program, vs); gl.attachShader(program, fs2);
    gl.linkProgram(program);
  }

  gl.useProgram(program);

  const posLoc  = gl.getAttribLocation(program, "a_position");
  const resLoc  = gl.getUniformLocation(program, "iResolution");
  const timeLoc = gl.getUniformLocation(program, "iTime");

  const buf = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    -1,-1, 1,-1, -1,1,
    -1,1, 1,-1, 1,1
  ]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(posLoc);
  gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

  const mediaQuery = createMatchMedia("(prefers-reduced-motion: reduce)");
  let reduced = mediaQuery.matches;
  let frameId: number | null = null;
  const t0 = performance.now();
  const frameSkip = opts?.isMobile ? 2 : 1;
  let frameCounter = 0;

  const render = () => {
    if (opts?.isMobile && frameCounter++ % frameSkip !== 0) {
      if (!reduced) frameId = requestAnimationFrame(render);
      return;
    }
    const t = (performance.now() - t0) / 1000;
    gl.uniform2f(resLoc, canvas.width, canvas.height);
    gl.uniform1f(timeLoc, t);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    if (!reduced) frameId = requestAnimationFrame(render);
  };
  render();

  const onReduce = (e: MediaQueryListEvent) => {
    reduced = e.matches;
    if (reduced && frameId != null) { cancelAnimationFrame(frameId); frameId = null; }
    if (!reduced && frameId == null) frameId = requestAnimationFrame(render);
  };
  mediaQuery.addEventListener?.("change", onReduce);
  mediaQuery.addListener?.(onReduce);

  return () => {
    if (frameId != null) cancelAnimationFrame(frameId);
    window.removeEventListener("resize", resize);
    mediaQuery.removeEventListener?.("change", onReduce);
    mediaQuery.removeListener?.(onReduce);
  };
}

/* ────────────────────────────────────────────────────────────────────────────
   2D FX LAYER — bubbles + colored sparkles (no white crosses)
   ──────────────────────────────────────────────────────────────────────────── */
function setupFX(canvas: HTMLCanvasElement, opts?: LayerOptions): Cleanup | undefined {
  const ctx = canvas.getContext("2d");
  if (!ctx) return undefined;

  const isMobile = opts?.isMobile ?? false;
  const maxDpr = isMobile ? 1 : 2;
  let dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
  let width = 0, height = 0;

  const resizeCanvas = () => {
    dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
    width = Math.floor(window.innerWidth * dpr);
    height = Math.floor(window.innerHeight * dpr);
    canvas.width = width; canvas.height = height;
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
  };
  resizeCanvas();

  const mediaQuery = createMatchMedia("(prefers-reduced-motion: reduce)");
  let prefersReduced = mediaQuery.matches;

  /* switches */
  const ENABLE_WATER = false;         // ← turn off to remove the faint “lines”
  const WATER_ALPHA  = 0.40;
  const WATER_TINT   = [160, 200, 255] as const;
  const CAUSTIC_SIZE = isMobile ? 512 : 768;

  // sparkle tuning (dots only; no crossbars)
  const SPARKLE_COUNT = isMobile ? 140 : 260;
  const SPARKLE_MIN   = 0.9;
  const SPARKLE_MAX   = 1.8;

  const rnd = (a:number,b:number)=>a+Math.random()*(b-a);

  type Bubble = { x:number;y:number;r:number;vy:number;sway:number;phase:number; };
  type Sparkle = { x:number;y:number;alpha:number;size:number;color:string; };
  const bubbles: Bubble[] = [];
  const sparkles: Sparkle[] = [];

  const populateBubbles = () => {
    bubbles.length = 0;
    if (prefersReduced) return;
    const density = Math.round((window.innerWidth * window.innerHeight) / 15000);
    const cap = isMobile ? 140 : 220;
    const count = Math.min(density, cap);
    for (let i=0;i<count;i++){
      bubbles.push({
        x:rnd(0,width), y:rnd(height*0.2,height),
        r:rnd(8,28)*dpr, vy:rnd(-36,-14)*dpr*(1/60),
        sway:rnd(0.6,1.6)*dpr*(1/60), phase:rnd(0,Math.PI*2),
      });
    }
  };

  const populateSparkles = () => {
    sparkles.length = 0;
    if (prefersReduced) return;
    for (let i=0;i<SPARKLE_COUNT;i++){
      sparkles.push({
        x:rnd(0,width), y:rnd(0,height),
        alpha:rnd(0.10,0.22),
        size:rnd(SPARKLE_MIN * dpr, SPARKLE_MAX * dpr),
        color:`hsl(${rnd(190,250)}, 90%, 75%)`
      });
    }
  };

  // offscreen caustics (water sheet)
  const caustics = document.createElement("canvas");
  caustics.width = CAUSTIC_SIZE; caustics.height = CAUSTIC_SIZE;
  const cctx = caustics.getContext("2d", { willReadFrequently: true })!;
  let cimg = cctx.createImageData(CAUSTIC_SIZE, CAUSTIC_SIZE);

  const WAVES = [
    { dir:[ 1.0, 0.30], freq: 8.5, speed: 0.80 },
    { dir:[-0.6, 1.00], freq: 7.5, speed:-0.62 },
    { dir:[ 0.7,-1.00], freq: 6.5, speed: 0.55 },
  ];
  const causticAt = (nx:number,ny:number,t:number) => {
    let v = 1.0;
    for (const w of WAVES) {
      const d = nx*w.dir[0] + ny*w.dir[1];
      v *= Math.sin(d * w.freq + t * w.speed);
    }
    return Math.pow(Math.abs(v), 3.2);
  };
  function renderCaustics(time:number) {
    const data = cimg.data; let p = 0; const t = time * 0.065;
    for (let j=0;j<CAUSTIC_SIZE;j++){
      const ny = (j / CAUSTIC_SIZE) * 2 - 1;
      for (let i=0;i<CAUSTIC_SIZE;i++){
        const nx = (i / CAUSTIC_SIZE) * 2 - 1;
        const v  = causticAt(nx, ny, t);
        const a  = Math.min(255, Math.floor(255 * v));
        data[p++] = WATER_TINT[0]; data[p++] = WATER_TINT[1];
        data[p++] = WATER_TINT[2]; data[p++] = a;
      }
    }
    cctx.putImageData(cimg, 0, 0);
  }

  const drawBubble = (b:Bubble) => {
    const g = ctx.createRadialGradient(b.x-b.r*0.32, b.y-b.r*0.36, b.r*0.10, b.x, b.y, b.r);
    g.addColorStop(0.00,"rgba(255,255,255,0.45)");
    g.addColorStop(0.25,"rgba(160,210,255,0.20)");
    g.addColorStop(0.60,"rgba(120,190,255,0.08)");
    g.addColorStop(1.00,"rgba(255,255,255,0.00)");
    ctx.fillStyle=g; ctx.beginPath(); ctx.arc(b.x,b.y,b.r,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle="rgba(190,230,255,0.18)";
    ctx.lineWidth=Math.max(1,b.r*0.06);
    ctx.beginPath(); ctx.arc(b.x,b.y,b.r*0.985,0,Math.PI*2); ctx.stroke();
    // removed bright white ellipse highlight
  };

  let frameId:number|null = null;
  let last = performance.now();
  const frameSkip = isMobile ? 2 : 1;
  let frameCounter = 0;

  const renderFrame = (time:number) => {
    if (isMobile && frameCounter++ % frameSkip !== 0) {
      frameId = requestAnimationFrame(renderFrame);
      return;
    }
    const dt = Math.min(33, time - last); last = time;
    ctx.clearRect(0,0,width,height);

    // (1) optional water overlay — set ENABLE_WATER=false to remove line-y look
    if (ENABLE_WATER) {
      renderCaustics(time);
      ctx.globalCompositeOperation = "overlay";
      ctx.globalAlpha = WATER_ALPHA;
      ctx.drawImage(caustics, 0, 0, width, height);
      ctx.globalAlpha = 1;
    }

    // (2) sparkles (dots only) + bubbles
    ctx.globalCompositeOperation = "screen";

    for (const b of bubbles) {
      b.phase += b.sway * dt * 0.015;
      b.x += Math.sin(b.phase) * 0.45;
      b.y += b.vy * (dt / 16.67);
      if (b.y < -b.r) { b.y = height + b.r*2; b.x = Math.random()*width; }
      drawBubble(b);
    }

    for (const s of sparkles) {
      const tw = 0.5 + 0.5 * Math.sin(time*0.003 + s.x*0.01 + s.y*0.01);
      ctx.globalAlpha = s.alpha * tw;
      ctx.fillStyle = s.color;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.size, 0, Math.PI*2); ctx.fill();
    }
    ctx.globalAlpha = 1;

    frameId = requestAnimationFrame(renderFrame);
  };

  const start = () => {
    if (frameId !== null) { cancelAnimationFrame(frameId); frameId = null; }
    if (prefersReduced) { ctx.clearRect(0,0,width,height); return; }
    last = performance.now();
    frameId = requestAnimationFrame(renderFrame);
  };

  const onResize = () => { resizeCanvas(); populateBubbles(); populateSparkles(); start(); };
  const onReduce = (e: MediaQueryListEvent) => { prefersReduced = e.matches; populateBubbles(); populateSparkles(); start(); };
  const onVisibility = () => {
    if (document.hidden) { if (frameId !== null) { cancelAnimationFrame(frameId); frameId = null; } }
    else start();
  };

  populateBubbles(); populateSparkles(); start();
  window.addEventListener("resize", onResize, { passive: true });
  mediaQuery.addEventListener?.("change", onReduce);
  mediaQuery.addListener?.(onReduce);
  document.addEventListener("visibilitychange", onVisibility);

  return () => {
    if (frameId !== null) cancelAnimationFrame(frameId);
    window.removeEventListener("resize", onResize);
    mediaQuery.removeEventListener?.("change", onReduce);
    mediaQuery.removeListener?.(onReduce);
    document.removeEventListener("visibilitychange", onVisibility);
  };
}

/* ────────────────────────────────────────────────────────────────────────────
   HALFTONE OVERLAY — CMYK rosette with visible drift & wobble
   ──────────────────────────────────────────────────────────────────────────── */
function setupHalftone(canvas: HTMLCanvasElement): Cleanup | undefined {
  const ctx = canvas.getContext("2d");
  if (!ctx) return undefined;

  // keep dots sharp when we scale the pattern
  (ctx as any).imageSmoothingEnabled = false;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  let width = 0, height = 0;

  const resizeCanvas = () => {
    width = Math.floor(window.innerWidth * dpr);
    height = Math.floor(window.innerHeight * dpr);
    canvas.width = width; canvas.height = height;
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
  };
  resizeCanvas();

  const mediaQuery = createMatchMedia("(prefers-reduced-motion: reduce)");
  let prefersReduced = mediaQuery.matches;

  // ——— tuning knobs (closer to your references) ———
  const PITCH = 3;            // smaller cell => tighter grid
  const RATIO = 0.72;         // bigger dots
  const TILE  = 12;
  const OP = { C: 0.85, M: 0.72, Y: 0.58, K: 0.35 }; // stronger CMY, modest K

  // stronger mis-registration + faster drift
  const DRIFT_AMP   = 14 * dpr;  // ↑ amplitude
  const DRIFT_SPEED = 1.6;       // ↑ speed (was ~1.0–1.2)

  // tiny rotation / scale wobble for the “breathing” rosette
  const ROT_JIT = 0.035;         // ~2°
  const SCL_JIT = 0.035;         // ±3.5%

  function makeTile(rgba: string) {
    const cell = Math.round(PITCH * dpr);
    const size = cell * TILE;
    const off  = Math.floor(cell / 2);
    const t = document.createElement("canvas");
    t.width = size; t.height = size;
    const tctx = t.getContext("2d")!;
    tctx.fillStyle = rgba;
    (tctx as any).imageSmoothingEnabled = false;

    const r = Math.max(1, Math.round(cell * RATIO));
    for (let y = off; y < size + 1; y += cell) {
      for (let x = off; x < size + 1; x += cell) {
        tctx.beginPath();
        tctx.arc(x, y, r, 0, Math.PI * 2);
        tctx.fill();
      }
    }
    return t;
  }

  const tileC = makeTile(`rgba(0,255,255,${OP.C})`);
  const tileM = makeTile(`rgba(255,0,255,${OP.M})`);
  const tileY = makeTile(`rgba(255,255,0,${OP.Y})`);
  const tileK = makeTile(`rgba(0,0,0,${OP.K})`);

  const patC = ctx.createPattern(tileC, "repeat")!;
  const patM = ctx.createPattern(tileM, "repeat")!;
  const patY = ctx.createPattern(tileY, "repeat")!;
  const patK = ctx.createPattern(tileK, "repeat")!;

  // classic print angles (rosette)
  const ANG = {
    C: (75 * Math.PI) / 180,
    M: (15 * Math.PI) / 180,
    Y: ( 0 * Math.PI) / 180,
    K: (45 * Math.PI) / 180,
  };

  // base mis-registration offsets (slightly larger than before)
  const OFF = {
    C: [ 1.6 * dpr,  1.2 * dpr],
    M: [-1.3 * dpr,  1.0 * dpr],
    Y: [ 0.0,        0.0       ],
    K: [ 0.0,        0.0       ],
  } as const;

  let frameId: number | null = null;

  const drawLayer = (
    pat: CanvasPattern,
    ang: number,
    jx: number,
    jy: number,
    ox: number,
    oy: number,
    t: number,
    sBase: number,
    rotPhase: number,
    sclPhase: number
  ) => {
    ctx.save();
    ctx.globalCompositeOperation = "multiply";
    ctx.translate(jx + ox, jy + oy);
    ctx.translate(width * 0.5, height * 0.5);

    // gentle rotate + scale wobble
    const rot = ang + Math.sin(t * 0.4 + rotPhase) * ROT_JIT;
    const scl = sBase * (1 + Math.sin(t * 0.6 + sclPhase) * SCL_JIT);

    ctx.rotate(rot);
    ctx.scale(scl, scl);
    ctx.translate(-width * 0.5, -height * 0.5);

    ctx.fillStyle = pat;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  };

  const render = (tms: number) => {
    ctx.clearRect(0, 0, width, height);
    if (prefersReduced) return;

    const t = tms / 1000;
    const ox = (ph:number, sp:number)=> Math.sin(t*sp*DRIFT_SPEED + ph) * DRIFT_AMP;
    const oy = (ph:number, sp:number)=> Math.cos(t*sp*DRIFT_SPEED + ph) * DRIFT_AMP;

    // vary base scales per plate slightly to encourage moiré
    drawLayer(patC, ANG.C, ox(0.0, 0.8), oy(1.3, 0.9), OFF.C[0], OFF.C[1], t, 2.18, 0.0, 1.1);
    drawLayer(patM, ANG.M, ox(1.2, 1.0), oy(2.1, 1.1), OFF.M[0], OFF.M[1], t, 2.22, 1.7, 2.4);
    drawLayer(patY, ANG.Y, ox(2.4, 1.2), oy(0.6, 0.7), OFF.Y[0], OFF.Y[1], t, 2.26, 2.3, 3.1);
    drawLayer(patK, ANG.K, ox(0.7, 0.6), oy(2.7, 0.5), OFF.K[0], OFF.K[1], t, 2.20, 0.9, 0.2);

    frameId = requestAnimationFrame(render);
  };

  const start = () => { if (frameId) cancelAnimationFrame(frameId); frameId = requestAnimationFrame(render); };
  const onResize = () => { resizeCanvas(); start(); };
  const onReduce = (e: MediaQueryListEvent) => { prefersReduced = e.matches; start(); };
  const onVisibility = () => { if (document.hidden && frameId){ cancelAnimationFrame(frameId); frameId = null; } else start(); };

  start();
  window.addEventListener("resize", onResize, { passive: true });
  mediaQuery.addEventListener?.("change", onReduce);
  mediaQuery.addListener?.(onReduce);
  document.addEventListener("visibilitychange", onVisibility);

  return () => {
    if (frameId) cancelAnimationFrame(frameId);
    window.removeEventListener("resize", onResize);
    mediaQuery.removeEventListener?.("change", onReduce);
    mediaQuery.removeListener?.(onReduce);
    document.removeEventListener("visibilitychange", onVisibility);
  };
}
