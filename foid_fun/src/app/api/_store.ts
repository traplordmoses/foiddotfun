// Server-only in-memory store for demo
import { type Rect } from "@/lib/grid";
import { currentEpoch } from "@/lib/epoch";

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

if (!g.__REFERENDUM_STORE__) {
  g.__REFERENDUM_STORE__ = {
    accepted: [],
    proposals: [],
    latestManifest: null,
    latestManifestCID: null,
    manifestHistory: new Map<number, ManifestEntry>(),
    yesThreshold: Number(process.env.NEXT_PUBLIC_YES_THRESHOLD ?? 0.51),
    quorum: Number(process.env.NEXT_PUBLIC_QUORUM ?? 5),
    voteWindowEpochs: Number(process.env.NEXT_PUBLIC_VOTE_WINDOW_EPOCHS ?? 2),
  } satisfies StoreShape;
}

const S = g.__REFERENDUM_STORE__!;

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
}

export function latestManifestCID() {
  return S.latestManifestCID;
}

export function manifestForEpoch(epoch: number | "latest") {
  if (epoch === "latest") {
    if (!S.latestManifest) return null;
    const cid = S.latestManifestCID;
    return { epoch: S.latestManifest.epoch, manifest: S.latestManifest, cid };
    }
  if (!Number.isFinite(epoch)) return null;
  const entry = S.manifestHistory.get(epoch);
  if (!entry) return null;
  return { epoch, manifest: entry.manifest, cid: entry.cid };
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
