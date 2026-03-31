const LOREBOARD_URL =
  process.env.GOLDSKY_LOREBOARD_URL ||
  "https://api.goldsky.com/api/public/project_cmkwd7dgh0bq501z7fog65iag/subgraphs/foid-loreboard-fluent-testnet/1.0.0/gn";

console.log("[goldsky] LOREBOARD_URL:", JSON.stringify(LOREBOARD_URL));
console.log("[goldsky] env GOLDSKY_LOREBOARD_URL:", JSON.stringify(process.env.GOLDSKY_LOREBOARD_URL));

export type Proposal = {
  proposalId: string;
  proposer: string;
  ipfsCid: string;
  x: number;
  y: number;
  w: number;
  h: number;
  votingEndsAt: string;
  finalized: boolean;
  approved: boolean;
  weightFor: string;
  weightAgainst: string;
  voteCount: number;
  blockTimestamp: string;
};

export type VoteCast = {
  id: string;
  voter: string;
  approve: boolean;
  weight: string;
  blockTimestamp: string;
  proposal: { proposalId: string };
};

export type LoreboardEvents = {
  proposals: Proposal[];
  votes: VoteCast[];
};

async function gqlPost<T>(url: string, query: string): Promise<T> {
  console.log("[goldsky] fetching URL:", url);
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

  const data = await gqlPost<{
    proposals: Proposal[];
    votes: VoteCast[];
  }>(
    LOREBOARD_URL,
    `{
      proposals(
        first: 100
        orderBy: blockTimestamp
        orderDirection: desc
        where: { blockTimestamp_gte: "${ts}" }
      ) {
        proposalId
        proposer
        ipfsCid
        x y w h
        votingEndsAt
        finalized
        approved
        weightFor
        weightAgainst
        voteCount
        blockTimestamp
      }
      votes(
        first: 200
        orderBy: blockTimestamp
        orderDirection: desc
        where: { blockTimestamp_gte: "${ts}" }
      ) {
        id
        voter
        approve
        weight
        blockTimestamp
        proposal { proposalId }
      }
    }`
  );

  return {
    proposals: data.proposals ?? [],
    votes: data.votes ?? [],
  };
}

export async function getVoteTallies(proposalIds: string[]): Promise<Map<string, { yes: number; no: number }>> {
  if (proposalIds.length === 0) return new Map();

  const idList = proposalIds.map((id) => `"${id}"`).join(", ");

  const data = await gqlPost<{ votes: VoteCast[] }>(
    LOREBOARD_URL,
    `{
      votes(
        first: 1000
        where: { proposal_in: [${idList}] }
      ) {
        approve
        weight
        proposal { proposalId }
      }
    }`
  );

  const tallies = new Map<string, { yes: number; no: number }>();
  for (const vote of data.votes ?? []) {
    const pid = vote.proposal.proposalId;
    const existing = tallies.get(pid) ?? { yes: 0, no: 0 };
    if (vote.approve) {
      existing.yes += Number(vote.weight);
    } else {
      existing.no += Number(vote.weight);
    }
    tallies.set(pid, existing);
  }
  return tallies;
}
