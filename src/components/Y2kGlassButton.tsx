"use client";

import Link from "next/link";
import { ReactNode, useState, MouseEvent } from "react";

function prettyLabel(raw: string) {
  return raw.replaceAll("_", " ");
}

type Props = {
  href: string;
  label: string;
  icon?: ReactNode;
  variant?: "pink" | "secondary";
};

export default function Y2kGlassButton({
  href,
  label,
  icon,
  variant = "pink",
}: Props) {
  const text = prettyLabel(label);
  const [mousePos, setMousePos] = useState({ x: 0.5, y: 0.5 });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = (e: MouseEvent<HTMLAnchorElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setMousePos({
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    });
  };

  const isPrimary = variant === "pink";

  return (
    <Link
      href={href}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onMouseMove={handleMouseMove}
      className={[
        "group relative block w-full",
        "h-[78px] rounded-[26px]",
        "overflow-hidden",
        "px-6",
        "flex items-center justify-center",
        "transform-gpu transition-all duration-300 ease-out",
        "hover:scale-[1.02] active:scale-[0.99]",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70",
      ].join(" ")}
      style={{
        background: isPrimary
          ? `linear-gradient(135deg, 
              rgba(255, 170, 200, 0.55) 0%, 
              rgba(255, 120, 170, 0.45) 25%,
              rgba(230, 90, 150, 0.5) 50%,
              rgba(200, 70, 130, 0.55) 75%,
              rgba(170, 60, 120, 0.6) 100%)`
          : `linear-gradient(135deg, 
              rgba(230, 190, 210, 0.45) 0%, 
              rgba(210, 160, 190, 0.4) 25%,
              rgba(190, 140, 170, 0.45) 50%,
              rgba(170, 120, 150, 0.5) 75%,
              rgba(150, 100, 140, 0.55) 100%)`,
        backdropFilter: "blur(24px) saturate(1.3)",
        WebkitBackdropFilter: "blur(24px) saturate(1.3)",
        border: `1px solid ${isPrimary 
          ? "rgba(255, 210, 230, 0.5)" 
          : "rgba(230, 200, 220, 0.45)"}`,
        boxShadow: isHovered
          ? `
              0 12px 40px rgba(200, 100, 150, 0.45),
              0 6px 20px rgba(255, 150, 180, 0.35),
              inset 0 2px 4px rgba(255, 255, 255, 0.45),
              inset 0 -3px 10px rgba(150, 50, 100, 0.25),
              0 0 50px rgba(255, 150, 180, 0.25)
            `
          : `
              0 8px 28px rgba(150, 80, 120, 0.35),
              0 4px 12px rgba(200, 100, 150, 0.25),
              inset 0 2px 4px rgba(255, 255, 255, 0.35),
              inset 0 -3px 8px rgba(100, 40, 80, 0.2)
            `,
      }}
    >
      {/* Top liquid surface reflection - the key Frutiger Aero look */}
      <span
        className="pointer-events-none absolute top-0 left-0 right-0 h-[45%] rounded-t-[25px]"
        style={{
          background: `linear-gradient(180deg, 
            rgba(255, 255, 255, 0.55) 0%, 
            rgba(255, 255, 255, 0.3) 35%,
            rgba(255, 255, 255, 0.1) 60%,
            transparent 100%)`,
        }}
      />

      {/* Dynamic light refraction following mouse - like light through water */}
      <span
        className="pointer-events-none absolute inset-0 rounded-[25px] transition-opacity duration-200"
        style={{
          background: `radial-gradient(ellipse 70% 90% at ${mousePos.x * 100}% ${mousePos.y * 100}%, 
            rgba(255, 255, 255, 0.5) 0%, 
            rgba(255, 230, 245, 0.25) 35%,
            transparent 65%)`,
          opacity: isHovered ? 1 : 0,
        }}
      />

      {/* Inner glass rim */}
      <span
        className="pointer-events-none absolute inset-[2px] rounded-[24px]"
        style={{
          border: "1px solid rgba(255, 255, 255, 0.2)",
          boxShadow: "inset 0 0 25px rgba(255, 210, 230, 0.15)",
        }}
      />

      {/* Caustic light effect at bottom - like light patterns in water */}
      <span
        className="pointer-events-none absolute bottom-0 left-[15%] right-[15%] h-[30%] rounded-b-[24px]"
        style={{
          background: `radial-gradient(ellipse 100% 100% at 50% 100%, 
            rgba(255, 190, 210, 0.25) 0%, 
            transparent 70%)`,
        }}
      />

      {/* Shimmer sweep on hover */}
      <span
        className={[
          "pointer-events-none absolute -inset-y-10 left-[-70%] w-[60%]",
          "rotate-[14deg]",
          "opacity-0",
          "group-hover:opacity-100",
          "group-hover:animate-foidShine",
        ].join(" ")}
        style={{
          background:
            "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.5) 50%, rgba(255,255,255,0) 100%)",
        }}
      />

      {/* Subtle bubble highlights */}
      <span
        className="pointer-events-none absolute left-[12%] top-[22%] w-3 h-3 rounded-full"
        style={{
          background: `radial-gradient(circle at 30% 30%, 
            rgba(255, 255, 255, 0.6) 0%, 
            rgba(255, 255, 255, 0.2) 50%,
            transparent 70%)`,
          opacity: 0.7,
        }}
      />
      <span
        className="pointer-events-none absolute right-[18%] top-[28%] w-2 h-2 rounded-full"
        style={{
          background: `radial-gradient(circle at 30% 30%, 
            rgba(255, 255, 255, 0.5) 0%, 
            transparent 60%)`,
          opacity: 0.6,
        }}
      />

      {/* Edge highlight - right side refraction */}
      <span
        className="pointer-events-none absolute right-0 top-4 bottom-4 w-[2px]"
        style={{
          background: `linear-gradient(180deg, 
            transparent 0%, 
            rgba(255, 255, 255, 0.35) 25%,
            rgba(255, 255, 255, 0.15) 75%,
            transparent 100%)`,
        }}
      />

      {icon ? (
        <span
          className="absolute left-4 top-1/2 -translate-y-1/2 grid h-9 w-9 place-items-center rounded-full"
          style={{
            background: `
              radial-gradient(circle at 30% 30%, rgba(255,255,255,0.35), transparent 60%),
              linear-gradient(180deg, rgba(255,255,255,0.25) 0%, rgba(255,255,255,0.1) 100%)
            `,
            border: "1px solid rgba(255,255,255,0.25)",
            boxShadow:
              "inset 0 1px 0 rgba(255,255,255,0.4), 0 8px 16px rgba(0,0,0,0.15)",
          }}
        >
          {icon}
        </span>
      ) : null}

      <div className="w-full">
        <div
          className={[
            "mx-auto text-center",
            "text-[14px] sm:text-[15px]",
            "font-black uppercase tracking-[0.22em] leading-none",
            "select-none truncate",
          ].join(" ")}
          style={{
            color: isPrimary ? "rgba(175, 255, 225, 0.95)" : "rgba(60, 35, 50, 0.9)",
            textShadow: isPrimary
              ? "0 0 18px rgba(120,255,220,0.35), 0 2px 0 rgba(0,0,0,0.2)"
              : "0 1px 1px rgba(255, 255, 255, 0.5)",
          }}
        >
          {text}
        </div>
      </div>

      {/* Right-side liquid orb */}
      <span
        className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full"
        style={{
          background: `
            radial-gradient(circle at 30% 30%, rgba(255,255,255,0.45) 0%, transparent 55%),
            radial-gradient(circle at 70% 70%, rgba(255,180,220,0.2) 0%, transparent 50%),
            linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(255,200,220,0.1) 100%)
          `,
          border: "1px solid rgba(255,255,255,0.25)",
          boxShadow:
            "inset 0 2px 4px rgba(255,255,255,0.3), 0 8px 20px rgba(0,0,0,0.12)",
        }}
      />
    </Link>
  );
}
