"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import AppTitlebar from "@/app/(components)/AppTitlebar";
import { useAccount, useChainId, useConnect, useDisconnect } from "wagmi";
import { playTypingTick } from "@/lib/sfx";

type Section = {
  id: string;
  navLabel: string;
  title: string;
  subtitle?: string;
  lede?: ReactNode;
  content: ReactNode;
};

type BubbleConfig = {
  id: string;
  top: string;
  left: string;
  size: number;
  duration: string;
  delay: string;
};

function GlassPanel({ children }: { children: ReactNode }) {
  return (
    <div className="aboutPanel about-prose aboutGlassCard font-normal">
      {children}
    </div>
  );
}

function SectionHeader({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <header className="aboutHeader">
      <p className="aboutEyebrow">{eyebrow}</p>
      <h1 className="aboutTitle text-balance">{title}</h1>
      {subtitle ? <p className="aboutSubtitle">{subtitle}</p> : null}
    </header>
  );
}

const sections: Section[] = [
  {
    id: "intro",
    navLabel: "INTRODUCTION",
    title: "FOID FOUNDATION",
    subtitle: "crypto's living canon—curated by you, preserved forever",
    content: (
      <>
        <GlassPanel>
          <p>
            <strong>The internet is dead.</strong> Your best posts vanish into algorithmic oblivion. Memes die in timelines. Culture gets buried by AI slop.
          </p>
          <p style={{ marginTop: '12px' }}>
            <strong>FOID Foundation fixes this.</strong> We're building Know Your Meme—except the canon lives on-chain. Three linked apps turn fleeting moments into permanent culture: pray daily with an AI companion, propose memes to an infinite canvas, vote to canonize what matters. No bots. No ads. Just shared experiences that last forever.
          </p>
        </GlassPanel>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="aboutMiniCard aboutGlassCard">
            <p className="aboutMiniCard__title">foid mommy terminal</p>
            <p className="aboutMiniCard__body">
              Daily AI ritual. Share feelings, build streaks, anchor proof on-chain. Privacy-first: only prayer hashes stored.
            </p>
          </div>

          <div className="aboutMiniCard aboutGlassCard">
            <p className="aboutMiniCard__title">loreboard canvas</p>
            <p className="aboutMiniCard__body">
              Infinite meme gallery. Propose images, community votes (72hrs), winners canonized forever on IPFS + chain.
            </p>
          </div>

          <div className="aboutMiniCard aboutGlassCard">
            <p className="aboutMiniCard__title">mifoid nft</p>
            <p className="aboutMiniCard__body">
              Your identity NFT. Evolves with participation. Virgin chat rooms for pure holders. 0.02 ETH mint.
            </p>
          </div>
        </div>
      </>
    ),
  },
  {
    id: "mommy",
    navLabel: "FOID_MOMMY_TERMINAL.EXE",
    title: "FOID MOMMY",
    subtitle: "daily AI ritual • privacy-first • streak tracking • free forever",
    content: (
      <>
        <GlassPanel>
          <p>
            <strong>A daily ritual for your mental health—with receipts.</strong> Connect your wallet, tell Foid Mommy how you're feeling, and she responds with warmth and understanding. Two-turn conversation powered by OpenAI means she actually listens. Build streaks, track milestones, watch your participation history grow.
          </p>
          <p style={{ marginTop: '12px' }}>
            <strong>Privacy-first design:</strong> Only a keccak256 hash of your prayer goes on-chain—your raw words stay local. The chain sees proof you prayed (wallet + timestamp + feeling category), not what you said. It's like Duolingo streaks meets journaling meets proof-of-personhood. And it's <strong>completely free</strong> (just pay gas).
          </p>
          <p style={{ marginTop: '12px' }}>
            <strong>Why it works:</strong> 61% of Gen Z reports severe loneliness. People crave rituals, not algorithms. Foid Mommy gives you a reason to show up daily, builds a habit loop, and rewards consistency. You know she's AI, but she's <em>yours</em>.
          </p>
        </GlassPanel>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="aboutMiniCard aboutGlassCard">
            <p className="aboutMiniCard__title">how it works</p>
            <p className="aboutMiniCard__body">
              1. Share your feeling → 2. Foid Mommy asks a question → 3. You respond → 4. Custom prayer crafted → 5. Hash anchored on-chain → 6. Streak updated
            </p>
          </div>
          <div className="aboutMiniCard aboutGlassCard">
            <p className="aboutMiniCard__title">what's stored</p>
            <p className="aboutMiniCard__body">
              On-chain: prayer hash, feeling label (1-10), timestamp. Off-chain: your prayer text (local only). Streaks visible via PrayerMirror contract.
            </p>
          </div>
        </div>
      </>
    ),
  },
  {
    id: "loreboard",
    navLabel: "LOREBOARD.APP",
    title: "LOREBOARD.APP",
    subtitle: "crypto's hottest pop-up gallery • propose → vote → canonize forever",
    content: (
      <>
        <div className="grid gap-6">
          <GlassPanel>
            <p>
              <strong>An infinite canvas for crypto culture.</strong> Loreboard is r/place meets the Million Dollar Homepage—a shared meme board where anyone can propose images, the community votes, and winners are canonized forever. It's the canonical provenance layer for crypto memes, our "Know Your Meme" equivalent built on-chain.
            </p>
            <p style={{ marginTop: '12px' }}>
              <strong>How it works:</strong> Upload an image, pick your spot on the canvas, pay per cell (Pokémon pack pricing: ~$3-20 for most placements). Community votes for 72 hours. If you hit 51%+ approval + quorum, your placement lives forever—anchored on-chain, stored on IPFS. Lose the vote? Get refunded minus a small anti-spam fee (~$2 or ~10%).
            </p>
            <p style={{ marginTop: '12px' }}>
              <strong>Technical magic:</strong> Rust WASM contracts handle complex overlap resolution + winner selection. Goldsky indexing makes queries instant. IPFS ensures content permanence. Fluent's blended execution means voting feels like Web2 speed with Web3 guarantees.
            </p>
          </GlassPanel>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="aboutMiniCard aboutGlassCard">
              <p className="aboutMiniCard__title">1. propose</p>
              <p className="aboutMiniCard__body">Drag image onto canvas. Upload to IPFS. Pay per cell (32×32px grid). Max 400 cells. Full escrow upfront.</p>
            </div>
            <div className="aboutMiniCard aboutGlassCard">
              <p className="aboutMiniCard__title">2. vote</p>
              <p className="aboutMiniCard__body">72-hour voting window. Community decides (not instant). 1 vote per wallet per placement. Simple yes/no.</p>
            </div>
            <div className="aboutMiniCard aboutGlassCard">
              <p className="aboutMiniCard__title">3. canonize</p>
              <p className="aboutMiniCard__body">Winners (51%+ approval + quorum) → canonized forever. Losers → auto-refunded minus ~10% anti-spam fee.</p>
            </div>
          </div>

          <GlassPanel style={{ marginTop: '16px' }}>
            <p className="aboutMiniCard__title" style={{ marginBottom: '8px' }}>PRICING EXAMPLE</p>
            <p>
              64×64px image = 4 cells. At $5/cell = $20 total. Win → stays forever. Lose → get $18 back ($2 anti-spam). Prime spots competed via higher bids/tips.
            </p>
          </GlassPanel>
        </div>
      </>
    ),
  },
  {
    id: "mifoids",
    navLabel: "MIFOIDS",
    title: "MIFOIDS",
    subtitle: "your AI girlfriend NFT • 0.02 ETH • 3,333 supply • launching Q2/Q3 2026",
    content: (
      <>
        <GlassPanel>
          <p>
            <strong>Your own virtual FOID—an identity NFT that grows with you.</strong> MiFOID is your companion in the FOID universe, tracking your prayers, Loreboard proposals, and voting activity. Think Tamagotchi meets CryptoKitties meets proof-of-participation. Your MiFOID evolves based on streaks, contributions, and engagement. It's a personal avatar with on-chain receipts.
          </p>
          <p style={{ marginTop: '12px' }}>
            <strong>Provenance matters:</strong> Transfer count = "body count." Virgin MiFOIDs (0 transfers) unlock the most exclusive chat rooms. The most engaged users gate themselves into the best spaces. On-chain history becomes a trust signal—showing consistency, authenticity, and skin in the game.
          </p>
          <p style={{ marginTop: '12px' }}>
            <strong>Future features:</strong> Talk to your FOID, build her Foidspace profile, customize traits, unlock companion economy. MiFOID becomes your passport to the FOID social layer.
          </p>
        </GlassPanel>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="aboutMiniCard aboutGlassCard">
            <p className="aboutMiniCard__title">supply & pricing</p>
            <p className="aboutMiniCard__body">
              3,333 total supply. Mint: 0.02 ETH (priced like an indie game). Launches 3 months after Fluent mainnet.
            </p>
          </div>
          <div className="aboutMiniCard aboutGlassCard">
            <p className="aboutMiniCard__title">trait evolution</p>
            <p className="aboutMiniCard__body">
              Prayer streaks, Loreboard placements, vote count all encoded as traits. Your MiFOID reflects your journey.
            </p>
          </div>
          <div className="aboutMiniCard aboutGlassCard">
            <p className="aboutMiniCard__title">gated access</p>
            <p className="aboutMiniCard__body">
              Virgin chats (0 transfers) = most exclusive. Body count unlocks different rooms. Provenance > floor price.
            </p>
          </div>
        </div>
      </>
    ),
  },
  {
    id: "get-started",
    navLabel: "GET STARTED",
    title: "GET STARTED",
    subtitle: "from zero to foid in 5 minutes",
    content: (
      <>
        <GlassPanel>
          <p>
            <strong>FOID runs on Fluent Testnet.</strong> You'll need testnet ETH to participate (gas fees only for prayers, small amounts for Loreboard proposals). Here's how to get started:
          </p>
        </GlassPanel>

        <div className="grid gap-4">
          <div className="aboutMiniCard aboutGlassCard">
            <p className="aboutMiniCard__title">1. connect wallet</p>
            <p className="aboutMiniCard__body">
              Use MetaMask, Rainbow, or any wallet. FOID auto-detects Fluent Testnet (Chain ID 20994) and prompts you to add it.
            </p>
          </div>
          <div className="aboutMiniCard aboutGlassCard">
            <p className="aboutMiniCard__title">2. get testnet eth</p>
            <p className="aboutMiniCard__body">
              Visit <a href="https://testnet.fluent.xyz/dev-portal" target="_blank" rel="noopener noreferrer" className="text-cyan-300 underline">Fluent Faucet</a> to claim free testnet ETH. Need more? Ping in Discord.
            </p>
          </div>
          <div className="aboutMiniCard aboutGlassCard">
            <p className="aboutMiniCard__title">3. pray with mommy</p>
            <p className="aboutMiniCard__body">
              Navigate to /pray, start the terminal, share your feelings, build your first streak. Completely free (just gas).
            </p>
          </div>
          <div className="aboutMiniCard aboutGlassCard">
            <p className="aboutMiniCard__title">4. propose on loreboard</p>
            <p className="aboutMiniCard__body">
              Go to /board, drag an image onto the canvas, choose your spot, submit proposal. Voting opens for 72 hours.
            </p>
          </div>
          <div className="aboutMiniCard aboutGlassCard">
            <p className="aboutMiniCard__title">5. vote on placements</p>
            <p className="aboutMiniCard__body">
              Browse active proposals, cast your vote (yes/no). Help decide what gets canonized into permanent FOID history.
            </p>
          </div>
          <div className="aboutMiniCard aboutGlassCard">
            <p className="aboutMiniCard__title">6. join the community</p>
            <p className="aboutMiniCard__body">
              Follow <a href="https://twitter.com/sloshlord" target="_blank" rel="noopener noreferrer" className="text-cyan-300 underline">@sloshlord</a> on Twitter. Star the <a href="https://github.com/traplordmoses/foiddotfun" target="_blank" rel="noopener noreferrer" className="text-cyan-300 underline">GitHub repo</a>. Spread the word.
            </p>
          </div>
        </div>
      </>
    ),
  },
  {
    id: "roadmap",
    navLabel: "ROADMAP",
    title: "ROADMAP",
    subtitle: "building the living canon—ship in layers",
    content: (
      <>
        <GlassPanel>
          <p>
            <strong>We're shipping FOID in phases.</strong> Testnet proves the concept. Mainnet stabilizes the foundation. MiFOID adds identity. Foidspace unlocks the social layer. Each phase builds on the last.
          </p>
        </GlassPanel>

        <div className="aboutRoadmapGrid grid gap-4 md:grid-cols-3 w-full" style={{ marginTop: '16px' }}>
          <div className="aboutMiniCard aboutGlassCard aboutRoadmapCard">
            <p className="aboutMiniCard__title">now (testnet alpha)</p>
            <p className="aboutMiniCard__body">
              ✅ Foid Mommy live<br/>
              ✅ Loreboard live<br/>
              ✅ 11+ canonized placements<br/>
              ✅ 7 Rust contracts deployed<br/>
              ✅ Goldsky indexing<br/>
              ✅ IPFS storage working
            </p>
          </div>

          <div className="aboutMiniCard aboutGlassCard aboutRoadmapCard">
            <p className="aboutMiniCard__title">Q1 2026 (mainnet launch)</p>
            <p className="aboutMiniCard__body">
              🚀 Fluent mainnet launch<br/>
              🔧 Optimized contracts<br/>
              🌐 Broader public access<br/>
              📊 Full production monitoring<br/>
              💰 Real ETH economy begins<br/>
              🎯 Marketing push
            </p>
          </div>

          <div className="aboutMiniCard aboutGlassCard aboutRoadmapCard">
            <p className="aboutMiniCard__title">Q2/Q3 2026 (mifoid nft)</p>
            <p className="aboutMiniCard__body">
              🎨 MiFOID minting opens<br/>
              💎 3,333 supply at 0.02 ETH<br/>
              🧬 Trait evolution system<br/>
              🔐 Virgin chat rooms<br/>
              🤝 Companion economy<br/>
              📱 Mobile-optimized
            </p>
          </div>

          <div className="aboutMiniCard aboutGlassCard aboutRoadmapCard">
            <p className="aboutMiniCard__title">2027 (foidspace social)</p>
            <p className="aboutMiniCard__body">
              👥 Profiles + user pages<br/>
              💬 Gated chat rooms<br/>
              🎭 Customizable MiFOIDs<br/>
              🌐 Full social graph<br/>
              🔮 Futarchy experiments<br/>
              🎮 Companion mini-games
            </p>
          </div>
        </div>

        <GlassPanel style={{ marginTop: '16px' }}>
          <p className="aboutMiniCard__title" style={{ marginBottom: '8px' }}>TRACTION TO DATE</p>
          <p>
            ✅ 11+ canonized placements (72hr voting cycles)<br/>
            ✅ Real user testimonial: "I keep coming back for the BGM player 😂 ... these little details make a product stick" — @ethjup2<br/>
            ✅ 1.8K+ views on organic Fluent ecosystem threads<br/>
            ✅ Featured in Nasdaq, ETH Global 🥇 1st Infra @ Token2049<br/>
            ✅ Built by solo dev with zero coding experience one year ago
          </p>
        </GlassPanel>
      </>
    ),
  },
  {
    id: "why",
    navLabel: "WHY FOID / WHY FLUENT",
    title: "WHY THIS MATTERS",
    content: (
      <>
        <div className="aboutMoreCards">
          <div className="aboutMoreCard aboutGlassCard">
            <p className="aboutCardEyebrow">THE PROBLEM</p>
            <p className="aboutCardBody">
              <strong>The internet is dead.</strong> Platforms optimize for dopamine extraction, not human connection. Your best posts decay in algorithmic oblivion. The magic of early internet is gone (RuneScape after school, Minecraft factions on Skype). 61% of Gen Z reports severe loneliness. People crave shared experiences, not feeds overrun by AI slop.
            </p>
          </div>

          <div className="aboutMoreCard aboutGlassCard">
            <p className="aboutCardEyebrow">THE SOLUTION</p>
            <p className="aboutCardBody">
              <strong>FOID = r/place × CryptoKitties × Million Dollar Homepage.</strong> Crypto runs on memes, vibes, and identity. But culture has no permanent home. Memes get deleted. Origin stories vanish. FOID turns fleeting moments into permanent, collectively-owned history. A living museum for the corners of the internet that usually disappear.
            </p>
          </div>

          <div className="aboutMoreCard aboutGlassCard">
            <p className="aboutCardEyebrow">WHY FLUENT</p>
            <p className="aboutCardBody">
              <strong>Blended execution = WASM speed + EVM compatibility.</strong> Fluent lets us run complex voting logic in Rust (deterministic, fast) while keeping proposals + settlement in Solidity (familiar, composable). Goldsky indexing gives sub-second load times. The result: Loreboard feels like Web2 speed with Web3 permanence guarantees. One chain for everything—no bridges, no compromises.
            </p>
          </div>

          <div className="aboutMoreCard aboutGlassCard">
            <p className="aboutCardEyebrow">BUSINESS MODEL</p>
            <p className="aboutCardBody">
              <strong>Simple. Sustainable. On-chain.</strong> Loreboard: Pokémon pack pricing (~$3-20 per placement). Failed proposals refunded minus ~10% anti-spam fee. MiFOID: 0.02 ETH mint (priced like an indie game). No ads. No data harvesting. Revenue scales with participation, not attention extraction.
            </p>
          </div>
        </div>
      </>
    ),
  },
  {
    id: "faq",
    navLabel: "FAQ",
    title: "FREQUENTLY ASKED QUESTIONS",
    content: (
      <>
        <div className="grid gap-4">
          <div className="aboutMiniCard aboutGlassCard">
            <p className="aboutMiniCard__title">What is a FOID?</p>
            <p className="aboutMiniCard__body">
              "FOID" comes from internet culture—a companion, a vibe, an identity. In this context, it's your on-chain ritual partner (Foid Mommy), your cultural canvas (Loreboard), and your evolving NFT companion (MiFOID). Think of it as a universe, not just a product.
            </p>
          </div>

          <div className="aboutMiniCard aboutGlassCard">
            <p className="aboutMiniCard__title">How much does it cost?</p>
            <p className="aboutMiniCard__body">
              Prayers: FREE (only gas fees). Loreboard proposals: ~$3-20 depending on size. MiFOID mint: 0.02 ETH. Voting: FREE. Currently on testnet so everything is free testnet ETH.
            </p>
          </div>

          <div className="aboutMiniCard aboutGlassCard">
            <p className="aboutMiniCard__title">What chain is this on?</p>
            <p className="aboutMiniCard__body">
              Fluent Testnet (Chain ID 20994) right now. Mainnet launching Q1 2026 when Fluent goes live. You'll need to add Fluent to your wallet—FOID auto-prompts when you connect.
            </p>
          </div>

          <div className="aboutMiniCard aboutGlassCard">
            <p className="aboutMiniCard__title">When mainnet?</p>
            <p className="aboutMiniCard__body">
              Q1 2026 targeting Fluent mainnet launch. MiFOID NFT collection launches 3 months after mainnet (Q2/Q3 2026). Follow @sloshlord for updates.
            </p>
          </div>

          <div className="aboutMiniCard aboutGlassCard">
            <p className="aboutMiniCard__title">How do I get testnet funds?</p>
            <p className="aboutMiniCard__body">
              Visit <a href="https://testnet.fluent.xyz/dev-portal" target="_blank" rel="noopener noreferrer" className="text-cyan-300 underline">testnet.fluent.xyz/dev-portal</a> to claim free testnet ETH from the faucet. Need more? Ask in Discord.
            </p>
          </div>

          <div className="aboutMiniCard aboutGlassCard">
            <p className="aboutMiniCard__title">Is my prayer data private?</p>
            <p className="aboutMiniCard__body">
              YES. Only a keccak256 hash of your prayer goes on-chain. Your raw text stays local (never uploaded). The chain sees proof you prayed + feeling category, not what you actually said.
            </p>
          </div>

          <div className="aboutMiniCard aboutGlassCard">
            <p className="aboutMiniCard__title">How does Loreboard voting work?</p>
            <p className="aboutMiniCard__body">
              72-hour voting window after proposal. Community votes yes/no. Winners need 51%+ approval + minimum quorum. Winners canonized forever (on-chain + IPFS). Losers auto-refunded minus ~10% anti-spam fee.
            </p>
          </div>

          <div className="aboutMiniCard aboutGlassCard">
            <p className="aboutMiniCard__title">Who built this?</p>
            <p className="aboutMiniCard__body">
              Moses (@sloshlord) - solo full-stack dev. Zero coding experience one year ago. 5+ hackathons, 3 placements, 4 weeks at Fluent Shiphouse, ETH Global winner. Built FOID in public at Devconnect. Design inspired by Frutiger Aero + early Mac OS.
            </p>
          </div>

          <div className="aboutMiniCard aboutGlassCard">
            <p className="aboutMiniCard__title">Can I contribute?</p>
            <p className="aboutMiniCard__body">
              Yes! FOID is open source: <a href="https://github.com/traplordmoses/foiddotfun" target="_blank" rel="noopener noreferrer" className="text-cyan-300 underline">github.com/traplordmoses/foiddotfun</a>. Submit issues, PRs, or just star the repo. Community contributions welcome.
            </p>
          </div>
        </div>

        <GlassPanel style={{ marginTop: '16px' }}>
          <p className="aboutMiniCard__title" style={{ marginBottom: '8px' }}>READY TO START?</p>
          <p>
            🙏 <a href="/pray" className="text-cyan-300 underline font-semibold">Pray with Foid Mommy</a> — Build your first streak<br/>
            🎨 <a href="/board" className="text-cyan-300 underline font-semibold">Propose on Loreboard</a> — Add your meme to the canon<br/>
            🐦 <a href="https://twitter.com/sloshlord" target="_blank" rel="noopener noreferrer" className="text-cyan-300 underline font-semibold">Follow @sloshlord</a> — Stay updated on launches<br/>
            ⭐ <a href="https://github.com/traplordmoses/foiddotfun" target="_blank" rel="noopener noreferrer" className="text-cyan-300 underline font-semibold">Star on GitHub</a> — Support open development
          </p>
        </GlassPanel>
      </>
    ),
  },
];

