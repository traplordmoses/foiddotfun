// /src/server/store.ts
import type { Manifest, PlacementIntent } from "@/lib/types";

type Store = {
  pendingByEpoch: Map<number, PlacementIntent[]>;
  manifests: Map<number, { cid: string | null; json: Manifest }>;
  latestEpochFinalized: number;
};

const g = globalThis as any;

if (!g.__MIFOID_STORE__) {
  g.__MIFOID_STORE__ = {
    pendingByEpoch: new Map<number, PlacementIntent[]>(),
    manifests: new Map<number, { cid: string | null; json: Manifest }>(),
    latestEpochFinalized: -1,
  } as Store;
}

const store: Store = g.__MIFOID_STORE__;

export default store;
export { store }; // (optional named re-export)
