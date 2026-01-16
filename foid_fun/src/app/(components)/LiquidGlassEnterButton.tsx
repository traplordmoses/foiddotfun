import type { ReactNode } from "react";

type LiquidGlassEnterButtonProps = {
  children?: ReactNode;
  label?: string;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
  className?: string;
  variant?: "primary" | "secondary";
};

export default function LiquidGlassEnterButton({
  children,
  label,
  onClick,
  type = "button",
  disabled,
  className,
  variant = "primary",
}: LiquidGlassEnterButtonProps) {
  const content = label ?? children;
  const variantClass = variant === "secondary" ? "liquid-enter--secondary" : "";

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`liquid-enter ${variantClass} ${className ?? ""}`}
    >
      <span className="liquid-enter__label">{content}</span>
      <span className="liquid-enter__legend" aria-hidden="true">
        ENTER <span className="liquid-enter__legend-arrow">↵</span>
      </span>
      <span className="liquid-enter__shine" aria-hidden="true" />
    </button>
  );
}
