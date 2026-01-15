"use client";

import { useEffect, useMemo, useState } from "react";

interface Orb {
  id: number;
  size: number;
  x: number;
  y: number;
  duration: number;
  delay: number;
  opacity: number;
}

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  duration: number;
  delay: number;
}

interface Wisp {
  id: number;
  width: number;
  height: number;
  x: number;
  y: number;
  rotation: number;
  duration: number;
  delay: number;
  hue: number;
}

export default function FloatingElements() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const orbs = useMemo<Orb[]>(
    () =>
      Array.from({ length: 12 }, (_, i) => ({
        id: i,
        size: 20 + Math.random() * 60,
        x: Math.random() * 100,
        y: Math.random() * 100,
        duration: 20 + Math.random() * 25,
        delay: Math.random() * -20,
        opacity: 0.15 + Math.random() * 0.25,
      })),
    []
  );

  const particles = useMemo<Particle[]>(
    () =>
      Array.from({ length: 30 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: 2 + Math.random() * 4,
        duration: 8 + Math.random() * 12,
        delay: Math.random() * -10,
      })),
    []
  );

  const wisps = useMemo<Wisp[]>(
    () =>
      Array.from({ length: 4 }, (_, i) => ({
        id: i,
        width: 200 + Math.random() * 300,
        height: 60 + Math.random() * 100,
        x: Math.random() * 80,
        y: 10 + Math.random() * 60,
        rotation: -15 + Math.random() * 30,
        duration: 25 + Math.random() * 20,
        delay: Math.random() * -15,
        hue: [180, 200, 280, 320][i],
      })),
    []
  );

  if (!mounted) return null;

  return (
    <div
      className="pointer-events-none fixed inset-0 overflow-hidden"
      style={{ zIndex: 2 }}
      aria-hidden="true"
    >
      {wisps.map((wisp) => (
        <div
          key={`wisp-${wisp.id}`}
          className="absolute rounded-full"
          style={{
            width: `${wisp.width}px`,
            height: `${wisp.height}px`,
            left: `${wisp.x}%`,
            top: `${wisp.y}%`,
            background: `radial-gradient(ellipse at center, 
              hsla(${wisp.hue}, 80%, 65%, 0.15) 0%, 
              hsla(${wisp.hue}, 70%, 55%, 0.08) 40%, 
              transparent 70%)`,
            filter: "blur(40px)",
            transform: `rotate(${wisp.rotation}deg)`,
            animation: `floatWisp ${wisp.duration}s ease-in-out infinite`,
            animationDelay: `${wisp.delay}s`,
          }}
        />
      ))}

      {orbs.map((orb) => (
        <div
          key={`orb-${orb.id}`}
          className="absolute rounded-full"
          style={{
            width: `${orb.size}px`,
            height: `${orb.size}px`,
            left: `${orb.x}%`,
            top: `${orb.y}%`,
            opacity: orb.opacity,
            background: `
              radial-gradient(circle at 30% 30%, 
                rgba(255, 255, 255, 0.8) 0%, 
                rgba(255, 255, 255, 0.4) 10%,
                transparent 50%),
              radial-gradient(circle at 70% 80%, 
                rgba(100, 200, 255, 0.3) 0%, 
                transparent 40%),
              radial-gradient(circle at 50% 50%, 
                rgba(150, 220, 255, 0.15) 0%, 
                rgba(100, 180, 220, 0.1) 50%,
                transparent 70%)
            `,
            boxShadow: `
              inset 0 0 ${orb.size * 0.3}px rgba(255, 255, 255, 0.3),
              inset 0 0 ${orb.size * 0.1}px rgba(255, 255, 255, 0.5),
              0 0 ${orb.size * 0.4}px rgba(100, 200, 255, 0.2)
            `,
            border: "1px solid rgba(255, 255, 255, 0.2)",
            animation: `floatOrb ${orb.duration}s ease-in-out infinite`,
            animationDelay: `${orb.delay}s`,
          }}
        />
      ))}

      {particles.map((particle) => (
        <div
          key={`particle-${particle.id}`}
          className="absolute rounded-full"
          style={{
            width: `${particle.size}px`,
            height: `${particle.size}px`,
            left: `${particle.x}%`,
            top: `${particle.y}%`,
            background: `radial-gradient(circle, 
              rgba(255, 255, 255, 0.9) 0%, 
              rgba(200, 240, 255, 0.6) 40%,
              transparent 70%)`,
            boxShadow: `0 0 ${particle.size * 2}px rgba(200, 240, 255, 0.5)`,
            animation: `floatParticle ${particle.duration}s ease-in-out infinite, 
                        sparkle ${2 + Math.random() * 2}s ease-in-out infinite`,
            animationDelay: `${particle.delay}s`,
          }}
        />
      ))}

      <style jsx>{`
        @keyframes floatOrb {
          0%,
          100% {
            transform: translate(0, 0) scale(1);
          }
          25% {
            transform: translate(${15 + Math.random() * 20}px, ${-20 - Math.random() * 30}px)
              scale(1.02);
          }
          50% {
            transform: translate(${-(10 + Math.random() * 15)}px, ${10 + Math.random() * 20}px)
              scale(0.98);
          }
          75% {
            transform: translate(${20 + Math.random() * 25}px, ${15 + Math.random() * 20}px)
              scale(1.01);
          }
        }

        @keyframes floatParticle {
          0%,
          100% {
            transform: translate(0, 0);
            opacity: 0.6;
          }
          33% {
            transform: translate(${10 + Math.random() * 20}px, ${-30 - Math.random() * 40}px);
            opacity: 1;
          }
          66% {
            transform: translate(${-(15 + Math.random() * 20)}px, ${
              -(15 + Math.random() * 25)
            }px);
            opacity: 0.8;
          }
        }

        @keyframes sparkle {
          0%,
          100% {
            opacity: 0.4;
            transform: scale(1);
          }
          50% {
            opacity: 1;
            transform: scale(1.3);
          }
        }

        @keyframes floatWisp {
          0%,
          100% {
            transform: rotate(var(--rotation, 0deg)) translateX(0) scaleX(1);
            opacity: 0.6;
          }
          50% {
            transform: rotate(var(--rotation, 0deg)) translateX(50px) scaleX(1.1);
            opacity: 0.9;
          }
        }
      `}</style>
    </div>
  );
}
