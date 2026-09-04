'use client';

import { useEffect } from "react";
import sfx from "@/lib/sfx";

// Effects cannot play before a user gesture, so there is no reason to fetch
// and decode them on page load (the old eager init cost every visitor
// ~500 KB of WAV before first paint). Warm the buffers on the first
// pointer/key event instead; a session with no interaction pays nothing.
export default function SfxInitializer() {
  useEffect(() => {
    let done = false;
    const opts: AddEventListenerOptions = { capture: true, passive: true };
    const cleanup = () => {
      window.removeEventListener("pointerdown", warm, opts);
      window.removeEventListener("keydown", warm, opts);
      window.removeEventListener("touchstart", warm, opts);
    };
    function warm() {
      if (done) return;
      done = true;
      cleanup();
      void sfx.init();
    }
    window.addEventListener("pointerdown", warm, opts);
    window.addEventListener("keydown", warm, opts);
    window.addEventListener("touchstart", warm, opts);
    return cleanup;
  }, []);

  return null;
}
