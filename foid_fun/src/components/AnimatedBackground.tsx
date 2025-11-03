"use client";

import { useEffect, useRef } from "react";

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

    const glCanvas = document.createElement("canvas");
    glCanvas.className = "foid-bg-layer foid-bg-layer--gl";
    const fxCanvas = document.createElement("canvas");
    fxCanvas.className = "foid-bg-layer foid-bg-layer--fx";

    container.appendChild(glCanvas);
    container.appendChild(fxCanvas);

    const disposeGl = setupWebGL(glCanvas);
    const disposeFx = setupFX(fxCanvas);

    return () => {
      disposeGl?.();
      disposeFx?.();
      container.innerHTML = "";
    };
  }, []);

  return <div ref={containerRef} className="foid-background" aria-hidden="true" />;
}

function setupWebGL(canvas: HTMLCanvasElement): Cleanup | undefined {
  const gl = canvas.getContext("webgl", {
    antialias: true,
    depth: false,
    stencil: false,
    alpha: true,
    premultipliedAlpha: true,
  });

  if (!gl) {
    console.warn("WebGL not available; skipping animated background.");
    return undefined;
  }

  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  const resize = () => {
    const width = Math.floor(window.innerWidth * dpr);
    const height = Math.floor(window.innerHeight * dpr);
    if (canvas.width === width && canvas.height === height) return;
    canvas.width = width;
    canvas.height = height;
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
    gl.viewport(0, 0, width, height);
  };

  resize();
  window.addEventListener("resize", resize, { passive: true });

  const vertexSource = `
    attribute vec2 a_position;
    void main(){
      gl_Position = vec4(a_position, 0.0, 1.0);
    }
  `;

  const fragmentSource = `
    precision highp float;
    uniform vec2 u_res;
    uniform float u_time;

    const vec3 COL_AQUA = vec3(0.447, 0.882, 1.000);
    const vec3 COL_CYAN = vec3(0.000, 0.816, 1.000);
    const vec3 COL_PERI = vec3(0.561, 0.667, 0.949);
    const vec3 COL_LAV  = vec3(0.804, 0.718, 1.000);
    const vec3 COL_PINK = vec3(1.000, 0.702, 0.851);
    const vec3 COL_MINT = vec3(0.659, 0.941, 0.820);
    const vec3 COL_TANG = vec3(1.000, 0.647, 0.322);
    const vec3 COL_OCEAN= vec3(0.043, 0.180, 0.306);
    const vec3 COL_NITE = vec3(0.055, 0.059, 0.169);

    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453123); }
    float noise(vec2 p){
      vec2 i = floor(p);
      vec2 f = fract(p);
      float a = hash(i);
      float b = hash(i + vec2(1.0,0.0));
      float c = hash(i + vec2(0.0,1.0));
      float d = hash(i + vec2(1.0,1.0));
      vec2 u = f*f*(3.0-2.0*f);
      return mix(a,b,u.x) + (c - a)*u.y*(1.0-u.x) + (d - b)*u.x*u.y;
    }
    float fbm(vec2 p){
      float v = 0.0;
      float a = 0.5;
      mat2 m = mat2(0.8, -0.6, 0.6, 0.8);
      for(int i=0;i<6;i++) {
        v += a * noise(p);
        p = m * p * 2.02;
        a *= 0.5;
      }
      return v;
    }

    float sparkle(vec2 p, float t){
      float n = fbm(p*18.0 + vec2(0.0, t*0.8));
      n = smoothstep(0.92, 1.0, n);
      return pow(n, 3.0);
    }

    void main(){
      vec2 uv = gl_FragCoord.xy / u_res;
      vec2 p = (gl_FragCoord.xy - 0.5*u_res) / min(u_res.x, u_res.y);

      float t = u_time;

      float gy = smoothstep(-0.8, 0.9, p.y);
      vec3 base = mix(COL_NITE, COL_OCEAN, gy);

      vec2 q = vec2(
        fbm( (p*1.6 + vec2(0.0, t*0.07)) * 3.0 ),
        fbm( (p*1.6 - vec2(0.0, t*0.06)) * 3.0 )
      );
      float c = fbm(p*7.0 + 4.0*q + vec2(t*0.12, -t*0.10));
      float caustic = smoothstep(0.72, 0.97, c);

      float rays = smoothstep(0.0,1.0, 0.5 + 0.5*sin((p.x*2.8 - p.y*1.8) - t*0.4));
      rays = pow(rays, 4.0) * 0.35;

      vec3 tint1 = mix(COL_PERI, COL_LAV, smoothstep(0.0,1.0,uv.y));
      vec3 tint2 = mix(COL_AQUA, COL_MINT, smoothstep(0.0,1.0,uv.x));
      vec3 tint = mix(tint1, tint2, 0.5 + 0.5*sin(t*0.2));

      float spec = pow(caustic, 1.7);
      float glit = sparkle(p + q*0.15, t) * 0.8;

      vec3 col = base;
      col = mix(col, col + tint*0.65, 0.6);
      col += COL_CYAN * spec * 0.65;
      col += COL_PINK * glit * 0.45;
      col += COL_TANG * (spec*glit) * 0.15;
      col += rays * 0.25;

      col *= (0.98 + 0.02*sin(p.x*6.2831));

      col = pow(col, vec3(0.95));
      gl_FragColor = vec4(col, 1.0);
    }
  `;

  const compile = (type: number, source: string) => {
    const shader = gl.createShader(type);
    if (!shader) return undefined;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return undefined;
    }
    return shader;
  };

  const vertexShader = compile(gl.VERTEX_SHADER, vertexSource);
  const fragmentShader = compile(gl.FRAGMENT_SHADER, fragmentSource);
  if (!vertexShader || !fragmentShader) {
    window.removeEventListener("resize", resize);
    return undefined;
  }

  const program = gl.createProgram();
  if (!program) {
    window.removeEventListener("resize", resize);
    return undefined;
  }
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(program));
    window.removeEventListener("resize", resize);
    return undefined;
  }

  gl.useProgram(program);

  const positionLoc = gl.getAttribLocation(program, "a_position");
  const resolutionLoc = gl.getUniformLocation(program, "u_res");
  const timeLoc = gl.getUniformLocation(program, "u_time");

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
    gl.STATIC_DRAW,
  );
  gl.enableVertexAttribArray(positionLoc);
  gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

  const mediaQuery = createMatchMedia("(prefers-reduced-motion: reduce)");
  let reducedMotion = mediaQuery.matches;
  let frameId: number | null = null;
  const start = performance.now();

  const render = () => {
    const elapsed = (performance.now() - start) / 1000;
    gl.uniform2f(resolutionLoc, canvas.width, canvas.height);
    gl.uniform1f(timeLoc, elapsed);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    if (!reducedMotion) {
      frameId = requestAnimationFrame(render);
    }
  };

  render();

  const handlePrefersReduce = (event: MediaQueryListEvent) => {
    reducedMotion = event.matches;
    if (reducedMotion) {
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
        frameId = null;
      }
      render();
    } else if (frameId === null) {
      frameId = requestAnimationFrame(render);
    }
  };

  mediaQuery.addEventListener?.("change", handlePrefersReduce);
  mediaQuery.addListener?.(handlePrefersReduce);

  return () => {
    if (frameId !== null) cancelAnimationFrame(frameId);
    window.removeEventListener("resize", resize);
    mediaQuery.removeEventListener?.("change", handlePrefersReduce);
    mediaQuery.removeListener?.(handlePrefersReduce);
  };
}