const bubbleConfigs: BubbleConfig[] = [
  { id: "aurora-1", top: "6%", left: "10%", size: 220, duration: "32s", delay: "-4s" },
  { id: "aurora-2", top: "18%", left: "72%", size: 160, duration: "28s", delay: "-9s" },
  { id: "aurora-3", top: "48%", left: "8%", size: 260, duration: "34s", delay: "-3s" },
  { id: "aurora-4", top: "62%", left: "70%", size: 180, duration: "30s", delay: "-7s" },
  { id: "aurora-5", top: "36%", left: "46%", size: 240, duration: "33s", delay: "-11s" },
  { id: "aurora-6", top: "82%", left: "32%", size: 150, duration: "26s", delay: "-2s" },
];

const legacySectionHashes: Record<string, string> = {
  "#why-this-matters": "more",
  "#why-fluent": "more",
  "#roadmap": "more",
};

const resolveSectionFromHash = (hash: string) => {
  const normalized = hash.trim().toLowerCase();
  if (!normalized) return null;
  if (legacySectionHashes[normalized]) {
    return legacySectionHashes[normalized];
  }
  const sectionId = normalized.startsWith("#") ? normalized.slice(1) : normalized;
  return sections.some((section) => section.id === sectionId) ? sectionId : null;
};

