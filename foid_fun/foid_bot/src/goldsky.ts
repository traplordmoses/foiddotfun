const BOARD_V1_URL =
  process.env.GOLDSKY_BOARD_V1_URL ||
  "https://api.goldsky.com/api/public/project_cmkwd7dgh0bq501z7fog65iag/subgraphs/foid-loreboard-fluent-testnet/2.0.2/gn";

const VOTING_URL =
  process.env.GOLDSKY_VOTING_URL ||
  "https://api.goldsky.com/api/public/project_cmkwd7dgh0bq501z7fog65iag/subgraphs/foid-loreboard-fluent-testnet/2.0.1/gn";

export type Proposal = {
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
  block_number: string;
  timestamp_: string;
};

export type VoteCast = {
  id: string;
  epochId: string;
  placementId: string;
  voter: string;
  support: boolean;
  weight: string;
  block_number: string;
  timestamp_: string;
};

export type EpochFinalized = {
  id: string;
  epochId: string;
  block_number: string;
  timestamp_: string;
};

export type LoreboardEvents = {
  proposals: Proposal[];
  votes: VoteCast[];
  epochFinalizations: EpochFinalized[];
};

async function gqlPost<T>(url: string, query: string): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) throw new Error(`Goldsky ${res.status}: ${await res.text()}`);
  const json = await res.json();
  if (json.errors?.length) {
    throw new Error(`Goldsky GQL errors: ${JSON.stringify(json.errors)}`);
  }
  return json.data;
}

export async function fetchEventsSince(sinceTimestamp: number): Promise<LoreboardEvents> {
  const ts = String(sinceTimestamp);

  const [boardData, votingData] = await Promise.all([
    gqlPost<{
      placementProposeds: Proposal[];
    }>(
      BOARD_V1_URL,
      `{
        placementProposeds(
          first: 100
          orderBy: timestamp_
          orderDirection: desc
          where: { timestamp__gt: "${ts}" }
        ) {
          id
          idParam
          bidder
          epoch
          x y w h
          bidPerCellWei
          cidHash
          block_number
          timestamp_
        }
      }`
    ),
    gqlPost<{
      voteCasts: VoteCast[];
      epochFinalizeds: EpochFinalized[];
    }>(
      VOTING_URL,
      `{
        voteCasts(
          first: 200
          orderBy: block_number
          orderDirection: desc
          where: { timestamp__gt: "${ts}" }
        ) {
          id
          epochId
          placementId
          voter
          support
          weight
          block_number
          timestamp_
        }
        epochFinalizeds(
          first: 10
          orderBy: timestamp_
          orderDirection: desc
          where: { timestamp__gt: "${ts}" }
        ) {
          id
          epochId
          block_number
          timestamp_
        }
      }`
    ),
  ]);

  return {
    proposals: boardData.placementProposeds ?? [],
    votes: votingData.voteCasts ?? [],
    epochFinalizations: votingData.epochFinalizeds ?? [],
  };
}

export async function getVoteTallies(placementIds: string[]): Promise<Map<string, { yes: number; no: number }>> {
  if (placementIds.length === 0) return new Map();

  const idList = placementIds.map((id) => `"${id}"`).join(", ");

  const data = await gqlPost<{ voteCasts: VoteCast[] }>(
    VOTING_URL,
    `{
      voteCasts(
        first: 1000
        where: { placementId_in: [${idList}] }
      ) {
        placementId
        support
        weight
      }
    }`
  );

  const tallies = new Map<string, { yes: number; no: number }>();
  for (const vote of data.voteCasts ?? []) {
    const existing = tallies.get(vote.placementId) ?? { yes: 0, no: 0 };
    if (vote.support) {
      existing.yes += Number(vote.weight);
    } else {
      existing.no += Number(vote.weight);
    }
    tallies.set(vote.placementId, existing);
  }
  return tallies;
}
