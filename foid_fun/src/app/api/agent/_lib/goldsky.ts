const BOARD_V1_URL =
  process.env.GOLDSKY_BOARD_V1_URL ||
  "https://api.goldsky.com/api/public/project_cmkwd7dgh0bq501z7fog65iag/subgraphs/foid-loreboard-fluent-testnet/2.0.2/gn";

const BOARD_V2_URL =
  process.env.GOLDSKY_BOARD_V2_URL ||
  process.env.GOLDSKY_BOARD_URL ||
  "https://api.goldsky.com/api/public/project_cmkwd7dgh0bq501z7fog65iag/subgraphs/foid-loreboard-fluent-testnet/2.0.0/gn";

const VOTING_URL =
  process.env.GOLDSKY_VOTING_URL ||
  "https://api.goldsky.com/api/public/project_cmkwd7dgh0bq501z7fog65iag/subgraphs/foid-loreboard-fluent-testnet/2.0.1/gn";

async function gqlPost<T>(url: string, query: string, variables?: Record<string, unknown>): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`Goldsky ${res.status}: ${await res.text()}`);
  const json = await res.json();
  if (json.errors?.length) throw new Error(`Goldsky GQL: ${JSON.stringify(json.errors)}`);
  return json.data;
}

export type PlacementRow = {
  id: string;
  idParam: string;
  bidder: string;
  epoch: string;
  x: string;
  y: string;
  w: string;
  h: string;
  bidPerCellWei: string;
  cidHash: string;
};

export type VoteRecord = {
  id: string;
  epochId: string;
  placementId: string;
  voter: string;
  support: boolean;
  weight: string;
};

export type PendingRecord = {
  id: string;
  epochId: string;
  placementId: string;
  registeredAt: string;
  voteEndsAt: string;
};

export type EpochFinalizedRecord = {
  id: string;
  epochId: string;
  timestamp_: string;
};

export async function fetchProposals(owner?: string): Promise<PlacementRow[]> {
  const ownerFilter = owner ? `where: { bidder: "${owner.toLowerCase()}" }` : "";
  const query = `{
    placementProposeds(first: 1000, orderBy: epoch, orderDirection: desc, ${ownerFilter}) {
      id idParam bidder epoch x y w h bidPerCellWei cidHash
    }
  }`;

  const [v1, v2] = await Promise.allSettled([
    gqlPost<{ placementProposeds: PlacementRow[] }>(BOARD_V1_URL, query),
    gqlPost<{ placementProposeds: PlacementRow[] }>(BOARD_V2_URL, query),
  ]);

  const v1Rows = v1.status === "fulfilled" ? v1.value.placementProposeds : [];
  const v2Rows = v2.status === "fulfilled" ? v2.value.placementProposeds : [];

  // Dedupe preferring v2
  const map = new Map<string, PlacementRow>();
  for (const r of v1Rows) map.set(r.id, r);
  for (const r of v2Rows) map.set(r.id, r);
  return Array.from(map.values());
}

export async function fetchVotingData(): Promise<{
  pending: PendingRecord[];
  votes: VoteRecord[];
}> {
  const data = await gqlPost<{
    pendingPlacementRegistereds: PendingRecord[];
    voteCasts: VoteRecord[];
  }>(VOTING_URL, `{
    pendingPlacementRegistereds(first: 1000, orderBy: epochId, orderDirection: asc) {
      id epochId placementId registeredAt voteEndsAt
    }
    voteCasts(first: 1000, orderBy: epochId, orderDirection: asc) {
      id epochId placementId voter support weight
    }
  }`);

  return {
    pending: data.pendingPlacementRegistereds ?? [],
    votes: data.voteCasts ?? [],
  };
}

export async function fetchVotesByVoter(voter: string): Promise<VoteRecord[]> {
  const data = await gqlPost<{ voteCasts: VoteRecord[] }>(
    VOTING_URL,
    `{
      voteCasts(first: 1000, where: { voter: "${voter.toLowerCase()}" }, orderBy: epochId, orderDirection: desc) {
        id epochId placementId voter support weight
      }
    }`
  );
  return data.voteCasts ?? [];
}

export async function fetchEpochFinalizations(): Promise<EpochFinalizedRecord[]> {
  const data = await gqlPost<{ epochFinalizeds: EpochFinalizedRecord[] }>(
    VOTING_URL,
    `{
      epochFinalizeds(first: 50, orderBy: timestamp_, orderDirection: desc) {
        id epochId timestamp_
      }
    }`
  );
  return data.epochFinalizeds ?? [];
}
