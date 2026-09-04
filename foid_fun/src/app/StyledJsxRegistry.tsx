"use client";

// styled-jsx server registry for the App Router.
//
// Without this, every `<style jsx>` block on the site (EnterGate, the home
// launcher, PrayApp, the music deck, SkyTint, ...) is injected on the
// client only, after hydration. The server HTML paints unstyled first, and
// on a phone the 240px music deck sat in normal flow above every route's
// window until the styles landed, then jumped (0.29 CLS on /vote and
// /board, 0.71 on /pray under mobile emulation). The registry streams the
// styles with the HTML, so first paint already has them.
import React, { useState } from "react";
import { useServerInsertedHTML } from "next/navigation";
import { StyleRegistry, createStyleRegistry } from "styled-jsx";

export default function StyledJsxRegistry({ children }: { children: React.ReactNode }) {
  const [registry] = useState(() => createStyleRegistry());

  useServerInsertedHTML(() => {
    const styles = registry.styles();
    registry.flush();
    return <>{styles}</>;
  });

  return <StyleRegistry registry={registry}>{children}</StyleRegistry>;
}