interface Bubble {
  x: number;
  y: number;
  r: number;
  vy: number;
  sway: number;
  phase: number;
}

interface Sparkle {
  x: number;
  y: number;
  alpha: number;
  size: number;
}

function setupFX(canvas: HTMLCanvasElement): Cleanup | undefined {
  const ctx = canvas.getContext("2d");
  if (!ctx) return undefined;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  let width = 0;
  let height = 0;

  const resizeCanvas = () => {
    width = Math.floor(window.innerWidth * dpr);
    height = Math.floor(window.innerHeight * dpr);
    canvas.width = width;
    canvas.height = height;
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
  };

  resizeCanvas();

  const mediaQuery = createMatchMedia("(prefers-reduced-motion: reduce)");
  let prefersReduced = mediaQuery.matches;

  const random = (min: number, max: number) => min + Math.random() * (max - min);

  const bubbles: Bubble[] = [];
  const sparkles: Sparkle[] = [];

  const populateBubbles = () => {
    bubbles.length = 0;
    if (prefersReduced) return;
    const density = Math.round((window.innerWidth * window.innerHeight) / 25000);
    const count = Math.min(density, 160);
    for (let i = 0; i < count; i += 1) {
      bubbles.push({
        x: random(0, width),
        y: random(height * 0.2, height),
        r: random(6, 26) * dpr,
        vy: random(-35, -12) * dpr * (1 / 60),
        sway: random(0.6, 1.6) * dpr * (1 / 60),
        phase: random(0, Math.PI * 2),
      });
    }
  };


  const populateSparkles = () => {
    sparkles.length = 0;
    if (prefersReduced) return;
    const density = Math.round((window.innerWidth * window.innerHeight) / 60000);
    const count = Math.min(density, 100);
    for (let i = 0; i < count; i += 1) {
      sparkles.push({
        x: random(0, width),
        y: random(0, height),
        alpha: random(0.08, 0.25),
        size: random(0.7, 1.8) * dpr,
      });
    }
  };

  const drawStatic = () => {
    ctx.clearRect(0, 0, width, height);
    ctx.globalCompositeOperation = "screen";
    ctx.fillStyle = "rgba(255,179,217,0.12)";
    for (let i = 0; i < 14; i += 1) {
      const x = random(0, width);
      const y = random(0, height);
      const r = random(0.3, 1.5) * dpr;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  };

  let frameId: number | null = null;
  let last = performance.now();

  const renderFrame = (time: number) => {
    const dt = Math.min(33, time - last);
    last = time;
    ctx.clearRect(0, 0, width, height);
    ctx.globalCompositeOperation = "screen";

    for (const bubble of bubbles) {
      bubble.phase += bubble.sway * dt * 0.015;
      bubble.x += Math.sin(bubble.phase) * 0.4;
      bubble.y += bubble.vy * (dt / 16.67);
      if (bubble.y < -bubble.r) {
        bubble.y = height + bubble.r * 2;
        bubble.x = random(0, width);
      }

      const gradient = ctx.createRadialGradient(
        bubble.x,
        bubble.y,
        bubble.r * 0.1,
        bubble.x,
        bubble.y,
        bubble.r,
      );
      gradient.addColorStop(0, "rgba(255,255,255,0.35)");
      gradient.addColorStop(0.4, "rgba(0,208,255,0.20)");
      gradient.addColorStop(1, "rgba(255,255,255,0.00)");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(bubble.x, bubble.y, bubble.r, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const sparkle of sparkles) {
      const twinkle =
        0.5 + 0.5 * Math.sin(time * 0.003 + sparkle.x * 0.01 + sparkle.y * 0.01);
      ctx.globalAlpha = sparkle.alpha * twinkle;
      ctx.fillStyle = "rgba(255,179,217,1)";
      ctx.beginPath();
      ctx.arc(sparkle.x, sparkle.y, sparkle.size, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
    frameId = requestAnimationFrame(renderFrame);
  };

  const startAnimation = () => {
    if (frameId !== null) {
      cancelAnimationFrame(frameId);
      frameId = null;
    }
    if (prefersReduced) {
      drawStatic();
      return;
    }
    last = performance.now();
    frameId = requestAnimationFrame(renderFrame);
  };

  const handleResize = () => {
    resizeCanvas();
    populateBubbles();
    populateSparkles();
    startAnimation();
  };

  const handlePrefersReduceFx = (event: MediaQueryListEvent) => {
    prefersReduced = event.matches;
    populateBubbles();
    populateSparkles();
    startAnimation();
  };

  const handleVisibility = () => {
    if (document.hidden) {
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
        frameId = null;
      }
    } else {
      startAnimation();
    }
  };

  populateBubbles();
  populateSparkles();
  startAnimation();

  window.addEventListener("resize", handleResize, { passive: true });
  mediaQuery.addEventListener?.("change", handlePrefersReduceFx);
  mediaQuery.addListener?.(handlePrefersReduceFx);
  document.addEventListener("visibilitychange", handleVisibility);

  return () => {
    if (frameId !== null) cancelAnimationFrame(frameId);
    window.removeEventListener("resize", handleResize);
    mediaQuery.removeEventListener?.("change", handlePrefersReduceFx);
    mediaQuery.removeListener?.(handlePrefersReduceFx);
    document.removeEventListener("visibilitychange", handleVisibility);
  };
}
