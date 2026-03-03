"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import AppTitlebar from "@/app/(components)/AppTitlebar";
import { useAccount, useChainId, useDisconnect } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
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
            <p className="aboutMiniCard__title">🎨 loreboard canvas</p>
            <p className="aboutMiniCard__body">
              Infinite collaborative meme gallery. Anyone can propose an image to the board. The community votes for 72 hours. Winners get canonized permanently—stored on IPFS and recorded on-chain.
            </p>
          </div>

          <div className="aboutMiniCard aboutGlassCard">
            <p className="aboutMiniCard__title">👆 swipe</p>
            <p className="aboutMiniCard__body">
              Tinder for memes. Propose a meme, get matched against another, and let the community swipe. Winners get canonized in the Gallery forever. Prayer streaks amplify your voting power.
            </p>
          </div>

          <div className="aboutMiniCard aboutGlassCard">
            <p className="aboutMiniCard__title">🖼️ gallery</p>
            <p className="aboutMiniCard__body">
              The permanent collection. Every meme that wins a swipe or gets placed directly lives here forever. Community-governed with flagging and removal votes.
            </p>
          </div>

          <div className="aboutMiniCard aboutGlassCard">
            <p className="aboutMiniCard__title">🎭 mifoid nft</p>
            <p className="aboutMiniCard__body">
              Your evolving on-chain identity. Mint your personal FOID companion NFT. It grows and changes based on your participation. 0.01 ETH to mint.
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
            ✅ FOID Mommy Terminal (prayer contracts + streaks + tiers)<br/>
            ✅ Loreboard Canvas (spatial grid + voting)<br/>
            ✅ Swipe (propose memes, community votes, winners canonized)<br/>
            ✅ Gallery / FOIDREST (permanent collection)<br/>
            ✅ MiFOID NFT contract (ERC-721 with trait evolution)<br/>
            ✅ Democratic voting (72-hour epochs + streak-weighted power)<br/>
            ✅ Community governance (flagging + removal votes)<br/>
            ✅ On-chain finalization (manifests → IPFS)<br/>
            ✅ Live NFT (updates with each epoch)<br/>
            ✅ Agent API (autonomous agents can pray, propose, vote)<br/>
            ✅ 11+ finalized epochs with real usage
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
            <strong>61% of Gen Z reports severe loneliness.</strong>
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
            A shared canvas where communities propose what matters, vote democratically, and canonize winners forever. It&apos;s r/place except the canvas never resets. It&apos;s Know Your Meme except the community decides what&apos;s canonical.
          </p>
          <p style={{ marginTop: '12px' }}>
            Every finalized epoch becomes a snapshot of what your community valued in that moment. Come back in five years and see exactly how your corner of the internet evolved.
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
              72-hour democratic window. Every connected wallet can vote yes or no. 51%+ approval + quorum required. No shortcuts. No buying your way in.
            </p>
          </div>
          <div className="aboutMiniCard aboutGlassCard">
            <p className="aboutMiniCard__title">3. canonize forever</p>
            <p className="aboutMiniCard__body">
              Winners are immortalized. Placement recorded on-chain. Image stored on IPFS. This is the record. Permanent. Verifiable. Yours.
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

        <GlassPanel style={{ marginTop: '16px' }}>
          <p className="aboutMiniCard__title" style={{ marginBottom: '8px' }}>THE TECHNOLOGY</p>
          <p>
            Built for permanence: Smart contracts (Solidity on Fluent), Storage (IPFS for images, on-chain for state), Indexing (Goldsky subgraph makes queries instant), Voting (72-hour epochs with democratic thresholds + streak-weighted power), NFT (ERC-721 updates after each finalization).
          </p>
          <p style={{ marginTop: '12px' }}>
            Fluent&apos;s blended execution means voting feels Web2-fast with Web3 guarantees. No waiting for blocks. No gas wars. Just democracy at scale.
          </p>
        </GlassPanel>

        <GlassPanel style={{ marginTop: '16px' }}>
          <p className="aboutMiniCard__title" style={{ marginBottom: '8px' }}>CURRENT STATUS</p>
          <p>
            ✅ 11+ finalized epochs<br/>
            ✅ Democratic voting (1 vote per wallet)<br/>
            ✅ Automatic finalization<br/>
            ✅ IPFS + on-chain storage<br/>
            ✅ Live NFT reflects current state
          </p>
        </GlassPanel>
      </>
    ),
  },
  {
    id: "swipe",
    navLabel: "SWIPE",
    title: "SWIPE",
    subtitle: "Swipe. Vote. Canonize.",
    content: (
      <>
        <GlassPanel>
          <p>
            <strong>Two memes enter. One gets immortalized.</strong>
          </p>
          <p style={{ marginTop: '12px' }}>
            Swipe is where community culture gets decided. Propose a meme, get matched against another, and let the community swipe. The winner gets canonized in the Gallery forever.
          </p>
          <p style={{ marginTop: '12px' }}>
            It&apos;s Tinder for memes. Swipe right to accept, swipe left to reject. Your prayer streak gives you more voting power&mdash;show up every day and your voice gets louder.
          </p>
        </GlassPanel>

        <div style={{ marginTop: '24px' }}>
          <p className="aboutMiniCard__title" style={{ marginBottom: '12px' }}>HOW IT WORKS</p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="aboutMiniCard aboutGlassCard">
            <p className="aboutMiniCard__title">1. submit</p>
            <p className="aboutMiniCard__body">
              Propose your meme. It enters a queue and gets automatically matched with another submission. Small entry fee keeps the pool clean.
            </p>
          </div>
          <div className="aboutMiniCard aboutGlassCard">
            <p className="aboutMiniCard__title">2. swipe &amp; vote</p>
            <p className="aboutMiniCard__body">
              The community swipes through active proposals. Voting power is weighted by your prayer streak&mdash;longer streak, bigger vote. 24-hour voting window.
            </p>
          </div>
          <div className="aboutMiniCard aboutGlassCard">
            <p className="aboutMiniCard__title">3. winner takes all</p>
            <p className="aboutMiniCard__body">
              The winning meme gets permanently placed on the FOIDREST. The loser fades into history. Culture decided by the community, not algorithms.
            </p>
          </div>
        </div>
      </>
    ),
  },
  {
    id: "gallery",
    navLabel: "GALLERY",
    title: "GALLERY",
    subtitle: "The Internet's Hottest Pop-Up Gallery",
    content: (
      <>
        <GlassPanel>
          <p>
            <strong>A museum for the internet.</strong>
          </p>
          <p style={{ marginTop: '12px' }}>
            The Gallery is where culture becomes permanent. Every meme that wins a swipe, every image placed directly&mdash;they all live here forever. On-chain. Immutable. A visual record of what your community valued.
          </p>
          <p style={{ marginTop: '12px' }}>
            Think of it as a gallery wall that never runs out of space. Every piece has a story: who created it, when it was placed, whether it won a swipe or was placed directly. The community governs the collection&mdash;flag inappropriate content, vote on removals, maintain the culture.
          </p>
        </GlassPanel>

        <div style={{ marginTop: '24px' }}>
          <p className="aboutMiniCard__title" style={{ marginBottom: '12px' }}>TWO PATHS TO THE GALLERY</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="aboutMiniCard aboutGlassCard">
            <p className="aboutMiniCard__title">Win a Swipe</p>
            <p className="aboutMiniCard__body">
              Propose your meme. If the community swipes in your favor, your meme gets canonized. Free placement for winners.
            </p>
          </div>
          <div className="aboutMiniCard aboutGlassCard">
            <p className="aboutMiniCard__title">Direct Placement</p>
            <p className="aboutMiniCard__body">
              Place content directly onto the FOIDREST. Requires a placement fee. Your content goes live immediately and becomes part of the permanent gallery.
            </p>
          </div>
        </div>

        <GlassPanel style={{ marginTop: '16px' }}>
          <p className="aboutMiniCard__title" style={{ marginBottom: '8px' }}>COMMUNITY GOVERNANCE</p>
          <p>
            The community governs the FOIDREST. Any connected wallet can flag content for review. Once enough flags accumulate, a removal vote triggers automatically. The community votes to keep or remove&mdash;democratic content moderation, fully on-chain.
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
              3,333 total supply. 0.01 ETH to mint. Launches Q2/Q3 2026 (about 3 months after Fluent mainnet).
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
            <strong>FOID runs on Fluent Testnet.</strong> This means everything is free (just gas fees). You&apos;re not spending real money to pray or propose memes. You&apos;re just... participating.
          </p>
          <p style={{ marginTop: '12px' }}>
            Here&apos;s how to get in:
          </p>
        </GlassPanel>

        <div className="grid gap-4" style={{ marginTop: '16px' }}>
          <div className="aboutMiniCard aboutGlassCard">
            <p className="aboutMiniCard__title">1. connect your wallet</p>
            <p className="aboutMiniCard__body">
              Use MetaMask, Rainbow, Coinbase Wallet, whatever you have. When you connect, FOID will auto-detect you&apos;re not on Fluent Testnet and ask if you want to add it. Click yes. That&apos;s it. Chain ID: 20994 (in case you need to add it manually).
            </p>
          </div>
          <div className="aboutMiniCard aboutGlassCard">
            <p className="aboutMiniCard__title">2. get testnet eth (it&apos;s free)</p>
            <p className="aboutMiniCard__body">
              You need testnet ETH for gas. Not real ETH. Fake internet money for a fake internet chain. But it works. Go to <a href="https://testnet.fluent.xyz/dev-portal" target="_blank" rel="noopener noreferrer" className="text-cyan-300 underline">Fluent Faucet</a> and claim some. Takes like 30 seconds. Need more? Ping in Discord.
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
              Go to /board and look at the canvas. Drag an image onto the grid. Choose your spot. Submit your proposal. This costs a small amount of testnet ETH. Voting lasts 72 hours. Community decides if your meme makes it into the permanent canon.
            </p>
          </div>
          <div className="aboutMiniCard aboutGlassCard">
            <p className="aboutMiniCard__title">5. vote on placements (optional)</p>
            <p className="aboutMiniCard__body">
              Browse active proposals on the board. See something you like? Vote yes. See something mid? Vote no. Voting is free (just gas). This is how we collectively decide what gets preserved forever. Your vote matters.
            </p>
          </div>
          <div className="aboutMiniCard aboutGlassCard">
            <p className="aboutMiniCard__title">5.5 swipe on memes (optional)</p>
            <p className="aboutMiniCard__body">
              Go to /swipe and swipe through proposed memes. Swipe right to canonize, left to pass. Your prayer streak amplifies your voting power. Winners get permanently placed in the Gallery.
            </p>
          </div>
          <div className="aboutMiniCard aboutGlassCard">
            <p className="aboutMiniCard__title">6. join the community</p>
            <p className="aboutMiniCard__body">
              Follow <a href="https://twitter.com/foidfun" target="_blank" rel="noopener noreferrer" className="text-cyan-300 underline">@foidfun</a> for updates. Star the <a href="https://github.com/traplordmoses/foiddotfun" target="_blank" rel="noopener noreferrer" className="text-cyan-300 underline">GitHub repo</a> if you&apos;re into that. Join Discord for testnet ETH, vibes, and coordination.
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
            Still confused? That&apos;s fair. This is weird. DM on Twitter or ask in Discord. We&apos;ll help you out.
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
            <strong>We&apos;re not doing a big reveal. We&apos;re building in the open.</strong>
          </p>
          <p style={{ marginTop: '12px' }}>
            Testnet proves it works. Mainnet makes it real. MiFOID adds identity. Then we see what happens.
          </p>
          <p style={{ marginTop: '12px' }}>
            Each phase builds on the last. Some things will change. Some will fail. That&apos;s how this works.
          </p>
        </GlassPanel>

        <div className="aboutRoadmapGrid grid gap-4 md:grid-cols-3 w-full" style={{ marginTop: '16px' }}>
          <div className="aboutMiniCard aboutGlassCard aboutRoadmapCard">
            <p className="aboutMiniCard__title">right now (testnet alpha)</p>
            <p className="aboutMiniCard__body">
              ✅ Foid Mommy Terminal - pray daily, build streaks, tier system<br/>
              ✅ Loreboard Canvas - propose memes, vote, canonize<br/>
              ✅ Swipe - propose memes, community swipe-votes, winners canonized<br/>
              ✅ Gallery / FOIDREST - permanent collection with governance<br/>
              ✅ MiFOID NFT contract - ERC-721 with trait evolution<br/>
              ✅ Agent API - autonomous agents can pray, propose, vote<br/>
              ✅ 16 Solidity smart contracts deployed and working<br/>
              ✅ 11+ finalized epochs with real community voting<br/>
              ✅ Goldsky subgraph indexing everything<br/>
              ✅ IPFS storage handling manifests + images
            </p>
          </div>

          <div className="aboutMiniCard aboutGlassCard aboutRoadmapCard">
            <p className="aboutMiniCard__title">Q1 2026 (mainnet launch)</p>
            <p className="aboutMiniCard__body">
              🚀 Fluent mainnet launch<br/>
              🚀 Real ETH economy (no more testnet)<br/>
              🚀 Optimized contracts (gas efficiency)<br/>
              🚀 Production monitoring<br/>
              🚀 Broader public access<br/>
              🚀 Stakes get real
            </p>
          </div>

          <div className="aboutMiniCard aboutGlassCard aboutRoadmapCard">
            <p className="aboutMiniCard__title">Q2/Q3 2026 (mifoid drop)</p>
            <p className="aboutMiniCard__body">
              🎨 MiFOID minting (3,333 supply at 0.01 ETH)<br/>
              🎨 Trait evolution system<br/>
              🎨 The Nunnery (virgin holders only)<br/>
              🎨 Body count tracking<br/>
              🎨 Mobile-optimized experience
            </p>
          </div>

          <div className="aboutMiniCard aboutGlassCard aboutRoadmapCard">
            <p className="aboutMiniCard__title">2027 (foidspace social layer)</p>
            <p className="aboutMiniCard__body">
              🔮 User profiles (speculation)<br/>
              🔮 More gated chat rooms<br/>
              🔮 Customizable MiFOIDs<br/>
              🔮 Full social graph<br/>
              🔮 Futarchy experiments<br/>
              🔮 Companion mini-games
            </p>
          </div>
        </div>

        <GlassPanel style={{ marginTop: '16px' }}>
          <p className="aboutMiniCard__title" style={{ marginBottom: '8px' }}>HOW WE GOT HERE</p>
          <p>
            Solo founder. Self-taught coder. One and a half years from zero to this.
          </p>
          <p style={{ marginTop: '12px' }}>
            🥇 1st place Infrastructure at Token2049 hackathon<br/>
            🏆 Won at ETH Global<br/>
            💰 First grant from Fluent Labs ($6k over 3 months)<br/>
            🏠 Spent 4 weeks at <a href="https://testnet.fluent.xyz/shiphouse" target="_blank" rel="noopener noreferrer" className="text-cyan-300 underline">Fluent Shiphouse</a> in Buenos Aires<br/>
            📰 Featured in Nasdaq article on Fluent ecosystem<br/>
            💬 Real users showing up daily
          </p>
          <p style={{ marginTop: '12px' }}>
            <strong>Started as:</strong> &quot;What if there was a way to save memes on-chain?&quot;<br/>
            <strong>Became:</strong> Infrastructure for cultural coordination
          </p>
          <p style={{ marginTop: '12px' }}>
            No team. No investors (yet). No fancy marketing budget. Just building something people want, one prayer at a time.
          </p>
        </GlassPanel>

        <GlassPanel style={{ marginTop: '16px' }}>
          <p className="aboutMiniCard__title" style={{ marginBottom: '8px' }}>WHAT&apos;S NEXT</p>
          <p>
            <strong>Immediate priorities:</strong>
          </p>
          <p style={{ marginTop: '8px' }}>
            1. Fluent mainnet launch<br/>
            2. Ship mobile PWA (so it works like a real app)<br/>
            3. MiFOID devotion campaign + mint<br/>
            4. Expand agent ecosystem<br/>
            5. Keep shipping
          </p>
          <p style={{ marginTop: '12px' }}>
            <strong>Long-term vision:</strong> Build the permanent memory layer for internet culture. Not just for humans—for anyone coordinating culture together.
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
            <strong>For serious inquiries:</strong> View Pitch Deck • <a href="mailto:moses@foid.fun" className="text-cyan-300 underline">Contact Me</a>
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
            Every piece of FOID runs on <strong>verified smart contracts</strong> deployed to the{" "}
            <a href="https://testnet.fluentscan.xyz" className="text-cyan-300 underline" target="_blank" rel="noopener noreferrer">Fluent testnet</a>.
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
              10-tier prayer streak system. Your daily devotion earns multipliers from 1x (Whisper) to 5x (Foid Sovereign). Tiers feed into voting power across the entire ecosystem.
            </p>
            <a href="https://testnet.fluentscan.xyz/address/0x4eEeD27Bfa0734086FA65082C96DAD014c31EeDB" className="text-cyan-300 underline text-xs" target="_blank" rel="noopener noreferrer">View on Explorer</a>
          </div>

          <div className="aboutMiniCard aboutGlassCard">
            <p className="aboutMiniCard__title">StreakVotingPower</p>
            <p className="aboutMiniCard__body">
              Converts prayer streaks into weighted voting power. Higher streaks = more influence on Swipe votes and loreboard governance. Base weight 100, scaled by tier multiplier.
            </p>
            <a href="https://testnet.fluentscan.xyz/address/0x68F10FC72572B433425AC036740B52AcE51Af1A6" className="text-cyan-300 underline text-xs" target="_blank" rel="noopener noreferrer">View on Explorer</a>
          </div>

          <div className="aboutMiniCard aboutGlassCard">
            <p className="aboutMiniCard__title">FoidTrest (Gallery)</p>
            <p className="aboutMiniCard__body">
              The permanent on-chain gallery. Every meme that wins a Swipe vote gets canonized here forever. Immutable entries, chronological order, community curated.
            </p>
            <a href="https://testnet.fluentscan.xyz/address/0xdEe866015122c9f3672E18646a172Bd8a1eb2ff1" className="text-cyan-300 underline text-xs" target="_blank" rel="noopener noreferrer">View on Explorer</a>
          </div>

          <div className="aboutMiniCard aboutGlassCard">
            <p className="aboutMiniCard__title">Swipe</p>
            <p className="aboutMiniCard__body">
              Propose a meme, community votes via EIP-712 signed ballots. If more than 51% approve, the meme gets canonized to the Gallery. Replaces the old DuelArena with a cleaner flow.
            </p>
            <a href="https://testnet.fluentscan.xyz/address/0x0e222432aC1583E47A80228fd664e90ba6f6e37C" className="text-cyan-300 underline text-xs" target="_blank" rel="noopener noreferrer">View on Explorer</a>
          </div>

          <div className="aboutMiniCard aboutGlassCard">
            <p className="aboutMiniCard__title">SwipeLoreboard</p>
            <p className="aboutMiniCard__body">
              Pay-to-place spatial board with community governance. Place content on a tile-aligned grid, flag inappropriate content, and vote on removals with streak-weighted power.
            </p>
            <a href="https://testnet.fluentscan.xyz/address/0xfb2C1aa8E72baEA6872fae120d25Fc30246a27C6" className="text-cyan-300 underline text-xs" target="_blank" rel="noopener noreferrer">View on Explorer</a>
          </div>
        </div>

        <div style={{ marginTop: '24px' }}>
          <p className="aboutMiniCard__title" style={{ marginBottom: '12px' }}>LEGACY CONTRACTS</p>
          <p style={{ marginBottom: '16px', color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.85rem' }}>
            Earlier contracts still live on-chain. The loreboard infrastructure powers the canvas experience.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="aboutMiniCard aboutGlassCard" style={{ opacity: 0.7 }}>
            <p className="aboutMiniCard__title">Prayer Mirror</p>
            <p className="aboutMiniCard__body">On-chain prayer streak oracle.</p>
            <a href="https://testnet.fluentscan.xyz/address/0x8ff39c2a78FaF7d655e4Dab03076Cb26C97007FF" className="text-cyan-300 underline text-xs" target="_blank" rel="noopener noreferrer">Explorer</a>
          </div>
          <div className="aboutMiniCard aboutGlassCard" style={{ opacity: 0.7 }}>
            <p className="aboutMiniCard__title">Loreboard Voting</p>
            <p className="aboutMiniCard__body">Rolling-window vote system for board placements.</p>
            <a href="https://testnet.fluentscan.xyz/address/0xEbf065A7ca3917BB5e669982e8C6954cC27A7075" className="text-cyan-300 underline text-xs" target="_blank" rel="noopener noreferrer">Explorer</a>
          </div>
          <div className="aboutMiniCard aboutGlassCard" style={{ opacity: 0.7 }}>
            <p className="aboutMiniCard__title">Loreboard Board</p>
            <p className="aboutMiniCard__body">Tile-aligned placement proposals + treasury escrow.</p>
            <a href="https://testnet.fluentscan.xyz/address/0xE41B2D418C09Ea928E4F657ED2438f5D01472105" className="text-cyan-300 underline text-xs" target="_blank" rel="noopener noreferrer">Explorer</a>
          </div>
          <div className="aboutMiniCard aboutGlassCard" style={{ opacity: 0.7 }}>
            <p className="aboutMiniCard__title">Loreboard Treasury</p>
            <p className="aboutMiniCard__body">Escrow and settlement for board proposals.</p>
            <a href="https://testnet.fluentscan.xyz/address/0x4A777d8650b3FA2419377F4ffeF0EF8007151536" className="text-cyan-300 underline text-xs" target="_blank" rel="noopener noreferrer">Explorer</a>
          </div>
          <div className="aboutMiniCard aboutGlassCard" style={{ opacity: 0.7 }}>
            <p className="aboutMiniCard__title">Prayer Registry</p>
            <p className="aboutMiniCard__body">On-chain prayer hash storage.</p>
            <a href="https://testnet.fluentscan.xyz/address/0x6FC7301fad7Ca0294152b23FD4f0467200376d65" className="text-cyan-300 underline text-xs" target="_blank" rel="noopener noreferrer">Explorer</a>
          </div>
          <div className="aboutMiniCard aboutGlassCard" style={{ opacity: 0.7 }}>
            <p className="aboutMiniCard__title">Manifest Store</p>
            <p className="aboutMiniCard__body">Epoch manifest anchoring for loreboard state.</p>
            <a href="https://testnet.fluentscan.xyz/address/0xeE469D8F9BB2Ace861AA689dE53c016871ad3D10" className="text-cyan-300 underline text-xs" target="_blank" rel="noopener noreferrer">Explorer</a>
          </div>
        </div>

        <GlassPanel style={{ marginTop: '24px' }}>
          <p>
            <strong>Open Source.</strong> All contract source code is verified on{" "}
            <a href="https://testnet.fluentscan.xyz" className="text-cyan-300 underline" target="_blank" rel="noopener noreferrer">Fluent Blockscout</a>
            {" "}and available on{" "}
            <a href="https://github.com/traplordmoses/foiddotfun" className="text-cyan-300 underline" target="_blank" rel="noopener noreferrer">GitHub</a>.
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
              <strong>61% of Gen Z reports severe loneliness.</strong> Not because we don&apos;t have connections—we have thousands of followers. But we don&apos;t have shared experiences anymore. We don&apos;t have rituals. Everything&apos;s optimized for engagement. Your best posts decay after 48 hours. Nothing lasts. <strong>Crypto runs on memes, vibes, and identity. But culture has no permanent home.</strong> We&apos;re building the infrastructure to fix this—a place where culture belongs to the people who create it.
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
              <strong>Loreboard placements:</strong> Pricing like Pokemon packs (~$3-20 depending on cell size). Winners pay the fee; losers get 90% refunded. <strong>MiFOID minting:</strong> 3,333 supply at 0.01 ETH each. <strong>What I&apos;m NOT doing:</strong> No ads, no data harvesting, no subscription tiers, no VC-backed growth-at-all-costs. Revenue scales with participation, not attention extraction.
            </p>
          </div>

          <div className="aboutMiniCard aboutGlassCard">
            <p className="aboutMiniCard__title">Who&apos;s behind this?</p>
            <p className="aboutMiniCard__body">
              Solo founder. Zero coding experience a year and a half ago. Learned everything from AI, YouTube, and trial and error. Spent 4 weeks at <a href="https://testnet.fluent.xyz/shiphouse" target="_blank" rel="noopener noreferrer" className="text-cyan-300 underline">Fluent Shiphouse</a> in Buenos Aires. <strong>Built solo:</strong> 16 Solidity smart contracts, full-stack Next.js app, Goldsky subgraph, IPFS integration, AI oracle system, agent API, live updating NFT. Won 1st place Infrastructure at Token2049, won at ETH Global, got a grant from Fluent Labs, shipped 11+ epochs with real users. <strong>This isn&apos;t a side project. This is the thing.</strong>
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
              <strong>Right now? Free (testnet).</strong> Everything runs on testnet ETH which you get from a faucet. Just pay gas (basically nothing). <strong>On mainnet:</strong> Prayers: FREE (just gas, couple cents). Voting: FREE (just gas). Loreboard proposals: ~$3-20 depending on cell size (if you win, you pay; if you lose, 90% refunded). MiFOID mint: 0.01 ETH (priced like an indie game). No subscriptions. No premium tiers.
            </p>
          </div>

          <div className="aboutMiniCard aboutGlassCard">
            <p className="aboutMiniCard__title">What chain is this on?</p>
            <p className="aboutMiniCard__body">
              <strong>Fluent Testnet</strong> (Chain ID 20994) right now. Mainnet launches Q1 2026 when Fluent goes live. When you connect your wallet, FOID will auto-detect you&apos;re not on Fluent and ask if you want to add it. Click yes. That&apos;s it.
            </p>
          </div>

          <div className="aboutMiniCard aboutGlassCard">
            <p className="aboutMiniCard__title">When mainnet?</p>
            <p className="aboutMiniCard__body">
              <strong>Fluent mainnet:</strong> Q1 2026 (targeting March/April). <strong>FOID on mainnet:</strong> Same day Fluent launches. <strong>MiFOID drop:</strong> Q2/Q3 2026 (about 3 months after mainnet stabilizes). Follow <a href="https://twitter.com/foidfun" target="_blank" rel="noopener noreferrer" className="text-cyan-300 underline">@foidfun</a> for updates.
            </p>
          </div>

          <div className="aboutMiniCard aboutGlassCard">
            <p className="aboutMiniCard__title">How do I get testnet funds?</p>
            <p className="aboutMiniCard__body">
              Go to <a href="https://testnet.fluent.xyz/dev-portal" target="_blank" rel="noopener noreferrer" className="text-cyan-300 underline">testnet.fluent.xyz/dev-portal</a> and hit the faucet. It&apos;ll give you some testnet ETH. Not real money—fake internet money for testing. Need more? Just ask in Discord. Someone will send you some. Community is chill about it.
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
              <strong>The cycle:</strong> Someone proposes a meme (pays a fee based on cell size) → Voting opens for 72 hours → Community votes yes/no (free, just gas) → After 72 hours, votes are tallied → Winners need 51%+ approval → <strong>Winners pay the fee</strong> (you bought your permanent spot) → <strong>Losers get refunded</strong> minus ~10% anti-spam fee. So basically: Good proposal that wins? You pay, but you earned a permanent spot. Bad proposal that loses? You get 90% back, lose 10% for wasting everyone&apos;s time.
            </p>
          </div>

          <div className="aboutMiniCard aboutGlassCard">
            <p className="aboutMiniCard__title">Who built this?</p>
            <p className="aboutMiniCard__body">
              Me. Moses (<a href="https://twitter.com/foidfun" target="_blank" rel="noopener noreferrer" className="text-cyan-300 underline">@foidfun</a>). Solo dev. Zero coding experience a year and a half ago. Spent 4 weeks at <a href="https://testnet.fluent.xyz/shiphouse" target="_blank" rel="noopener noreferrer" className="text-cyan-300 underline">Fluent Shiphouse</a> in Buenos Aires learning how to ship blockchain projects. Debugged contracts at 2am. Then: Won 1st place Infrastructure at Token2049, placed at 5+ hackathons including ETH Global, got a grant from Fluent Labs, built this entire stack (16 smart contracts, full app, subgraph, agent API, everything). Design vibe: Frutiger Aero meets early Mac OS. Building in public. Everything&apos;s on GitHub.
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
              <strong>Three steps:</strong> 1. Connect wallet → Add Fluent Testnet (FOID will prompt you). 2. Get testnet ETH → Hit the faucet at testnet.fluent.xyz/dev-portal. 3. Start praying → Go to /pray and talk to Foid Mommy. That&apos;s it. You&apos;re in. Then explore /swipe to vote on memes, /board to propose to the Loreboard, and /gallery to see the permanent collection. Your streak starts today. Your MiFOID traits are being determined now. Every day you skip is a day she doesn&apos;t grow.
            </p>
          </div>

          <div className="aboutMiniCard aboutGlassCard">
            <p className="aboutMiniCard__title">I have more questions</p>
            <p className="aboutMiniCard__body">
              <strong>Good. Ask them.</strong> DM <a href="https://twitter.com/foidfun" target="_blank" rel="noopener noreferrer" className="text-cyan-300 underline">@foidfun</a> on Twitter. Ask in Discord (link on homepage). Comment on GitHub issues. I&apos;ll answer honestly. Even if the answer is &quot;I don&apos;t know yet.&quot;
            </p>
          </div>
        </div>

        <GlassPanel style={{ marginTop: '16px' }}>
          <p className="aboutMiniCard__title" style={{ marginBottom: '8px' }}>READY TO START?</p>
          <p>
            🙏 <Link href="/pray" prefetch className="text-cyan-300 underline font-semibold">Pray with Foid Mommy</Link> — Build your first streak<br/>
            🎨 <Link href="/board" prefetch className="text-cyan-300 underline font-semibold">Propose on Loreboard</Link> — Add your meme to the canon<br/>
            👆 <Link href="/swipe" prefetch className="text-cyan-300 underline font-semibold">Swipe on Memes</Link> — Vote on what gets canonized<br/>
            🖼️ <Link href="/gallery" prefetch className="text-cyan-300 underline font-semibold">Browse the Gallery</Link> — See the permanent collection<br/>
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
    <main className="about-page relative w-full flex items-center justify-center overflow-hidden max-w-full" style={{ height: "100vh" }}>
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
          <div className="vista-window vista-window--terminal vista-window--enhanced h-[94vh] max-h-[94vh] w-full">
            <AppTitlebar
              title="FOID_ABOUT.EXE"
              chainId={chainId}
              connected={isConnected}
              address={address}
              onDisconnect={() => disconnect()}
              onSwitchWallet={handleSwitchWallet}
            />
            <div className="vista-window__body aboutWindowBody flex flex-col md:flex-row gap-3 md:gap-4">
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
          backdrop-filter: blur(26px);
          -webkit-backdrop-filter: blur(26px);
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
          backdrop-filter: blur(26px);
          -webkit-backdrop-filter: blur(26px);
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
          padding: 16px;
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
          background: rgba(255, 255, 255, 0.1);
          border-color: rgba(255, 255, 255, 0.2);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
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
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          transform: translateY(-1px);
          color: rgba(255, 255, 255, 0.92);
        }

        .aboutNavButton--active {
          background: rgba(255, 255, 255, 0.2);
          border-color: rgba(255, 255, 255, 0.3);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          box-shadow: 0 10px 24px rgba(0, 0, 0, 0.22);
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