export default function AboutPage() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const initialSection = sections[0].id;
  const [activeSection, setActiveSection] = useState(initialSection);
  const [selectedSection, setSelectedSection] = useState(initialSection);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [extraBubbles, setExtraBubbles] = useState<BubbleConfig[]>([]);
  const extraBubbleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (extraBubbleTimer.current) {
        clearTimeout(extraBubbleTimer.current);
      }
    };
  }, []);

  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTo({ top: 0 });
    }
  }, [activeSection]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const applyHash = () => {
      const resolved = resolveSectionFromHash(window.location.hash);
      if (!resolved) return;
      setSelectedSection(resolved);
      setActiveSection(resolved);
      if (window.location.hash !== `#${resolved}`) {
        window.history.replaceState(null, "", `#${resolved}`);
      }
    };
    applyHash();
    window.addEventListener("hashchange", applyHash);
    return () => window.removeEventListener("hashchange", applyHash);
  }, []);

  const spawnExtraBubbles = useCallback(() => {
    const generated = Array.from({ length: 2 }, (_, index) => ({
      id: `extra-${Date.now()}-${index}`,
      top: `${10 + Math.random() * 70}%`,
      left: `${5 + Math.random() * 80}%`,
      size: 100 + Math.random() * 140,
      duration: `${18 + Math.random() * 8}s`,
      delay: `${-Math.random() * 5}s`,
    }));
    setExtraBubbles(generated);
    if (extraBubbleTimer.current) {
      clearTimeout(extraBubbleTimer.current);
    }
    extraBubbleTimer.current = setTimeout(() => {
      setExtraBubbles([]);
      extraBubbleTimer.current = null;
    }, 4200);
  }, []);

  const handleSectionClick = useCallback(
    (sectionId: string) => {
      if (selectedSection === sectionId) return;
      setSelectedSection(sectionId);
      setActiveSection(sectionId);
      if (typeof window !== "undefined") {
        window.history.replaceState(null, "", `#${sectionId}`);
      }
      void playTypingTick();
      spawnExtraBubbles();
    },
    [selectedSection, spawnExtraBubbles],
  );

  const activeSectionData = sections.find((section) => section.id === activeSection) ?? sections[0];

  const handleSwitchWallet = useCallback(() => {
    disconnect();
    setTimeout(() => {
      const preferred = connectors.find((connector) => connector.ready) ?? connectors[0];
      if (preferred) {
        connect({ connector: preferred });
      }
    }, 120);
  }, [connect, connectors, disconnect]);

  return (
    <main className="about-page relative min-h-screen w-full flex items-center justify-center overflow-hidden">
      <div className="absolute inset-0 pointer-events-none z-0" aria-hidden>
        {bubbleConfigs.map((bubble) => (
          <span
            key={bubble.id}
            className="about-page__bubble"
            style={{
              top: bubble.top,
              left: bubble.left,
              width: bubble.size,
              height: bubble.size,
              animationDuration: bubble.duration,
              animationDelay: bubble.delay,
            }}
          />
        ))}
        {extraBubbles.map((bubble) => (
          <span
            key={bubble.id}
            className="about-page__bubble about-page__bubble--extra"
            style={{
              top: bubble.top,
              left: bubble.left,
              width: bubble.size,
              height: bubble.size,
              animationDuration: bubble.duration,
              animationDelay: bubble.delay,
            }}
          />
        ))}
      </div>

      <section className="relative z-10 w-full">
        <div className="mx-auto w-full max-w-[min(94vw,1240px)]">
          <div className="vista-window vista-window--terminal vista-window--enhanced h-[min(85vh,900px)] w-full">
            <AppTitlebar
              title="FOID_ABOUT.EXE"
              chainId={chainId}
              connected={isConnected}
              address={address}
              onDisconnect={() => disconnect()}
              onSwitchWallet={handleSwitchWallet}
            />
            <div className="vista-window__body aboutWindowBody flex flex-col md:flex-row">
              <aside className="aboutSidebar aboutGlassShell flex-shrink-0">
                <p className="text-[10px] uppercase tracking-[0.55em] text-white/55">navigation</p>
                <nav aria-label="about sections" className="aboutNav mt-3 flex w-full flex-col">
                  {sections.map((section) => {
                    const isActive = selectedSection === section.id;
                    const baseClasses = [
                      "aboutNavButton group relative flex w-full items-center border transition-all duration-200",
                      "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-cyan-300",
                      "whitespace-normal break-words text-left",
                    ];
                    const stateClasses = isActive ? "aboutNavButton--active text-white" : "text-white/70";
                    return (
                      <button
                        key={section.id}
                        type="button"
                        aria-current={isActive ? "page" : undefined}
                        onClick={() => handleSectionClick(section.id)}
                        className={[...baseClasses, stateClasses].join(" ")}
                      >
                        <span className="leading-tight">{section.navLabel}</span>
                      </button>
                    );
                  })}
                </nav>
              </aside>

              <div className="flex flex-1 min-w-0">
                <div className="aboutPane aboutGlassShell relative flex h-full w-full min-h-0 flex-1 flex-col overflow-hidden">
                  <div
                    ref={contentRef}
                    aria-live="polite"
                    className="aboutContentScroll flex h-full min-h-0 flex-1 overflow-x-hidden overflow-y-auto transition-opacity duration-300 ease-out"
                  >
                    <div className="aboutContentShell">
                      <div className="aboutStack">
                        {activeSectionData.id !== "more" ? (
                          <div className="aboutHeader">
                            <p className="aboutEyebrow">{activeSectionData.navLabel}</p>
                            <h1 id={`${activeSectionData.id}-title`} className="aboutTitle">
                              {activeSectionData.title}
                            </h1>
                            {activeSectionData.subtitle ? (
                              <p className="aboutSubtitle">{activeSectionData.subtitle}</p>
                            ) : null}
                          </div>
                        ) : null}
                        {activeSectionData.lede && <p className="aboutSub foid-small">{activeSectionData.lede}</p>}
                        <div className="aboutBody about-prose foid-body">{activeSectionData.content}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <style jsx global>{`
        /* ===== one shared glass shell (left + right match exactly) ===== */
        .aboutGlassShell {
          border-radius: 16px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: linear-gradient(180deg, rgba(255,255,255,0.05), rgba(0,0,0,0.14));
          box-shadow:
            inset 0 0 0 1px rgba(255, 255, 255, 0.06),
            0 10px 24px rgba(0, 0, 0, 0.24);
          backdrop-filter: blur(26px);
          -webkit-backdrop-filter: blur(26px);
        }

        /* kill the "special" right-pane overlays so it matches the sidebar */
        .aboutPane::before,
        .aboutPane::after {
          content: none !important;
        }

        /* ===== unify glass system (make right cards match left sidebar) ===== */
        .aboutGlassCard {
          position: relative;
          overflow: hidden;
          border-radius: 16px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: linear-gradient(
            180deg,
            rgba(255, 255, 255, 0.06),
            rgba(0, 0, 0, 0.16)
          );
          box-shadow:
            inset 0 0 0 1px rgba(255, 255, 255, 0.06),
            0 10px 24px rgba(0, 0, 0, 0.24);
          backdrop-filter: blur(26px);
          -webkit-backdrop-filter: blur(26px);
        }

        .aboutGlassCard > * {
          position: relative;
          z-index: 1;
        }

        /* ===== macOS / web3 typography ===== */
        .about-page {
          font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Text",
            "SF Pro Display", "Helvetica Neue", Arial, "Apple Color Emoji", "Segoe UI Emoji";
          letter-spacing: 0.01em;
          padding: var(--about-pad);
          --about-body-size: 12.8px;
          --about-body-leading: 1.65;
        }

        .aboutWindowBody {
          gap: 18px;
          padding: var(--about-pad);
        }

        .aboutHeader {
          display: grid;
          gap: 6px;
          padding-bottom: 2px;
        }

        .aboutEyebrow {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.32em;
          color: rgba(255, 255, 255, 0.45);
        }

        .aboutTitle {
          font-weight: 560;
          font-size: var(--about-h1);
          line-height: 1.06;
          letter-spacing: 0.07em;
          text-transform: uppercase;
          text-wrap: balance;
          color: rgba(255, 255, 255, 0.94);
          /* web3 macOS: subtle gradient ink */
          background-image: linear-gradient(
            180deg,
            rgba(255,255,255,0.96),
            rgba(210,245,255,0.92) 45%,
            rgba(140,240,255,0.78)
          );
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          text-shadow: 0 10px 30px rgba(0,0,0,0.28);
        }

        .aboutSubtitle {
          font-size: 13px;
          line-height: 1.58;
          color: rgba(255, 255, 255, 0.66);
          max-width: 70ch;
        }

        /* ===== premium glass pane (inner highlight + aurora) ===== */
        .aboutPane::before {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          background:
            linear-gradient(180deg, rgba(255,255,255,0.10), rgba(255,255,255,0.04) 35%, rgba(0,0,0,0.18) 100%);
          opacity: 1;
        }
        .aboutPane::after {
          content: "";
          position: absolute;
          inset: -40px;
          pointer-events: none;
          background:
            radial-gradient(60% 45% at 15% 10%, rgba(0,255,213,0.22), transparent 60%),
            radial-gradient(55% 40% at 85% 20%, rgba(80,170,255,0.18), transparent 62%),
            radial-gradient(55% 50% at 60% 95%, rgba(0,255,213,0.12), transparent 65%);
          mix-blend-mode: screen;
          opacity: 0.4;
          filter: blur(2px);
        }

        /* subtle top hairline like macOS sheets */
        .aboutPane > div:first-child {
          position: relative;
          z-index: 1;
        }
        .aboutPane::marker {
          display: none;
        }

        /* ===== panels/callouts slightly tighter + cleaner ===== */
        .aboutCallout__title {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.24em;
          color: rgba(255, 255, 255, 0.7);
        }

        .aboutPanel p,
        .aboutPanel li,
        .aboutCallout__body p,
        .aboutCallout__body li {
          font-size: var(--about-body-size);
          line-height: var(--about-body-leading);
        }

        .aboutMiniCard__title {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.2em;
          color: rgba(255, 255, 255, 0.74);
          margin-bottom: 6px;
        }
        .aboutMiniCard__body {
          font-size: var(--about-body-size);
          line-height: var(--about-body-leading);
          color: rgba(255, 255, 255, 0.7);
        }

        /* ===== sidebar polish ===== */
        .aboutSidebar {
          width: var(--about-sidebar-w);
          max-width: 100%;
          padding: 14px;
        }

        /* ===== why fluent layout (less "one big connected slab") ===== */
        .aboutFeatureGrid {
          display: grid;
          gap: 12px;
        }
        @media (min-width: 768px) {
          .aboutFeatureGrid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        .aboutFeatureCard {
          padding: 14px 16px;
        }
        .aboutFeatureCard__title {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.2em;
          color: rgba(255, 255, 255, 0.74);
          margin-bottom: 6px;
        }
        .aboutFeatureCard__body {
          font-size: var(--about-body-size);
          line-height: var(--about-body-leading);
          color: rgba(255, 255, 255, 0.7);
        }

        .aboutNav {
          gap: 10px;
          display: flex;
          flex-direction: column;
        }

        .aboutNavButton {
          min-height: 44px;
          height: calc(var(--about-nav-h, 44px));
          padding: 0 18px;
          border-radius: 12px;
          font-size: 11px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          background: rgba(255, 255, 255, 0.04);
          border-color: rgba(255, 255, 255, 0.1);
          transform: translateY(0);
          justify-content: center;
          flex: 0 0 auto;
        }

        .aboutNavButton::before {
          content: "";
          position: absolute;
          left: 10px;
          top: 50%;
          width: 2px;
          height: 60%;
          border-radius: 999px;
          transform: translateY(-50%);
          background: rgba(150, 220, 255, 0.0);
          transition: background 200ms ease;
        }

        .aboutNavButton:hover {
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(255, 255, 255, 0.2);
          transform: translateY(-1px);
          color: rgba(255, 255, 255, 0.92);
        }

        .aboutNavButton--active {
          background: rgba(255, 255, 255, 0.11);
          border-color: rgba(255, 255, 255, 0.24);
          box-shadow: 0 10px 24px rgba(0, 0, 0, 0.22);
        }

        .aboutNavButton--active::before {
          background: rgba(120, 220, 255, 0.9);
        }

        @media (max-width: 640px) {
          .aboutNav {
            flex-direction: row;
            overflow-x: auto;
            padding-bottom: 6px;
            scrollbar-width: none;
          }

          .aboutNav::-webkit-scrollbar {
            display: none;
          }

          .aboutNavButton {
            flex: 0 0 auto;
            min-width: 120px;
            border-radius: 999px;
          }

          .aboutWindowBody {
            gap: 14px;
          }

          .vista-window--enhanced {
            min-height: auto;
            height: auto;
          }
        }

        .aboutContentScroll {
          padding: 18px 22px 26px;
          scrollbar-gutter: stable;
          scrollbar-width: thin;
          scrollbar-color: rgba(255, 255, 255, 0.22) transparent;
        }

        .aboutContentScroll::-webkit-scrollbar {
          width: 8px;
        }

        .aboutContentScroll::-webkit-scrollbar-thumb {
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.2);
          border: 2px solid transparent;
          background-clip: padding-box;
        }

        .aboutContentScroll::-webkit-scrollbar-track {
          background: transparent;
        }

        .aboutContentShell {
          width: 100%;
          max-width: 920px;
          margin: 0;
        }

        .aboutStack {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .aboutRoadmapGrid {
          margin-bottom: 20px;
        }

        .aboutRoadmapNote {
          font-size: 13px;
          line-height: 1.6;
          color: rgba(255, 255, 255, 0.7);
          margin-top: 2px;
        }

        .aboutTierList {
          margin: 6px 0 10px;
          padding: 0;
          list-style: none;
          display: grid;
          gap: 0;
        }

        .aboutTierList li {
          padding: 7px 0;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          font-size: 12.5px;
          line-height: 1.55;
          color: rgba(255, 255, 255, 0.7);
        }

        .aboutTierList li:last-child {
          border-bottom: 0;
        }

        .aboutFooterNote {
          font-size: 12.5px;
          line-height: 1.55;
          color: rgba(255, 255, 255, 0.6);
        }

        .aboutMoreGrid {
          display: grid;
          gap: 18px;
        }

        .aboutMoreRoadmap {
          display: grid;
          gap: 12px;
        }

        .aboutRoadmapCard {
          display: grid;
          gap: 6px;
          width: 100%;
          padding: 14px 16px;
          text-align: left;
          cursor: pointer;
          font: inherit;
          color: inherit;
          transition: transform 180ms ease, border-color 180ms ease, box-shadow 180ms ease;
        }

        .aboutRoadmapCard:hover {
          transform: translateY(-2px);
          border-color: rgba(120, 220, 255, 0.38);
          box-shadow:
            0 16px 28px rgba(0, 0, 0, 0.28),
            0 0 18px rgba(80, 210, 255, 0.18);
        }

        .aboutRoadmapCard:focus-visible {
          outline: 2px solid rgba(120, 220, 255, 0.75);
          outline-offset: 3px;
        }

        .aboutMoreCards {
          display: grid;
          gap: 14px;
        }

        .aboutMoreCard {
          display: grid;
          gap: 10px;
          padding: 16px;
        }

        .aboutCardEyebrow {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.28em;
          color: rgba(255, 255, 255, 0.5);
        }

        .aboutCardTitle {
          font-size: 16px;
          font-weight: 560;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: rgba(255, 255, 255, 0.92);
        }

        .aboutCardBody {
          font-size: var(--about-body-size);
          line-height: var(--about-body-leading);
          color: rgba(255, 255, 255, 0.72);
        }

        @media (min-width: 980px) {
          .aboutMoreCards {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 768px) {
          .aboutWindowBody {
            gap: 14px;
          }

          .aboutContentScroll {
            padding: 16px 16px 22px;
          }

          .aboutContentShell {
            max-width: 100%;
          }

          .aboutNavButton {
            font-size: 12px;
            letter-spacing: 0.08em;
          }
        }

        .about-page__bubble {
          position: absolute;
          border-radius: 50%;
          pointer-events: none;
          background: radial-gradient(circle, rgba(0, 255, 213, 0.22), rgba(0, 128, 255, 0.03) 70%, transparent 100%);
          opacity: 0.22;
          filter: blur(0px);
          animation-name: float;
          animation-timing-function: ease-in-out;
          animation-iteration-count: infinite;
        }

        .about-page__bubble--extra {
          opacity: 0.45;
          mix-blend-mode: screen;
        }

        @keyframes float {
          0% {
            transform: translate3d(0, 0, 0) scale(1);
            opacity: 0.18;
          }
          50% {
            transform: translate3d(10px, -40px, 0) scale(1.05);
            opacity: 0.32;
          }
          100% {
            transform: translate3d(-15px, -90px, 0) scale(1);
            opacity: 0.16;
          }
        }
      `}</style>
    </main>
  );
}
