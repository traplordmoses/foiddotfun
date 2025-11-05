"use client";

import { useEffect } from "react";

const COLORS = ["#ffe066", "#ff95e2", "#8fd3ff", "#b6ffea", "#e0b3ff"];

type Particle = {
  element: HTMLSpanElement;
  life: number;
  vx: number;
  vy: number;
};

export default function FairyDustCursor() {
  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return;

    const particles: Particle[] = [];
    let pointer = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    let frameId: number | null = null;

    const spawn = (x: number, y: number) => {
      const particle = document.createElement("span");
      particle.className = "fairy-dust-particle";
      particle.style.left = `${x}px`;
      particle.style.top = `${y}px`;
      particle.style.color = COLORS[Math.floor(Math.random() * COLORS.length)];
      particle.innerHTML = "✦";

      const speed = 1 + Math.random() * 1.5;
      const angle = Math.random() * Math.PI * 2;

      const data: Particle = {
        element: particle,
        life: 60 + Math.random() * 20,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 0.5,
      };

      particles.push(data);
      document.body.appendChild(particle);
    };

    const handleMove = (event: MouseEvent) => {
      pointer = { x: event.clientX, y: event.clientY };
      spawn(pointer.x, pointer.y);
      spawn(pointer.x, pointer.y);
    };

    const handleScroll = () => {
      // keep particles aligned with page scroll
      particles.forEach((particle) => {
        const rect = particle.element.getBoundingClientRect();
        particle.element.style.left = `${rect.left + window.scrollX}px`;
        particle.element.style.top = `${rect.top + window.scrollY}px`;
      });
    };

    const step = () => {
      frameId = window.requestAnimationFrame(step);

      for (let i = particles.length - 1; i >= 0; i -= 1) {
        const particle = particles[i];
        particle.life -= 1;
        if (particle.life <= 0) {
          particle.element.remove();
          particles.splice(i, 1);
          continue;
        }

        const x = parseFloat(particle.element.style.left || "0") + particle.vx;
        const y = parseFloat(particle.element.style.top || "0") + particle.vy;

        particle.element.style.left = `${x}px`;
        particle.element.style.top = `${y}px`;
        particle.element.style.opacity = (particle.life / 80).toString();
        particle.vy += 0.02;
      }
    };

    window.addEventListener("mousemove", handleMove, { passive: true });
    window.addEventListener("scroll", handleScroll, { passive: true });
    frameId = window.requestAnimationFrame(step);

    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("scroll", handleScroll);
      if (frameId) window.cancelAnimationFrame(frameId);
      particles.forEach((particle) => particle.element.remove());
      particles.length = 0;
    };
  }, []);

  return null;
}
