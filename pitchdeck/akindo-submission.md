# AKINDO Submission — FOID Foundation

## ETHDenver 2026 Pitchfest Application

---

## Product Overview

**What are you building?**

FOID Foundation is an on-chain altar for culture, ritual, and identity — live on Fluent testnet. We've built three interlocking products:

1. **Prayer Terminal (Foid Mommy)**: A daily ritual where users type how they feel and receive AI-generated empathetic responses. Only the keccak256 hash of their prayer is stored on-chain — raw text stays private. Streak mechanics (current streak, longest streak, total prayers) create daily retention loops and feed future identity traits.

2. **Loreboard Canvas**: A community-governed infinite canvas where users propose image placements, vote during epoch windows, and winners get permanently placed on-chain. Think r/place meets on-chain governance, with IPFS storage and deterministic settlement via Rust VM.

3. **MiFOID Identity NFTs**: NFTs whose traits evolve based on participation — prayer streaks, loreboard votes, board contributions, and early participation badges. Not static JPEGs, but living records of devotion.

**Why does it matter?**

Web3 identity is broken. Wallets are cold addresses that don't capture who you are. Communities lack daily touchpoints — nothing brings users back every day like Duolingo or Wordle. Memes live and die on Twitter instead of becoming permanent on-chain culture. And NFT traits are static — your participation doesn't evolve your identity.

FOID Foundation solves this by combining:
- **Ritual mechanics** (streaks drive retention)
- **Community governance** (culture is collectively owned)
- **Evolving identity** (participation = reputation)
- **Privacy-first design** (only hashes on-chain)

We're building the soulful layer for Web3.

---

## Traction

**Users, revenue, partnerships, or development progress:**

| Metric | Details |
|--------|---------|
| **Grant** | Secured grant from Fluent to build on their testnet |
| **Live Product** | Prayer Terminal + Loreboard Canvas deployed and functional on Fluent testnet |
| **Smart Contracts** | 7 contracts deployed: PrayerRegistry, PrayerMirror, LoreboardBoardV2, LoreboardVotingV2, LoreBoardTreasury, LoreBoardManifestStore, FOID20Factory |
| **Active Testing** | Community members testing daily prayers and loreboard proposals |
| **Social Proof** | Organic user mentions and engagement on X (Twitter) |
| **Open Source** | Full codebase public on GitHub |
| **Tech Stack** | Next.js 14, React 18, Wagmi/Viem, RainbowKit, Zustand, Solidity, Rust VM |

We've been building in public since 2024 and have a working product on testnet.

---

## Demo / Links

**Live app, demo video, or GitHub repository:**

- **Live Testnet App**: [foid.fun](https://foid.fun)
  - Prayer Terminal: `/pray`
  - Loreboard Canvas: `/board`

- **GitHub Repository**: [github.com/foid-foundation/foid_fun](https://github.com/foid-foundation/foid_fun)
  - Frontend: `foid_fun/src/`
  - Smart Contracts: `solidity_contracts/src/`
  - Worker Automation: `foid_fun/scripts/`

- **Network**: Fluent Testnet (Chain ID 20994)

- **Block Explorer**: [testnet.fluentscan.xyz](https://testnet.fluentscan.xyz)

**To test:**
1. Visit foid.fun
2. Connect wallet (MetaMask or RainbowKit supported)
3. Switch to Fluent Testnet
4. Navigate to /pray to try the Prayer Terminal
5. Navigate to /board to explore the Loreboard

---

## Team

**Who is building this?**

| Name | Role | Background |
|------|------|------------|
| **Kevin Taproot** | Founder & Strategy | Philosophy background, Web3 strategy, community building |
| **REMSee** | Technical Lead | Full-stack development, smart contract engineering, system architecture |
| **Purrcat** | Community & Growth | Social media, community management, growth hacking |

**Team Highlights:**
- All team members are doxxed and publicly committed
- Active in the Fluent ecosystem
- Building in public since 2024
- Regular updates and engagement with community

---

## Goals

**What are you hoping to achieve at ETHDenver?**

1. **Funding**: Seeking $150K–$300K seed round
   - 6 months runway to mainnet launch
   - Hire 1 additional smart contract engineer
   - Marketing budget for mainnet launch campaign

2. **Partnerships**:
   - Infrastructure partners (IPFS pinning, indexing services)
   - Other Fluent ecosystem projects for cross-promotion
   - Identity/SocialFi protocols for integration opportunities

3. **Visibility**:
   - Exposure to top-tier VCs and active LPs
   - Potential funding consideration by Bufficorn Ventures
   - Signal quality to the market through Pitchfest selection

4. **Feedback**:
   - Investor perspective on product positioning
   - Technical feedback on architecture decisions
   - Go-to-market strategy refinement

**Post-ETHDenver Milestones:**
- Q2 2025: MiFOID minting + trait system live
- Q3 2025: Fluent mainnet launch
- Q4 2025: Governance mechanisms + futarchy experiments

---

## Additional Context

**Web3 Component:**
FOID Foundation is built entirely on Fluent testnet with plans to launch on Fluent mainnet. All core functionality is on-chain:
- Prayer hashes stored in PrayerRegistry contract
- Loreboard proposals, votes, and manifests anchored on-chain
- Treasury manages fees and refunds
- MiFOID traits derived from on-chain activity

**Funding History:**
- Fluent ecosystem grant (amount confidential)
- No external VC funding raised yet
- Total funding < $3M (eligible for Pitchfest)

**Category:**
- Primary: Consumer / SocialFi
- Secondary: Identity, Infrastructure (on Fluent)

**Contact:**
- Twitter: [@faborhood](https://twitter.com/faborhood)
- Website: [foid.fun](https://foid.fun)
- Email: [TBD — add your contact email]

---

## One-Liner

> **FOID Foundation is an on-chain altar combining daily ritual (Prayer Terminal), community-governed culture (Loreboard Canvas), and evolving identity NFTs (MiFOIDs) — built on Fluent for privacy-preserving, composable Web3 identity.**
