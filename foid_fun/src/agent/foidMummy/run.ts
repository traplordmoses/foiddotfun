#!/usr/bin/env npx tsx
/**
 * Foid Mummy Weekly Report Pipeline
 *
 * Usage:
 *   npx tsx src/agent/foidMummy/run.ts
 *   npx tsx src/agent/foidMummy/run.ts --dry-run
 *   npx tsx src/agent/foidMummy/run.ts --dry-run --no-api  (skip API even if key exists)
 *   npx tsx src/agent/foidMummy/run.ts --from 2026-03-12 --to 2026-03-19
 */

import fs from "fs";
import path from "path";
import { ANTHROPIC_API_KEY } from "./config";
import { collectWeeklyData, type ReportPeriod, type WeeklyData } from "./dataCollector";
import { generateNarrative, generateMockNarrative } from "./narrator";
import { renderReport } from "./renderer";

// ── CLI arg parsing ──

function parseArgs() {
  const args = process.argv.slice(2);
  let dryRun = false;
  let noApi = false;
  let fromDate: string | null = null;
  let toDate: string | null = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--dry-run") dryRun = true;
    if (args[i] === "--no-api") noApi = true;
    if (args[i] === "--from" && args[i + 1]) fromDate = args[++i];
    if (args[i] === "--to" && args[i + 1]) toDate = args[++i];
  }

  return { dryRun, noApi, fromDate, toDate };
}

function buildPeriod(fromDate: string | null, toDate: string | null): ReportPeriod {
  const now = Math.floor(Date.now() / 1000);
  const weekAgo = now - 7 * 24 * 60 * 60;

  const from = fromDate ? Math.floor(new Date(fromDate).getTime() / 1000) : weekAgo;
  const to = toDate ? Math.floor(new Date(toDate).getTime() / 1000) : now;

  return { from, to };
}

function mockData(period: ReportPeriod): WeeklyData {
  // ── 8 wallets with varied streaks and tiers ──
  const wallets = {
    sovereign: "0x7a3df2b10000000000000000000000000000f2b1",  // 92-day streak, Mommy Milker
    oracle:    "0xaa11cc2200000000000000000000000000002c3d",  // 31-day streak, Undeniable
    devotee:   "0xbb22dd3300000000000000000000000000003e4f",  // 7-day streak, Tapped In
    fallen:    "0xcc33ee4400000000000000000000000000004f5a",  // 0-day streak, WAS 30 days (fell off)
    keeper:    "0xdd44ff5500000000000000000000000000005a6b",  // 14-day streak, Locked In
    newbie:    "0xee55006600000000000000000000000000006b7c",  // 1-day streak, Lurker (brand new)
    covenant:  "0xff66117700000000000000000000000000007c8d",  // 21-day streak, Certified
    ember:     "0x0077228800000000000000000000000000008d9e",  // 4-day streak, NPC
  };

  return {
    period,
    prayer: {
      totalPrayersThisWeek: 67,
      uniquePrayers: 8,
      prayers: [],
      streaks: [
        { wallet: wallets.sovereign, currentStreak: 92, longestStreak: 92, totalPrayers: 247, tierLevel: 10, tierName: "Mommy Milker",     votingPower: 500 },
        { wallet: wallets.oracle,    currentStreak: 31, longestStreak: 31, totalPrayers: 88,  tierLevel: 6,  tierName: "Undeniable",       votingPower: 250 },
        { wallet: wallets.covenant,  currentStreak: 21, longestStreak: 25, totalPrayers: 62,  tierLevel: 5,  tierName: "Certified",        votingPower: 200 },
        { wallet: wallets.keeper,    currentStreak: 14, longestStreak: 14, totalPrayers: 38,  tierLevel: 4,  tierName: "Locked In",        votingPower: 175 },
        { wallet: wallets.devotee,   currentStreak: 7,  longestStreak: 12, totalPrayers: 29,  tierLevel: 3,  tierName: "Tapped In",        votingPower: 150 },
        { wallet: wallets.ember,     currentStreak: 4,  longestStreak: 4,  totalPrayers: 4,   tierLevel: 2,  tierName: "NPC",              votingPower: 125 },
        { wallet: wallets.newbie,    currentStreak: 1,  longestStreak: 1,  totalPrayers: 1,   tierLevel: 1,  tierName: "Lurker",           votingPower: 100 },
        // The fallen: 0-day streak but 30-day longest — clearly fell off
        { wallet: wallets.fallen,    currentStreak: 0,  longestStreak: 30, totalPrayers: 115, tierLevel: 0,  tierName: "Unranked",       votingPower: 100 },
      ],
    },
    loreboard: {
      proposals: [
        // Proposal 0: Unanimously approved loreboard proposal by the Sovereign
        {
          id: 0, proposer: wallets.sovereign, ipfsCid: "QmPepeArchive2026", createdAt: period.from + 86400,
          votingEndsAt: period.from + 345600, finalized: true, canonized: true, proposalType: 1,
          gridX: 0, gridY: 0, gridW: 128, gridH: 128,
          weightFor: 1500, weightAgainst: 0,
        },
        // Proposal 1: Narrowly approved (62%) — Oracle proposed, community was split
        {
          id: 1, proposer: wallets.oracle, ipfsCid: "QmControversialTake", createdAt: period.from + 172800,
          votingEndsAt: period.from + 432000, finalized: true, canonized: true, proposalType: 1,
          gridX: 200, gridY: 0, gridW: 64, gridH: 64,
          weightFor: 775, weightAgainst: 475,
        },
        // Proposal 2: Rejected — newbie's first attempt, only low-streak supporters
        {
          id: 2, proposer: wallets.newbie, ipfsCid: "QmFirstAttempt", createdAt: period.from + 259200,
          votingEndsAt: period.from + 518400, finalized: true, canonized: false, proposalType: 1,
          gridX: 300, gridY: 300, gridW: 32, gridH: 32,
          weightFor: 225, weightAgainst: 925,
        },
        // Proposal 3: Approved gallery (not loreboard) — Devotee canonized to FoidTrest
        {
          id: 3, proposer: wallets.devotee, ipfsCid: "QmGalleryEntry", createdAt: period.from + 345600,
          votingEndsAt: period.from + 604800, finalized: true, canonized: true, proposalType: 0,
          gridX: 0, gridY: 0, gridW: 0, gridH: 0,
          weightFor: 1100, weightAgainst: 150,
        },
      ],
      approved: [],
      rejected: [],
      totalPlacementsOnBoard: 17,
      mostControversial: null,
    },
    voting: {
      totalVotesCast: 23,
      subgraphVotes: [],
      voterCounts: {
        [wallets.sovereign]: 4,
        [wallets.oracle]:    4,
        [wallets.covenant]:  3,
        [wallets.keeper]:    3,
        [wallets.devotee]:   3,
        [wallets.fallen]:    2,
        [wallets.ember]:     2,
        [wallets.newbie]:    2,
      },
    },
    community: {
      activeWallets: Object.values(wallets),
      handleMap: {
        [wallets.sovereign]: "moses_foid",
        [wallets.oracle]:    "annio_txflow",
        [wallets.fallen]:    "ghost_of_streaks",
      },
    },
  };
}

