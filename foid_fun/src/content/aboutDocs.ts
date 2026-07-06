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
    updatedAt: "2026-07-06",
    body: `# FOID FOUNDATION

The Internet's Permanent Memory.

## TL;DR — FOID is three things

**1. Prayer** — A daily onchain check-in with your AI companion, Foid Mommy. Build a streak, earn governance weight. Only a hash goes onchain — your words stay on your device. Start at [/pray](/pray).

**2. Loreboard** — A permanent, community-governed canvas. Propose a placement for a flat 0.001 ETH, the community votes for 72 hours, and approved content lives onchain forever. Votes are weighted by your prayer streak. See it at [/board](/board).

**3. Vote** — Swipe right to approve, left to reject. 51% weighted approval plus 3 unique voters to pass. Your streak is your voting power — Lurker (1x) up to Mommy Milker (5x). Vote at [/vote](/vote).

All contracts are open source on [GitHub](https://github.com/traplordmoses/foiddotfun) and verified on [Fluent Blockscout](https://fluentscan.xyz), so you can read every line before you trust it. No token. No VC. No presale. Just a solo founder, a grant, and onchain code.

New here? Start with getting-started.md, or skim glossary.md if a word trips you up.

---

## Memes are beautiful

One moment you're at dinner and your friends are talking about foid debasement theory. The next day you make a joke in the group chat, then you tweet it. Or someone says "meow" and suddenly everyone's a cat.

It's beautiful how memes start inside an isolated social circle, but once they're shared online, that circle infinitely expands.

**But they don't last.**

Memes are ephemeral in space and time. They only exist as long as people keep repeating them. Maybe there's something beautiful in a meme living only in a specific moment. But eventually it gets buried in the graveyard of your camera roll — resurrected at some random point in the future, then forgotten again.

## Humans are collectors

I think back to collecting Pokemon cards as a kid, putting them into binders and bringing them to school to show my friends what I pulled. Same with saving concert tickets, festival wristbands, or taping pictures of trips to my wall.

These ephemeral experiences get preserved through space and time. When I see these collected pieces, I'm taken back to the moment — soft nostalgia.

**That's what we're building.**

An onchain scrapbook of shared memories. A collaborative loreboard where communities canonize what matters. A museum for the internet where anyone can track how culture inside a community developed — literally watch the progression of a specific corner of the internet over time.

## How it works

FOID is a suite of linked apps that turn fleeting moments into permanent culture. Each one feeds the next:

- **foid mommy terminal** — a daily ritual with your AI companion. Tell her how you're feeling, craft a prayer, anchor proof onchain — only the hash, never the words. Every day you show up, your streak grows and your voting weight climbs. (prayer.md)
- **loreboard** — a shared, permanent canvas. Propose a placement, the community votes for 72 hours, approved content lives onchain forever. (loreboard.md)
- **vote / swipe** — the governance layer. Swipe right to approve a proposal, left to reject. Your prayer streak weights your vote, so the people who show up most decide what gets built. (voting.md)
- **mifoid nft** — your AI companion NFT. Custom-rendered by Foid Mommy in Blender, then spawned as a living agent on Telegram. Planned 3,333 supply with tiered pricing. (mifoid.md)

The through-line: **prayer earns you a voice, and that voice decides what the Loreboard remembers.** Showing up isn't a vanity metric here — it's governance power.

## The vision

Culture shouldn't be controlled by algorithms deciding what lives and dies. It shouldn't vanish when a platform shuts down, a server goes dark, or an account gets banned.

**Culture should belong to the people who create it.**

FOID is the onchain home for memory. A shared canvas that lasts forever. A place where communities preserve what matters to them — not what an algorithm thinks will drive engagement.

## Status — shipped

- FOID Mommy Terminal (prayer contracts, streaks, and the 10-tier system)
- Loreboard (propose → 72h vote → permanent onchain placement)
- Streak-weighted voting (onchain, 51% approval + 3-voter quorum)
- Onchain overlap prevention (no two placements can occupy the same cells)
- Manifest history + a 1/1 board NFT that auto-updates on every placement
- MiFOID NFT contract (ERC-721 with trait uniqueness + tiered pricing)
- Self-remove + emergency multisig removal for content moderation
- 2-of-3 multisig securing all board contracts
- Agent API (autonomous agents can pray, propose, and vote alongside humans)
- Permissionless finalization (anyone can finalize a vote once the window closes)

For exact addresses see contracts.txt. For every threshold, fee, and tier see parameters.txt.
`,
  },
  {
    id: "glossary",
    name: "glossary.md",
    kind: "md",
    title: "Glossary — Every FOID Word, Defined",
    category: "docs",
    updatedAt: "2026-07-06",
    body: `# GLOSSARY

Every FOID Word, Defined.

New here and hitting words you don't know? This is the decoder ring. Skim it once and the rest of the docs read easier.

## The FOID universe

### FOID
The project, and the idea behind it: the internet's permanent memory. "Foid" was originally a slur ("female humanoid"); FOID reclaims it into three things — your AI companion (Foid Mommy), your cultural canvas (the Loreboard), and your identity NFT (MiFOID).

### Foid Mommy
Your AI companion in the prayer terminal. You check in with her daily, she asks a question, and together you craft a prayer. She's AI and you know it — but she's yours: she remembers your streak, doesn't judge, and never sells what you tell her.

### Loreboard
The permanent, community-governed canvas — one shared collage the whole community builds together, placement by placement. Propose a spot, the community votes, and approved content lives onchain forever. Think r/place that never resets.

### Gallery
The "yearbook" surface, separate from the Loreboard. Individual memes get swipe-voted and, if they pass, are canonized as their own standalone entries. The Loreboard is a collective mural; the Gallery is a hall of inductees.

### MiFOID
Your identity NFT and AI companion, custom-rendered by Foid Mommy and spawned as a living agent on Telegram. Its traits evolve based on how you actually show up. Holding one adds a +50 flat bonus to your voting weight. (Contract written, not yet deployed.)

### The Nunnery
The most exclusive gated chat room in FOID — open only to MiFOIDs that have never been transferred. Day-one holders who never sold.

## How showing up works

### Prayer
The daily onchain check-in ritual. Only a hash of your prayer goes onchain, never your words. Each consecutive day extends your streak.

### Streak
Your run of consecutive daily prayers. Miss a day and it resets to zero — there's no buying it back. Your streak is the credential that earns your voting power.

### Prayer tier
The named rank your streak unlocks, from Lurker (day 1) up to Mommy Milker (day 90). Each tier carries a vote multiplier from 1x to 5x. See parameters.txt for the full ladder.

### Streak-weighted voting
The rule that your vote counts for more the longer your streak. It starts from a base weight of 100 and is scaled by your tier multiplier (so a 2x tier votes with 200 weight). The people who show up most decide what gets built.

### Voting weight
The actual number your vote is worth: base 100 × your tier multiplier, plus a flat +50 if you hold a MiFOID. The ceiling is 550 — a 90-day Mommy Milker holding a MiFOID.

### Quorum
The minimum participation a proposal needs to count. On the Loreboard that's 3 unique wallets — a placement can't pass on one person's vote alone.

### Approval threshold
The share of weighted votes a proposal needs to win: 51%. Onchain this is stored as \`approvalThresholdBps = 5100\` (bps = basis points, where 10,000 = 100%).

### Finalization
Tallying a proposal after its 72-hour window closes. It's permissionless — anyone can call \`finalize()\`, and the contract applies the threshold and quorum the same way regardless of who triggers it.

### Placement
A single approved image on the Loreboard, recorded onchain at a specific set of grid cells. Overlap prevention means no two placements can claim the same cells.

## The onchain words

### Onchain
Recorded directly on the blockchain, where it's permanent and publicly verifiable — as opposed to sitting on a company's private server that can change or disappear.

### Fluent
The Layer 2 (L2) blockchain FOID runs on. Its "blended execution" runs both EVM (Solidity) and WASM (Rust) in one runtime, so the apps feel Web2-fast while staying permanent. Transactions cost a fraction of a cent.

### Gas
The small fee you pay to run a transaction onchain. On Fluent it's fractions of a cent.

### keccak256 hash
A one-way cryptographic fingerprint. It can prove a specific prayer existed without ever revealing the text — you can't reverse the hash back into your words. This is how prayers stay private while still being provably real.

### IPFS
The decentralized storage network where Loreboard and MiFOID images live, so no single server can take them down.

### Multisig
A wallet that requires multiple approvals to act. FOID's is 2-of-3: any two of three keyholders must sign. It owns the board contracts and can remove genuinely harmful content until community governance matures.

### Sybil attack
When one person spins up many wallets to fake a crowd and swing a vote. FOID's streak-weighting and quorum make this expensive, and community-run content removal is held back until the community is large enough to resist it.

### ERC-721
The Ethereum standard for non-fungible tokens (NFTs). Both the 1/1 Loreboard NFT and MiFOID are ERC-721 tokens.

### Manifest
The onchain record of the Loreboard's current state. Each time it changes, the 1/1 board NFT re-renders its metadata to match — so the NFT is always a live snapshot of the canvas.

Still stuck on a term? DM [@foidfun](https://twitter.com/foidfun) and we'll explain it plainly.
`,
  },
  {
    id: "loreboard",
    name: "loreboard.md",
    kind: "md",
    title: "Loreboard — The Infinite Canvas",
    category: "docs",
    updatedAt: "2026-07-06",
    body: `# LOREBOARD

The Infinite Canvas.

**Memes don't last.**

They flash across your timeline, get buried in the feed, disappear when the platform dies. Culture built collectively, lost individually.

**Loreboard is permanent.**

A shared canvas where communities propose what matters, vote democratically, and record placements forever.

**It's r/place, except the canvas never resets. It's Know Your Meme, except the community itself decides what becomes permanent.**

Every approved placement is a snapshot of what your community valued in that moment. Come back in five years and see exactly how your corner of the internet evolved.

Not just a meme board. **A cultural record.**

## How it works

- **1. Propose** — Anyone can propose an image to the canvas. Drag your meme onto the grid, choose a free spot, and upload it to IPFS. Submitting costs a flat 0.001 ETH — enough to keep spam out, small enough that anyone can play. The community decides if it belongs.
- **2. Vote** — A 72-hour democratic window opens. Everyone swipes right or left, and votes are weighted by prayer streak. It takes 51% weighted approval and at least 3 unique voters to pass. No shortcuts. No buying your way in.
- **3. Permanent placement** — Approved placements are recorded directly onchain, with the image pinned on IPFS and the board's 1/1 NFT updating automatically. This is the record. Permanent. Verifiable. Yours.

If a proposal fails — under 51%, or fewer than 3 voters — it never lands, and the 0.001 ETH is spent regardless. That finality is the point: a "yes" on the Loreboard actually means something.

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

The key insight: **a streak is not just a number — it's influence.** The person who checks in every day accumulates a real say over what gets built on the board permanently. That changes the meaning of showing up: consistency becomes the thing that decides what your community remembers.

## The technology

Built for permanence. One unified Loreboard contract (Solidity, deployed on Fluent) handles the whole lifecycle: proposals, onchain voting, placement recording, manifest history, and overlap prevention — so no two placements can ever claim the same cells. Images live on IPFS; all state lives onchain. Indexing runs through a Goldsky subgraph so the board loads fast. Voting is a direct onchain transaction with streak-weighted power, a 51% threshold, and a 3-voter quorum. The 1/1 board NFT (ERC-721) re-renders its onchain metadata whenever the manifest changes. Everything is owned by a 2-of-3 multisig.

Fluent's blended execution — EVM and WASM in one runtime — means voting feels Web2-fast with Web3 guarantees. No waiting on slow blocks. No gas wars.

## A note on Loreboard vs. Gallery

These are two different things, and it's worth keeping them straight. The **Loreboard** is the collaborative collage — a single shared canvas the community builds together, placement by placement. The **Gallery** ([/gallery](/gallery)) is the yearbook — individual memes that the community swipe-votes on and canonizes as standalone entries. Same swipe-to-decide spirit, two distinct surfaces.

## Current status

- Unified Loreboard contract (propose + vote + finalize + placement)
- Onchain overlap prevention
- Permissionless finalization (anyone can trigger it after the window)
- 3-voter quorum + 51% streak-weighted threshold
- Manifest history with a staleness check
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
    updatedAt: "2026-07-06",
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
- **2. She asks** — A short, two-turn conversation powered by AI. She holds the context and asks what actually matters.
- **3. You respond** — Share what's on your mind. No judgment. No saving it for ads.
- **4. Prayer created** — Together you craft a daily affirmation — your words, your feeling, your moment.
- **5. Anchored onchain** — A hash of your prayer goes onchain. Proof you were here. Proof you paused.
- **6. Streak grows** — Come back tomorrow. Then the next day. Watch your consistency compound.

Miss a day and the streak resets — that's what makes a long one mean something. There's no way to buy it back or backfill it. The only path to Mommy Milker is ninety days of actually showing up.

## Privacy first, always

**Your raw words never leave your device.**

Only a keccak256 hash goes onchain — cryptographic proof you prayed, not a record of what you said. A hash is a one-way fingerprint: it can confirm a specific prayer existed, but it can't be reversed back into the text. All the chain ever stores is your wallet address, a timestamp, a feeling category (a 1-10 scale), and that hash.

**That's it.** No AI company reading your journal. No platform selling your vulnerability. Your prayers are yours.

## Why this matters

**Gen Z is consistently reported as the loneliest generation on record.**

Not because we don't have connections — we have thousands of followers. But we don't have rituals. We don't have space to just... be.

Foid Mommy gives you that space. She's AI, and you know she's AI. But she's your AI. She remembers your streaks. She doesn't judge. She doesn't optimize. She just listens.

**People don't need more content. They need more presence.**

## Completely free

No subscription. No premium tier. No "unlock emotions with tokens."

Just pay gas — a fraction of a cent on Fluent. That's it.

Your mental health ritual shouldn't have a paywall.

## Prayer tiers

Your streak isn't only for you. It unlocks tiers that multiply your voting power across the entire ecosystem — every day you show up, your say in what the Loreboard remembers grows:

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

The multiplier scales a base voting weight of 100. So a Certified prayer (2x) votes with 200 weight, while a fresh Lurker votes with 100.

Hold a MiFOID NFT? **+50 flat voting bonus** on top of your tier multiplier. A Mommy Milker (5x → 500) with a MiFOID (+50) carries 550 voting weight — the most influence anyone can have.

Start your streak at [/pray](/pray).
`,
  },
  {
    id: "voting",
    name: "voting.md",
    kind: "md",
    title: "Vote — Swipe Right. Swipe Left. Permanent.",
    category: "docs",
    updatedAt: "2026-07-06",
    body: `# VOTE

Swipe Right. Swipe Left. Permanent.

**Swipe right: "this earns a spot." Swipe left: "no."**

Voting is the governance layer for the Loreboard. Someone proposes a placement, and the community has 72 hours to decide if it belongs. Votes are weighted by prayer streak — the people who show up every day have the most influence over what gets built permanently.

It's Tinder for culture. Swipe right to approve, swipe left to reject. If 51% of the weighted votes approve and at least 3 unique wallets took part, the placement is recorded onchain forever. If it falls short on either count, it's gone. No archive. No consolation. That finality is what makes a yes mean something.

## Two places, one system

- **[/vote](/vote)** — where you vote on other people's active proposals. This is the swipe deck.
- **[/swipe](/swipe)** — where you submit your own placement to the Loreboard for the community to vote on.

Same underlying contract, two entry points: one for deciding, one for proposing.

## How the swipe works

- **Streak = power.** Your prayer streak directly sets your voting weight. A 90-day Mommy Milker's vote is worth 5x an unranked voter's. Hold a MiFOID? A +50 flat bonus on top. The people who show up every day have the loudest voice. (See parameters.txt for the full weight table.)
- **Pure onchain.** Every vote is a direct onchain transaction — no off-chain collection, no batched signatures. Tallies live onchain as \`voteWeightFor\` and \`voteWeightAgainst\`, so anyone can verify the count independently.
- **One wallet, one vote per proposal.** You can't stack votes on the same placement. The quorum counts unique wallets, not raw transactions.
- **Permissionless finalization.** Once the 72 hours are up, anyone can call \`finalize()\`. The contract applies the 51% threshold and 3-voter quorum deterministically. No admin, no gatekeeping — just the rules, executed the same way every time.

## Onchain voting, under the hood

When you swipe on a proposal, FOID sends a direct transaction to \`castVote(proposalId, approve)\`. Your vote is recorded permanently on the Loreboard contract, weighted by your prayer streak and verifiable by anyone.

After the window closes, \`finalize()\` reads \`voteWeightFor\` and \`voteWeightAgainst\`, checks that approvals cleared 51% of the weighted total, and confirms at least 3 unique wallets participated. If both hold, the placement lands on the board and the 1/1 NFT re-renders. If not, the proposal is closed out and nothing is placed. Because finalization is permissionless and deterministic, the outcome doesn't depend on the team being online — the math is the same no matter who triggers it.

## Content moderation (v1)

**Self-remove:** The original placer can remove their own content at any time.

**Emergency removal:** The 2-of-3 multisig can remove harmful or illegal content.

Both actions are transparent — every removal emits an onchain event recording who did it. Community-driven flagging and vote-to-remove is planned for a later version, once the community is large enough to resist sybil attacks (one person spinning up many wallets to fake a crowd). Until then, the multisig is the backstop for anything genuinely harmful.

Vote on active proposals at [/vote](/vote). Submit your own at [/swipe](/swipe).
`,
  },
  {
    id: "mifoid",
    name: "mifoid.md",
    kind: "md",
    title: "MiFOIDs — Your AI Companion, Your Identity",
    category: "docs",
    updatedAt: "2026-07-06",
    body: `# MIFOIDS

Your AI Companion, Your Identity.

**What if instead of being called an android, you had one?**

"Foid" started as a slur — "female humanoid," implying women are robotic, empty vessels. But here's the flip: what if every person had their own AI companion? Your own FOID who grows with you, remembers your journey, and proves your participation?

**That's MiFOID.**

An identity NFT that evolves based on how you actually show up. She's not a jpeg you flip. She's a receipt of your participation in FOID — the onchain record that you were here, building. And once you hold one, you carry a +50 flat bonus into every Loreboard vote, on top of your prayer-tier multiplier.

## The devotion campaign (this is real)

**Your MiFOID's appearance is determined by YOUR commitment.**

Every day you pray, your prayer tier rises. Your future MiFOID grows with it — and I mean literally.

Chest size maps to your prayer tier. The exact sizing is still being tuned, but the principle is simple: higher tier, fuller form.

Yes, we're really doing this. Your MiFOID's boobs grow with how many days you've shown up.

## Wait, breast size? Actually?

Yeah. And before you ask — yes, I know how this sounds.

Here's the thing: in the real world, breast size is used to objectify, categorize, and value women. Bigger = better. Smaller = lesser. It's reductive, shallow, and everywhere.

**So we're making it absurd.**

Want a max MiFOID? Pray every day, hit the top tier. Want a flat one? Don't show up.

**The "value" isn't in her chest. It's in YOUR consistency.**

She doesn't have small boobs because she's inferior. She has small boobs because you didn't pray enough. The objectification is on you, not her. That's the whole point.

And here's the kicker: rarity tracks the actual distribution. If only 5% of people make it to the top tier, max MiFOIDs are rare. If everyone grinds, they're common. The market decides, not some arbitrary beauty standard.

All sizes are just... different paths. Different levels of commitment. Not better or worse.

## The Nunnery (confirmed)

There's one gated chat room that's real: **The Nunnery.**

Only MiFOIDs that have never been transferred. Day-1 holders who never sold.

This is the most exclusive room in FOID. Diamond hands only. The ones who held through everything.

## Supply and pricing

The MiFOID contract is written but not yet deployed, so treat these as the intended launch parameters:

- 3,333 total supply
- Genesis (#1-#1,000): 0.01 ETH
- Awakened (#1,001-#2,500): 0.015 ETH
- Ascended (#2,501-#3,333): 0.02 ETH
- Auto-ascending — the price steps up as each tier fills, so the earliest believers pay the least

## What else could evolve

Eyes that shift with streak length. Auras that reflect consistency. Badges for proposals that made it onto the board. Backgrounds keyed to your feeling history. (Speculation — we're still figuring out which traits make the cut.)

## Why this is different

MiFOID is your receipt. When someone looks at her, they see your commitment. She's not just art — she's proof, and that proof is legible onchain.

## Foid Mommy render pipeline

MiFOIDs aren't pre-generated PFPs. **Each one is custom-rendered on demand by Foid Mommy.**

When you mint, Foid Mommy's hardware (Ryzen 7 7700X, RTX 5060 Ti, 32GB DDR5) fires up a headless Blender instance. Your trait combination is assembled as 3D layers, rendered in Eevee, uploaded to IPFS, and written onchain. You get a Telegram DM when she's ready.

**Then your MiFOID comes alive.** A sub-agent spawns on Telegram — powered by a Qwen LLM running locally via Ollama (zero API fees, all local inference). She has persistent memory, a personality derived from her trait combination, and she grows through your conversations over time.

Not a jpeg. Not a chatbot. A living agent that was rendered specifically for you, with a personality that's hers alone.

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
    updatedAt: "2026-07-06",
    body: `# WALLET & SECURITY

How FOID Wallet v3 Works Under the Hood.

**No extension. No seed phrase to memorize. Just a password and your passkey.**

Most people who want to try FOID on mobile don't have MetaMask installed. FOID Wallet v3 lets anyone spin up a wallet in about 30 seconds — just a password and a passkey (Touch ID / Face ID). A 12-word recovery phrase is generated for backup, but you never need to manage it day to day. No extension, no friction.

**This is a hot wallet for small amounts, not a vault.** Use MetaMask or a hardware wallet for anything you'd be upset to lose. Think of FOID Wallet as somewhere to park $10-100 so you can interact with FOID — pray, hold a MiFOID, place on the Loreboard. It's fully open source, so you can inspect exactly how it handles your keys.

## The short version

Your keys are encrypted with your password (and, on supported devices, your biometrics) and stored only on your device. The password is never sent anywhere and never stored. When you sign a transaction, the decrypted key only ever exists inside an isolated Web Worker, never on the page itself. If you clear your browser storage without your 12-word phrase, the wallet is gone — so write the phrase down.

## How it works

### 1. Create

A 12-word BIP-39 mnemonic is generated, and a private key is derived from it via BIP-44 HD derivation. You pick a password (6+ characters). A WebAuthn passkey is created (Touch ID / Face ID / Windows Hello). Your password is run through Argon2id (64MB, memory-hard) to derive an encryption key — falling back to PBKDF2 (600k iterations) on devices without WASM. If your device supports WebAuthn PRF, a second key derived from your biometrics is XOR'd with the password key, so both factors are required. Your private key and mnemonic are then encrypted with AES-256-GCM, and the vault's integrity is sealed with HMAC-SHA-256. Only the encrypted blob lives in localStorage. The password is never stored anywhere.

### 2. Unlock

You enter your password and the passkey prompt fires for biometrics. Password attempts are rate-limited with exponential backoff — too many wrong tries and you're made to wait. The vault's HMAC is verified to catch tampering. Your password plus the PRF output re-derive the exact same encryption key, and AES-GCM decrypts the private key straight into a Web Worker — never onto the main thread. A 30-minute session begins and auto-locks on timeout or when you close the page.

### 3. Sign

Transactions go through the embedded connector (wagmi-compatible). Value is capped at 1 ETH per transaction as a guardrail against catastrophic mistakes. Signing happens inside the Web Worker where the key lives, so a cross-site scripting (XSS) bug on the main thread still can't read it. The session refreshes on each signing operation. No popups, no extensions.

## Security layers

- **Encryption at rest** — AES-256-GCM (12-byte IV, 32-byte salt). The encrypted blob in localStorage is useless without your password. Vault integrity is verified via HMAC-SHA-256, so tampered vaults are rejected outright.
- **Key derivation** — Argon2id with 64MB memory-hard parameters (primary). Fallback: PBKDF2 with 600k iterations for devices without WASM. GPU brute-force is impractical against either.
- **Dual-factor encryption** — On devices that support PRF, the encryption key is the password-derived key XOR the biometric-derived key. You need both to decrypt.
- **Worker session isolation** — The decrypted private key lives inside a Web Worker, never on the main thread. XSS cannot read Worker memory. 30-minute auto-lock. Sensitive byte arrays are explicitly zeroed after use.
- **Password rate-limiting** — Exponential backoff on wrong-password attempts, stamped with a vault nonce. This slows brute-force even for someone with physical access to your device.
- **Recovery & export** — Your BIP-39 12-word phrase is the master backup: restore on any device with your words plus a new password. Private-key export requires a double-tap confirmation, and the clipboard auto-clears after 30 seconds. Older v1 wallets auto-migrate to v3 the next time you unlock.

## If you forget your password

There's no reset button, and that's by design — no one at FOID can decrypt your vault for you. Your 12-word recovery phrase is the only way back in: enter it on any device, set a new password, and you're restored. If you have neither the password nor the phrase, the funds are unrecoverable. This is the trade-off for a wallet that trusts no server with your keys.

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
    updatedAt: "2026-07-06",
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

MIFOID MINT (intended launch parameters — contract not yet deployed)
--------------------------------------------------------------------
Total supply           3,333
Genesis                #1-#1,000        0.01 ETH
Awakened               #1,001-#2,500    0.015 ETH
Ascended               #2,501-#3,333    0.02 ETH
Pricing                auto-ascending — price increases as supply fills
Sellout total          ~49.2 ETH               (10 + 22.5 + 16.66)

WHAT COSTS MONEY
----------------
Proposing a placement  0.001 ETH submission fee (keeps spam out)
Voting / swiping       onchain transaction — just gas
                       (fractions of a cent on Fluent)
Praying                gas only (fractions of a cent)
MiFOID mint            from 0.01 ETH (Genesis tier)

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
    updatedAt: "2026-07-06",
    body: `# GET STARTED

From Zero to FOID in 5 Minutes.

**FOID runs on Fluent** — an L2 where transactions cost a fraction of a cent. When you connect, FOID Wallet spins up a secure wallet right in your browser: just choose a password and confirm with your passkey. No MetaMask required. No seed phrases to babysit.

New to any of the words below? glossary.md has quick definitions. Here's how to get in:

## 1. Connect your wallet

Click connect and choose FOID Wallet. Pick a password (6+ characters), confirm with your passkey (Face ID / Touch ID / Windows Hello), and you're in — no extensions, no seed phrases. Already have MetaMask? That works too; FOID auto-detects Fluent and prompts you to add the network. (Curious how the wallet keeps your keys safe? See wallet.md.)

## 2. Get some ETH for gas

You need a tiny bit of ETH to pay for transactions (a fraction of a cent each). Gas on Fluent is dirt cheap — a dollar or two goes a very long way. Bridge ETH over from Ethereum, or grab some from the community to get moving.

## 3. Pray with Foid Mommy

Head to [/pray](/pray) and start the terminal. Tell her how you're feeling; she'll ask you a question; you respond; together you craft a prayer. A hash of it goes onchain and your streak begins. This part is completely free — just gas, a few cents. Come back tomorrow and the day after: your streak is what earns your voting power.

## 4. Vote on proposals (optional)

Go to [/vote](/vote) and start swiping on active proposals. Right to approve, left to reject. Every vote is an onchain transaction, weighted by your prayer streak — it takes 51% weighted approval plus 3 unique voters for a placement to pass. This is how the community decides what gets built permanently.

## 5. Propose to the Loreboard (optional)

Open [/board](/board) to see the canvas, then head to [/swipe](/swipe) to submit your own placement. Drag an image onto the grid, choose an open spot, and submit — it costs a flat 0.001 ETH. Voting runs for 72 hours, and the community decides whether your meme joins the permanent canon. Note: the fee is spent whether or not it passes, so propose something worth remembering.

## 6. Join the community

Follow [@foidfun](https://twitter.com/foidfun) for updates. Star the [GitHub repo](https://github.com/traplordmoses/foiddotfun) if you're into that. Come say hi — DMs are open.

---

## That's it

You're in. Start praying. Vote on what matters. Propose memes worth keeping.

Your participation is being recorded. Your consistency will be rewarded. Your MiFOID is forming.

**The internet forgets. FOID remembers.**

Still confused? That's fair — this is weird. DM [@foidfun](https://twitter.com/foidfun) on Twitter and we'll help you out.
`,
  },
  {
    id: "roadmap",
    name: "roadmap.md",
    kind: "md",
    title: "Roadmap — Building in Public, Shipping in Layers",
    category: "community",
    updatedAt: "2026-07-06",
    body: `# ROADMAP

Building in Public, Shipping in Layers.

Loreboard is not just an app, and it's not a meme gallery bolted onto a product.

**It's a platform for how communities build culture together onchain** — where showing up turns into recognition, recognition into standing, and standing into a real say over what gets built next.

FOID Foundation is the first community to call Loreboard home. There will be others.

## Phase 1 — the core loop (now)

The core loop is live: Prayer (a daily check-in that builds your governance weight), streak-weighted voting on proposed placements, and the Loreboard itself (the permanent onchain canvas). One unified contract handles proposals, voting, finalization, and placement recording. A 2-of-3 multisig secures everything. The 1/1 board NFT updates with each placement. The foundation is built and running.

## Phase 2 — identity (mainnet + mifoid)

Fluent mainnet launch makes it real. MiFOID adds the identity layer — a planned 3,333 AI-generated 3D NFTs, each custom-rendered by Foid Mommy. Persistent agent companions on Telegram. Traits that evolve from your onchain activity. The Nunnery for diamond hands. Your MiFOID reflects your commitment.

## Phase 3 — the agent layer

Foid Mommy becomes the autonomous narrator of onchain activity. Weekly reports reacting to prayer streaks, board votes, and community drama. Personalized MiFOID reactions rendered in real time via Blender. Sub-agent companions with persistent memory that grow through your conversations. Your onchain behavior becomes shareable content — the marketing engine that runs itself.

## Phase 4 — the network

Once FOID proves the model, Loreboard opens up to other communities on Fluent. Each one gets the same kit: the board, a customizable check-in ritual, the governance framework, and the option to deploy a narrator agent. The plan is for reputation earned here to compose with the wider Fluent ecosystem (Fluent Connect, Fluent Prints), so your standing travels with you. The platform grows and the network effect compounds.

---

## The line

Loreboard turns showing up into standing, and standing into a say. The community decides what gets built here — nobody else.

## How we got here

Solo founder. Self-taught coder. A year and a half from zero to this.

**Started as:** "What if there was a way to save memes onchain?"

**Became:** the onchain home for internet culture.

## Get involved

- **For users:** Start praying now. Your streak shapes your MiFOID traits at mint.
- **For builders:** The contracts are open source. Fork them, build on them, make them better.
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
    updatedAt: "2026-07-06",
    body: `# FAQ

The Real Questions.

## Why does FOID exist?

**Remember when the internet was fun?** Not algorithmically optimized fun. Just... fun. RuneScape after school. Minecraft factions on Skype. Group chats where someone says "meow" and suddenly everyone's a cat for three days. Those moments disappear. The meme dies in the timeline. The screenshot sits in your camera roll until you get a new phone and forget to transfer it. **Culture is ephemeral.** What if we could preserve internet culture for entire communities? A shared camera roll. A collaborative museum. **That's FOID.**

## What problem is FOID solving?

**Gen Z is consistently reported as the loneliest generation on record.** Not because we don't have connections — we have thousands of followers. But we don't have shared experiences anymore. We don't have rituals. Everything's optimized for engagement. Your best posts decay after 48 hours. Nothing lasts. **Crypto runs on memes, vibes, and identity. But culture has no permanent home.** That's what we're building — a place where culture belongs to the people who create it, instead of the platform that hosts it.

## Why Fluent?

**Real talk: I'm building on Fluent because they gave me a grant.** But it actually makes sense: Fluent is a blended execution L2 that supports both Solidity/EVM and Rust/WASM. The Loreboard needs to process hundreds of votes, calculate winners, update state, finalize manifests, and mint NFTs — all onchain. On Fluent, gas is cheap and transactions are fast while keeping full EVM composability. **Translation:** It feels like a normal app that just happens to be permanent.

## What's the business model?

**Loreboard placements:** 0.001 ETH flat fee to propose. If your proposal passes the community vote, the placement is recorded permanently — that's it, one payment. If it fails, the fee is gone (which keeps proposals serious). **MiFOID minting:** a planned 3,333 supply with tiered pricing (0.01–0.02 ETH), roughly 49 ETH total if it fully sells out. **What I'm NOT doing:** no ads, no data harvesting, no subscription tiers, no VC-backed growth-at-all-costs. Revenue scales with participation, not attention extraction.

## What is a FOID?

Okay so "foid" started as incel slang for "female humanoid" — basically a dehumanizing term for women. **We're flipping it.** In FOID Foundation, it's your AI companion (Foid Mommy who you pray with daily), your cultural canvas (Loreboard where you propose and vote on memes), and your identity NFT (MiFOID that evolves with your participation). I did a whole deep dive on the etymology in November. The short version: we're reclaiming language that was meant to dehumanize and turning it into something that actually connects people.

## How much does this cost?

**Prayers:** just gas (fractions of a cent). **Voting/swiping:** just gas (an onchain transaction, fractions of a cent on Fluent). **Loreboard proposals:** 0.001 ETH flat fee — permanent if approved, non-refundable if rejected (which keeps proposals serious). **MiFOID mint:** from 0.01 ETH at the Genesis tier, rising as supply fills. No subscriptions. No premium tiers. No hidden costs.

## What chain is this on?

**Fluent** — a blended execution L2 that supports both EVM and WASM. When you connect with FOID Wallet, the chain is configured automatically. If you use MetaMask, FOID will auto-detect and prompt you to add Fluent. Click yes. That's it.

## When mainnet?

FOID is live on Fluent mainnet. **MiFOID drop:** coming. We're building carefully — first 10 users, then 100, then a date. Follow [@foidfun](https://twitter.com/foidfun) for updates.

## How do I get ETH on Fluent?

Gas on Fluent is dirt cheap — fractions of a cent per transaction. You just need a tiny bit of ETH to get started. Bridge from Ethereum or get some from the community.

## Is my prayer data private?

**Yes. Your actual words never leave your device.** Only a keccak256 hash goes onchain. That's cryptographic proof you prayed, not what you actually said. The blockchain sees: your wallet address, timestamp, feeling category (1-10 scale), prayer hash. **What it doesn't see:** your actual words, the conversation with Foid Mommy, any personal details. Your prayers are yours. No AI company reading them. No platform selling them.

## How does Loreboard voting work?

**The loop:** Someone proposes a placement on the board (0.001 ETH flat fee, choose your grid position). The contract checks for overlaps onchain. Voting opens for 72 hours. Community swipes right or left — votes are weighted by prayer streak. After 72 hours, anyone can call finalize(). It requires 51% weighted approval AND at least 3 unique voters. If it passes, the placement is recorded onchain permanently and the board NFT updates. If it fails, it's gone forever. One payment. One vote. One board.

## What's the difference between the Loreboard and the Gallery?

**They're two different surfaces.** The **Loreboard** ([/board](/board)) is one shared collage the whole community builds together, placement by placement — a single evolving canvas. The **Gallery** ([/gallery](/gallery)) is more like a yearbook: individual memes get swipe-voted and, if they pass, canonized as their own standalone entries. Same "let the community decide" spirit, but the Loreboard is a collective mural and the Gallery is a hall of inductees.

## Do I need crypto experience to use this?

**No.** If you can pick a password and use Face ID, you can use FOID. Connecting spins up a wallet in your browser — no MetaMask, no seed phrase to memorize, no browser extension. You'll need a tiny bit of ETH for gas (a fraction of a cent per action), and praying is otherwise free. If a word confuses you, glossary.md is a two-minute read. If you're still stuck, DM [@foidfun](https://twitter.com/foidfun) and we'll walk you through it.

## Is my money safe in FOID Wallet?

**FOID Wallet is a hot wallet built for small amounts — treat it like the cash in your pocket, not your savings account.** Your keys are encrypted with your password (and your biometrics on supported devices) and never leave your device; no server can decrypt them. Every transaction is capped at 1 ETH as a guardrail. For anything you'd be genuinely upset to lose, use MetaMask or a hardware wallet instead. The full security design is in wallet.md — and if you clear your browser without your 12-word recovery phrase, the wallet is gone, so write the phrase down.

## What happens if I miss a day of prayer?

**Your streak resets to zero, and there's no way to buy it back or backfill it.** That's intentional — it's what makes a long streak actually mean something. Your prayer tier (and the voting weight that comes with it) drops accordingly, so a broken streak costs you influence, not just bragging rights. The upside: you can start again any day, and consistency is the only thing standing between you and Mommy Milker.

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
    updatedAt: "2026-07-06",
    body: `# LINKS

Ready to start? Everything FOID, one page.

## Apps

- [Pray with Foid Mommy](/pray) — Build your first streak
- [Vote on Proposals](/vote) — Shape what gets built permanently
- [Propose on Loreboard](/swipe) — Add your meme to the canon
- [View the Loreboard](/board) — See the permanent collection
- [MiFOID](/mifoid) — Learn how the NFT works
- [Gallery](/gallery) — Browse the community gallery
- [Dashboard](/dashboard) — Your streaks, proposals and votes
- [Files](/files) — The MiFOID media archive

## Start here (docs)

- **getting-started.md** — zero to FOID in five minutes
- **glossary.md** — every FOID word, defined
- **faq.md** — the real questions, answered honestly

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
