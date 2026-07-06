// /enter is the front door of FOID OS — this layout exists to scope the
// boot-sequence stylesheet to the route (plain CSS: keyframes + tokens;
// styled-jsx stays inside EnterGate for the key itself).
import type { ReactNode } from "react";
import "./enter.css";

export default function EnterLayout({ children }: { children: ReactNode }) {
  return children;
}
