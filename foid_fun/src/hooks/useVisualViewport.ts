"use client";
import { useEffect } from "react";
/** Reserve the real visible screen when mobile browsers open a keyboard. */
export function useVisualViewport() {
  useEffect(() => {
    const viewport = window.visualViewport;
    let frame = 0;
    const update = () => {
      const height = viewport?.height ?? window.innerHeight;
      const editable = document.activeElement?.matches("input, textarea, [contenteditable=true]");
      const keyboard = Boolean(editable && window.innerHeight - height > 150);
      document.documentElement.style.setProperty("--foid-visible-height", `${height}px`);
      document.documentElement.toggleAttribute("data-foid-keyboard", keyboard);
      cancelAnimationFrame(frame);
      if (editable && window.innerWidth < 1024) frame = requestAnimationFrame(() => {
        (document.activeElement?.closest(".foid-cli__composer") ?? document.activeElement)?.scrollIntoView({ block: "nearest" });
      });
    };
    update();
    viewport?.addEventListener("resize", update);
    window.addEventListener("resize", update);
    document.addEventListener("focusin", update);
    document.addEventListener("focusout", update);
    return () => {
      cancelAnimationFrame(frame);
      viewport?.removeEventListener("resize", update);
      window.removeEventListener("resize", update);
      document.removeEventListener("focusin", update);
      document.removeEventListener("focusout", update);
      document.documentElement.style.removeProperty("--foid-visible-height");
      document.documentElement.removeAttribute("data-foid-keyboard");
    };
  }, []);
}
