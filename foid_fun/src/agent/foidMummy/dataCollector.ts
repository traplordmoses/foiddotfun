import { type Address } from "viem";
import { getClient, CONTRACTS, SUBGRAPH_URLS, PAIR_X_URL } from "./config";

// ── Types ──

export type ReportPeriod = { from: number; to: number }; // unix seconds

export type PrayerStats = {
  totalPrayersThisWeek: number;
  uniquePrayers: number;
  prayers: Array<{ wallet: string; timestamp: number }>;
  streaks: Array<{
    wallet: string;
    currentStreak: number;
    longestStreak: number;
    totalPrayers: number;
    tierLevel: number;
    tierName: string;
    votingPower: number;
  }>;
};

export type SwipeProposal = {
  id: number;
  proposer: string;
  ipfsCid: string;
  createdAt: number;
  votingEndsAt: number;
  finalized: boolean;
  canonized: boolean;
  proposalType: number; // 0=gallery, 1=loreboard
  gridX: number;
  gridY: number;
  gridW: number;
  gridH: number;
  weightFor: number;
  weightAgainst: number;
};

export type LoreboardStats = {
  proposals: SwipeProposal[];
  approved: SwipeProposal[];
  rejected: SwipeProposal[];
  totalPlacementsOnBoard: number;
  mostControversial: SwipeProposal | null;
};

export type SubgraphVote = {
  voter: string;
  placementId: string;
  support: boolean;
  weight: string;
  timestamp: number;
};

export type VotingStats = {
  totalVotesCast: number;
  subgraphVotes: SubgraphVote[];
  voterCounts: Record<string, number>;
};

export type CommunityStats = {
  activeWallets: string[];
  handleMap: Record<string, string>;
};

export type WeeklyData = {
  period: ReportPeriod;
  prayer: PrayerStats;
  loreboard: LoreboardStats;
  voting: VotingStats;
  community: CommunityStats;
};

// ── ABIs (only for RPC reads the subgraph can't provide) ──

