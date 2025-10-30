interface StampProps {
  text?: string;
  className?: string;
}

export function Stamp({ text = "APPROVED", className = "" }: StampProps) {
  return (
    <div
      className={`select-none inline-block border-2 border-red-600 text-red-600 rotate-[-8deg] px-3 py-1 tracking-widest [font-family:ui-monospace,monospace] opacity-80 mix-blend-multiply ${className}`}
    >
      {text}
    </div>
  );
}
