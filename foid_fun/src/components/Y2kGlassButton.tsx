"use client";

import Link from "next/link";
import { ReactNode, useState, MouseEvent } from "react";
import useAeroSounds from "./useAeroSounds";

function prettyLabel(raw: string) {
  return raw.replaceAll("_", " ");
}

type Props = {
  href: string;
  label: string;
  icon?: ReactNode;
  variant?: "pink" | "secondary";
};

const baseStyle = {
  backdropFilter: "blur(24px) saturate(1.3)",
  WebkitBackdropFilter: "blur(24px) saturate(1.3)",
};

const primaryStyle = {
  background: `linear-gradient(135deg,
    rgba(255, 210, 225, 0.62) 0%,
    rgba(255, 150, 195, 0.52) 28%,
    rgba(235, 105, 165, 0.55) 55%,
    rgba(200, 75, 140, 0.62) 78%,
    rgba(170, 55, 120, 0.68) 100%
  )`,
  border: "1px solid rgba(255, 210, 235, 0.6)",
};

const secondaryStyle = {
  background: `linear-gradient(135deg,
    rgba(245, 235, 242, 0.52) 0%,
    rgba(225, 210, 224, 0.48) 30%,
    rgba(205, 190, 208, 0.52) 60%,
    rgba(185, 170, 192, 0.58) 100%
  )`,
  border: "1px solid rgba(255, 255, 255, 0.55)",
};

const idleShadowPrimary = `
  0 14px 30px rgba(0, 10, 30, 0.28),
  0 0 34px rgba(255, 150, 190, 0.18),
  inset 0 1px 0 rgba(255, 255, 255, 0.45),
  inset 0 -10px 18px rgba(0, 0, 0, 0.16)
`;

const hoverShadowPrimary = `
  0 18px 44px rgba(0, 10, 30, 0.35),
  0 0 56px rgba(255, 150, 190, 0.26),
  inset 0 1px 0 rgba(255, 255, 255, 0.45),
  inset 0 -10px 18px rgba(0, 0, 0, 0.16)
`;

const idleShadowSecondary = `
  0 12px 26px rgba(0, 10, 30, 0.24),
  0 0 30px rgba(180, 200, 230, 0.15),
  inset 0 1px 0 rgba(255, 255, 255, 0.45),
  inset 0 -8px 16px rgba(0, 0, 0, 0.12)
`;

const hoverShadowSecondary = `
  0 16px 38px rgba(0, 10, 30, 0.3),
  0 0 46px rgba(200, 210, 245, 0.22),
  inset 0 1px 0 rgba(255, 255, 255, 0.45),
  inset 0 -8px 16px rgba(0, 0, 0, 0.12)
`;

export default function Y2kGlassButton({
  href,
  label,
  icon,
  variant = "pink",
}: Props) {
  const text = prettyLabel(label);
  const [mousePos, setMousePos] = useState({ x: 0.5, y: 0.5 });
  const [isHovered, setIsHovered] = useState(false);
  const { playHover, playClick } = useAeroSounds();

  const handleMouseMove = (e: MouseEvent<HTMLAnchorElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setMousePos({
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    });
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
    playHover();
  };

  const handleClick = () => {
    playClick();
  };

  const isPrimary = variant === "pink";
  const variantStyle = isPrimary ? primaryStyle : secondaryStyle;
  const idleShadow = isPrimary ? idleShadowPrimary : idleShadowSecondary;
  const hoverShadow = isPrimary ? hoverShadowPrimary : hoverShadowSecondary;
  const currentShadow = isHovered ? hoverShadow : idleShadow;

  return (
    <Link
      href={href}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setIsHovered(false)}
      onMouseMove={handleMouseMove}
      onClick={handleClick}
      className={[
        "group relative block w-full",
        "h-[78px] rounded-[26px]",
        "overflow-hidden",
        "px-6",
        "flex items-center justify-center",
        "transform-gpu transition-all duration-300 ease-out",
        "hover:scale-[1.02] active:scale-[0.99]",
        "hover:-translate-y-[2px] active:translate-y-[1px]",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70",
      ].join(" ")}
      style={{
        ...baseStyle,
        ...variantStyle,
        boxShadow: currentShadow,
      }}
    >
      <span
        className="pointer-events-none absolute top-0 left-0 right-0 h-[42%] rounded-t-[25px]"
        style={{
          background: `linear-gradient(180deg, 
            rgba(255, 255, 255, 0.6) 0%, 
            rgba(255, 255, 255, 0.35) 35%,
            rgba(255, 255, 255, 0.15) 60%,
            transparent 100%)`,
        }}
      />

      <span
        className="pointer-events-none absolute inset-0 rounded-[25px] transition-opacity duration-200"
        style={{
          background: `radial-gradient(ellipse 70% 90% at ${mousePos.x * 100}% ${
            mousePos.y * 100
          }%, 
            rgba(255, 255, 255, 0.42) 0%, 
            rgba(255, 230, 242, 0.25) 30%,
            transparent 55%)`,
          opacity: isHovered ? 1 : 0,
        }}
      />

      <span
        className="pointer-events-none absolute inset-[2px] rounded-[24px]"
        style={{
          border: "1px solid rgba(255, 255, 255, 0.35)",
          boxShadow:
            "inset 0 0 28px rgba(255, 255, 255, 0.25), inset 0 -2px 10px rgba(255, 255, 255, 0.18)",
        }}
      />

      <span
        className="pointer-events-none absolute bottom-0 left-[15%] right-[15%] h-[30%] rounded-b-[24px]"
        style={{
          background: `radial-gradient(ellipse 100% 100% at 50% 100%, 
            rgba(255, 190, 210, 0.25) 0%, 
            transparent 70%)`,
        }}
      />

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

      <span
        className="pointer-events-none absolute left-[12%] top-[22%] w-3 h-3 rounded-full"
        style={{
          background: `radial-gradient(circle at 30% 30%, 
            rgba(255, 255, 255, 0.55) 0%, 
            rgba(255, 255, 255, 0.2) 50%,
            transparent 70%)`,
          opacity: 0.65,
        }}
      />
      <span
        className="pointer-events-none absolute right-[18%] top-[28%] w-2 h-2 rounded-full"
        style={{
          background: `radial-gradient(circle at 30% 30%, 
            rgba(255, 255, 255, 0.5) 0%, 
            transparent 60%)`,
          opacity: 0.55,
        }}
      />

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
            color: "rgba(190, 255, 235, 0.95)",
            textShadow: "0 0 20px rgba(140,255,220,0.45), 0 2px 0 rgba(0,0,0,0.38)",
          }}
        >
          {text}
        </div>
      </div>

      <span
        className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full"
        style={{
          background: `
            radial-gradient(circle at 30% 30%, rgba(255,255,255,0.5) 0%, transparent 55%),
            radial-gradient(circle at 70% 70%, rgba(255,180,220,0.25) 0%, transparent 50%),
            linear-gradient(135deg, rgba(255,255,255,0.18) 0%, rgba(255,200,220,0.12) 100%)
          `,
          border: "1px solid rgba(255,255,255,0.28)",
          boxShadow: `
            inset 0 2px 4px rgba(255,255,255,0.35),
            inset 0 -1px 3px rgba(200,100,150,0.15),
            0 8px 20px rgba(0,0,0,0.12)
          `,
        }}
      />
    </Link>
  );
}
