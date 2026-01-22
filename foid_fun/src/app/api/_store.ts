// Server-only in-memory store for demo
import { type Rect } from "@/lib/grid";
import { currentEpoch, voteWindowEpochs } from "@/lib/epoch";
import fs from "fs";
import path from "path";

export type Placement = {
  id: string;
  owner: string;
  cid: string;
  name: string;
  mime: "image/png" | "image/jpeg";
  rect: Rect;
  cells: number;
  bidPerCellWei: string;
  width?: number;
  height?: number;
};

export type ProposalStatus = "proposed" | "accepted" | "rejected" | "expired";

export type Proposal = Placement & {
  epochSubmitted: number;
  voteEndsAtEpoch: number;
  voteEndsAtSec?: number;
  chainId?: string;
  isVotable?: boolean;
  voters: Record<string, boolean>;
  yes: number;
  no: number;
  status: ProposalStatus;
  createdAt: number;
};

export type Manifest = {
  epoch: number;
  finalizedAt: number;
  placements: Placement[];
};

export type StoredManifest = {
  epoch: number;
  placements: Placement[];
  finalizedAt: number;
  cid: string;
};

type ManifestEntry = { manifest: Manifest; cid: string | null };

type StoreShape = {
  accepted: Placement[];
  proposals: Proposal[];
  latestManifest: Manifest | null;
  latestManifestCID: string | null;
  manifestHistory: Map<number, ManifestEntry>;
  yesThreshold: number;
  quorum: number;
  voteWindowEpochs: number;
};

const g = globalThis as typeof globalThis & { __REFERENDUM_STORE__?: StoreShape };
type ManifestCache = {
  byEpoch: Map<number, StoredManifest>;
  latestEpoch: number | null;
};
const manifestGlobal = globalThis as typeof globalThis & {
  __MANIFEST_CACHE__?: ManifestCache;
};
const PERSIST_PATH = path.join(process.cwd(), ".next-cache", "manifest-latest.json");

function loadPersistedManifest(): ManifestCache {
  try {
    const raw = fs.readFileSync(PERSIST_PATH, "utf8");
    const parsed = JSON.parse(raw);
    const byEpoch = new Map<number, StoredManifest>();
    const list: StoredManifest[] = Array.isArray(parsed?.byEpoch) ? parsed.byEpoch : [];
    for (const rec of list) {
      if (rec && typeof rec.epoch === "number" && rec.cid) {
        byEpoch.set(rec.epoch, {
          ...rec,
          placements: Array.isArray(rec.placements) ? rec.placements.map(clonePlacement) : [],
        });
      }
    }
    const latestEpoch =
      typeof parsed?.latestEpoch === "number" && Number.isFinite(parsed.latestEpoch)
        ? parsed.latestEpoch
        : (list.length ? list[list.length - 1]?.epoch ?? null : null);
    return { byEpoch, latestEpoch };
  } catch {
    return { byEpoch: new Map<number, StoredManifest>(), latestEpoch: null };
  }
}

