"use client";

import Link from "next/link";
import { useCallback } from "react";
import sfx from "@/lib/sfx";

interface SacredPortalProps {
  href: string;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  className?: string;
}

export default function SacredPortal({
  href,
  title,
  subtitle,
  icon,
  className = "",
}: SacredPortalProps) {
  const handleMouseEnter = useCallback(() => {
    // Play subtle hover sound
    sfx.playLoading?.();
  }, []);

  const handleClick = useCallback(() => {
    // Play click sound
    sfx.playReward?.();
  }, []);

  return (
    <Link
      href={href}
      className={`sacred-portal ${className}`}
      onMouseEnter={handleMouseEnter}
      onClick={handleClick}
    >
      {icon && <div className="sacred-portal__icon">{icon}</div>}
      <h2 className="sacred-portal__title">{title}</h2>
      {subtitle && <p className="sacred-portal__subtitle">{subtitle}</p>}
    </Link>
  );
}
