"use client";

interface ExtrasGlyphProps {
  onClick: () => void;
}

export default function ExtrasGlyph({ onClick }: ExtrasGlyphProps) {
  return (
    <button
      className="extras-glyph"
      onClick={onClick}
      aria-label="Open extras menu"
      type="button"
    >
      {"//extras"}
    </button>
  );
}
