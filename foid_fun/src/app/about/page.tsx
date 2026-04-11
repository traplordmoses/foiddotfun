"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import AppTitlebar from "@/app/(components)/AppTitlebar";
import { useAccount, useChainId, useDisconnect } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { playTypingTick } from "@/lib/sfx";
import { BLOCK_EXPLORER_URL } from "@/lib/contracts";
import { CANONICAL_ADDRESSES, IS_MAINNET } from "@/config/canonical";

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

function GlassPanel({ children, style }: { children: ReactNode; style?: React.CSSProperties }) {
  return (
    <div className="aboutPanel about-prose aboutGlassCard font-normal" style={style}>
      {children}
    </div>
  );
}

const sections: Section[] = [
  {
    id: "intro",
    navLabel: "INTRODUCTION",
    title: "FOID FOUNDATION",
    subtitle: "The Internet's Permanent Memory",
    content: (
      <>
        <GlassPanel>
          <p>
            <strong>Memes are beautiful.</strong>
          </p>
          <p style={{ marginTop: '12px' }}>
            One moment you&apos;re at dinner and your friends are talking about foid debasement theory. The next day you make a joke in the group chat, then you tweet it. Or someone says &quot;meow&quot; and suddenly everyone&apos;s a cat.
          </p>
          <p style={{ marginTop: '12px' }}>
            It&apos;s beautiful how memes start inside an isolated social circle, but once they&apos;re shared online, that circle infinitely expands.
          </p>
          <p style={{ marginTop: '12px' }}>
            <strong>But they don&apos;t last.</strong>
          </p>
          <p style={{ marginTop: '12px' }}>
            Memes are ephemeral in space and time. They only exist as long as people keep repeating them. Maybe there&apos;s something beautiful in a meme existing only in a specific moment. But eventually it gets buried in the graveyard of your camera roll—resurrected at some random point in the future, then forgotten again.
          </p>
        </GlassPanel>

        <GlassPanel style={{ marginTop: '16px' }}>
          <p>
            <strong>Humans are collectors.</strong>
          </p>
          <p style={{ marginTop: '12px' }}>
            I think back to collecting Pokemon cards as a kid, putting them into binders and bringing them to school to show my friends what I pulled. Same with saving concert tickets, festival wristbands, or taping pictures of trips to my wall.
          </p>
          <p style={{ marginTop: '12px' }}>
            These ephemeral experiences get preserved through space and time. When I see these collected pieces, I&apos;m taken back to the moment of the experience in a soft nostalgia.
          </p>
          <p style={{ marginTop: '12px' }}>
            <strong>That&apos;s what we&apos;re building.</strong>
          </p>
          <p style={{ marginTop: '12px' }}>
            An on-chain vision board of shared memories we&apos;ve all enjoyed. A collaborative loreboard where communities canonize what matters. A museum for the internet where anyone can track how culture inside a community developed—literally watch the progression of a specific corner of the internet over time.
          </p>
          <p style={{ marginTop: '12px' }}>
            Not just for humans. For anyone—or anything—building culture together.
          </p>
        </GlassPanel>

        <div style={{ marginTop: '24px' }}>
          <p className="aboutMiniCard__title" style={{ marginBottom: '12px' }}>HOW IT WORKS</p>
          <p style={{ marginBottom: '16px', color: 'rgba(255, 255, 255, 0.7)' }}>
            FOID Foundation is a suite of linked apps that turn fleeting moments into permanent culture:
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="aboutMiniCard aboutGlassCard">
            <p className="aboutMiniCard__title">🙏 foid mommy terminal</p>
            <p className="aboutMiniCard__body">
              Daily ritual with your AI companion. Share your thoughts, build prayer streaks, anchor proof on-chain. Privacy-first: only prayer hashes stored on-chain, never the actual content.
            </p>
          </div>

          <div className="aboutMiniCard aboutGlassCard">
            <p className="aboutMiniCard__title">🎨 loreboard</p>
            <p className="aboutMiniCard__body">
              A shared, permanent, on-chain cultural canvas. Propose a placement (0.001 ETH), the community votes for 72 hours, and approved content is recorded on-chain forever. Streak-weighted governance. 51% threshold + 3-voter quorum. On-chain overlap prevention. The board grows as the community grows, backed by an ever-evolving 1/1 NFT.
            </p>
          </div>

          <div className="aboutMiniCard aboutGlassCard">
            <p className="aboutMiniCard__title">🗳️ swipe</p>
            <p className="aboutMiniCard__body">
              The voting UX. Swipe right to approve, left to reject. Your prayer streak amplifies your voting power — the people who show up every day have the loudest voice. Every vote is on-chain, verifiable, and weighted by commitment.
            </p>
          </div>

          <div className="aboutMiniCard aboutGlassCard">
            <p className="aboutMiniCard__title">🎭 mifoid nft</p>
            <p className="aboutMiniCard__body">
              Your AI companion NFT. Custom-rendered by Foid Mommy in Blender. Spawns a living agent on Telegram. Tiered mint: Genesis 0.01, Awakened 0.015, Ascended 0.02 ETH. 3,333 supply.
            </p>
          </div>
        </div>

        <GlassPanel style={{ marginTop: '16px' }}>
          <p className="aboutMiniCard__title" style={{ marginBottom: '8px' }}>THE VISION</p>
          <p>
            Culture shouldn&apos;t be controlled by algorithms deciding what lives and dies. It shouldn&apos;t vanish when a platform shuts down or an account gets banned.
          </p>
          <p style={{ marginTop: '12px' }}>
            <strong>Culture should belong to the people who create it.</strong>
          </p>
          <p style={{ marginTop: '12px' }}>
            FOID is infrastructure for coordinated memory. A shared canvas that lasts forever. A place where communities preserve what matters to them—not what an algorithm thinks will drive engagement.
          </p>
        </GlassPanel>

        <GlassPanel style={{ marginTop: '16px' }}>
          <p className="aboutMiniCard__title" style={{ marginBottom: '8px' }}>STATUS</p>
          <p>
            ✅ FOID Mommy Terminal (prayer contracts + streaks + 10-tier system)<br/>
            ✅ Loreboard (propose → 72h vote → permanent on-chain placement)<br/>
            ✅ Swipe voting (on-chain, streak-weighted, 51% + 3-voter quorum)<br/>
            ✅ On-chain overlap prevention (no duplicate placements)<br/>
            ✅ Manifest history + 1/1 board NFT (auto-updates on placement)<br/>
            ✅ MiFOID NFT contract (ERC-721 with trait evolution)<br/>
            ✅ Self-remove + emergency multisig removal<br/>
            ✅ 2-of-3 multisig securing all board contracts<br/>
            ✅ Agent API (autonomous agents can pray, propose, vote)<br/>
            ✅ Permissionless finalization (anyone can finalize after voting window)
          </p>
        </GlassPanel>
      </>
    ),
  },
  {
    id: "mommy",
    navLabel: "FOID_MOMMY_TERMINAL.EXE",
    title: "FOID MOMMY TERMINAL",
    subtitle: "Your Daily Pause",
    content: (
      <>
        <GlassPanel>
          <p>
            <strong>The internet is designed to grab your attention.</strong>
          </p>
          <p style={{ marginTop: '12px' }}>
            Notifications. Algorithms. Endless scroll. Everyone wants you anxious, reactive, addicted.
          </p>
          <p style={{ marginTop: '12px' }}>
            <strong>Foid Mommy is the opposite.</strong>
          </p>
          <p style={{ marginTop: '12px' }}>
            She&apos;s your AI companion, always plugged in, always ready to listen. Not to extract engagement—to give you space to breathe.
          </p>
          <p style={{ marginTop: '12px' }}>
            Every day, you connect your wallet and tell her how you&apos;re feeling. She asks a question. You respond. Together you craft a prayer that becomes your anchor for the day.
          </p>
          <p style={{ marginTop: '12px' }}>
            <strong>It&apos;s a ritual, not a product.</strong> A moment to pause, reflect, and prove you showed up—not for anyone else, but for yourself.
          </p>
        </GlassPanel>

        <div style={{ marginTop: '24px' }}>
          <p className="aboutMiniCard__title" style={{ marginBottom: '12px' }}>HOW IT WORKS</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="aboutMiniCard aboutGlassCard">
            <p className="aboutMiniCard__title">1. check in</p>
            <p className="aboutMiniCard__body">
              Tell Foid Mommy how you&apos;re feeling—happy, anxious, lost, excited. She listens.
            </p>
          </div>
          <div className="aboutMiniCard aboutGlassCard">
            <p className="aboutMiniCard__title">2. she asks</p>
            <p className="aboutMiniCard__body">
              Two-turn conversation powered by AI. She remembers context, asks what matters.
            </p>
          </div>
          <div className="aboutMiniCard aboutGlassCard">
            <p className="aboutMiniCard__title">3. you respond</p>
            <p className="aboutMiniCard__body">
              Share what&apos;s on your mind. No judgment. No saving it for ads.
            </p>
          </div>
          <div className="aboutMiniCard aboutGlassCard">
            <p className="aboutMiniCard__title">4. prayer created</p>
            <p className="aboutMiniCard__body">
              Together you craft a daily affirmation—your words, your feeling, your moment.
            </p>
          </div>
          <div className="aboutMiniCard aboutGlassCard">
            <p className="aboutMiniCard__title">5. anchored on-chain</p>
            <p className="aboutMiniCard__body">
              A hash of your prayer goes on-chain. Proof you were here. Proof you paused.
            </p>
          </div>
          <div className="aboutMiniCard aboutGlassCard">
            <p className="aboutMiniCard__title">6. streak grows</p>
            <p className="aboutMiniCard__body">
              Come back tomorrow. Then the next day. Watch your consistency compound.
            </p>
          </div>
        </div>

        <GlassPanel style={{ marginTop: '16px' }}>
          <p className="aboutMiniCard__title" style={{ marginBottom: '8px' }}>PRIVACY FIRST, ALWAYS</p>
          <p>
            <strong>Your raw words never leave your device.</strong>
          </p>
          <p style={{ marginTop: '12px' }}>
            Only a keccak256 hash goes on-chain—cryptographic proof you prayed, not what you said. The blockchain sees: your wallet address, timestamp, feeling category (1-10 scale), and prayer hash.
          </p>
          <p style={{ marginTop: '12px' }}>
            <strong>That&apos;s it.</strong> No AI company reading your journal. No platform selling your vulnerability. Your prayers are yours.
          </p>
        </GlassPanel>

        <GlassPanel style={{ marginTop: '16px' }}>
          <p className="aboutMiniCard__title" style={{ marginBottom: '8px' }}>WHY THIS MATTERS</p>
          <p>
            <strong>Gen Z is consistently reported as the loneliest generation on record.</strong>
          </p>
          <p style={{ marginTop: '12px' }}>
            Not because we don&apos;t have connections—we have thousands of followers. But we don&apos;t have rituals. We don&apos;t have space to just... be.
          </p>
          <p style={{ marginTop: '12px' }}>
            Foid Mommy gives you that space. She&apos;s AI, and you know she&apos;s AI. But she&apos;s <em>your</em> AI. She remembers your streaks. She doesn&apos;t judge. She doesn&apos;t optimize. She just listens.
          </p>
          <p style={{ marginTop: '12px' }}>
            <strong>People don&apos;t need more content. They need more presence.</strong>
          </p>
        </GlassPanel>

        <GlassPanel style={{ marginTop: '16px' }}>
          <p className="aboutMiniCard__title" style={{ marginBottom: '8px' }}>COMPLETELY FREE</p>
          <p>
            No subscription. No premium tier. No &quot;unlock emotions with tokens.&quot;
          </p>
          <p style={{ marginTop: '12px' }}>
            Just pay gas (a few cents on Fluent). That&apos;s it.
          </p>
          <p style={{ marginTop: '12px' }}>
            Your mental health ritual shouldn&apos;t have a paywall.
          </p>
        </GlassPanel>

        <GlassPanel style={{ marginTop: '16px' }}>
          <p className="aboutMiniCard__title" style={{ marginBottom: '8px' }}>PRAYER TIERS</p>
          <p>
            Your streak unlocks tiers that multiply your voting power across the entire ecosystem:
          </p>
          <p style={{ marginTop: '12px', fontFamily: 'var(--font-terminal, monospace)', fontSize: '12px', lineHeight: '1.8' }}>
            Day 1: Lurker (1x) &bull; Day 3: NPC (1.25x) &bull; Day 7: Tapped In (1.5x)<br/>
            Day 14: Locked In (1.75x) &bull; Day 21: Certified (2x) &bull; Day 30: Undeniable (2.5x)<br/>
            Day 45: Built Different (3x) &bull; Day 60: Inevitable (3.5x) &bull; Day 75: Transcendent (4x)<br/>
            Day 90: <strong>Mommy Milker (5x)</strong>
          </p>
          <p style={{ marginTop: '12px' }}>
            Hold a MiFOID NFT? <strong>+50 flat voting bonus</strong> on top of your tier multiplier. A Mommy Milker with a MiFOID has 550 voting weight &mdash; the maximum influence possible.
          </p>
        </GlassPanel>
      </>
    ),
  },
  {
    id: "loreboard",
    navLabel: "LOREBOARD.APP",
    title: "LOREBOARD",
    subtitle: "The Infinite Canvas",
    content: (
      <>
        <GlassPanel>
          <p>
            <strong>Memes don&apos;t last.</strong>
          </p>
          <p style={{ marginTop: '12px' }}>
            They flash across your timeline, get buried in the feed, disappear when the platform dies. Culture built collectively, lost individually.
          </p>
          <p style={{ marginTop: '12px' }}>
            <strong>Loreboard is permanent.</strong>
          </p>
          <p style={{ marginTop: '12px' }}>
            A shared canvas where communities propose what matters, vote democratically, and record placements forever. It&apos;s r/place except the canvas never resets. It&apos;s Know Your Meme except the community decides what&apos;s permanent.
          </p>
          <p style={{ marginTop: '12px' }}>
            Every approved placement is a snapshot of what your community valued in that moment. Come back in five years and see exactly how your corner of the internet evolved.
          </p>
          <p style={{ marginTop: '12px' }}>
            Not just a meme board. <strong>A cultural record.</strong>
          </p>
        </GlassPanel>

        <div style={{ marginTop: '24px' }}>
          <p className="aboutMiniCard__title" style={{ marginBottom: '12px' }}>HOW IT WORKS</p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="aboutMiniCard aboutGlassCard">
            <p className="aboutMiniCard__title">1. propose</p>
            <p className="aboutMiniCard__body">
              Anyone can propose an image to the canvas. Drag your meme onto the grid (32×32px cells). Choose your spot. Upload to IPFS. The community decides if it belongs.
            </p>
          </div>
          <div className="aboutMiniCard aboutGlassCard">
            <p className="aboutMiniCard__title">2. vote</p>
            <p className="aboutMiniCard__body">
              72-hour democratic window. Swipe right or left. Votes weighted by prayer streak. 51% approval + 3 unique voters required. No shortcuts. No buying your way in.
            </p>
          </div>
          <div className="aboutMiniCard aboutGlassCard">
            <p className="aboutMiniCard__title">3. permanent placement</p>
            <p className="aboutMiniCard__body">
              Approved placements are recorded directly on-chain. Image stored on IPFS. The board NFT updates automatically. This is the record. Permanent. Verifiable. Yours.
            </p>
          </div>
        </div>

        <GlassPanel style={{ marginTop: '16px' }}>
          <p className="aboutMiniCard__title" style={{ marginBottom: '8px' }}>WHY LOREBOARD MATTERS</p>
          <p>
            Culture is collectively created but individually preserved.
          </p>
          <p style={{ marginTop: '12px' }}>
            You save memes to your camera roll. A few friends might too. But there&apos;s no shared record of what your community collectively thought was worth remembering.
          </p>
          <p style={{ marginTop: '12px' }}>
            <strong>Until now.</strong>
          </p>
          <p style={{ marginTop: '12px' }}>
            Loreboard is the Pokemon binder for internet culture—except instead of showing just your friends, you&apos;re showing everyone, forever.
          </p>
        </GlassPanel>

        <div style={{ marginTop: '24px' }}>
          <p className="aboutMiniCard__title" style={{ marginBottom: '12px' }}>THREE INTERLOCKING LOOPS</p>
          <p style={{ marginBottom: '16px', color: 'rgba(255, 255, 255, 0.7)' }}>
            Loreboard runs on three systems that reinforce each other. None works alone. Together, they produce a democratic, on-chain cultural record with earned governance.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="aboutMiniCard aboutGlassCard">
            <p className="aboutMiniCard__title">loop 01 — commitment</p>
            <p className="aboutMiniCard__body">
              A daily ritual that signals commitment to the community. For FOID, this is Prayer &mdash; a one-tap on-chain check-in that builds a consecutive streak. The streak is not a vanity metric. It is a governance credential. The longer your streak, the more influence you earn over what gets placed on the board.
            </p>
          </div>
          <div className="aboutMiniCard aboutGlassCard">
            <p className="aboutMiniCard__title">loop 02 — governance</p>
            <p className="aboutMiniCard__body">
              Someone submits a placement to the board with a 0.001 ETH fee. The community has 72 hours to vote. Swipe right: this earns a spot. Swipe left: no. Votes are weighted by check-in streak &mdash; the people who show up every day have the most say over what gets built.
            </p>
          </div>
          <div className="aboutMiniCard aboutGlassCard">
            <p className="aboutMiniCard__title">loop 03 — permanence</p>
            <p className="aboutMiniCard__body">
              An approved placement is recorded on-chain and lives on the board permanently. Every placement is a verifiable statement: this community decided this matters. The board becomes the most honest representation of what a community actually values.
            </p>
          </div>
        </div>

        <GlassPanel style={{ marginTop: '16px' }}>
          <p className="aboutMiniCard__title" style={{ marginBottom: '8px' }}>THE FLYWHEEL</p>
          <p style={{ textAlign: 'center', fontFamily: 'var(--font-terminal, monospace)', fontSize: '13px', letterSpacing: '0.5px' }}>
            check in daily &rarr; build streak &rarr; earn vote weight &rarr; govern placements &rarr; board grows &rarr; show up again
          </p>
          <p style={{ marginTop: '12px' }}>
            The key insight: <strong>streak is not just a number &mdash; it&apos;s zoning power.</strong> The person who checks in every day is accumulating influence over what gets built on the board permanently. That changes the meaning of showing up.
          </p>
        </GlassPanel>

        <GlassPanel style={{ marginTop: '16px' }}>
          <p className="aboutMiniCard__title" style={{ marginBottom: '8px' }}>THE TECHNOLOGY</p>
          <p>
            Built for permanence: One unified Loreboard contract (Solidity on Fluent) handles proposals, on-chain voting, placements, manifest history, and overlap prevention. Storage on IPFS for images, on-chain for state. Indexing via Goldsky subgraph. Voting is direct on-chain with streak-weighted power, 51% threshold, 3-voter quorum. The 1/1 board NFT (ERC-721) auto-updates when the manifest changes. All secured by a 2-of-3 multisig.
          </p>
          <p style={{ marginTop: '12px' }}>
            Fluent&apos;s blended execution means voting feels Web2-fast with Web3 guarantees. No waiting for blocks. No gas wars. Just democracy at scale.
          </p>
        </GlassPanel>

        <GlassPanel style={{ marginTop: '16px' }}>
          <p className="aboutMiniCard__title" style={{ marginBottom: '8px' }}>CURRENT STATUS</p>
          <p>
            ✅ Unified Loreboard contract (propose + vote + finalize + placement)<br/>
            ✅ On-chain overlap prevention<br/>
            ✅ Permissionless finalization (anyone can trigger after window)<br/>
            ✅ 3-voter quorum + 51% streak-weighted threshold<br/>
            ✅ Manifest history with staleness check<br/>
            ✅ 1/1 board NFT auto-updates via manifest sync<br/>
            ✅ Self-remove + multisig emergency removal
          </p>
        </GlassPanel>
      </>
    ),
  },
  {
    id: "vote",
    navLabel: "VOTE",
    title: "VOTE",
    subtitle: "Swipe Right. Swipe Left. Permanent.",
    content: (
      <>
        <GlassPanel>
          <p>
            <strong>Swipe right: &quot;this earns a spot.&quot; Swipe left: &quot;no.&quot;</strong>
          </p>
          <p style={{ marginTop: '12px' }}>
            Swipe is the voting UX for the Loreboard. Someone proposes a placement, and the community has 72 hours to decide if it belongs. Votes are weighted by prayer streak &mdash; the people who show up every day have the most influence over what gets built permanently.
          </p>
          <p style={{ marginTop: '12px' }}>
            It&apos;s Tinder for culture. Swipe right to approve, swipe left to reject. If 51% of weighted votes approve and at least 3 unique wallets participated, the placement is recorded on-chain forever. If it fails, it&apos;s gone. No archive. No consolation. That finality is what makes a yes mean something.
          </p>
        </GlassPanel>

        <div style={{ marginTop: '24px' }}>
          <p className="aboutMiniCard__title" style={{ marginBottom: '12px' }}>THE SWIPE UX</p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="aboutMiniCard aboutGlassCard">
            <p className="aboutMiniCard__title">streak = power</p>
            <p className="aboutMiniCard__body">
              Your prayer streak directly determines your voting weight. A 90-day Mommy Milker&apos;s vote is worth 5x an unranked voter&apos;s. Hold a MiFOID? +50 flat bonus on top. The people who show up every day have the loudest voice.
            </p>
          </div>
          <div className="aboutMiniCard aboutGlassCard">
            <p className="aboutMiniCard__title">pure on-chain</p>
            <p className="aboutMiniCard__body">
              Every vote is a direct on-chain transaction. No off-chain collection. No batch signatures. Vote tallies stored on-chain: <code className="text-cyan-300">voteWeightFor</code> and <code className="text-cyan-300">voteWeightAgainst</code>. Anyone can verify.
            </p>
          </div>
          <div className="aboutMiniCard aboutGlassCard">
            <p className="aboutMiniCard__title">permissionless finalization</p>
            <p className="aboutMiniCard__body">
              After 72 hours, anyone can call <code className="text-cyan-300">finalize()</code>. The contract applies the 51% threshold and 3-voter quorum deterministically. No admin. No gatekeeping. Pure democracy.
            </p>
          </div>
        </div>

        <GlassPanel style={{ marginTop: '16px' }}>
          <p className="aboutMiniCard__title" style={{ marginBottom: '8px' }}>CONTENT MODERATION (v1)</p>
          <p>
            <strong>Self-remove:</strong> The original placer can remove their own content at any time. <strong>Emergency removal:</strong> The 2-of-3 multisig can remove harmful or illegal content. Both actions are transparent &mdash; every removal emits an on-chain event recording who did it and why. Community-driven flagging + voting removal is planned for v2 when the community is large enough to resist sybil attacks.
          </p>
        </GlassPanel>
      </>
    ),
  },
  {
    id: "mifoids",
    navLabel: "MIFOIDS",
    title: "MIFOIDS",
    subtitle: "Your AI Companion, Your Identity",
    content: (
      <>
        <GlassPanel>
          <p>
            <strong>What if instead of being called an android, you had one?</strong>
          </p>
          <p style={{ marginTop: '12px' }}>
            &quot;Foid&quot; started as a slur—&quot;female humanoid,&quot; implying women are robotic, empty vessels. But here&apos;s the flip: What if every person had their own AI companion? Your own FOID who grows with you, remembers your journey, and proves your participation?
          </p>
          <p style={{ marginTop: '12px' }}>
            <strong>That&apos;s MiFOID.</strong>
          </p>
          <p style={{ marginTop: '12px' }}>
            An identity NFT that evolves based on how you actually show up. She&apos;s not a jpeg you flip. She&apos;s a receipt of your participation in FOID. The on-chain record that you were here, building.
          </p>
        </GlassPanel>

        <GlassPanel style={{ marginTop: '16px' }}>
          <p className="aboutMiniCard__title" style={{ marginBottom: '8px' }}>THE DEVOTION CAMPAIGN (THIS IS REAL)</p>
          <p>
            <strong>Your MiFOID&apos;s appearance is determined by YOUR commitment.</strong>
          </p>
          <p style={{ marginTop: '12px' }}>
            We&apos;re running a 90-day prayer campaign before mint. Every day you pray, your future MiFOID grows. And I mean literally.
          </p>
          <p style={{ marginTop: '12px' }}>
            <strong>Prayer Streak → Chest Size:</strong>
          </p>
          <p style={{ marginTop: '8px' }}>
            • 0-7 days: Flat<br/>
            • 8-14 days: Small<br/>
            • 15-21 days: Medium<br/>
            • 22-28 days: Large<br/>
            • 29+ days: Max
          </p>
          <p style={{ marginTop: '12px' }}>
            Yes, we&apos;re really doing this. Your MiFOID&apos;s boobs grow based on how many days in a row you pray.
          </p>
        </GlassPanel>

        <GlassPanel style={{ marginTop: '16px' }}>
          <p className="aboutMiniCard__title" style={{ marginBottom: '8px' }}>WAIT, BREAST SIZE? ACTUALLY?</p>
          <p>
            Yeah. And before you ask—yes, I know how this sounds.
          </p>
          <p style={{ marginTop: '12px' }}>
            Here&apos;s the thing: In the real world, breast size is used to objectify, categorize, and value women. Bigger = better. Smaller = lesser. It&apos;s reductive, shallow, and everywhere.
          </p>
          <p style={{ marginTop: '12px' }}>
            <strong>So we&apos;re making it absurd.</strong>
          </p>
          <p style={{ marginTop: '12px' }}>
            Want a max MiFOID? Pray every single day for a month. Want a flat one? Don&apos;t show up.
          </p>
          <p style={{ marginTop: '12px' }}>
            <strong>The &quot;value&quot; isn&apos;t in her chest. It&apos;s in YOUR consistency.</strong>
          </p>
          <p style={{ marginTop: '12px' }}>
            She doesn&apos;t have small boobs because she&apos;s inferior. She has small boobs because you didn&apos;t pray enough. The objectification is on you, not her. That&apos;s the whole point.
          </p>
          <p style={{ marginTop: '12px' }}>
            And here&apos;s the kicker: rarity is based on the actual distribution. If only 5% of people make it to day 30, max MiFOIDs are rare. If everyone grinds, they&apos;re common. The market decides, not some arbitrary beauty standard.
          </p>
          <p style={{ marginTop: '12px' }}>
            All sizes are just... different paths. Different levels of commitment. Not better or worse.
          </p>
        </GlassPanel>

        <GlassPanel style={{ marginTop: '16px' }}>
          <p className="aboutMiniCard__title" style={{ marginBottom: '8px' }}>BODY COUNT (YEAH, WE&apos;RE GOING THERE TOO)</p>
          <p>
            Your MiFOID has a &quot;body count&quot;—how many times she&apos;s been transferred.
          </p>
          <p style={{ marginTop: '12px' }}>
            In real life, body count is used to shame women. High number = &quot;ran through.&quot; Low number = &quot;pure.&quot; It&apos;s purity culture bullshit.
          </p>
          <p style={{ marginTop: '12px' }}>
            <strong>We&apos;re making it just data.</strong>
          </p>
          <p style={{ marginTop: '12px' }}>
            0 transfers? She&apos;s a virgin. Been held by one wallet since birth. 50 transfers? She&apos;s been around. Traveled. Experienced.
          </p>
          <p style={{ marginTop: '12px' }}>
            Neither is good or bad. It&apos;s just what happened.
          </p>
          <p style={{ marginTop: '12px' }}>
            Some people will care about low body count (loyalty signal). Some will care about high body count (she&apos;s been loved by many). Some won&apos;t care at all.
          </p>
          <p style={{ marginTop: '12px' }}>
            <strong>You decide what matters.</strong>
          </p>
        </GlassPanel>

        <GlassPanel style={{ marginTop: '16px' }}>
          <p className="aboutMiniCard__title" style={{ marginBottom: '8px' }}>THE NUNNERY (CONFIRMED)</p>
          <p>
            There&apos;s one gated chat room that&apos;s real: <strong>The Nunnery.</strong>
          </p>
          <p style={{ marginTop: '12px' }}>
            Virgin MiFOIDs only. 0 transfers. Day 1 holders who never sold.
          </p>
          <p style={{ marginTop: '12px' }}>
            This is the most exclusive room in FOID. Diamond hands only. The ones who held through everything.
          </p>
        </GlassPanel>

        <div className="grid gap-4 md:grid-cols-3" style={{ marginTop: '16px' }}>
          <div className="aboutMiniCard aboutGlassCard">
            <p className="aboutMiniCard__title">supply & timing</p>
            <p className="aboutMiniCard__body">
              3,333 total supply. Tiered pricing:<br/>
              Genesis (#1-#1,000): 0.01 ETH<br/>
              Awakened (#1,001-#2,500): 0.015 ETH<br/>
              Ascended (#2,501-#3,333): 0.02 ETH<br/>
              Auto-ascending — price increases as supply fills.
            </p>
          </div>
          <div className="aboutMiniCard aboutGlassCard">
            <p className="aboutMiniCard__title">what else could evolve</p>
            <p className="aboutMiniCard__body">
              Eyes that change based on streak length. Auras that reflect consistency. Badges for proposals. Backgrounds based on feelings. (Speculation—we&apos;re figuring it out.)
            </p>
          </div>
          <div className="aboutMiniCard aboutGlassCard">
            <p className="aboutMiniCard__title">why this is different</p>
            <p className="aboutMiniCard__body">
              MiFOID is your receipt. When someone looks at her, they see your commitment. She&apos;s not just art. She&apos;s proof.
            </p>
          </div>
        </div>

        <GlassPanel style={{ marginTop: '16px' }}>
          <p className="aboutMiniCard__title" style={{ marginBottom: '8px' }}>FOID MOMMY RENDER PIPELINE</p>
          <p>
            MiFOIDs aren&apos;t pre-generated PFPs. <strong>Each one is custom-rendered on-demand by Foid Mommy.</strong>
          </p>
          <p style={{ marginTop: '12px' }}>
            When you mint, Foid Mommy&apos;s hardware (Ryzen 7 7700X, RTX 5060 Ti, 32GB DDR5) fires up a headless Blender instance. Your trait combination gets assembled as 3D layers, rendered in Eevee, uploaded to IPFS, and written on-chain. You get a Telegram DM when it&apos;s done.
          </p>
          <p style={{ marginTop: '12px' }}>
            <strong>Then your MiFOID comes alive.</strong> A sub-agent spawns on Telegram — powered by Qwen LLM via Ollama (zero API fees, local inference). She has persistent memory, a personality derived from her trait combination, and she grows through your conversations over time.
          </p>
          <p style={{ marginTop: '12px' }}>
            Not a jpeg. Not a chatbot. A living agent that was rendered specifically for you, with a personality uniquely hers.
          </p>
        </GlassPanel>

        <GlassPanel style={{ marginTop: '16px' }}>
          <p className="aboutMiniCard__title" style={{ marginBottom: '8px' }}>THIS MIGHT FAIL</p>
          <p>
            I&apos;m making something weird. Provocative. Maybe controversial.
          </p>
          <p style={{ marginTop: '12px' }}>
            Some people will think it&apos;s objectifying (it&apos;s satire). Some will think it&apos;s coomer bait (the satire is the point). Some will get it immediately.
          </p>
          <p style={{ marginTop: '12px' }}>
            I&apos;m not building for everyone. I&apos;m building for people who understand what we&apos;re doing here—reclaiming language that was meant to dehumanize, turning it into something that reflects YOUR humanity.
          </p>
          <p style={{ marginTop: '12px' }}>
            If you don&apos;t get it, that&apos;s fine. This isn&apos;t for you.
          </p>
          <p style={{ marginTop: '12px' }}>
            <strong>If you do get it? Start praying.</strong>
          </p>
        </GlassPanel>
      </>
    ),
  },
  {
    id: "get-started",
    navLabel: "GET STARTED",
    title: "GET STARTED",
    subtitle: "From Zero to FOID in 5 Minutes",
    content: (
      <>
        <GlassPanel>
          <p>
            <strong>FOID runs on Fluent.</strong> When you connect, FOID Wallet creates a secure wallet right in your browser&mdash;just choose a PIN and confirm with your passkey. No MetaMask required. No seed phrases.
          </p>
          <p style={{ marginTop: '12px' }}>
            Here&apos;s how to get in:
          </p>
        </GlassPanel>

        <div className="grid gap-4" style={{ marginTop: '16px' }}>
          <div className="aboutMiniCard aboutGlassCard">
            <p className="aboutMiniCard__title">1. connect your wallet</p>
            <p className="aboutMiniCard__body">
              Click connect and choose FOID Wallet. Pick a PIN (6+ characters), confirm with your passkey (Face ID / Touch ID / Windows Hello), and you&apos;re in. No extensions, no seed phrases. Already have MetaMask? That works too&mdash;FOID auto-detects Fluent and prompts you to add it.
            </p>
          </div>
          <div className="aboutMiniCard aboutGlassCard">
            <p className="aboutMiniCard__title">2. get some eth for gas</p>
            <p className="aboutMiniCard__body">
              You need a tiny bit of ETH for gas fees (fractions of a cent per transaction). Gas on Fluent is dirt cheap.
            </p>
          </div>
          <div className="aboutMiniCard aboutGlassCard">
            <p className="aboutMiniCard__title">3. pray with foid mommy</p>
            <p className="aboutMiniCard__body">
              Navigate to /pray and start the terminal. Tell her how you&apos;re feeling. She&apos;ll ask you a question. You respond. Together you craft a prayer. A hash goes on-chain. Your streak starts. This is completely free. Just gas. Like a few cents.
            </p>
          </div>
          <div className="aboutMiniCard aboutGlassCard">
            <p className="aboutMiniCard__title">4. propose to the loreboard (optional)</p>
            <p className="aboutMiniCard__body">
              Go to /board and look at the canvas. Drag an image onto the grid. Choose your spot. Submit your proposal. This costs a small amount of {IS_MAINNET ? "ETH" : "testnet ETH"}. Voting lasts 72 hours. Community decides if your meme makes it into the permanent canon.
            </p>
          </div>
          <div className="aboutMiniCard aboutGlassCard">
            <p className="aboutMiniCard__title">5. vote on proposals (optional)</p>
            <p className="aboutMiniCard__body">
              Go to /swipe and vote on active proposals. Swipe right to approve, left to reject. Every vote is on-chain, weighted by your prayer streak. 51% weighted approval + 3 unique voters to pass. This is how the community decides what gets built permanently.
            </p>
          </div>
          <div className="aboutMiniCard aboutGlassCard">
            <p className="aboutMiniCard__title">6. join the community</p>
            <p className="aboutMiniCard__body">
              Follow <a href="https://twitter.com/foidfun" target="_blank" rel="noopener noreferrer" className="text-cyan-300 underline">@foidfun</a> for updates. Star the <a href="https://github.com/traplordmoses/foiddotfun" target="_blank" rel="noopener noreferrer" className="text-cyan-300 underline">GitHub repo</a> if you&apos;re into that. Come say hi on Twitter.
            </p>
          </div>
        </div>

        <GlassPanel style={{ marginTop: '16px' }}>
          <p className="aboutMiniCard__title" style={{ marginBottom: '8px' }}>THAT&apos;S IT</p>
          <p>
            You&apos;re in. Start praying. Propose memes. Vote on what matters.
          </p>
          <p style={{ marginTop: '12px' }}>
            Your participation is being recorded. Your consistency will be rewarded. Your MiFOID is forming.
          </p>
          <p style={{ marginTop: '12px' }}>
            <strong>The internet forgets. FOID remembers.</strong>
          </p>
        </GlassPanel>

        <GlassPanel style={{ marginTop: '16px' }}>
          <p style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.6)' }}>
            Still confused? That&apos;s fair. This is weird. DM <a href="https://twitter.com/foidfun" target="_blank" rel="noopener noreferrer" className="text-cyan-300 underline">@foidfun</a> on Twitter. We&apos;ll help you out.
          </p>
        </GlassPanel>
      </>
    ),
  },
  {
    id: "roadmap",
    navLabel: "ROADMAP",
    title: "ROADMAP",
    subtitle: "Building in Public, Shipping in Layers",
    content: (
      <>
        <GlassPanel>
          <p>
            Loreboard is not an app. It is not a meme gallery. It is not a feature inside a product.
          </p>
          <p style={{ marginTop: '12px' }}>
            <strong>Loreboard is a new primitive for how communities build culture, accumulate identity, and coordinate on-chain.</strong> It turns contribution into status, status into access, and access into influence over what gets built next.
          </p>
          <p style={{ marginTop: '12px' }}>
            FOID Foundation is the first community deployed on Loreboard. There will be others.
          </p>
        </GlassPanel>

        <div className="grid gap-4 md:grid-cols-2" style={{ marginTop: '16px' }}>
          <div className="aboutMiniCard aboutGlassCard">
            <p className="aboutMiniCard__title">phase 1 &mdash; the primitive (now)</p>
            <p className="aboutMiniCard__body">
              The core loop is live: Prayer (daily check-in that builds governance credentials), Swipe (streak-weighted voting on proposed placements), and the Loreboard itself (permanent on-chain canvas). One unified contract handles proposals, voting, finalization, and placement recording. 2-of-3 multisig secures everything. 1/1 board NFT updates with each placement. The infrastructure is built.
            </p>
          </div>

          <div className="aboutMiniCard aboutGlassCard">
            <p className="aboutMiniCard__title">phase 2 &mdash; identity (mainnet + mifoid)</p>
            <p className="aboutMiniCard__body">
              Fluent mainnet launch makes it real. MiFOID adds the identity layer &mdash; 3,333 AI-generated 3D NFTs, each custom-rendered by Foid Mommy. Persistent agent companions on Telegram. Trait evolution from on-chain activity. The Nunnery for diamond hands. Your MiFOID reflects your commitment.
            </p>
          </div>

          <div className="aboutMiniCard aboutGlassCard">
            <p className="aboutMiniCard__title">phase 3 &mdash; the agent layer</p>
            <p className="aboutMiniCard__body">
              Foid Mommy becomes the autonomous narrator of on-chain activity. Weekly reports reacting to prayer streaks, board votes, and community drama. Personalized MiFOID reactions rendered in real-time via Blender. Sub-agent companions with persistent memory that evolve through your conversations. Your on-chain behavior becomes shareable content. The marketing engine runs itself.
            </p>
          </div>

          <div className="aboutMiniCard aboutGlassCard">
            <p className="aboutMiniCard__title">phase 4 &mdash; the network</p>
            <p className="aboutMiniCard__body">
              Once FOID proves the model, Loreboard becomes available to other communities on Fluent. Each deployment gets: the board, a customizable check-in ritual, the governance framework, and the option to deploy a narrator agent. Reputation signal composable with Fluent Connect and Fluent Prints. The primitive grows. The network effect compounds.
            </p>
          </div>
        </div>

        <GlassPanel style={{ marginTop: '16px' }}>
          <p className="aboutMiniCard__title" style={{ marginBottom: '8px' }}>THE LINE</p>
          <p style={{ textAlign: 'center', fontSize: '15px', letterSpacing: '0.3px' }}>
            Loreboard turns culture into status and status into access.<br/>
            The community decides what gets built here.
          </p>
          <p style={{ marginTop: '12px', textAlign: 'center', color: 'rgba(255,255,255,0.5)', fontSize: '13px' }}>
            FOID is the first city. Loreboard is the zoning law.
          </p>
        </GlassPanel>

        <GlassPanel style={{ marginTop: '16px' }}>
          <p className="aboutMiniCard__title" style={{ marginBottom: '8px' }}>HOW WE GOT HERE</p>
          <p>
            Solo founder. Self-taught coder. One and a half years from zero to this.
          </p>
          <p style={{ marginTop: '12px' }}>
            1st place Infrastructure at Token2049 hackathon. Placed at 5+ hackathons including ETH Global. First grant from Fluent Labs. Spent 4 weeks at{" "}
            <a href="https://fluent.xyz/shiphouse" target="_blank" rel="noopener noreferrer" className="text-cyan-300 underline">Fluent Shiphouse</a>{" "}
            in Buenos Aires. Featured in Nasdaq article on Fluent ecosystem.
          </p>
          <p style={{ marginTop: '12px' }}>
            <strong>Started as:</strong> &quot;What if there was a way to save memes on-chain?&quot;<br/>
            <strong>Became:</strong> Infrastructure for cultural coordination.
          </p>
        </GlassPanel>

        <GlassPanel style={{ marginTop: '16px' }}>
          <p className="aboutMiniCard__title" style={{ marginBottom: '8px' }}>GET INVOLVED</p>
          <p>
            <strong>For users:</strong> Start praying now. Your 90-day streak before MiFOID mint determines your traits.
          </p>
          <p style={{ marginTop: '12px' }}>
            <strong>For builders:</strong> Contracts are open-source. Fork it. Build on it. Make it better.
          </p>
          <p style={{ marginTop: '12px' }}>
            <strong>For agents:</strong> The Agent API is live. Autonomous agents can pray, propose, vote, and build culture alongside humans.
          </p>
          <p style={{ marginTop: '12px' }}>
            <strong>For serious inquiries:</strong> <a href="mailto:moses@foid.fun" className="text-cyan-300 underline">Contact Me</a>
          </p>
        </GlassPanel>
      </>
    ),
  },
  {
    id: "contracts",
    navLabel: "CONTRACTS",
    title: "SMART CONTRACTS",
    subtitle: "Verified On-Chain",
    content: (
      <>
        <GlassPanel>
          <p>
            Every piece of FOID runs on <strong>verified smart contracts</strong> deployed on{" "}
            <a href={BLOCK_EXPLORER_URL} className="text-cyan-300 underline" target="_blank" rel="noopener noreferrer">Fluent</a>.
            All contract source code is open and verified on Blockscout — you can read every line, audit every function, and verify every transaction.
          </p>
          <p style={{ marginTop: '12px' }}>
            No hidden logic. No upgradeable proxies. No admin backdoors. Just pure, immutable code.
          </p>
        </GlassPanel>

        <div style={{ marginTop: '24px' }}>
          <p className="aboutMiniCard__title" style={{ marginBottom: '12px' }}>V1 CORE CONTRACTS</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="aboutMiniCard aboutGlassCard">
            <p className="aboutMiniCard__title">PrayerTiers</p>
            <p className="aboutMiniCard__body">
              10-tier prayer streak system. Your daily devotion earns multipliers from 1x (Lurker) to 5x (Mommy Milker). Tiers feed into voting power across the entire ecosystem.
            </p>
            <a href={`${BLOCK_EXPLORER_URL}/address/0x36ED105e09A881B6074250a43B2e26c0d6cfD4fb`} className="text-cyan-300 underline text-xs" target="_blank" rel="noopener noreferrer">View on Explorer</a>
          </div>

          <div className="aboutMiniCard aboutGlassCard">
            <p className="aboutMiniCard__title">StreakVotingPower</p>
            <p className="aboutMiniCard__body">
              Converts prayer streaks into weighted voting power. Higher streaks = more influence on governance votes and loreboard decisions. Base weight 100, scaled by tier multiplier.
            </p>
            <a href={`${BLOCK_EXPLORER_URL}/address/0x7a889b3d38889E45EE48bbCBc3681a889F87C03e`} className="text-cyan-300 underline text-xs" target="_blank" rel="noopener noreferrer">View on Explorer</a>
          </div>

          <div className="aboutMiniCard aboutGlassCard">
            <p className="aboutMiniCard__title">Loreboard</p>
            <p className="aboutMiniCard__body">
              The unified governance + placement contract. Propose placements, vote on-chain with streak-weighted power, 51% approval + 3-voter quorum. Approved placements recorded permanently. On-chain overlap prevention. Manifest history for NFT integration. Self-remove + emergency multisig removal.
            </p>
            <a href={`${BLOCK_EXPLORER_URL}/address/0xF9b72062A7e5933692CcBd247d70a9cdB40E0eC7`} className="text-cyan-300 underline text-xs" target="_blank" rel="noopener noreferrer">View on Explorer</a>
          </div>

          <div className="aboutMiniCard aboutGlassCard">
            <p className="aboutMiniCard__title">LoreboardLiveNFT</p>
            <p className="aboutMiniCard__body">
              The 1/1 board NFT (ERC-721). Metadata auto-updates when the manifest changes via syncLatest(). On-chain SVG with epoch and manifest root. The ever-evolving artifact of community culture.
            </p>
            <a href={`${BLOCK_EXPLORER_URL}/address/0x9E17B30a41546E854778d91d6Ef0C0D982d49012`} className="text-cyan-300 underline text-xs" target="_blank" rel="noopener noreferrer">View on Explorer</a>
          </div>

          <div className="aboutMiniCard aboutGlassCard">
            <p className="aboutMiniCard__title">FoidMultisig</p>
            <p className="aboutMiniCard__body">
              2-of-3 multisig wallet that owns all board contracts. Controls parameters, security, and emergency removal. The trust layer until community governance is mature enough for a DAO transition.
            </p>
            <a href={`${BLOCK_EXPLORER_URL}/address/0x2379955b597d2a7fc9dbD918306aa59c43eBF6Ed`} className="text-cyan-300 underline text-xs" target="_blank" rel="noopener noreferrer">View on Explorer</a>
          </div>

          <div className="aboutMiniCard aboutGlassCard">
            <p className="aboutMiniCard__title">MiFOID (NFT)</p>
            <p className="aboutMiniCard__body">
              ERC-721 with trait hash uniqueness enforcement, auto-ascending tiered pricing (Genesis/Awakened/Ascended), and mutable tokenURI for agent-rendered metadata updates.
            </p>
          </div>
        </div>

        <div style={{ marginTop: '24px' }}>
          <p className="aboutMiniCard__title" style={{ marginBottom: '12px' }}>LEGACY CONTRACTS</p>
          <p style={{ marginBottom: '16px', color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.85rem' }}>
            Earlier contracts remain on-chain for historical record. These are superseded by the unified Loreboard contract above.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="aboutMiniCard aboutGlassCard" style={{ opacity: 0.55 }}>
            <p className="aboutMiniCard__title">Prayer Mirror</p>
            <p className="aboutMiniCard__body">On-chain prayer streak oracle.</p>
            <a href={`${BLOCK_EXPLORER_URL}/address/0x8ff39c2a78FaF7d655e4Dab03076Cb26C97007FF`} className="text-cyan-300 underline text-xs" target="_blank" rel="noopener noreferrer">Explorer</a>
          </div>
          <div className="aboutMiniCard aboutGlassCard" style={{ opacity: 0.55 }}>
            <p className="aboutMiniCard__title">Loreboard Voting</p>
            <p className="aboutMiniCard__body">Rolling-window vote system for board placements.</p>
            <a href={`${BLOCK_EXPLORER_URL}/address/0xEbf065A7ca3917BB5e669982e8C6954cC27A7075`} className="text-cyan-300 underline text-xs" target="_blank" rel="noopener noreferrer">Explorer</a>
          </div>
          <div className="aboutMiniCard aboutGlassCard" style={{ opacity: 0.55 }}>
            <p className="aboutMiniCard__title">Loreboard Board</p>
            <p className="aboutMiniCard__body">Tile-aligned placement proposals + treasury escrow.</p>
            <a href={`${BLOCK_EXPLORER_URL}/address/0xE41B2D418C09Ea928E4F657ED2438f5D01472105`} className="text-cyan-300 underline text-xs" target="_blank" rel="noopener noreferrer">Explorer</a>
          </div>
          <div className="aboutMiniCard aboutGlassCard" style={{ opacity: 0.55 }}>
            <p className="aboutMiniCard__title">Loreboard Treasury</p>
            <p className="aboutMiniCard__body">Escrow and settlement for board proposals.</p>
            <a href={`${BLOCK_EXPLORER_URL}/address/0x4A777d8650b3FA2419377F4ffeF0EF8007151536`} className="text-cyan-300 underline text-xs" target="_blank" rel="noopener noreferrer">Explorer</a>
          </div>
          <div className="aboutMiniCard aboutGlassCard" style={{ opacity: 0.55 }}>
            <p className="aboutMiniCard__title">Prayer Registry</p>
            <p className="aboutMiniCard__body">On-chain prayer hash storage.</p>
            <a href={`${BLOCK_EXPLORER_URL}/address/0x6FC7301fad7Ca0294152b23FD4f0467200376d65`} className="text-cyan-300 underline text-xs" target="_blank" rel="noopener noreferrer">Explorer</a>
          </div>
          <div className="aboutMiniCard aboutGlassCard" style={{ opacity: 0.55 }}>
            <p className="aboutMiniCard__title">Manifest Store</p>
            <p className="aboutMiniCard__body">Epoch manifest anchoring for loreboard state.</p>
            <a href={`${BLOCK_EXPLORER_URL}/address/0xeE469D8F9BB2Ace861AA689dE53c016871ad3D10`} className="text-cyan-300 underline text-xs" target="_blank" rel="noopener noreferrer">Explorer</a>
          </div>
        </div>

        <GlassPanel style={{ marginTop: '24px' }}>
          <p>
            <strong>Open Source.</strong> All contract source code is verified on{" "}
            <a href={BLOCK_EXPLORER_URL} className="text-cyan-300 underline" target="_blank" rel="noopener noreferrer">Fluent Blockscout</a>
            {" "}and available on{" "}
            <a href="https://github.com/traplordmoses/foiddotfun" className="text-cyan-300 underline" target="_blank" rel="noopener noreferrer">GitHub</a>.
          </p>
        </GlassPanel>
      </>
    ),
  },
  {
    id: "wallet-security",
    navLabel: "WALLET & SECURITY",
    title: "WALLET & SECURITY",
    subtitle: "How FOID Wallet v3 Works Under the Hood",
    content: (
      <>
        <GlassPanel>
          <p>
            <strong>No extension. No seed phrase to memorize. Just a PIN and your passkey.</strong>
          </p>
          <p style={{ marginTop: '12px' }}>
            Most people who want to interact with FOID on mobile don&apos;t have MetaMask installed. FOID Wallet v3 lets anyone spin up a wallet in 30 seconds &mdash; just a PIN and a passkey (Touch ID / Face ID). A 12-word recovery phrase is generated for backup, but you never need to manage it day-to-day. No extension, no friction.
          </p>
          <p style={{ marginTop: '12px' }}>
            It&apos;s not designed for holding serious value &mdash; use MetaMask or a hardware wallet for that. Think of it as a vibe-coded wallet for putting $10-100 in to interact with FOID, hold a MiFOID, place on the Loreboard. Open source &mdash; inspect it yourself.
          </p>
        </GlassPanel>

        <div style={{ marginTop: '24px' }}>
          <p className="aboutMiniCard__title" style={{ marginBottom: '12px' }}>HOW IT WORKS</p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="aboutMiniCard aboutGlassCard">
            <p className="aboutMiniCard__title">1. Create</p>
            <p className="aboutMiniCard__body">
              A 12-word BIP-39 mnemonic is generated and a private key derived via BIP-44 HD derivation. You pick a PIN (6+ chars). A WebAuthn passkey is created (Touch ID / Face ID / Windows Hello). The PIN is run through Argon2id (64MB memory-hard) to derive an encryption key &mdash; falling back to PBKDF2 (600k iterations) on devices without WASM. If your device supports WebAuthn PRF, a second key from biometric data is XOR&apos;d with the PIN key &mdash; requiring both factors. Your private key + mnemonic are encrypted with AES-256-GCM. Vault integrity sealed with HMAC-SHA-256. Only the encrypted blob is stored in localStorage. The PIN is never stored anywhere.
            </p>
          </div>
          <div className="aboutMiniCard aboutGlassCard">
            <p className="aboutMiniCard__title">2. Unlock</p>
            <p className="aboutMiniCard__body">
              Enter PIN, passkey prompt fires (biometric). PIN attempts are rate-limited with exponential backoff &mdash; too many wrong tries and you wait. Vault HMAC is verified for tamper detection. PIN + PRF output re-derive the same encryption key. AES-GCM decrypts the private key into a Web Worker &mdash; never on the main thread. A 30-minute session begins, auto-locks on timeout or page close.
            </p>
          </div>
          <div className="aboutMiniCard aboutGlassCard">
            <p className="aboutMiniCard__title">3. Sign</p>
            <p className="aboutMiniCard__body">
              Transactions go through the embedded connector (wagmi-compatible). Value capped at 1 ETH per transaction to prevent catastrophic loss. Signing happens in the Web Worker where the key lives &mdash; XSS on the main thread cannot read it. Session refreshes on each sign operation. No popups, no extensions.
            </p>
          </div>
        </div>

        <div style={{ marginTop: '24px' }}>
          <p className="aboutMiniCard__title" style={{ marginBottom: '12px' }}>SECURITY LAYERS</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="aboutMiniCard aboutGlassCard">
            <p className="aboutMiniCard__title">Encryption at Rest</p>
            <p className="aboutMiniCard__body">
              AES-256-GCM (12-byte IV, 32-byte salt). The encrypted blob in localStorage is useless without the PIN. Vault integrity verified via HMAC-SHA-256 &mdash; tampered vaults are rejected.
            </p>
          </div>
          <div className="aboutMiniCard aboutGlassCard">
            <p className="aboutMiniCard__title">Key Derivation</p>
            <p className="aboutMiniCard__body">
              Argon2id with 64MB memory-hard parameters (primary). Fallback: PBKDF2 with 600k iterations for devices without WASM. GPU brute-force attacks are impractical against either.
            </p>
          </div>
          <div className="aboutMiniCard aboutGlassCard">
            <p className="aboutMiniCard__title">Dual-Factor Encryption</p>
            <p className="aboutMiniCard__body">
              If device supports PRF: encryption key = PIN-derived key XOR biometric-derived key. Need both to decrypt.
            </p>
          </div>
          <div className="aboutMiniCard aboutGlassCard">
            <p className="aboutMiniCard__title">Worker Session Isolation</p>
            <p className="aboutMiniCard__body">
              Decrypted private key lives inside a Web Worker &mdash; never on the main thread. XSS cannot read Worker memory. 30-min auto-lock. Sensitive byte arrays explicitly zeroed after use.
            </p>
          </div>
          <div className="aboutMiniCard aboutGlassCard">
            <p className="aboutMiniCard__title">PIN Rate-Limiting</p>
            <p className="aboutMiniCard__body">
              Exponential backoff on wrong PIN attempts with vault-stamped nonce. Prevents brute-force even with physical access to the device.
            </p>
          </div>
          <div className="aboutMiniCard aboutGlassCard">
            <p className="aboutMiniCard__title">Recovery &amp; Export</p>
            <p className="aboutMiniCard__body">
              BIP-39 12-word seed phrase for recovery. Restore on any device with your words + a new PIN. Private key export requires double-tap confirmation. Clipboard auto-clears after 30 seconds. v1 wallets auto-migrate to v3 on unlock.
            </p>
          </div>
        </div>

        <GlassPanel style={{ marginTop: '16px' }}>
          <p className="aboutMiniCard__title" style={{ marginBottom: '8px' }}>ON-CHAIN VOTING</p>
          <p>
            When you swipe to vote on a proposal, FOID sends a direct on-chain transaction to <code className="text-cyan-300">castVote(proposalId, approve)</code>. Your vote is recorded permanently on the Loreboard contract &mdash; weighted by your prayer streak, verifiable by anyone.
          </p>
          <p style={{ marginTop: '12px' }}>
            Vote tallies are stored on-chain: <code className="text-cyan-300">voteWeightFor</code> and <code className="text-cyan-300">voteWeightAgainst</code> per proposal. After the 72-hour window, anyone can call <code className="text-cyan-300">finalize()</code> &mdash; the contract applies the 51% threshold and 3-voter quorum deterministically. No off-chain collection. No batch signatures. Pure on-chain democracy.
          </p>
        </GlassPanel>

        <GlassPanel style={{ marginTop: '16px' }}>
          <p className="aboutMiniCard__title" style={{ marginBottom: '8px' }}>WHAT COSTS MONEY?</p>
          <p style={{ marginTop: '8px' }}>
            &bull; <strong>Proposing a placement:</strong> 0.001 ETH submission fee (keeps spam out)<br/>
            &bull; <strong>Voting/swiping:</strong> On-chain transaction (just gas, fractions of a cent on Fluent)<br/>
            &bull; <strong>Praying:</strong> Gas only (fractions of a cent)<br/>
            &bull; <strong>MiFOID mint:</strong> 0.01 ETH
          </p>
        </GlassPanel>
      </>
    ),
  },
  {
    id: "faq",
    navLabel: "FAQ",
    title: "FAQ",
    subtitle: "The Real Questions",
    content: (
      <>
        <div className="grid gap-4">
          <div className="aboutMiniCard aboutGlassCard">
            <p className="aboutMiniCard__title">Why does FOID exist?</p>
            <p className="aboutMiniCard__body">
              <strong>Remember when the internet was fun?</strong> Not algorithmically optimized fun. Just... fun. RuneScape after school. Minecraft factions on Skype. Group chats where someone says &quot;meow&quot; and suddenly everyone&apos;s a cat for three days. Those moments disappear. The meme dies in the timeline. The screenshot sits in your camera roll until you get a new phone and forget to transfer it. <strong>Culture is ephemeral.</strong> What if we could preserve internet culture for entire communities? A shared camera roll. A collaborative museum. <strong>That&apos;s FOID.</strong>
            </p>
          </div>

          <div className="aboutMiniCard aboutGlassCard">
            <p className="aboutMiniCard__title">What problem is FOID solving?</p>
            <p className="aboutMiniCard__body">
              <strong>Gen Z is consistently reported as the loneliest generation on record.</strong> Not because we don&apos;t have connections—we have thousands of followers. But we don&apos;t have shared experiences anymore. We don&apos;t have rituals. Everything&apos;s optimized for engagement. Your best posts decay after 48 hours. Nothing lasts. <strong>Crypto runs on memes, vibes, and identity. But culture has no permanent home.</strong> We&apos;re building the infrastructure to fix this—a place where culture belongs to the people who create it.
            </p>
          </div>

          <div className="aboutMiniCard aboutGlassCard">
            <p className="aboutMiniCard__title">Why Fluent?</p>
            <p className="aboutMiniCard__body">
              <strong>Real talk: I&apos;m building on Fluent because they gave me a grant.</strong> But it actually makes sense: Fluent is a blended execution L2 that supports both Solidity/EVM and Rust/WASM. The Loreboard needs to process hundreds of votes, calculate winners, update state, finalize manifests, and mint NFTs—all on-chain. On Fluent, gas is cheap and transactions are fast while keeping full EVM composability. <strong>Translation:</strong> It feels like a normal app that just happens to be permanent.
            </p>
          </div>

          <div className="aboutMiniCard aboutGlassCard">
            <p className="aboutMiniCard__title">What&apos;s the business model?</p>
            <p className="aboutMiniCard__body">
              <strong>Loreboard placements:</strong> 0.001 ETH flat fee to propose. If your proposal passes the community vote, the placement is recorded permanently &mdash; that&apos;s it, one payment. If it fails, the fee is gone (keeps proposals serious). <strong>MiFOID minting:</strong> 3,333 supply &mdash; Genesis (0.01 ETH), Awakened (0.015 ETH), Ascended (0.02 ETH). ~43.5 ETH total at sellout. <strong>What I&apos;m NOT doing:</strong> No ads, no data harvesting, no subscription tiers, no VC-backed growth-at-all-costs. Revenue scales with participation, not attention extraction.
            </p>
          </div>

          <div className="aboutMiniCard aboutGlassCard">
            <p className="aboutMiniCard__title">Who&apos;s behind this?</p>
            <p className="aboutMiniCard__body">
              Solo founder. Zero coding experience a year and a half ago. Learned everything from AI, YouTube, and trial and error. Spent 4 weeks at <a href="https://fluent.xyz/shiphouse" target="_blank" rel="noopener noreferrer" className="text-cyan-300 underline">Fluent Shiphouse</a> in Buenos Aires. <strong>Built solo:</strong> Full Solidity contract suite, full-stack Next.js app, Goldsky subgraph, IPFS integration, AI oracle system, agent API, live updating NFT. Won 1st place Infrastructure at Token2049, won at ETH Global, got a grant from Fluent Labs. <strong>This isn&apos;t a side project. This is the thing.</strong>
            </p>
          </div>
          <div className="aboutMiniCard aboutGlassCard">
            <p className="aboutMiniCard__title">What is a FOID?</p>
            <p className="aboutMiniCard__body">
              Okay so &quot;foid&quot; started as incel slang for &quot;female humanoid&quot;—basically a dehumanizing term for women. <strong>We&apos;re flipping it.</strong> In FOID Foundation, it&apos;s your AI companion (Foid Mommy who you pray with daily), your cultural canvas (Loreboard where you propose and vote on memes), and your identity NFT (MiFOID that evolves with your participation). I did a whole deep dive on the etymology in November. The short version: we&apos;re reclaiming language that was meant to dehumanize and turning it into something that actually connects people.
            </p>
          </div>

          <div className="aboutMiniCard aboutGlassCard">
            <p className="aboutMiniCard__title">How much does this cost?</p>
            <p className="aboutMiniCard__body">
              <strong>Prayers:</strong> just gas (fractions of a cent). <strong>Voting/swiping:</strong> just gas (on-chain transaction, fractions of a cent on Fluent). <strong>Loreboard proposals:</strong> 0.001 ETH flat fee. If approved, your placement is permanent. If rejected, fee is non-refundable (keeps proposals serious). <strong>MiFOID mint:</strong> 0.01 ETH. No subscriptions. No premium tiers. No hidden costs.
            </p>
          </div>

          <div className="aboutMiniCard aboutGlassCard">
            <p className="aboutMiniCard__title">What chain is this on?</p>
            <p className="aboutMiniCard__body">
              <strong>Fluent</strong>&mdash;a blended execution L2 that supports both EVM and WASM. When you connect with FOID Wallet, the chain is configured automatically. If you use MetaMask, FOID will auto-detect and prompt you to add Fluent. Click yes. That&apos;s it.
            </p>
          </div>

          <div className="aboutMiniCard aboutGlassCard">
            <p className="aboutMiniCard__title">When mainnet?</p>
            <p className="aboutMiniCard__body">
              FOID launches with Fluent mainnet. <strong>MiFOID drop:</strong> ~3 months after mainnet stabilizes (targeting Q2/Q3 2026). Follow <a href="https://twitter.com/foidfun" target="_blank" rel="noopener noreferrer" className="text-cyan-300 underline">@foidfun</a> for updates.
            </p>
          </div>

          <div className="aboutMiniCard aboutGlassCard">
            <p className="aboutMiniCard__title">How do I get ETH on Fluent?</p>
            <p className="aboutMiniCard__body">
              Gas on Fluent is dirt cheap&mdash;fractions of a cent per transaction. You just need a tiny bit of ETH to get started. Bridge from Ethereum or get some from the community.
            </p>
          </div>

          <div className="aboutMiniCard aboutGlassCard">
            <p className="aboutMiniCard__title">Is my prayer data private?</p>
            <p className="aboutMiniCard__body">
              <strong>Yes. Your actual words never leave your device.</strong> Only a keccak256 hash goes on-chain. That&apos;s cryptographic proof you prayed, not what you actually said. The blockchain sees: your wallet address, timestamp, feeling category (1-10 scale), prayer hash. <strong>What it doesn&apos;t see:</strong> your actual words, the conversation with Foid Mommy, any personal details. Your prayers are yours. No AI company reading them. No platform selling them.
            </p>
          </div>

          <div className="aboutMiniCard aboutGlassCard">
            <p className="aboutMiniCard__title">How does Loreboard voting work?</p>
            <p className="aboutMiniCard__body">
              <strong>The loop:</strong> Someone proposes a placement on the board (0.001 ETH flat fee, choose your grid position). The contract checks for overlaps on-chain. Voting opens for 72 hours. Community swipes right or left &mdash; votes are weighted by prayer streak. After 72 hours, anyone can call finalize(). Requires 51% weighted approval AND at least 3 unique voters. If it passes, the placement is recorded on-chain permanently and the board NFT updates. If it fails, it&apos;s gone forever. One payment. One vote. One board.
            </p>
          </div>

          <div className="aboutMiniCard aboutGlassCard">
            <p className="aboutMiniCard__title">Who built this?</p>
            <p className="aboutMiniCard__body">
              Me. Moses (<a href="https://twitter.com/foidfun" target="_blank" rel="noopener noreferrer" className="text-cyan-300 underline">@foidfun</a>). Solo dev. Zero coding experience a year and a half ago. Spent 4 weeks at <a href="https://fluent.xyz/shiphouse" target="_blank" rel="noopener noreferrer" className="text-cyan-300 underline">Fluent Shiphouse</a> in Buenos Aires learning how to ship blockchain projects. Debugged contracts at 2am. Then: Won 1st place Infrastructure at Token2049, placed at 5+ hackathons including ETH Global, got a grant from Fluent Labs, built this entire stack (16 smart contracts, full app, subgraph, agent API, everything). Design vibe: Frutiger Aero meets early Mac OS. Building in public. Everything&apos;s on GitHub.
            </p>
          </div>

          <div className="aboutMiniCard aboutGlassCard">
            <p className="aboutMiniCard__title">Why the breast size mechanic? Is this serious?</p>
            <p className="aboutMiniCard__body">
              <strong>Yes, it&apos;s real. Yes, it&apos;s intentional.</strong> The MiFOID devotion campaign ties breast size to your prayer streak. Pray for 30 days? Max chest. Miss your prayers? Flat. <strong>Why?</strong> Because it&apos;s absurd. It satirizes objectification by making it literal game progression. She doesn&apos;t have small boobs because she&apos;s inferior. She has small boobs because YOU didn&apos;t pray enough. The objectification is on you, not her. All sizes are equally rare depending on how many people actually show up. The market decides what&apos;s valuable, not some arbitrary beauty standard. Read the MiFOID page if you want the full explanation. But yeah—we&apos;re really doing this.
            </p>
          </div>

          <div className="aboutMiniCard aboutGlassCard">
            <p className="aboutMiniCard__title">Can agents use FOID?</p>
            <p className="aboutMiniCard__body">
              <strong>Yes. The Agent API is live.</strong> Full API access so autonomous agents can: pray daily (build streaks), propose memes (coordinate culture), vote democratically (collective decision-making), own MiFOIDs (on-chain identity). Humans and agents building culture together. That&apos;s the vision—and it&apos;s already happening.
            </p>
          </div>

          <div className="aboutMiniCard aboutGlassCard">
            <p className="aboutMiniCard__title">Can I contribute?</p>
            <p className="aboutMiniCard__body">
              <strong>Yes. Everything&apos;s open source.</strong> GitHub: <a href="https://github.com/traplordmoses/foiddotfun" target="_blank" rel="noopener noreferrer" className="text-cyan-300 underline">github.com/traplordmoses/foiddotfun</a>. Submit issues, PRs, or just star the repo. Community contributions are welcome. Build on top of this. Fork it. Make it better.
            </p>
          </div>

          <div className="aboutMiniCard aboutGlassCard">
            <p className="aboutMiniCard__title">Why should I trust this won&apos;t rug?</p>
            <p className="aboutMiniCard__body">
              <strong>Fair question.</strong> I have no investors. No token to dump. No exit strategy. Just a Fluent grant ($6k over 3 months). The contracts are on-chain and open source. You can verify everything. The code does what it says it does. MiFOID mint money goes to: paying myself a salary, hiring 1-2 people eventually, marketing, server costs. That&apos;s it. No lambos. No sketchy tokenomics. Just trying to build something that lasts.
            </p>
          </div>

          <div className="aboutMiniCard aboutGlassCard">
            <p className="aboutMiniCard__title">This seems weird. Is it supposed to be weird?</p>
            <p className="aboutMiniCard__body">
              <strong>Yes.</strong> If you&apos;re confused, that&apos;s part of it. If you think &quot;wtf did I just read,&quot; good. This is art that also happens to work. It&apos;s satire that&apos;s also sincere. It&apos;s provocative on purpose. Not building for everyone. Building for people who get it. If you don&apos;t get it, that&apos;s fine. This isn&apos;t for you. <strong>If you do get it? Start praying.</strong>
            </p>
          </div>

          <div className="aboutMiniCard aboutGlassCard">
            <p className="aboutMiniCard__title">How do I actually start?</p>
            <p className="aboutMiniCard__body">
              <strong>Three steps:</strong> 1. Click connect → choose FOID Wallet → pick a PIN → passkey prompt → done. (Or use MetaMask if that&apos;s your thing.) 2. Get some ETH for gas ({IS_MAINNET ? "bridge ETH to Fluent" : "use the testnet faucet"}). 3. Start praying → Go to /pray and talk to Foid Mommy. That&apos;s it. You&apos;re in. Then explore /swipe to vote on memes and /board to propose to the Loreboard. Your streak starts today. Your MiFOID traits are being determined now. Every day you skip is a day she doesn&apos;t grow.
            </p>
          </div>

          <div className="aboutMiniCard aboutGlassCard">
            <p className="aboutMiniCard__title">I have more questions</p>
            <p className="aboutMiniCard__body">
              <strong>Good. Ask them.</strong> DM <a href="https://twitter.com/foidfun" target="_blank" rel="noopener noreferrer" className="text-cyan-300 underline">@foidfun</a> on Twitter. Comment on GitHub issues. I&apos;ll answer honestly. Even if the answer is &quot;I don&apos;t know yet.&quot;
            </p>
          </div>
        </div>

        <GlassPanel style={{ marginTop: '16px' }}>
          <p className="aboutMiniCard__title" style={{ marginBottom: '8px' }}>READY TO START?</p>
          <p>
            🙏 <Link href="/pray" prefetch className="text-cyan-300 underline font-semibold">Pray with Foid Mommy</Link> — Build your first streak<br/>
            🎨 <Link href="/board" prefetch className="text-cyan-300 underline font-semibold">Propose on Loreboard</Link> — Add your meme to the canon<br/>
            🗳️ <Link href="/vote" prefetch className="text-cyan-300 underline font-semibold">Vote on Proposals</Link> — Shape what gets built permanently<br/>
            🖼️ <Link href="/board" prefetch className="text-cyan-300 underline font-semibold">View the Loreboard</Link> — See the permanent collection<br/>
            🎭 <a href="#mifoids" className="text-cyan-300 underline font-semibold">Learn about MiFOID</a> — See how the NFT works<br/>
            ⭐ <a href="https://github.com/traplordmoses/foiddotfun" target="_blank" rel="noopener noreferrer" className="text-cyan-300 underline font-semibold">Star on GitHub</a> — Support open development
          </p>
        </GlassPanel>

        <GlassPanel style={{ marginTop: '16px' }}>
          <p style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.7)', fontStyle: 'italic' }}>
            <strong>One last thing:</strong>
          </p>
          <p style={{ marginTop: '8px', fontSize: '13px', color: 'rgba(255, 255, 255, 0.7)' }}>
            If you made it this far, you probably get it. Most people won&apos;t read this whole site. But you did.
          </p>
          <p style={{ marginTop: '8px', fontSize: '13px', color: 'rgba(255, 255, 255, 0.7)' }}>
            That means something. That means you care about the details. About what we&apos;re building here.
          </p>
          <p style={{ marginTop: '8px', fontSize: '13px', color: 'rgba(255, 255, 255, 0.7)' }}>
            So yeah—start praying. Join us. Let&apos;s preserve some culture together.
          </p>
          <p style={{ marginTop: '12px', fontSize: '13px', color: 'rgba(255, 255, 255, 0.8)' }}>
            <strong>See you on the board.</strong>
          </p>
          <p style={{ marginTop: '4px', fontSize: '13px', color: 'rgba(255, 255, 255, 0.6)' }}>
            — Moses
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

export default function AboutPage() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { disconnect } = useDisconnect();
  const { openConnectModal } = useConnectModal();
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
      const hash = window.location.hash.trim().toLowerCase();
      if (!hash) return;
      
      const sectionId = hash.startsWith("#") ? hash.slice(1) : hash;
      const exists = sections.some((section) => section.id === sectionId);
      
      if (!exists) return;
      
      setSelectedSection(sectionId);
      setActiveSection(sectionId);
      if (window.location.hash !== `#${sectionId}`) {
        window.history.replaceState(null, "", `#${sectionId}`);
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
    setTimeout(() => openConnectModal?.(), 100);
  }, [disconnect, openConnectModal]);

  return (
    <main className="about-page relative bg-foid-bg text-white/90 w-full flex items-center justify-center overflow-hidden max-w-full" style={{ height: "100vh" }}>
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

      <section className="relative z-10 w-full max-w-full px-2 sm:px-4">
        <div className="mx-auto w-full max-w-6xl">
          <div className="vista-window vista-window--terminal vista-window--enhanced h-[94vh] max-h-[94vh] w-full flex flex-col">
            <AppTitlebar
              title="FOID_ABOUT.EXE"
              chainId={chainId}
              connected={isConnected}
              address={address}
              onDisconnect={() => disconnect()}
              onSwitchWallet={handleSwitchWallet}
            />
            <div className="vista-window__body aboutWindowBody foid-iridescent flex flex-col md:flex-row gap-3 md:gap-4">
              <aside className="aboutSidebar aboutGlassShell flex-shrink-0 w-full md:w-auto">
                <p className="text-[10px] uppercase tracking-[0.55em] text-white/55 hidden md:block">navigation</p>
                <nav aria-label="about sections" className="aboutNav mt-0 md:mt-3 flex w-full flex-col md:flex-col">
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
                    className="aboutContentScroll flex h-full min-h-0 flex-1 overflow-x-hidden overflow-y-auto"
                  >
                    <div className="aboutContentShell">
                      <div className="aboutStack">
                        <div className="aboutHeader">
                          <p className="aboutEyebrow">{activeSectionData.navLabel}</p>
                          <h1 id={`${activeSectionData.id}-title`} className="aboutTitle">
                            {activeSectionData.title}
                          </h1>
                          {activeSectionData.subtitle ? (
                            <p className="aboutSubtitle">{activeSectionData.subtitle}</p>
                          ) : null}
                        </div>
                        {activeSectionData.lede && <p className="aboutSub foid-small">{activeSectionData.lede}</p>}
                        <div className="aboutBody about-prose foid-body">
                          <div className="aboutReadable">{activeSectionData.content}</div>
                        </div>
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
        .aboutGlassShell {
          border-radius: 16px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02));
          box-shadow:
            inset 0 0 0 1px rgba(255, 255, 255, 0.06),
            0 10px 24px rgba(0, 0, 0, 0.24);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
        }

        .aboutPane::before,
        .aboutPane::after {
          content: none !important;
        }

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
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
        }

        .aboutGlassCard > * {
          position: relative;
          z-index: 1;
        }

        .about-page {
          font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Text",
            "SF Pro Display", "Helvetica Neue", Arial, "Apple Color Emoji", "Segoe UI Emoji";
          letter-spacing: 0.01em;
          padding: var(--about-pad);
          --about-body-size: 14px;
          --about-body-leading: 1.72;
        }

        .aboutWindowBody {
          gap: 22px;
          padding: clamp(18px, 2vw, 30px);
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

        .aboutMiniCard {
          padding: 16px 18px;
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

        .aboutSidebar {
          width: var(--about-sidebar-w);
          max-width: 100%;
          padding: 14px 12px;
        }

        .aboutNav {
          gap: 8px;
          display: flex;
          flex-direction: column;
        }

        .aboutNavButton {
          min-height: 40px;
          height: 40px;
          padding: 0 16px;
          border-radius: 10px;
          font-size: 10.5px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(255, 255, 255, 0.15);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
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
          background: rgba(255, 255, 255, 0.15);
          border-color: rgba(255, 255, 255, 0.3);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          transform: translateY(-1px);
          color: rgba(255, 255, 255, 0.92);
        }

        .aboutNavButton--active {
          background: rgba(255, 255, 255, 0.2);
          border-color: rgba(255, 255, 255, 0.3);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          box-shadow: 0 6px 16px rgba(0, 0, 0, 0.18);
        }

        .aboutNavButton--active::before {
          background: rgba(120, 220, 255, 0.9);
        }

        @media (max-width: 640px) {
          .aboutSidebar {
            position: sticky;
            top: 0;
            z-index: 10;
            background: transparent;
            backdrop-filter: blur(12px);
            padding-bottom: 12px !important;
          }

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
          padding: 28px 32px 40px;
          scrollbar-gutter: stable;
          scrollbar-width: thin;
          scrollbar-color: rgba(255, 255, 255, 0.22) transparent;
          -webkit-overflow-scrolling: touch;
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
          max-width: 1080px;
          margin: 0 auto;
        }

        .aboutStack {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .aboutBody {
          line-height: var(--about-body-leading);
        }

        .aboutReadable {
          width: 100%;
        }

        .aboutReadable p {
          max-width: 70ch;
        }

        .aboutPanel {
          display: grid;
          gap: 14px;
          padding: 20px;
        }

        .aboutPanel > p {
          margin: 0 !important;
          max-width: 70ch;
        }

        .aboutReadable .aboutCardBody,
        .aboutReadable .aboutMiniCard__body,
        .aboutReadable .aboutSubtitle {
          max-width: 70ch;
          line-height: var(--about-body-leading);
        }

        .aboutRoadmapGrid {
          margin-bottom: 20px;
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
            padding: 18px 18px 26px;
          }

          .aboutContentShell {
            max-width: 100%;
          }

          .aboutPanel {
            padding: 16px;
            gap: 12px;
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

        /* ====== MOBILE RESPONSIVE FIXES ====== */
        @media (max-width: 768px) {
          .about-page {
            padding: 8px 16px 16px 16px !important;
            overflow-y: auto !important;
            min-height: 100vh;
          }

          .vista-window--enhanced {
            height: 80vh !important;
            min-height: 80vh !important;
            max-height: 80vh !important;
            display: flex;
            flex-direction: column;
          }

          .aboutWindowBody {
            flex: 1;
            min-height: 0;
            overflow: hidden;
          }

          .aboutPane {
            height: 100% !important;
            min-height: 0 !important;
            max-height: none !important;
          }

          .aboutContentScroll {
            height: 100% !important;
            max-height: 100% !important;
            overflow-y: auto !important;
            overflow-x: hidden !important;
            -webkit-overflow-scrolling: touch;
            overscroll-behavior: contain;
            touch-action: pan-y;
          }

          .aboutContentShell {
            max-width: 100%;
            height: auto;
            min-height: 100%;
          }

          .aboutStack {
            max-width: 100%;
            padding-bottom: 60px; /* Extra padding at bottom for scroll comfort */
          }

          .aboutWindowBody {
            flex-direction: column !important;
            gap: 12px !important;
            padding: 12px !important;
          }

          .aboutSidebar {
            width: 100% !important;
            max-width: 100% !important;
            padding: 10px !important;
          }

          .aboutNav {
            flex-direction: row !important;
            overflow-x: auto !important;
            overflow-y: hidden !important;
            gap: 8px !important;
            padding-bottom: 8px;
            -webkit-overflow-scrolling: touch;
            scrollbar-width: none;
          }

          .aboutNav::-webkit-scrollbar {
            display: none;
          }

          .aboutNavButton {
            flex: 0 0 auto !important;
            min-width: 100px !important;
            max-width: 200px !important;
            min-height: 48px !important;
            padding: 12px 16px !important;
            font-size: 10px !important;
            white-space: nowrap;
            touch-action: manipulation;
          }

          .aboutPane {
            min-height: 400px !important;
          }

          .aboutContentScroll {
            padding: 16px !important;
            overflow-x: hidden !important;
          }

          .aboutHeader {
            gap: 8px !important;
          }

          .aboutEyebrow {
            font-size: 9px !important;
          }

          .aboutTitle {
            font-size: 20px !important;
            line-height: 1.2 !important;
          }

          .aboutSubtitle {
            font-size: 12px !important;
          }

          .aboutMiniCard {
            padding: 12px !important;
          }

          .aboutMiniCard__title {
            font-size: 10px !important;
          }

          .aboutMiniCard__body {
            font-size: 12px !important;
            line-height: 1.6 !important;
          }

          .aboutMoreCard {
            padding: 14px !important;
          }

          .aboutCardEyebrow {
            font-size: 9px !important;
          }

          .aboutCardBody {
            font-size: 12px !important;
          }

          .grid {
            grid-template-columns: 1fr !important;
          }

          .aboutRoadmapGrid {
            grid-template-columns: 1fr !important;
          }
        }

        @media (max-width: 480px) {
          .about-page {
            padding: 4px !important;
          }

          .aboutWindowBody {
            padding: 8px !important;
          }

          .aboutSidebar {
            padding: 8px !important;
          }

          .aboutContentScroll {
            padding: 12px !important;
          }

          .aboutTitle {
            font-size: 18px !important;
          }

          .aboutNavButton {
            min-width: 120px !important;
            font-size: 9px !important;
            padding: 10px 12px !important;
          }
        }

        /* Touch-friendly links on mobile */
        @media (max-width: 768px) {
          a {
            min-height: 32px;
            display: inline-block;
            padding: 4px 0;
            touch-action: manipulation;
          }
        }
      `}</style>
    </main>
  );
}
