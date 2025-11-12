// src/server/boardStore.ts
export type Placement = {
  id: string;
  owner: string;
  cid: string;
  x: number;
  y: number;
  w: number;
  h: number;
  cells: number;
  bidPerCellWei: string; // string for easy JSON
};

export type Manifest = {
  epoch: number;
  finalizedAt: string; // ISO string
  placements: Placement[];
  cid?: string; // optional IPFS CID of manifest.json
};

let manifestsByEpoch = new Map<number, Manifest>();
let latestEpoch: number | null = null;

export function setManifest(m: Manifest) {
  manifestsByEpoch.set(m.epoch, m);
  if (latestEpoch === null || m.epoch > latestEpoch) latestEpoch = m.epoch;
}

export function getManifestByEpoch(epoch: number): Manifest | null {
  return manifestsByEpoch.get(epoch) ?? null;
}

export function getLatestManifest(): Manifest | null {
  return latestEpoch == null ? null : manifestsByEpoch.get(latestEpoch) ?? null;
}

export function getLatestEpoch(): number | null {
  return latestEpoch;
}

// For first boot/demo: ensure there is at least an empty epoch 0.
export function seedManifestIfEmpty() {
  if (latestEpoch == null) {
    const seed: Manifest = {
      epoch: 0,
      finalizedAt: new Date().toISOString(),
      placements: [],
    };
    setManifest(seed);
  }
}