const PRAYER_MIRROR_ABI = [
  {
    inputs: [{ name: "user", type: "address" }],
    name: "get",
    outputs: [
      { name: "currentStreak", type: "uint256" },
      { name: "longestStreak", type: "uint256" },
      { name: "totalPrayers", type: "uint256" },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;

const PRAYER_TIERS_ABI = [
  {
    inputs: [{ name: "streakDays", type: "uint256" }],
    name: "getTier",
    outputs: [
      { name: "tierLevel", type: "uint8" },
      { name: "tierName", type: "string" },
      { name: "multiplierBps", type: "uint256" },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;

const VOTING_POWER_ABI = [
  {
    inputs: [
      { name: "voter", type: "address" },
      { name: "epochId", type: "uint256" },
    ],
    name: "votingPowerOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

// ── Subgraph helpers ──

async function querySubgraph(url: string, query: string): Promise<unknown> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) throw new Error(`Subgraph error: ${res.status}`);
  const json = await res.json();
  if (json.errors) {
    throw new Error(`Subgraph query error: ${json.errors[0]?.message}`);
  }
  return json.data;
}

// ── Prayer data (subgraph primary, RPC for live streak values) ──

export async function collectPrayerData(period: ReportPeriod): Promise<PrayerStats> {
  const client = getClient();

  // PRIMARY: Query prayer subgraph for PrayerSubmitted events
  let prayers: Array<{ wallet: string; timestamp: number }> = [];
  try {
    console.log("[dataCollector] Querying prayer subgraph...");
    const data = (await querySubgraph(
      SUBGRAPH_URLS.prayer,
      `{
        prayerSubmitteds(
          first: 1000
          orderBy: timestamp
          orderDirection: desc
          where: { timestamp_gte: "${period.from}", timestamp_lte: "${period.to}" }
        ) {
          user
          timestamp
        }
      }`
    )) as { prayerSubmitteds: Array<{ user: string; timestamp: string }> };

    prayers = (data.prayerSubmitteds ?? []).map((p) => ({
      wallet: p.user.toLowerCase(),
      timestamp: Number(p.timestamp),
    }));
    console.log(`[dataCollector] Prayer subgraph returned ${prayers.length} prayers`);
  } catch (err) {
    console.warn("[dataCollector] Prayer subgraph unavailable, skipping:", (err as Error).message);
  }

  const uniqueWallets = [...new Set(prayers.map((p) => p.wallet))];

  // RPC: Fetch live streak/tier/voting power for each wallet (subgraph can't provide these)
  const streaks = await Promise.all(
    uniqueWallets.map(async (wallet) => {
      try {
        const [currentStreak, longestStreak, totalPrayers] = await client.readContract({
          address: CONTRACTS.prayerMirror,
          abi: PRAYER_MIRROR_ABI,
          functionName: "get",
          args: [wallet as Address],
        });

        const [tierLevel, tierName] = await client.readContract({
          address: CONTRACTS.prayerTiers,
          abi: PRAYER_TIERS_ABI,
          functionName: "getTier",
          args: [currentStreak],
        });

        const votingPower = await client.readContract({
          address: CONTRACTS.streakVotingPower,
          abi: VOTING_POWER_ABI,
          functionName: "votingPowerOf",
          args: [wallet as Address, 0n],
        });

        return {
          wallet,
          currentStreak: Number(currentStreak),
          longestStreak: Number(longestStreak),
          totalPrayers: Number(totalPrayers),
          tierLevel: Number(tierLevel),
          tierName: tierName as string,
          votingPower: Number(votingPower),
        };
      } catch {
        return {
          wallet,
          currentStreak: 0,
          longestStreak: 0,
          totalPrayers: 0,
          tierLevel: 0,
          tierName: "Unranked",
          votingPower: 0,
        };
      }
    })
  );

  return {
    totalPrayersThisWeek: prayers.length,
    uniquePrayers: uniqueWallets.length,
    prayers,
    streaks: streaks.sort((a, b) => b.currentStreak - a.currentStreak),
  };
}

// ── Loreboard / Swipe data (subgraph primary) ──

export async function collectLoreboardData(period: ReportPeriod): Promise<LoreboardStats> {
  // PRIMARY: Query swipe subgraph for proposals + finalization results
  const proposals: SwipeProposal[] = [];

  try {
    console.log("[dataCollector] Querying swipe subgraph for proposals...");

    // Gallery proposals
    const galleryData = (await querySubgraph(
      SUBGRAPH_URLS.swipe,
      `{
        proposeds(
          first: 100
          orderBy: blockTimestamp
          orderDirection: desc
          where: { blockTimestamp_gte: "${period.from}", blockTimestamp_lte: "${period.to}" }
        ) {
          proposalId
          proposer
          ipfsCid
          votingEndsAt
          blockTimestamp
        }
      }`
    )) as { proposeds: Array<{ proposalId: string; proposer: string; ipfsCid: string; votingEndsAt: string; blockTimestamp: string }> };

    for (const p of galleryData.proposeds ?? []) {
      proposals.push({
        id: Number(p.proposalId),
        proposer: p.proposer.toLowerCase(),
        ipfsCid: p.ipfsCid,
        createdAt: Number(p.blockTimestamp),
        votingEndsAt: Number(p.votingEndsAt),
        finalized: false,
        canonized: false,
        proposalType: 0,
        gridX: 0, gridY: 0, gridW: 0, gridH: 0,
        weightFor: 0,
        weightAgainst: 0,
      });
    }

    // Loreboard proposals
    const loreboardData = (await querySubgraph(
      SUBGRAPH_URLS.swipe,
      `{
        loreboardProposeds(
          first: 100
          orderBy: blockTimestamp
          orderDirection: desc
          where: { blockTimestamp_gte: "${period.from}", blockTimestamp_lte: "${period.to}" }
        ) {
          proposalId
          proposer
          ipfsCid
          x y w h
          votingEndsAt
          blockTimestamp
        }
      }`
    )) as { loreboardProposeds: Array<{ proposalId: string; proposer: string; ipfsCid: string; x: string; y: string; w: string; h: string; votingEndsAt: string; blockTimestamp: string }> };

    for (const p of loreboardData.loreboardProposeds ?? []) {
      // Deduplicate — a proposal might appear in both if types overlap
      if (proposals.some((ex) => ex.id === Number(p.proposalId))) continue;
      proposals.push({
        id: Number(p.proposalId),
        proposer: p.proposer.toLowerCase(),
        ipfsCid: p.ipfsCid,
        createdAt: Number(p.blockTimestamp),
        votingEndsAt: Number(p.votingEndsAt),
        finalized: false,
        canonized: false,
        proposalType: 1,
        gridX: Number(p.x), gridY: Number(p.y),
        gridW: Number(p.w), gridH: Number(p.h),
        weightFor: 0,
        weightAgainst: 0,
      });
    }

    // Finalization results
    const finalData = (await querySubgraph(
      SUBGRAPH_URLS.swipe,
      `{
        finalizeds(
          first: 100
          orderBy: blockTimestamp
          orderDirection: desc
          where: { blockTimestamp_gte: "${period.from}", blockTimestamp_lte: "${period.to}" }
        ) {
          proposalId
          canonized
          weightFor
          weightAgainst
          blockTimestamp
        }
      }`
    )) as { finalizeds: Array<{ proposalId: string; canonized: boolean; weightFor: string; weightAgainst: string }> };

    for (const f of finalData.finalizeds ?? []) {
      const match = proposals.find((p) => p.id === Number(f.proposalId));
      if (match) {
        match.finalized = true;
        match.canonized = f.canonized;
        match.weightFor = Number(f.weightFor);
        match.weightAgainst = Number(f.weightAgainst);
      }
    }

    console.log(`[dataCollector] Swipe subgraph: ${proposals.length} proposals, ${finalData.finalizeds?.length ?? 0} finalized`);
  } catch (err) {
    console.warn("[dataCollector] Swipe subgraph query failed:", (err as Error).message);
  }

  const approved = proposals.filter((p) => p.finalized && p.canonized);
  const rejected = proposals.filter((p) => p.finalized && !p.canonized);

  // Most controversial = closest to 60% threshold
  let mostControversial: SwipeProposal | null = null;
  let closestDiff = Infinity;
  for (const p of proposals) {
    if (!p.finalized) continue;
    const total = p.weightFor + p.weightAgainst;
    if (total === 0) continue;
    const pct = p.weightFor / total;
    const diff = Math.abs(pct - 0.6);
    if (diff < closestDiff) {
      closestDiff = diff;
      mostControversial = p;
    }
  }

  // Count claimed placements from subgraph
  let totalPlacementsOnBoard = 0;
  try {
    const claimedData = (await querySubgraph(
      SUBGRAPH_URLS.swipe,
      `{ placementClaimeds(first: 1000) { id } }`
    )) as { placementClaimeds: Array<{ id: string }> };
    totalPlacementsOnBoard = claimedData.placementClaimeds?.length ?? 0;
  } catch {
    // not critical
  }

  return {
    proposals,
    approved,
    rejected,
    totalPlacementsOnBoard,
    mostControversial,
  };
}

// ── Voting data (legacy subgraph for loreboard votes) ──

export async function collectVotingData(period: ReportPeriod): Promise<VotingStats> {
  const sinceTs = period.from.toString();
  let subgraphVotes: SubgraphVote[] = [];

  // Legacy loreboard votes from existing subgraph
  try {
    const data = (await querySubgraph(
      SUBGRAPH_URLS.voting,
      `{
        voteCasts(
          first: 1000
          orderBy: timestamp_
          orderDirection: desc
          where: { timestamp__gt: "${sinceTs}" }
        ) {
          voter placementId support weight timestamp_
        }
      }`
    )) as { voteCasts: Array<{ voter: string; placementId: string; support: boolean; weight: string; timestamp_: string }> };

    subgraphVotes = (data.voteCasts ?? []).map((v) => ({
      voter: v.voter.toLowerCase(),
      placementId: v.placementId,
      support: v.support,
      weight: v.weight,
      timestamp: Number(v.timestamp_),
    }));
  } catch (err) {
    console.warn("[dataCollector] Legacy voting subgraph query failed:", (err as Error).message);
  }

  const voterCounts: Record<string, number> = {};
  for (const v of subgraphVotes) {
    voterCounts[v.voter] = (voterCounts[v.voter] ?? 0) + 1;
  }

  return {
    totalVotesCast: subgraphVotes.length,
    subgraphVotes,
    voterCounts,
  };
}

// ── Community stats ──

export async function collectCommunityStats(
  prayerWallets: string[],
  proposerWallets: string[],
  voterWallets: string[]
): Promise<CommunityStats> {
  const allWallets = [...new Set([...prayerWallets, ...proposerWallets, ...voterWallets])];

  let handleMap: Record<string, string> = {};
  if (allWallets.length > 0) {
    try {
      const batchSize = 100;
      for (let i = 0; i < allWallets.length; i += batchSize) {
        const batch = allWallets.slice(i, i + batchSize);
        const res = await fetch(`${PAIR_X_URL}?wallets=${batch.join(",")}`);
        if (res.ok) {
          const data = await res.json();
          handleMap = { ...handleMap, ...data };
        }
      }
    } catch {
      // X handle lookup is best-effort
    }
  }

  return { activeWallets: allWallets, handleMap };
}

// ── Main collector ──

export async function collectWeeklyData(period: ReportPeriod): Promise<WeeklyData> {
  console.log(`[dataCollector] Collecting data from ${new Date(period.from * 1000).toISOString()} to ${new Date(period.to * 1000).toISOString()}`);

  const [prayer, loreboard, voting] = await Promise.all([
    collectPrayerData(period),
    collectLoreboardData(period),
    collectVotingData(period),
  ]);

  const community = await collectCommunityStats(
    prayer.streaks.map((s) => s.wallet),
    loreboard.proposals.map((p) => p.proposer),
    Object.keys(voting.voterCounts)
  );

  console.log(`[dataCollector] Done: ${prayer.totalPrayersThisWeek} prayers, ${loreboard.proposals.length} proposals, ${voting.totalVotesCast} votes, ${community.activeWallets.length} active wallets`);

  return { period, prayer, loreboard, voting, community };
}
