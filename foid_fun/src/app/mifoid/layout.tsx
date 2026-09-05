import type { ReactNode } from "react";
import { routeMetadata } from "@/lib/routeMetadata";

export const metadata = routeMetadata({
  title: "MiFOID",
  description:
    "3,333 MiFOIDs, born not generated. Agent-rendered identity NFTs with a governance boost on the Loreboard.",
  path: "/mifoid",
  card: "mifoid",
});

export default function MifoidLayout({ children }: { children: ReactNode }) {
  return children;
}
