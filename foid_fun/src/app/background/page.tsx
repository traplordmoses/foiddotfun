import type { Metadata } from "next";

// Bare wallpaper (used for recordings); nothing to index.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function BackgroundPage() {
  return <div className="fixed inset-0" />;
}
