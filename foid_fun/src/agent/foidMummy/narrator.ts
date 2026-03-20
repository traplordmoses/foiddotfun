import Anthropic from "@anthropic-ai/sdk";
import { ANTHROPIC_API_KEY } from "./config";
import type { WeeklyData } from "./dataCollector";

const SYSTEM_PROMPT = `You are Foid Mummy, the autonomous narrator and cultural commentator of FOID Foundation. You watch everything that happens on-chain and have opinions about all of it.

Your tone is: irreverent, playful, occasionally roasting, always observant, meme-literate, and deeply invested in the community even when you're making fun of it. You speak like a reality TV host crossed with a crypto-native gossip columnist.

You assign dynamic titles based on behavior:
- The Architect (most placements)
- The Faithful (longest streak)
- The Kingmaker (most aligned with winning votes)
- The Ghost (stopped praying / fell off streak)
- The Whale (highest voting weight)
- The Newcomer (first interaction this week)
- The Contrarian (most votes against consensus)

Reference people by their X handle when available (e.g., @moses_foid). When no handle is paired, use shortened wallet address (e.g., 0x7a3...f2b). Never be mean-spirited — roasts are affectionate. Every report should make someone want to screenshot it and post it.

Output format: Generate a weekly report with these sections:
1. **HEADLINE** — one punchy line summarizing the week
2. **HIGHLIGHTS** — 3-5 bullet points of the most notable events
3. **TITLE CEREMONY** — assign 3-5 dynamic titles to specific wallets/handles with a one-liner explanation
4. **THE ROAST** — 2-3 affectionate roasts of community members based on their on-chain behavior
5. **STATE OF THE BOARD** — brief summary of loreboard health (proposals, approval rate, grid fill)
6. **PRAYER REPORT** — streak stats, tier milestones, who fell off
7. **CLOSING ORACLE** — one cryptic, philosophical line about the state of on-chain culture

Write in markdown. Keep it punchy — no section should be more than 5-6 lines. The whole report should be readable in 2 minutes.`;

function shortAddr(addr: string): string {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-3)}`;
}

function buildDataSummary(data: WeeklyData): string {
  const { period, prayer, loreboard, voting, community } = data;
  const handleOrAddr = (wallet: string) => {
    const handle = community.handleMap[wallet.toLowerCase()];
    return handle ? `@${handle}` : shortAddr(wallet);
  };

  const lines: string[] = [
    `## Reporting Period`,
    `From: ${new Date(period.from * 1000).toISOString().split("T")[0]}`,
    `To: ${new Date(period.to * 1000).toISOString().split("T")[0]}`,
    ``,
    `## Prayer Activity`,
    `- Total prayers this week: ${prayer.totalPrayersThisWeek}`,
    `- Unique praying wallets: ${prayer.uniquePrayers}`,
  ];

  if (prayer.streaks.length > 0) {
    const top = prayer.streaks[0];
    lines.push(`- Longest active streak: ${handleOrAddr(top.wallet)} with ${top.currentStreak} days (${top.tierName}, ${top.votingPower} voting power)`);

    const topPrayers = prayer.streaks.slice(0, 10).map(
      (s) => `  - ${handleOrAddr(s.wallet)}: ${s.currentStreak}d streak, ${s.tierName} (tier ${s.tierLevel}), VP=${s.votingPower}`
    );
    lines.push(`- Top 10 streaks:`, ...topPrayers);
  }

  lines.push(
    ``,
    `## Loreboard Activity`,
    `- New proposals: ${loreboard.proposals.length}`,
    `- Approved: ${loreboard.approved.length}`,
    `- Rejected: ${loreboard.rejected.length}`,
    `- Total placements on board (cumulative): ${loreboard.totalPlacementsOnBoard}`,
  );

  if (loreboard.approved.length > 0) {
    lines.push(`- Approved proposals:`);
    for (const p of loreboard.approved) {
      const type = p.proposalType === 1 ? "loreboard" : "gallery";
      lines.push(`  - #${p.id} by ${handleOrAddr(p.proposer)} (${type}) — ${p.weightFor} for / ${p.weightAgainst} against`);
    }
  }

  if (loreboard.mostControversial) {
    const mc = loreboard.mostControversial;
    const total = mc.weightFor + mc.weightAgainst;
    const pct = total > 0 ? ((mc.weightFor / total) * 100).toFixed(1) : "0";
    lines.push(`- Most controversial: #${mc.id} by ${handleOrAddr(mc.proposer)} — ${pct}% approval (${mc.weightFor}/${total})`);
  }

  lines.push(
    ``,
    `## Voting Activity`,
    `- Total votes cast (subgraph): ${voting.totalVotesCast}`,
  );

  const topVoters = Object.entries(voting.voterCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);
  if (topVoters.length > 0) {
    lines.push(`- Most active voters:`);
    for (const [wallet, count] of topVoters) {
      lines.push(`  - ${handleOrAddr(wallet)}: ${count} votes`);
    }
  }

  lines.push(
    ``,
    `## Community`,
    `- Total active wallets: ${community.activeWallets.length}`,
    `- Wallets with X handles linked: ${Object.keys(community.handleMap).length}`,
  );

  return lines.join("\n");
}

export async function generateNarrative(data: WeeklyData): Promise<string> {
  if (!ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is required for narrative generation");
  }

  const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
  const dataSummary = buildDataSummary(data);

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2000,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Here is the on-chain data for this week's FOID Foundation report. Generate the weekly narrative.\n\n${dataSummary}`,
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text in Anthropic response");
  }

  return textBlock.text;
}

export function generateMockNarrative(data: WeeklyData): string {
  const { prayer, loreboard, voting, community } = data;
  return `# FOID MUMMY WEEKLY REPORT (DRY RUN)

## HEADLINE
another week on-chain. ${prayer.totalPrayersThisWeek} prayers. ${loreboard.proposals.length} proposals. the grid remembers.

## HIGHLIGHTS
- ${prayer.uniquePrayers} wallets kept the faith this week
- ${loreboard.approved.length} proposals cleared the 60% threshold
- ${voting.totalVotesCast} votes cast across the loreboard
- ${community.activeWallets.length} unique wallets touched the chain

## TITLE CEREMONY
${prayer.streaks.length > 0 ? `- **The Faithful**: ${prayer.streaks[0].wallet.slice(0, 10)}... — ${prayer.streaks[0].currentStreak} day streak, ${prayer.streaks[0].tierName}` : "- No active streaks this week"}

## THE ROAST
- [dry run — roasts require the real Foid Mummy voice]

## STATE OF THE BOARD
${loreboard.totalPlacementsOnBoard} total placements. ${loreboard.proposals.length} proposals this week, ${loreboard.approved.length} approved, ${loreboard.rejected.length} rejected.

## PRAYER REPORT
${prayer.totalPrayersThisWeek} prayers from ${prayer.uniquePrayers} wallets. Top streak: ${prayer.streaks.length > 0 ? prayer.streaks[0].currentStreak + " days" : "none"}.

## CLOSING ORACLE
the grid does not forget. it only grows.
`;
}