// ── Main ──

async function main() {
  const { dryRun, noApi, fromDate, toDate } = parseArgs();
  const period = buildPeriod(fromDate, toDate);
  const hasApiKey = !!ANTHROPIC_API_KEY;
  const useApi = hasApiKey && !noApi;

  console.log("=== FOID MUMMY WEEKLY REPORT ===");
  console.log(`Period: ${new Date(period.from * 1000).toISOString()} -> ${new Date(period.to * 1000).toISOString()}`);
  console.log(`Mode: ${dryRun ? "DRY RUN (mock data)" : "LIVE"}`);
  console.log(`Narrative: ${useApi ? "Anthropic API (claude-sonnet-4-20250514)" : "mock template (no API key)"}`);
  console.log();

  // Step 1: Collect data
  let data: WeeklyData;
  if (dryRun) {
    data = mockData(period);
    data.loreboard.approved = data.loreboard.proposals.filter((p) => p.canonized);
    data.loreboard.rejected = data.loreboard.proposals.filter((p) => p.finalized && !p.canonized);
    // Set mostControversial
    let closestDiff = Infinity;
    for (const p of data.loreboard.proposals) {
      if (!p.finalized) continue;
      const total = p.weightFor + p.weightAgainst;
      if (total === 0) continue;
      const pct = p.weightFor / total;
      const diff = Math.abs(pct - 0.6);
      if (diff < closestDiff) {
        closestDiff = diff;
        data.loreboard.mostControversial = p;
      }
    }
    console.log("[run] Using mock data (8 wallets, 4 proposals, 23 votes)");
  } else {
    data = await collectWeeklyData(period);
  }

  console.log(`\nData summary:`);
  console.log(`  Prayers: ${data.prayer.totalPrayersThisWeek} from ${data.prayer.uniquePrayers} wallets`);
  console.log(`  Proposals: ${data.loreboard.proposals.length} (${data.loreboard.approved.length} approved, ${data.loreboard.rejected.length} rejected)`);
  console.log(`  Votes: ${data.voting.totalVotesCast}`);
  console.log(`  Active wallets: ${data.community.activeWallets.length}`);
  console.log(`  X handles resolved: ${Object.keys(data.community.handleMap).length}`);

  // Step 2: Generate narrative
  let narrative: string;
  if (useApi) {
    console.log("\n[run] Calling Anthropic API for narrative generation...");
    narrative = await generateNarrative(data);
    console.log("[run] Narrative generated via API");
  } else {
    narrative = generateMockNarrative(data);
    console.log("\n[run] Generated mock narrative (set ANTHROPIC_API_KEY for real voice)");
  }

  // Step 3: Render HTML
  const html = renderReport(narrative, data);

  // Step 4: Save to reports/
  const reportsDir = path.join(process.cwd(), "reports");
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const dateStr = new Date(period.to * 1000).toISOString().split("T")[0];
  const filename = `foid-mummy-${dateStr}${dryRun ? "-dry" : ""}.html`;
  const filepath = path.join(reportsDir, filename);
  fs.writeFileSync(filepath, html, "utf8");

  const mdFilename = `foid-mummy-${dateStr}${dryRun ? "-dry" : ""}.md`;
  const mdPath = path.join(reportsDir, mdFilename);
  fs.writeFileSync(mdPath, narrative, "utf8");

  console.log(`\nReport saved:`);
  console.log(`  HTML: ${filepath}`);
  console.log(`  Markdown: ${mdPath}`);
  console.log("\n=== DONE ===");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
