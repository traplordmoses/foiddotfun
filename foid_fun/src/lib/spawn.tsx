// src/lib/spawn.tsx
"use client";
import { createRoot } from "react-dom/client";
import React from "react";

export function spawn(el: React.ReactNode, ttl = 2000) {
  const mount = document.createElement("div");
  document.body.appendChild(mount);
  const root = createRoot(mount);
  const unmount = () => { root.unmount(); mount.remove(); };
  root.render(<>{el}</>);
  if (ttl) setTimeout(unmount, ttl);
  return unmount;
}