function persistManifestCache(cache: ManifestCache) {
  try {
    const dir = path.dirname(PERSIST_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const byEpochArr = Array.from(cache.byEpoch.values()).map((rec) => ({
      ...rec,
      placements: rec.placements.map(clonePlacement),
    }));
    fs.writeFileSync(
      PERSIST_PATH,
      JSON.stringify({ latestEpoch: cache.latestEpoch, byEpoch: byEpochArr }, null, 2),
      "utf8"
    );
  } catch {
    /* best-effort */
  }
}

if (!manifestGlobal.__MANIFEST_CACHE__) {
  manifestGlobal.__MANIFEST_CACHE__ = loadPersistedManifest();
}

const manifestCache = manifestGlobal.__MANIFEST_CACHE__!;

if (!g.__REFERENDUM_STORE__) {
  g.__REFERENDUM_STORE__ = {
    accepted: [],
    proposals: [],
    latestManifest: null,
    latestManifestCID: null,
    manifestHistory: new Map<number, ManifestEntry>(),
    yesThreshold: Number(process.env.NEXT_PUBLIC_YES_THRESHOLD ?? 0.51),
    quorum: Number(process.env.NEXT_PUBLIC_QUORUM ?? 5),
    voteWindowEpochs: voteWindowEpochs(),
  } satisfies StoreShape;
}

const S = g.__REFERENDUM_STORE__!;

const clonePlacement = (p: Placement): Placement => ({
  ...p,
  rect: { ...p.rect },
});

const seedManifest: StoredManifest = {
  epoch: 0,
  finalizedAt: 0,
  cid: "ipfs://bafkreieo43q5jmr4raj26fslh53px72j7iatscxodxh7ej2v7pddmzuuie",
  placements: [
    {
      id: "0x490ed285f62a371a9d211f82c3111aa1409f3b9075192eb20140d87fe10c0147",
      owner: "",
      cid: "QmXuaCr8S7JdggmS9wefhMmtiC4ePHeoAa4hfG5x7uVdpo",
      name: "beliefs.png",
      mime: "image/png",
      rect: {
        x: 0,
        y: 0,
        w: 736,
        h: 544,
      },
      cells: 391,
      bidPerCellWei: "0",
      width: 736,
      height: 544,
    },
  ],
};

if (!manifestCache.byEpoch.size) {
  manifestCache.byEpoch.set(seedManifest.epoch, {
    ...seedManifest,
    placements: seedManifest.placements.map(clonePlacement),
  });
  manifestCache.latestEpoch = seedManifest.epoch;
  persistManifestCache(manifestCache);
}

if (!S.latestManifest) {
  const manifest: Manifest = {
    epoch: seedManifest.epoch,
    finalizedAt: seedManifest.finalizedAt,
    placements: seedManifest.placements.map(clonePlacement),
  };
  S.accepted = seedManifest.placements.map(clonePlacement);
  setLatestManifest(manifest, seedManifest.cid);
}

export function getStore() {
  return S;
}

export function addProposal(
  p: Omit<Proposal, "yes" | "no" | "voters" | "status" | "createdAt">
) {
  const pr: Proposal = {
    ...p,
    voters: {},
    yes: 0,
    no: 0,
    status: "proposed",
    createdAt: Date.now(),
  };
  S.proposals.push(pr);
  return pr;
}

export function listProposals() {
  return S.proposals.slice();
}

export function listAccepted() {
  return S.accepted.slice();
}

export function replaceAccepted(next: Placement[]) {
  S.accepted = next;
}

export function setLatestManifest(m: Manifest, cid: string | null) {
  S.latestManifest = m;
  S.latestManifestCID = cid;
  S.manifestHistory.set(m.epoch, { manifest: m, cid });

  const stored: StoredManifest = {
    epoch: m.epoch,
    placements: m.placements.map(clonePlacement),
    finalizedAt: m.finalizedAt,
    cid: cid ?? "",
  };
  manifestCache.byEpoch.set(m.epoch, stored);
  const currentLatest = manifestCache.latestEpoch;
  if (currentLatest === null || m.epoch >= currentLatest) {
    manifestCache.latestEpoch = m.epoch;
  }
  persistManifestCache(manifestCache);
}

export function latestManifestCID() {
  return S.latestManifestCID;
}

export function proposalById(id: string) {
  return S.proposals.find((p) => p.id === id) ?? null;
}

export function vote(proposalId: string, voter: string, yes: boolean) {
  const p = proposalById(proposalId);
  if (!p) return null;
  p.voters[voter.toLowerCase()] = !!yes;
  const vals = Object.values(p.voters);
  p.yes = vals.filter((v) => v).length;
  p.no = vals.length - p.yes;
  return p;
}

export function gcProposals() {
  const cur = currentEpoch();
  S.proposals = S.proposals.filter(
    (p) => !(p.status !== "proposed" && p.voteEndsAtEpoch + 24 < cur)
  );
}

export function saveManifestForEpoch(
  epoch: number,
  placements: Placement[],
  finalizedAt: number,
  cid: string
) {
  const record: StoredManifest = {
    epoch,
    placements: placements.map(clonePlacement),
    finalizedAt,
    cid,
  };
  manifestCache.byEpoch.set(epoch, record);
  const currentLatest = manifestCache.latestEpoch;
  if (currentLatest === null || epoch >= currentLatest) {
    manifestCache.latestEpoch = epoch;
  }
  persistManifestCache(manifestCache);
}

export function getManifestForEpoch(epoch: number): StoredManifest | null {
  if (!Number.isFinite(epoch)) return null;
  const record = manifestCache.byEpoch.get(epoch);
  if (!record) return null;
  return {
    ...record,
    placements: record.placements.map(clonePlacement),
  };
}

export function getLatestManifest(): StoredManifest | null {
  const { latestEpoch } = manifestCache;
  if (latestEpoch == null) return null;
  return getManifestForEpoch(latestEpoch);
}

export function manifestForEpoch(epoch: number | "latest") {
  const record =
    epoch === "latest"
      ? getLatestManifest()
      : typeof epoch === "number"
      ? getManifestForEpoch(epoch)
      : null;
  if (!record) return null;
  return {
    epoch: record.epoch,
    manifest: {
      epoch: record.epoch,
      finalizedAt: record.finalizedAt,
      placements: record.placements.map(clonePlacement),
    },
    cid: record.cid,
  };
}
