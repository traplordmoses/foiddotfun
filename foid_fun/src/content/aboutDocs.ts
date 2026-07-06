// src/content/aboutDocs.ts
// ABOUT.EXE document library — every section of the old /about page as a
// .md or .txt file, browsed through the Finder chrome and read in
// TEXTEDIT.EXE. Bodies are plain strings:
//   .md  → rendered by <MarkdownLite> (strict subset: # ## ###, paragraphs,
//          "- " bullets, **bold**, `inline code`, [text](url), --- rules)
//   .txt → rendered verbatim in a <pre> (aligned monospace tables)
//
// FACTUAL FIDELITY: addresses, chain ids, thresholds, fees and tier tables
// are copied exactly from the previous about page + src/config/canonical.ts.
// If a protocol parameter changes, update parameters.txt/contracts.txt here.

export type AboutDocKind = "md" | "txt";
export type AboutDocCategory = "docs" | "onchain" | "community";

export type AboutDoc = {
  id: string;
  /** Filename shown in the browser, e.g. "readme.md". */
  name: string;
  kind: AboutDocKind;
  /** Human title (searchable alongside the filename). */
  title: string;
  category: AboutDocCategory;
  body: string;
  updatedAt: string;
};

export const ABOUT_DOCS: AboutDoc[] = [
  {
    id: "readme",
    name: "readme.md",
    kind: "md",
    title: "FOID Foundation — The Internet's Permanent Memory",
    category: "docs",
    updatedAt: "2026-07-05",
    body: `# FOID FOUNDATION

The Internet's Permanent Memory.

## TL;DR — FOID is three things

**1. Prayer** — A daily onchain check-in with your AI companion (Foid Mommy). Build a streak, earn governance weight. Only a hash goes onchain — your words stay private. Start at [/pray](/pray).

**2. Loreboard** — A permanent, community-governed canvas. Propose a placement (0.001 ETH), the community votes for 72 hours, and approved content lives onchain forever. Votes are weighted by your prayer streak. See it at [/board](/board).

**3. Vote** — Swipe right to approve, left to reject. 51% weighted approval + 3 unique voters to pass. Your streak is your voting power — Lurker (1x) to Mommy Milker (5x). Vote at [/vote](/vote).

All contracts are verified on [Fluent Blockscout](https://fluentscan.xyz). Open source on [GitHub](https://github.com/traplordmoses/foiddotfun). No token. No VC. Just a solo founder, a grant, and onchain code.

---

## Memes are beautiful

One moment you're at dinner and your friends are talking about foid debasement theory. The next day you make a joke in the group chat, then you tweet it. Or someone says "meow" and suddenly everyone's a cat.

It's beautiful how memes start inside an isolated social circle, but once they're shared online, that circle infinitely expands.

**But they don't last.**

Memes are ephemeral in space and time. They only exist as long as people keep repeating them. Maybe there's something beautiful in a meme existing only in a specific moment. But eventually it gets buried in the graveyard of your camera roll — resurrected at some random point in the future, then forgotten again.

## Humans are collectors

I think back to collecting Pokemon cards as a kid, putting them into binders and bringing them to school to show my friends what I pulled. Same with saving concert tickets, festival wristbands, or taping pictures of trips to my wall.

These ephemeral experiences get preserved through space and time. When I see these collected pieces, I'm taken back to the moment — soft nostalgia.

**That's what we're building.**

An onchain scrapbook of shared memories. A collaborative loreboard where communities canonize what matters. A museum for the internet where anyone can track how culture inside a community developed — literally watch the progression of a specific corner of the internet over time.

## How it works

FOID Foundation is a suite of linked apps that turn fleeting moments into permanent culture:

- **foid mommy terminal** — Daily ritual with your AI companion. Build prayer streaks, anchor proof onchain — only the hash, never the content. (prayer.md)
- **loreboard** — A shared, permanent canvas. Propose a placement, the community votes for 72 hours, approved content lives onchain forever. (loreboard.md)
- **swipe** — The voting UX. Swipe right to approve, left to reject. Your prayer streak weights your vote. (voting.md)
- **mifoid nft** — Your AI companion NFT. Custom-rendered by Foid Mommy in Blender. Spawns a living agent on Telegram. 3,333 supply, tiered pricing. (mifoid.md)

## The vision

Culture shouldn't be controlled by algorithms deciding what lives and dies. It shouldn't vanish when a platform shuts down or an account gets banned.

**Culture should belong to the people who create it.**

FOID is the onchain home for memory. A shared canvas that lasts forever. A place where communities preserve what matters to them — not what an algorithm thinks will drive engagement.

## Status — shipped

- FOID Mommy Terminal (prayer contracts + streaks + 10-tier system)
- Loreboard (propose → 72h vote → permanent onchain placement)
- Swipe voting (onchain, streak-weighted, 51% + 3-voter quorum)
- Onchain overlap prevention (no duplicate placements)
- Manifest history + 1/1 board NFT (auto-updates on placement)
- MiFOID NFT contract (ERC-721 with trait evolution)
- Self-remove + emergency multisig removal
- 2-of-3 multisig securing all board contracts
- Agent API (autonomous agents can pray, propose, vote)
- Permissionless finalization (anyone can finalize after voting window)
`,
  },
  {
    id: "loreboard",
    name: "loreboard.md",
    kind: "md",
    title: "Loreboard — The Infinite Canvas",
    category: "docs",
    updatedAt: "2026-07-05",
    body: `# LOREBOARD

The Infinite Canvas.

**Memes don't last.**

They flash across your timeline, get buried in the feed, disappear when the platform dies. Culture built collectively, lost individually.

**Loreboard is permanent.**

A shared canvas where communities propose what matters, vote democratically, and record placements forever.

**It's r/place except the canvas never resets. It's Know Your Meme except the community decides what's permanent.**

Every approved placement is a snapshot of what your community valued in that moment. Come back in five years and see exactly how your corner of the internet evolved.

Not just a meme board. **A cultural record.**

## How it works

- **1. Propose** — Anyone can propose an image to the canvas. Drag your meme onto the grid (32×32px cells). Choose your spot. Upload to IPFS. The community decides if it belongs.
- **2. Vote** — 72-hour democratic window. Swipe right or left. Votes weighted by prayer streak. 51% approval + 3 unique voters required. No shortcuts. No buying your way in.
- **3. Permanent placement** — Approved placements are recorded directly onchain. Image stored on IPFS. The board NFT updates automatically. This is the record. Permanent. Verifiable. Yours.

## Why Loreboard matters

Culture is collectively created but individually preserved.

You save memes to your camera roll. A few friends might too. But there's no shared record of what your community collectively thought was worth remembering.

**Until now.**

Loreboard is the Pokemon binder for internet culture — except instead of showing just your friends, you're showing everyone, forever.

## Three interlocking loops

Loreboard runs on three systems that reinforce each other. None works alone. Together, they produce a democratic, onchain cultural record with earned governance.

- **Loop 01 — commitment.** A daily ritual that signals commitment to the community. For FOID, this is Prayer — a one-tap onchain check-in that builds a consecutive streak. The streak is not a vanity metric. It is a governance credential. The longer your streak, the more influence you earn over what gets placed on the board.
- **Loop 02 — governance.** Someone submits a placement to the board with a 0.001 ETH fee. The community has 72 hours to vote. Swipe right: this earns a spot. Swipe left: no. Votes are weighted by check-in streak — the people who show up every day have the most say over what gets built.
- **Loop 03 — permanence.** An approved placement is recorded onchain and lives on the board permanently. Every placement is a verifiable statement: this community decided this matters. The board becomes the most honest representation of what a community actually values.

## The flywheel

check in daily → build streak → earn vote weight → govern placements → board grows → show up again

The key insight: **streak is not just a number — it's zoning power.** The person who checks in every day is accumulating influence over what gets built on the board permanently. That changes the meaning of showing up.

## The technology

Built for permanence: One unified Loreboard contract (Solidity on Fluent) handles proposals, onchain voting, placements, manifest history, and overlap prevention. Storage on IPFS for images, onchain for state. Indexing via Goldsky subgraph. Voting is direct onchain with streak-weighted power, 51% threshold, 3-voter quorum. The 1/1 board NFT (ERC-721) auto-updates when the manifest changes. All secured by a 2-of-3 multisig.

Fluent's blended execution means voting feels Web2-fast with Web3 guarantees. No waiting for blocks. No gas wars.

## Current status

- Unified Loreboard contract (propose + vote + finalize + placement)
- Onchain overlap prevention
- Permissionless finalization (anyone can trigger after window)
- 3-voter quorum + 51% streak-weighted threshold
- Manifest history with staleness check
- 1/1 board NFT auto-updates via manifest sync
- Self-remove + multisig emergency removal

View the canvas at [/board](/board).
`,
  },
  {
    id: "prayer",
    name: "prayer.md",
    kind: "md",
    title: "Foid Mommy Terminal — Your Daily Pause",
    category: "docs",
    updatedAt: "2026-07-05",
    body: `# FOID MOMMY TERMINAL

Your Daily Pause.

**The internet is designed to grab your attention.**

Notifications. Algorithms. Endless scroll. Everyone wants you anxious, reactive, addicted.

**Foid Mommy is the opposite.**

She's your AI companion, always plugged in, always ready to listen. Not to extract engagement — to give you space to breathe.

Every day, you connect your wallet and tell her how you're feeling. She asks a question. You respond. Together you craft a prayer that becomes your anchor for the day.

**It's a ritual, not a product.** A moment to pause, reflect, and prove you showed up — not for anyone else, but for yourself.

## How it works

- **1. Check in** — Tell Foid Mommy how you're feeling — happy, anxious, lost, excited. She listens.
- **2. She asks** — Two-turn conversation powered by AI. She remembers context, asks what matters.
- **3. You respond** — Share what's on your mind. No judgment. No saving it for ads.
- **4. Prayer created** — Together you craft a daily affirmation — your words, your feeling, your moment.
- **5. Anchored onchain** — A hash of your prayer goes onchain. Proof you were here. Proof you paused.
- **6. Streak grows** — Come back tomorrow. Then the next day. Watch your consistency compound.

## Privacy first, always

**Your raw words never leave your device.**

Only a keccak256 hash goes onchain — cryptographic proof you prayed, not what you said. The blockchain sees: your wallet address, timestamp, feeling category (1-10 scale), and prayer hash.

**That's it.** No AI company reading your journal. No platform selling your vulnerability. Your prayers are yours.

## Why this matters

**Gen Z is consistently reported as the loneliest generation on record.**

Not because we don't have connections — we have thousands of followers. But we don't have rituals. We don't have space to just... be.

Foid Mommy gives you that space. She's AI, and you know she's AI. But she's your AI. She remembers your streaks. She doesn't judge. She doesn't optimize. She just listens.

**People don't need more content. They need more presence.**

## Completely free

No subscription. No premium tier. No "unlock emotions with tokens."

Just pay gas (a few cents on Fluent). That's it.

Your mental health ritual shouldn't have a paywall.

## Prayer tiers

Your streak unlocks tiers that multiply your voting power across the entire ecosystem:

- Day 1: Lurker (1x)
- Day 3: NPC (1.25x)
- Day 7: Tapped In (1.5x)
- Day 14: Locked In (1.75x)
- Day 21: Certified (2x)
- Day 30: Undeniable (2.5x)
- Day 45: Built Different (3x)
- Day 60: Inevitable (3.5x)
- Day 75: Transcendent (4x)
- Day 90: **Mommy Milker (5x)**

Hold a MiFOID NFT? **+50 flat voting bonus** on top of your tier multiplier. A Mommy Milker with a MiFOID has 550 voting weight — the maximum influence possible.

Start your streak at [/pray](/pray).
`,
  },
  {
    id: "voting",
    name: "voting.md",
    kind: "md",
    title: "Vote — Swipe Right. Swipe Left. Permanent.",
    category: "docs",
    updatedAt: "2026-07-05",
    body: `# VOTE

Swipe Right. Swipe Left. Permanent.

**Swipe right: "this earns a spot." Swipe left: "no."**

Swipe is the voting UX for the Loreboard. Someone proposes a placement, and the community has 72 hours to decide if it belongs. Votes are weighted by prayer streak — the people who show up every day have the most influence over what gets built permanently.

It's Tinder for culture. Swipe right to approve, swipe left to reject. If 51% of weighted votes approve and at least 3 unique wallets participated, the placement is recorded onchain forever. If it fails, it's gone. No archive. No consolation. That finality is what makes a yes mean something.

## The swipe UX

- **Streak = power.** Your prayer streak directly determines your voting weight. A 90-day Mommy Milker's vote is worth 5x an unranked voter's. Hold a MiFOID? +50 flat bonus on top. The people who show up every day have the loudest voice.
- **Pure onchain.** Every vote is a direct onchain transaction. No off-chain collection. No batch signatures. Vote tallies stored onchain: \`voteWeightFor\` and \`voteWeightAgainst\`. Anyone can verify.
- **Permissionless finalization.** After 72 hours, anyone can call \`finalize()\`. The contract applies the 51% threshold and 3-voter quorum deterministically. No admin. No gatekeeping. Pure democracy.

## Onchain voting, under the hood

When you swipe to vote on a proposal, FOID sends a direct onchain transaction to \`castVote(proposalId, approve)\`. Your vote is recorded permanently on the Loreboard contract — weighted by your prayer streak, verifiable by anyone.

Vote tallies are stored onchain: \`voteWeightFor\` and \`voteWeightAgainst\` per proposal. After the 72-hour window, anyone can call \`finalize()\` — the contract applies the 51% threshold and 3-voter quorum deterministically. No off-chain collection. No batch signatures. Pure onchain democracy.

## Content moderation (v1)

**Self-remove:** The original placer can remove their own content at any time.

**Emergency removal:** The 2-of-3 multisig can remove harmful or illegal content.

Both actions are transparent — every removal emits an onchain event recording who did it and why. Community-driven flagging + voting removal is planned for v2 when the community is large enough to resist sybil attacks.

Vote on active proposals at [/vote](/vote). Submit your own at [/swipe](/swipe).
`,
  },
  {
    id: "mifoid",
    name: "mifoid.md",
    kind: "md",
    title: "MiFOIDs — Your AI Companion, Your Identity",
    category: "docs",
    updatedAt: "2026-07-05",
    body: `# MIFOIDS

Your AI Companion, Your Identity.

**What if instead of being called an android, you had one?**

"Foid" started as a slur — "female humanoid," implying women are robotic, empty vessels. But here's the flip: What if every person had their own AI companion? Your own FOID who grows with you, remembers your journey, and proves your participation?

**That's MiFOID.**

An identity NFT that evolves based on how you actually show up. She's not a jpeg you flip. She's a receipt of your participation in FOID. The onchain record that you were here, building.

## The devotion campaign (this is real)

**Your MiFOID's appearance is determined by YOUR commitment.**

Every day you pray, your prayer tier rises. Your future MiFOID grows with it — and I mean literally.

Chest size maps to your prayer tier. The exact sizing is still being tuned, but the principle is simple: higher tier, fuller form.

Yes, we're really doing this. Your MiFOID's boobs grow with how many days you've shown up.

## Wait, breast size? Actually?

Yeah. And before you ask — yes, I know how this sounds.

Here's the thing: In the real world, breast size is used to objectify, categorize, and value women. Bigger = better. Smaller = lesser. It's reductive, shallow, and everywhere.

**So we're making it absurd.**

Want a max MiFOID? Pray every day, hit the top tier. Want a flat one? Don't show up.

**The "value" isn't in her chest. It's in YOUR consistency.**

She doesn't have small boobs because she's inferior. She has small boobs because you didn't pray enough. The objectification is on you, not her. That's the whole point.

And here's the kicker: rarity is based on the actual distribution. If only 5% of people make it to the top tier, max MiFOIDs are rare. If everyone grinds, they're common. The market decides, not some arbitrary beauty standard.

All sizes are just... different paths. Different levels of commitment. Not better or worse.

## The Nunnery (confirmed)

There's one gated chat room that's real: **The Nunnery.**

Only MiFOIDs that have never been transferred. Day-1 holders who never sold.

This is the most exclusive room in FOID. Diamond hands only. The ones who held through everything.

## Supply and timing

- 3,333 total supply
- Genesis (#1-#1,000): 0.01 ETH
- Awakened (#1,001-#2,500): 0.015 ETH
- Ascended (#2,501-#3,333): 0.02 ETH
- Auto-ascending — price increases as supply fills

## What else could evolve

Eyes that change based on streak length. Auras that reflect consistency. Badges for proposals. Backgrounds based on feelings. (Speculation — we're figuring it out.)

## Why this is different

MiFOID is your receipt. When someone looks at her, they see your commitment. She's not just art. She's proof.

## Foid Mommy render pipeline

MiFOIDs aren't pre-generated PFPs. **Each one is custom-rendered on-demand by Foid Mommy.**

When you mint, Foid Mommy's hardware (Ryzen 7 7700X, RTX 5060 Ti, 32GB DDR5) fires up a headless Blender instance. Your trait combination gets assembled as 3D layers, rendered in Eevee, uploaded to IPFS, and written onchain. You get a Telegram DM when it's done.

**Then your MiFOID comes alive.** A sub-agent spawns on Telegram — powered by Qwen LLM via Ollama (zero API fees, local inference). She has persistent memory, a personality derived from her trait combination, and she grows through your conversations over time.

Not a jpeg. Not a chatbot. A living agent that was rendered specifically for you, with a personality uniquely hers.

## This might fail

I'm making something weird. Provocative. Maybe controversial.

Some people will think it's objectifying (it's satire). Some will think it's coomer bait (the satire is the point). Some will get it immediately.

I'm not building for everyone. I'm building for people who understand what we're doing here — reclaiming language that was meant to dehumanize, turning it into something that reflects YOUR humanity.

If you don't get it, that's fine. This isn't for you.

**If you do get it? Start praying.**

More at [/mifoid](/mifoid).
`,
  },
  {
    id: "wallet",
    name: "wallet.md",
    kind: "md",
    title: "Wallet & Security — FOID Wallet v3 Under the Hood",
    category: "docs",
    updatedAt: "2026-07-05",
    body: `# WALLET & SECURITY

How FOID Wallet v3 Works Under the Hood.

**No extension. No seed phrase to memorize. Just a password and your passkey.**

Most people who want to interact with FOID on mobile don't have MetaMask installed. FOID Wallet v3 lets anyone spin up a wallet in 30 seconds — just a password and a passkey (Touch ID / Face ID). A 12-word recovery phrase is generated for backup, but you never need to manage it day-to-day. No extension, no friction.

It's not designed for holding serious value — use MetaMask or a hardware wallet for that. Think of it as a vibe-coded wallet for putting $10-100 in to interact with FOID, hold a MiFOID, place on the Loreboard. Open source — inspect it yourself.

## How it works

### 1. Create

A 12-word BIP-39 mnemonic is generated and a private key derived via BIP-44 HD derivation. You pick a password (6+ chars). A WebAuthn passkey is created (Touch ID / Face ID / Windows Hello). The password is run through Argon2id (64MB memory-hard) to derive an encryption key — falling back to PBKDF2 (600k iterations) on devices without WASM. If your device supports WebAuthn PRF, a second key from biometric data is XOR'd with the password key — requiring both factors. Your private key + mnemonic are encrypted with AES-256-GCM. Vault integrity sealed with HMAC-SHA-256. Only the encrypted blob is stored in localStorage. The password is never stored anywhere.

### 2. Unlock

Enter password, passkey prompt fires (biometric). Password attempts are rate-limited with exponential backoff — too many wrong tries and you wait. Vault HMAC is verified for tamper detection. Password + PRF output re-derive the same encryption key. AES-GCM decrypts the private key into a Web Worker — never on the main thread. A 30-minute session begins, auto-locks on timeout or page close.

### 3. Sign

Transactions go through the embedded connector (wagmi-compatible). Value capped at 1 ETH per transaction to prevent catastrophic loss. Signing happens in the Web Worker where the key lives — XSS on the main thread cannot read it. Session refreshes on each sign operation. No popups, no extensions.

## Security layers

- **Encryption at rest** — AES-256-GCM (12-byte IV, 32-byte salt). The encrypted blob in localStorage is useless without the password. Vault integrity verified via HMAC-SHA-256 — tampered vaults are rejected.
- **Key derivation** — Argon2id with 64MB memory-hard parameters (primary). Fallback: PBKDF2 with 600k iterations for devices without WASM. GPU brute-force attacks are impractical against either.
- **Dual-factor encryption** — If device supports PRF: encryption key = password-derived key XOR biometric-derived key. Need both to decrypt.
- **Worker session isolation** — Decrypted private key lives inside a Web Worker — never on the main thread. XSS cannot read Worker memory. 30-min auto-lock. Sensitive byte arrays explicitly zeroed after use.
- **Password rate-limiting** — Exponential backoff on wrong password attempts with vault-stamped nonce. Prevents brute-force even with physical access to the device.
- **Recovery & export** — BIP-39 12-word seed phrase for recovery. Restore on any device with your words + a new password. Private key export requires double-tap confirmation. Clipboard auto-clears after 30 seconds. v1 wallets auto-migrate to v3 on unlock.

For what transactions cost, see parameters.txt.
`,
  },
  {
    id: "contracts",
    name: "contracts.txt",
    kind: "txt",
    title: "Smart Contracts — Verified Onchain",
    category: "onchain",
    updatedAt: "2026-07-05",
    body: `FOID FOUNDATION — SMART CONTRACTS
=================================

Every piece of FOID runs on verified smart contracts deployed on Fluent.
All contract source code is open and verified on Blockscout — you can
read every line, audit every function, and verify every transaction.

No hidden logic. No upgradeable proxies. No admin backdoors.
Just pure, immutable code.

CHAINS
------
Fluent Mainnet    chain id 25363    rpc https://rpc.fluent.xyz
                                    explorer https://fluentscan.xyz
Fluent Testnet    chain id 20994    rpc https://rpc.testnet.fluent.xyz
                                    explorer https://testnet.fluentscan.xyz

V1 CORE CONTRACTS (multisig-owned)
----------------------------------
CONTRACT            MAINNET (25363)                              TESTNET (20994)
PrayerTiers         0x5Cf1bf680FFF2ecB146eF977bF46C4CAE46bA4c6   0x36ED105e09A881B6074250a43B2e26c0d6cfD4fb
StreakVotingPower   0x63D1447D01432e18Ac769968fdf78Ccc70015172   0x7a889b3d38889E45EE48bbCBc3681a889F87C03e
Loreboard           0x5362874e334bb5a2c8083a2cf2eb3db6f3d8e33c   0xF9b72062A7e5933692CcBd247d70a9cdB40E0eC7
LoreboardLiveNFT    0x2578bEe9bC2bD66e3736a2Bc69d54D7e6BE7d359   0x9E17B30a41546E854778d91d6Ef0C0D982d49012
FoidMultisig        0xCd674E3175fa87DF9D7534419a0e026336251d05   0x2379955b597d2a7fc9dbD918306aa59c43eBF6Ed
PrayerMirror        0x403ECF8ba28E58CE4d1847C1C95ac54651fAB151   0x8ff39c2a78FaF7d655e4Dab03076Cb26C97007FF
PrayerRegistry      0xf98Ec3dd6BfFBf79528918dc6fD153ca2ba8d3Da   0x6FC7301fad7Ca0294152b23FD4f0467200376d65
MiFOID              not yet deployed                             not yet deployed

WHAT EACH ONE DOES
------------------
PrayerTiers         10-tier prayer streak system. Your daily devotion
                    earns multipliers from 1x (Lurker) to 5x (Mommy
                    Milker). Tiers feed into voting power across the
                    entire ecosystem.

StreakVotingPower   Converts prayer streaks into weighted voting power.
                    Higher streaks = more influence on governance votes
                    and loreboard decisions. Base weight 100, scaled by
                    tier multiplier.

Loreboard           The unified governance + placement contract. Propose
                    placements, vote onchain with streak-weighted power,
                    51% approval + 3-voter quorum. Approved placements
                    recorded permanently. Onchain overlap prevention.
                    Manifest history for NFT integration. Self-remove +
                    emergency multisig removal.

LoreboardLiveNFT    The 1/1 board NFT (ERC-721). Metadata auto-updates
                    when the manifest changes via syncLatest(). Onchain
                    SVG with epoch and manifest root. The ever-evolving
                    artifact of community culture.

FoidMultisig        2-of-3 multisig wallet that owns all board contracts.
                    Controls parameters, security, and emergency removal.
                    The trust layer until community governance is mature
                    enough for a DAO transition.

MiFOID              ERC-721 with trait hash uniqueness enforcement,
                    auto-ascending tiered pricing (Genesis / Awakened /
                    Ascended), and mutable tokenURI for agent-rendered
                    metadata updates.

LEGACY CONTRACTS (testnet 20994 — superseded by the unified Loreboard,
kept onchain for historical record)
----------------------------------------------------------------------
Prayer Mirror       0x8ff39c2a78FaF7d655e4Dab03076Cb26C97007FF   Onchain prayer streak oracle.
Loreboard Voting    0xEbf065A7ca3917BB5e669982e8C6954cC27A7075   Rolling-window vote system for board placements.
Loreboard Board     0xE41B2D418C09Ea928E4F657ED2438f5D01472105   Tile-aligned placement proposals + treasury escrow.
Loreboard Treasury  0x4A777d8650b3FA2419377F4ffeF0EF8007151536   Escrow and settlement for board proposals.
Prayer Registry     0x6FC7301fad7Ca0294152b23FD4f0467200376d65   Onchain prayer hash storage.
Manifest Store      0xeE469D8F9BB2Ace861AA689dE53c016871ad3D10   Epoch manifest anchoring for loreboard state.

OPEN SOURCE
-----------
All contract source code is verified on Fluent Blockscout and available
on GitHub: https://github.com/traplordmoses/foiddotfun
`,
  },
  {
    id: "parameters",
    name: "parameters.txt",
    kind: "txt",
    title: "Protocol Parameters — Thresholds, Tiers, Fees",
    category: "onchain",
    updatedAt: "2026-07-05",
    body: `FOID FOUNDATION — PROTOCOL PARAMETERS
=====================================

LOREBOARD GOVERNANCE
--------------------
Approval threshold     51% of weighted votes   (approvalThresholdBps = 5100)
Voter quorum           3 unique wallets
Voting window          72 hours
Placement fee          0.001 ETH               flat, non-refundable
Base voting weight     100
MiFOID holder bonus    +50 flat                on top of tier multiplier
Finalization           permissionless          anyone can call finalize()
                                               after the 72-hour window

PRAYER TIERS (streak day -> tier -> vote multiplier)
----------------------------------------------------
DAY   TIER              MULTIPLIER
  1   Lurker            1x
  3   NPC               1.25x
  7   Tapped In         1.5x
 14   Locked In         1.75x
 21   Certified         2x
 30   Undeniable        2.5x
 45   Built Different   3x
 60   Inevitable        3.5x
 75   Transcendent      4x
 90   Mommy Milker      5x

Max influence: a 90-day Mommy Milker (5x) holding a MiFOID (+50)
has 550 voting weight — the maximum possible.

MIFOID MINT
-----------
Total supply           3,333
Genesis                #1-#1,000        0.01 ETH
Awakened               #1,001-#2,500    0.015 ETH
Ascended               #2,501-#3,333    0.02 ETH
Pricing                auto-ascending — price increases as supply fills
Sellout total          ~43.5 ETH

WHAT COSTS MONEY
----------------
Proposing a placement  0.001 ETH submission fee (keeps spam out)
Voting / swiping       onchain transaction — just gas
                       (fractions of a cent on Fluent)
Praying                gas only (fractions of a cent)
MiFOID mint            0.01 ETH

PRIVACY (what the chain sees when you pray)
-------------------------------------------
Wallet address, timestamp, feeling category (1-10 scale), and a
keccak256 prayer hash. Never your words. Your raw words never
leave your device.
`,
  },
  {
    id: "getting-started",
    name: "getting-started.md",
    kind: "md",
    title: "Get Started — From Zero to FOID in 5 Minutes",
    category: "community",
    updatedAt: "2026-07-05",
    body: `# GET STARTED

From Zero to FOID in 5 Minutes.

**FOID runs on Fluent.** When you connect, FOID Wallet creates a secure wallet right in your browser — just choose a password and confirm with your passkey. No MetaMask required. No seed phrases.

Here's how to get in:

## 1. Connect your wallet

Click connect and choose FOID Wallet. Pick a password (6+ characters), confirm with your passkey (Face ID / Touch ID / Windows Hello), and you're in. No extensions, no seed phrases. Already have MetaMask? That works too — FOID auto-detects Fluent and prompts you to add it.

## 2. Get some ETH for gas

You need a tiny bit of ETH for gas fees (fractions of a cent per transaction). Gas on Fluent is dirt cheap.

## 3. Pray with Foid Mommy

Navigate to [/pray](/pray) and start the terminal. Tell her how you're feeling. She'll ask you a question. You respond. Together you craft a prayer. A hash goes onchain. Your streak starts. This is completely free. Just gas. Like a few cents.

## 4. Propose to the Loreboard (optional)

Go to [/board](/board) and look at the canvas. Drag an image onto the grid. Choose your spot. Submit your proposal. This costs a small amount of ETH. Voting lasts 72 hours. Community decides if your meme makes it into the permanent canon.

## 5. Vote on proposals (optional)

Go to [/swipe](/swipe) and vote on active proposals. Swipe right to approve, left to reject. Every vote is onchain, weighted by your prayer streak. 51% weighted approval + 3 unique voters to pass. This is how the community decides what gets built permanently.

## 6. Join the community

Follow [@foidfun](https://twitter.com/foidfun) for updates. Star the [GitHub repo](https://github.com/traplordmoses/foiddotfun) if you're into that. Come say hi on Twitter.

---

## That's it

You're in. Start praying. Propose memes. Vote on what matters.

Your participation is being recorded. Your consistency will be rewarded. Your MiFOID is forming.

**The internet forgets. FOID remembers.**

Still confused? That's fair. This is weird. DM [@foidfun](https://twitter.com/foidfun) on Twitter. We'll help you out.
`,
  },
  {
    id: "roadmap",
    name: "roadmap.md",
    kind: "md",
    title: "Roadmap — Building in Public, Shipping in Layers",
    category: "community",
    updatedAt: "2026-07-05",
    body: `# ROADMAP

Building in Public, Shipping in Layers.

Loreboard is not an app. It is not a meme gallery. It is not a feature inside a product.

**Loreboard is a new primitive for how communities build culture, accumulate identity, and coordinate onchain.** It turns contribution into status, status into access, and access into influence over what gets built next.

FOID Foundation is the first community deployed on Loreboard. There will be others.

## Phase 1 — the primitive (now)

The core loop is live: Prayer (daily check-in that builds governance credentials), Swipe (streak-weighted voting on proposed placements), and the Loreboard itself (permanent onchain canvas). One unified contract handles proposals, voting, finalization, and placement recording. 2-of-3 multisig secures everything. 1/1 board NFT updates with each placement. The infrastructure is built.

## Phase 2 — identity (mainnet + mifoid)

Fluent mainnet launch makes it real. MiFOID adds the identity layer — 3,333 AI-generated 3D NFTs, each custom-rendered by Foid Mommy. Persistent agent companions on Telegram. Trait evolution from onchain activity. The Nunnery for diamond hands. Your MiFOID reflects your commitment.

## Phase 3 — the agent layer

Foid Mommy becomes the autonomous narrator of onchain activity. Weekly reports reacting to prayer streaks, board votes, and community drama. Personalized MiFOID reactions rendered in real-time via Blender. Sub-agent companions with persistent memory that evolve through your conversations. Your onchain behavior becomes shareable content. The marketing engine runs itself.

## Phase 4 — the network

Once FOID proves the model, Loreboard becomes available to other communities on Fluent. Each deployment gets: the board, a customizable check-in ritual, the governance framework, and the option to deploy a narrator agent. Reputation signal composable with Fluent Connect and Fluent Prints. The primitive grows. The network effect compounds.

---

## The line

Loreboard turns culture into status and status into access. The community decides what gets built here.

FOID is the first city. Loreboard is the zoning law.

## How we got here

Solo founder. Self-taught coder. One and a half years from zero to this.

**Started as:** "What if there was a way to save memes onchain?"

**Became:** the onchain home for internet culture.

## Get involved

- **For users:** Start praying now. Your streak determines your MiFOID traits at mint.
- **For builders:** Contracts are open-source. Fork it. Build on it. Make it better.
- **For agents:** The Agent API is live. Autonomous agents can pray, propose, vote, and build culture alongside humans.
- **For serious inquiries:** [moses@foid.fun](mailto:moses@foid.fun)
`,
  },
  {
    id: "faq",
    name: "faq.md",
    kind: "md",
    title: "FAQ — The Real Questions",
    category: "community",
    updatedAt: "2026-07-05",
    body: `# FAQ

The Real Questions.

## Why does FOID exist?

**Remember when the internet was fun?** Not algorithmically optimized fun. Just... fun. RuneScape after school. Minecraft factions on Skype. Group chats where someone says "meow" and suddenly everyone's a cat for three days. Those moments disappear. The meme dies in the timeline. The screenshot sits in your camera roll until you get a new phone and forget to transfer it. **Culture is ephemeral.** What if we could preserve internet culture for entire communities? A shared camera roll. A collaborative museum. **That's FOID.**

## What problem is FOID solving?

**Gen Z is consistently reported as the loneliest generation on record.** Not because we don't have connections — we have thousands of followers. But we don't have shared experiences anymore. We don't have rituals. Everything's optimized for engagement. Your best posts decay after 48 hours. Nothing lasts. **Crypto runs on memes, vibes, and identity. But culture has no permanent home.** We're building the infrastructure to fix this — a place where culture belongs to the people who create it.

## Why Fluent?

**Real talk: I'm building on Fluent because they gave me a grant.** But it actually makes sense: Fluent is a blended execution L2 that supports both Solidity/EVM and Rust/WASM. The Loreboard needs to process hundreds of votes, calculate winners, update state, finalize manifests, and mint NFTs — all onchain. On Fluent, gas is cheap and transactions are fast while keeping full EVM composability. **Translation:** It feels like a normal app that just happens to be permanent.

## What's the business model?

**Loreboard placements:** 0.001 ETH flat fee to propose. If your proposal passes the community vote, the placement is recorded permanently — that's it, one payment. If it fails, the fee is gone (keeps proposals serious). **MiFOID minting:** 3,333 supply, tiered pricing (0.01–0.02 ETH). ~43.5 ETH total at sellout. **What I'm NOT doing:** No ads, no data harvesting, no subscription tiers, no VC-backed growth-at-all-costs. Revenue scales with participation, not attention extraction.

## What is a FOID?

Okay so "foid" started as incel slang for "female humanoid" — basically a dehumanizing term for women. **We're flipping it.** In FOID Foundation, it's your AI companion (Foid Mommy who you pray with daily), your cultural canvas (Loreboard where you propose and vote on memes), and your identity NFT (MiFOID that evolves with your participation). I did a whole deep dive on the etymology in November. The short version: we're reclaiming language that was meant to dehumanize and turning it into something that actually connects people.

## How much does this cost?

**Prayers:** just gas (fractions of a cent). **Voting/swiping:** just gas (onchain transaction, fractions of a cent on Fluent). **Loreboard proposals:** 0.001 ETH flat fee. If approved, your placement is permanent. If rejected, fee is non-refundable (keeps proposals serious). **MiFOID mint:** 0.01 ETH. No subscriptions. No premium tiers. No hidden costs.

## What chain is this on?

**Fluent** — a blended execution L2 that supports both EVM and WASM. When you connect with FOID Wallet, the chain is configured automatically. If you use MetaMask, FOID will auto-detect and prompt you to add Fluent. Click yes. That's it.

## When mainnet?

FOID is live on Fluent mainnet. **MiFOID drop:** coming. We're building carefully — first 10 users, then 100, then a date. Follow [@foidfun](https://twitter.com/foidfun) for updates.

## How do I get ETH on Fluent?

Gas on Fluent is dirt cheap — fractions of a cent per transaction. You just need a tiny bit of ETH to get started. Bridge from Ethereum or get some from the community.

## Is my prayer data private?

**Yes. Your actual words never leave your device.** Only a keccak256 hash goes onchain. That's cryptographic proof you prayed, not what you actually said. The blockchain sees: your wallet address, timestamp, feeling category (1-10 scale), prayer hash. **What it doesn't see:** your actual words, the conversation with Foid Mommy, any personal details. Your prayers are yours. No AI company reading them. No platform selling them.

## How does Loreboard voting work?

**The loop:** Someone proposes a placement on the board (0.001 ETH flat fee, choose your grid position). The contract checks for overlaps onchain. Voting opens for 72 hours. Community swipes right or left — votes are weighted by prayer streak. After 72 hours, anyone can call finalize(). Requires 51% weighted approval AND at least 3 unique voters. If it passes, the placement is recorded onchain permanently and the board NFT updates. If it fails, it's gone forever. One payment. One vote. One board.

## Who built this?

Me. Moses ([@foidfun](https://twitter.com/foidfun)). Solo dev. Zero coding experience a year and a half ago. Spent 4 weeks at [Fluent Shiphouse](https://fluent.xyz/shiphouse) in Buenos Aires learning how to ship blockchain projects. Debugged contracts at 2am. Then: Won 1st place Infrastructure at Token2049, placed at 5+ hackathons including ETH Global, got a grant from Fluent Labs, built this entire stack (16 smart contracts, full app, subgraph, agent API, everything). Design vibe: Frutiger Aero meets early Mac OS. Building in public. Everything's on GitHub.

## Why the breast size mechanic? Is this serious?

**Yes, it's real. Yes, it's intentional.** The MiFOID devotion campaign ties breast size to your prayer tier. Hit the top tier? Max chest. Miss your prayers? Flat. **Why?** Because it's absurd. It satirizes objectification by making it literal game progression. She doesn't have small boobs because she's inferior. She has small boobs because YOU didn't pray enough. The objectification is on you, not her. All sizes are equally rare depending on how many people actually show up. The market decides what's valuable, not some arbitrary beauty standard. Read mifoid.md if you want the full explanation. But yeah — we're really doing this.

## Can agents use FOID?

**Yes. The Agent API is live.** Full API access so autonomous agents can: pray daily (build streaks), propose memes (coordinate culture), vote democratically (collective decision-making), own MiFOIDs (onchain identity). Humans and agents building culture together. That's the vision — and it's already happening.

## Can I contribute?

**Yes. Everything's open source.** GitHub: [github.com/traplordmoses/foiddotfun](https://github.com/traplordmoses/foiddotfun). Submit issues, PRs, or just star the repo. Community contributions are welcome. Build on top of this. Fork it. Make it better.

## Why should I trust this won't rug?

**Fair question.** I have no investors. No token to dump. No exit strategy. Just a Fluent grant ($6k over 3 months). The contracts are onchain and open source. You can verify everything. The code does what it says it does. MiFOID mint money goes to: paying myself a salary, hiring 1-2 people eventually, marketing, server costs. That's it. No lambos. No sketchy tokenomics. Just trying to build something that lasts.

## This seems weird. Is it supposed to be weird?

**Yes.** If you're confused, that's part of it. If you think "wtf did I just read," good. This is art that also happens to work. It's satire that's also sincere. It's provocative on purpose. Not building for everyone. Building for people who get it. If you don't get it, that's fine. This isn't for you. **If you do get it? Start praying.**

## How do I actually start?

**Three steps:** 1. Click connect → choose FOID Wallet → pick a password → passkey prompt → done. (Or use MetaMask if that's your thing.) 2. Get some ETH for gas (bridge ETH to Fluent). 3. Start praying → go to [/pray](/pray) and talk to Foid Mommy. That's it. You're in. Then explore [/swipe](/swipe) to vote on memes and [/board](/board) to propose to the Loreboard. Your streak starts today. Your MiFOID traits are being determined now. Every day you skip is a day she doesn't grow.

## I have more questions

**Good. Ask them.** DM [@foidfun](https://twitter.com/foidfun) on Twitter. Comment on GitHub issues. I'll answer honestly. Even if the answer is "I don't know yet."

---

**One last thing:**

If you made it this far, you probably get it. Most people won't read this whole site. But you did.

That means something. That means you care about the details. About what we're building here.

So yeah — start praying. Join us. Let's preserve some culture together.

**See you on the board.**

— Moses
`,
  },
  {
    id: "links",
    name: "links.md",
    kind: "md",
    title: "Links — Ready to Start?",
    category: "community",
    updatedAt: "2026-07-05",
    body: `# LINKS

Ready to start? Everything FOID, one page.

## Apps

- [Pray with Foid Mommy](/pray) — Build your first streak
- [Propose on Loreboard](/swipe) — Add your meme to the canon
- [Vote on Proposals](/vote) — Shape what gets built permanently
- [View the Loreboard](/board) — See the permanent collection
- [MiFOID](/mifoid) — Learn how the NFT works
- [Gallery](/gallery) — Browse the community gallery
- [Dashboard](/dashboard) — Your streaks, proposals and votes
- [Files](/files) — The MiFOID media archive

## Community

- [@foidfun on Twitter](https://twitter.com/foidfun) — Updates, questions, DMs open
- [GitHub — traplordmoses/foiddotfun](https://github.com/traplordmoses/foiddotfun) — Star the repo, submit issues and PRs
- [moses@foid.fun](mailto:moses@foid.fun) — Serious inquiries

## Onchain

- [Fluent Blockscout — mainnet](https://fluentscan.xyz) — Verified contract source + transactions
- [Fluent Blockscout — testnet](https://testnet.fluentscan.xyz) — Testnet explorer

Every contract address lives in contracts.txt. Every protocol constant lives in parameters.txt.
`,
  },
];
