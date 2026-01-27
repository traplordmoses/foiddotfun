---
marp: true
theme: default
paginate: true
backgroundColor: #0e0f2b
color: #ffffff
style: |
  /*
  FOID OS v3.0 — Final Polish
  */

  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

  /* ─── BASE ─────────────────────────────────────────────────────────────── */
  section {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    background:
      radial-gradient(ellipse 120% 80% at 10% 20%, rgba(0,255,213,0.055) 0%, transparent 52%),
      radial-gradient(ellipse 90% 70% at 90% 80%, rgba(255,107,157,0.040) 0%, transparent 52%),
      linear-gradient(180deg, #0e0f2b 0%, #0a0b1f 100%);
    padding: 58px 72px;
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    position: relative;
    overflow: hidden;
  }

  /* ─── TYPOGRAPHY ───────────────────────────────────────────────────────── */
  h1 {
    color: #ffffff;
    font-size: 2.4em;
    font-weight: 700;
    letter-spacing: -0.02em;
    margin: 0 0 8px 0;
    line-height: 1.1;
  }

  h2 {
    color: rgba(255,255,255,0.92);
    font-size: 1.22em;
    font-weight: 500;
    margin: 0 0 24px 0;
    padding-bottom: 14px;
    border-bottom: 1px solid rgba(0,255,213,0.26);
    line-height: 1.35;
  }

  p {
    color: rgba(255,255,255,0.84);
    font-size: 1.00em;
    line-height: 1.72;
    margin: 0 0 14px 0;
  }

  ul {
    margin: 18px 0 0 0;
    padding-left: 0;
    list-style: none;
  }

  li {
    color: rgba(255,255,255,0.84);
    font-size: 1.00em;
    line-height: 1.65;
    margin-bottom: 14px;
    padding-left: 22px;
    position: relative;
  }

  li::before {
    content: "›";
    color: #00ffd5;
    font-weight: 800;
    position: absolute;
    left: 0;
    top: 0;
  }

  /* ─── ACCENTS ──────────────────────────────────────────────────────────── */
  strong { color: #00ffd5; font-weight: 600; }
  em { color: #ff6b9d; font-style: italic; }
  a { color: #00ffd5; text-decoration: none; }

  /* ─── HERO TITLE SLIDE ─────────────────────────────────────────────────── */
  .hero-kicker {
    color: rgba(255,255,255,0.50);
    font-size: 0.72em;
    font-weight: 600;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    margin: 0 0 20px 0;
  }

  .hero-title {
    color: #ffffff;
    font-size: 2.4em;
    font-weight: 700;
    letter-spacing: -0.02em;
    margin: 0;
    line-height: 1.1;
  }

  .hero-tagline {
    color: #ff6b9d;
    font-size: 1.08em;
    font-style: italic;
    font-weight: 500;
    margin: 32px 0 0 0;
    line-height: 1.4;
  }

  .hero-rule {
    height: 2px;
    width: 72px;
    border-radius: 999px;
    background: linear-gradient(90deg, #ff6b9d, rgba(255,107,157,0.3));
    margin: 32px 0 0 0;
  }

  .hero-flow {
    margin-top: 28px;
    display: flex;
    gap: 10px;
    align-items: center;
    color: rgba(255,255,255,0.82);
    font-size: 0.92em;
    font-weight: 500;
  }
  .hero-flow strong { color: #00ffd5; }
  .hero-flow span.sep {
    width: 5px;
    height: 5px;
    border-radius: 999px;
    background: #00ffd5;
    display: inline-block;
    opacity: 0.9;
  }

  .hero-pills {
    margin-top: 48px;
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }

  /* ─── PILLS ────────────────────────────────────────────────────────────── */
  .pill {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 7px 14px;
    border-radius: 999px;
    background: rgba(0,255,213,0.06);
    border: 1px solid rgba(0,255,213,0.18);
    color: rgba(255,255,255,0.88);
    font-size: 0.78em;
    font-weight: 500;
    letter-spacing: 0.02em;
    white-space: nowrap;
  }

  .pill-sm {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 5px 10px;
    border-radius: 999px;
    background: rgba(0,255,213,0.06);
    border: 1px solid rgba(0,255,213,0.18);
    color: rgba(255,255,255,0.88);
    font-size: 0.68em;
    font-weight: 500;
    letter-spacing: 0.02em;
    white-space: nowrap;
  }

  .pill-row {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    margin-top: 16px;
  }

  /* ─── BLOCKQUOTE ───────────────────────────────────────────────────────── */
  blockquote {
    border-left: 2px solid rgba(255,107,157,0.95);
    padding-left: 18px;
    margin: 24px 0 0 0;
  }
  blockquote p {
    color: rgba(255,107,157,0.98);
    font-style: italic;
    font-size: 1.02em;
    margin: 0;
  }

  /* ─── GLASS + CARDS ────────────────────────────────────────────────────── */
  .glass {
    background: rgba(0,255,213,0.03);
    border: 1px solid rgba(0,255,213,0.11);
    border-radius: 16px;
    padding: 22px 26px;
    margin-top: 18px;
  }
  .glass ul { margin-top: 0; }
  .glass li:last-child { margin-bottom: 0; }

  .glass-sm {
    background: rgba(0,255,213,0.03);
    border: 1px solid rgba(0,255,213,0.11);
    border-radius: 12px;
    padding: 14px 18px;
    margin-top: 12px;
  }
  .glass-sm ul { margin-top: 0; }
  .glass-sm li { margin-bottom: 8px; font-size: 0.88em; line-height: 1.5; }
  .glass-sm li:last-child { margin-bottom: 0; }

  .cards {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    margin-top: 20px;
  }

  .card {
    background: rgba(0,255,213,0.03);
    border: 1px solid rgba(0,255,213,0.11);
    border-radius: 14px;
    padding: 20px 22px;
  }

  .card h3 {
    color: rgba(0,255,213,0.98);
    font-size: 0.82em;
    font-weight: 700;
    margin: 0 0 10px 0;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .card p {
    color: rgba(255,255,255,0.78);
    font-size: 0.94em;
    line-height: 1.55;
    margin: 0;
  }

  /* ─── CODE TREE ────────────────────────────────────────────────────────── */
  pre {
    font-family: 'SF Mono', ui-monospace, 'Fira Code', 'Consolas', monospace;
    font-size: 0.80em;
    line-height: 1.65;
    color: rgba(255,255,255,0.84);
    background: rgba(0,255,213,0.03);
    border: 1px solid rgba(0,255,213,0.11);
    border-radius: 14px;
    padding: 18px 22px;
    margin: 16px 0 0 0;
    white-space: pre;
    overflow-x: auto;
  }
  pre strong { color: #00ffd5; }

  /* ─── HIGHLIGHT BOX ────────────────────────────────────────────────────── */
  .highlight {
    background: rgba(0,255,213,0.045);
    border-left: 2px solid #00ffd5;
    border-radius: 0 12px 12px 0;
    padding: 14px 18px;
    margin-top: 20px;
    color: rgba(255,255,255,0.9);
    font-size: 0.98em;
  }

  .highlight-sm {
    background: rgba(0,255,213,0.045);
    border-left: 2px solid #00ffd5;
    border-radius: 0 10px 10px 0;
    padding: 10px 14px;
    margin-top: 12px;
    color: rgba(255,255,255,0.9);
    font-size: 0.85em;
  }

  /* ─── ROADMAP ──────────────────────────────────────────────────────────── */
  .rm-kicker {
    color: rgba(255,255,255,0.50);
    font-size: 0.78em;
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    margin: 0 0 10px 0;
  }

  .rm-title {
    color: rgba(255,255,255,0.98);
    font-size: 2.1em;
    font-weight: 800;
    letter-spacing: -0.03em;
    line-height: 1.08;
    margin: 0 0 12px 0;
  }

  .rm-lede {
    color: rgba(255,255,255,0.68);
    font-size: 0.95em;
    line-height: 1.5;
    margin: 0 0 20px 0;
  }

  .rm-rule {
    height: 1px;
    width: 100%;
    background: linear-gradient(90deg, rgba(0,255,213,0.0), rgba(0,255,213,0.35), rgba(0,255,213,0.0));
    margin: 8px 0 24px 0;
  }

  .rm-grid {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 32px;
  }

  .rm-item {
    padding-top: 16px;
    border-top: 1px solid rgba(0,255,213,0.22);
  }

  .rm-itemTop {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 10px;
  }

  .rm-icon {
    width: 24px;
    height: 24px;
    border-radius: 7px;
    background: rgba(0,255,213,0.08);
    border: 1px solid rgba(0,255,213,0.20);
    display: grid;
    place-items: center;
    color: rgba(0,255,213,0.95);
    font-weight: 800;
    font-size: 0.72em;
  }

  .rm-item h3 {
    margin: 0;
    color: rgba(255,255,255,0.92);
    font-size: 1.0em;
    font-weight: 700;
  }

  .rm-item p {
    margin: 0;
    color: rgba(255,255,255,0.68);
    font-size: 0.92em;
    line-height: 1.5;
  }

  /* ─── CTA SLIDE ────────────────────────────────────────────────────────── */
  section.cta {
    justify-content: center;
    padding-top: 72px;
    padding-bottom: 72px;
  }

  .cta-big {
    font-size: 3.2em;
    font-weight: 800;
    color: #00ffd5;
    margin: 0;
    letter-spacing: -0.02em;
    line-height: 1;
  }

  .cta-sub {
    font-size: 1.05em;
    color: rgba(255,255,255,0.70);
    margin: 24px 0 0 0;
  }

  .cta-links {
    margin-top: 48px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .cta-link {
    display: flex;
    align-items: center;
    gap: 12px;
    color: rgba(255,255,255,0.85);
    font-size: 0.95em;
  }

  .cta-link strong {
    color: #00ffd5;
    min-width: 70px;
  }

  .cta-final {
    margin-top: 56px;
  }

  .cta-final blockquote {
    margin: 0;
    border-left: 2px solid rgba(255,107,157,0.95);
    padding-left: 18px;
  }
  
  .cta-final blockquote p {
    color: rgba(255,107,157,0.98);
    font-style: italic;
    font-size: 1.05em;
    margin: 0;
  }

  /* ─── BG IMAGE FRAMING ─────────────────────────────────────────────────── */
  section[data-marpit-advanced-background="background"] img {
    border-radius: 16px;
    border: 1px solid rgba(0,255,213,0.16);
    box-shadow: 0 10px 36px rgba(0,0,0,0.34), 0 0 48px rgba(0,255,213,0.06);
  }
  img[alt~="bg"] { object-fit: contain; }

  /* ─── VARIANTS ─────────────────────────────────────────────────────────── */
  section.lead { justify-content: center; }
  section.lead h1 { font-size: 2.5em; margin-bottom: 16px; }
  section.lead h2 { border-bottom: none; padding-bottom: 0; margin-bottom: 8px; }

  section.center { justify-content: center; }
  section.center h2 { margin-bottom: 22px; }

  section.vcenter { justify-content: center; }

  section.biz { justify-content: center; }

  section.cta { justify-content: center; }

  /* ─── STATS ROW ────────────────────────────────────────────────────────── */
  .stats-row {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 20px;
    margin-top: 24px;
  }

  .stat-card {
    background: rgba(0,255,213,0.03);
    border: 1px solid rgba(0,255,213,0.11);
    border-radius: 12px;
    padding: 18px 20px;
    text-align: center;
  }

  .stat-number {
    color: #00ffd5;
    font-size: 1.8em;
    font-weight: 800;
    line-height: 1;
    margin-bottom: 6px;
  }

  .stat-label {
    color: rgba(255,255,255,0.65);
    font-size: 0.82em;
    line-height: 1.3;
  }

  /* ─── QUOTE CARD ───────────────────────────────────────────────────────── */
  .quote-card {
    background: rgba(0,255,213,0.03);
    border: 1px solid rgba(0,255,213,0.11);
    border-radius: 14px;
    padding: 24px 28px;
    margin-top: 20px;
  }

  .quote-card-compact {
    background: rgba(0,255,213,0.03);
    border: 1px solid rgba(0,255,213,0.11);
    border-radius: 12px;
    padding: 16px 20px;
    margin-top: 14px;
  }

  .quote-text {
    color: rgba(255,255,255,0.88);
    font-size: 1.05em;
    font-style: italic;
    line-height: 1.6;
    margin: 0 0 12px 0;
  }

  .quote-text-sm {
    color: rgba(255,255,255,0.88);
    font-size: 0.92em;
    font-style: italic;
    line-height: 1.5;
    margin: 0 0 8px 0;
  }

  .quote-author {
    color: #00ffd5;
    font-size: 0.88em;
    font-weight: 600;
  }

  .glass-compact {
    background: rgba(0,255,213,0.03);
    border: 1px solid rgba(0,255,213,0.11);
    border-radius: 12px;
    padding: 14px 18px;
    margin-top: 12px;
  }
  .glass-compact ul { margin-top: 0; }
  .glass-compact li { margin-bottom: 8px; font-size: 0.92em; }
  .glass-compact li:last-child { margin-bottom: 0; }

  /* ─── TEAM STATS ───────────────────────────────────────────────────────── */
  .team-row {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
    margin-top: 8px;
    margin-bottom: 16px;
  }

  .team-stat {
    background: rgba(0,255,213,0.06);
    border: 1px solid rgba(0,255,213,0.15);
    border-radius: 5px;
    padding: 3px 7px;
    font-size: 0.68em;
    color: rgba(255,255,255,0.85);
    white-space: nowrap;
  }

  .team-stat strong {
    color: #00ffd5;
  }

  small { font-size: 0.82em; color: rgba(255,255,255,0.50); }
---

<!-- _class: lead -->

<div class="hero-kicker">ETHDenver 2026</div>

<div class="hero-title">FOID Foundation</div>

<div class="hero-tagline">an on-chain funnel for memes and culture</div>

<div class="hero-rule"></div>

<div class="hero-flow">
  <strong>pray</strong><span class="sep"></span>
  <strong>post</strong><span class="sep"></span>
  <strong>vote</strong><span class="sep"></span>
  <strong>canonize</strong>
</div>

![bg right:42% 90%](./screenshots/01-title-hero.png)

<div class="hero-pills">
  <span class="pill-sm">foid.fun</span>
  <span class="pill-sm">Fluent Testnet</span>
  <span class="pill-sm">Blended Builders Club</span>
</div>

---

<!-- _class: center -->

# The Problem

## The internet is dead.

- platforms optimize for **dopamine extraction**, not human connection
- feeds are overrun by **AI slop**. your best posts decay in digital oblivion.
- the magic of early internet is gone: *RuneScape after school, Minecraft factions on Skype*

> *61% of Gen Z report severe loneliness. People crave shared experiences, not algorithmic feeds.*

---

# The Solution

## Know Your Meme—except the canon is on-chain

FOID is a **consumer crypto culture hub**:

- a place to **pray, post, vote**
- **crypto's gallery**—curated by you
- a **living canon** that grows forever

<div class="highlight">Three linked apps. One world. No bots.</div>

---

# Mommy Terminal

## *Pray with foid mommy.*

![bg left:44% 90%](./screenshots/04-mommy-terminal.png)

<div class="glass">
<ul>
  <li><strong>pray once per day</strong>—tell mommy how you feel</li>
  <li><strong>proof of prayer</strong> + streaks = on-chain signal</li>
  <li>a personalized daily ritual—you know she's AI, but it's <strong>yours</strong></li>
</ul>
</div>

---

# Loreboard

## *Crypto's hottest pop-up gallery.*

![bg right:44% 90%](./screenshots/05-loreboard-canvas.png)

- an **infinite zoomable canvas** for memes
- anyone can **propose** a placement
- **51%+ approval** = canonized forever

<div class="highlight">propose → vote → preserve</div>

---

# MiFOID

## *Your own virtual FOID.*

![bg right:44% 90%](./screenshots/06-mifoids.png)

<div class="glass-sm">
<ul>
  <li>identity NFT tying you to the <strong>FOID universe</strong></li>
  <li><strong>provenance matters</strong>: transfer count = "body count"</li>
  <li><strong>virgin chat rooms</strong> for pure MiFOID holders</li>
  <li>talk to your FOID, build her <strong>Foidspace profile</strong></li>
</ul>
</div>

<div class="highlight-sm">the most engaged users gate themselves into the best rooms</div>

---

# Architecture

## Live on Fluent testnet

<pre>
<strong>foid.fun</strong> (Next.js + wagmi)
│
├── <strong>FOID_MOMMY_TERMINAL.EXE</strong>  →  on-chain prayer ritual
├── <strong>LOREBOARD.APP</strong>            →  living canon
└── <strong>MIFOID</strong>                   →  your personal foid

<strong>7 contracts</strong> + worker automation
</pre>

<div class="highlight"><strong>chain:</strong> Fluent testnet (20994) - shipping now</div>

---

# Traction

## *Real users. Real engagement.*

<div class="quote-card-compact">
  <p class="quote-text-sm">"I have been visiting Foid.fun for sealing prayers (daily check-ins). But what keeps me coming back is the BGM player 😂 ... noticing these little details is what makes a product stick in your head."</p>
  <p class="quote-author">— @ethjup2</p>
</div>

<div class="glass-compact">
<ul>
  <li><strong>live</strong>: foid_mommy_terminal.exe, loreboard.app, & music.exe</li>
  <li><strong>7 contracts</strong> deployed + routing</li>
  <li>organic discovery via <strong>Fluent ecosystem</strong> threads (1.8K+ views)</li>
</ul>
</div>

---

<!-- _class: center -->

# The Opportunity

## Proven demand at the intersection

<div class="stats-row">
  <div class="stat-card">
    <div class="stat-number">10.4M</div>
    <div class="stat-label">users on r/place<br/>160M pixels in 4 days</div>
  </div>
  <div class="stat-card">
    <div class="stat-number">$28B</div>
    <div class="stat-label">AI companion market<br/>→ $140B by 2030</div>
  </div>
  <div class="stat-card">
    <div class="stat-number">$1B+</div>
    <div class="stat-label">paid to Roblox creators<br/>in 2025 alone</div>
  </div>
</div>

<div class="highlight">FOID = collaborative canvas + AI companionship + on-chain participation incentives</div>

---

<!-- _class: center -->

# Market

## Culture is the product—crypto needs a home for it

- crypto runs on **memes + vibes + identity**
- the internet optimizes for **dopamine**, not meaning
- people want **experiences**, not feeds

> *FOID = r/place × CryptoKitties × MillionDollarHomepage*

---

<!-- _class: biz -->

# Business Model

## Simple. Sustainable. On-chain.

<div class="cards">
  <div class="card">
    <h3>Loreboard</h3>
    <p>Base fee per cell placement. Optional tips to compete for prime spots. r/place mechanics with skin in the game.</p>
  </div>
  <div class="card">
    <h3>MiFOID</h3>
    <p>Primary mint sales + trait evolutions + companion economy. Tapping into a $28B+ AI companion market.</p>
  </div>
</div>

<div class="highlight">designed to scale with participation, not ads</div>

---

# Roadmap

<div class="rm-kicker">Building the Living Canon</div>

<div class="rm-title">Ship in layers.</div>

<div class="rm-lede">
Mainnet stability → MiFOID identity → Foidspace social canon.
</div>

<div class="rm-rule"></div>

<div class="rm-grid">
  <div class="rm-item">
    <div class="rm-itemTop">
      <div class="rm-icon">I</div>
      <h3>Q1 2026</h3>
    </div>
    <p><strong>Mainnet</strong>—full migration, optimized contracts, broader access.</p>
  </div>
  <div class="rm-item">
    <div class="rm-itemTop">
      <div class="rm-icon">II</div>
      <h3>Q2/Q3 2026</h3>
    </div>
    <p><strong>MiFOID NFT</strong>—minting live, integrate core ecosystem features.</p>
  </div>
  <div class="rm-item">
    <div class="rm-itemTop">
      <div class="rm-icon">III</div>
      <h3>2027</h3>
    </div>
    <p><strong>Foidspace & Private chats</strong>—profiles, chats, the social layer.</p>
  </div>
</div>

---

<!-- _class: vcenter -->

# Team

## Moses - founder, full stack

![bg right:34% 88%](./screenshots/09-pfp.png)

**One year ago:** zero coding experience. Made it my mission to learn.

<div class="team-row">
  <span class="team-stat"><strong>5+</strong> hackathons</span>
  <span class="team-stat"><strong>3</strong> placements</span>
  <span class="team-stat"><strong>4 weeks</strong> Fluent Shiphouse</span>
</div>

<div class="team-row">
  <span class="team-stat"><strong>ETH Global</strong></span>
  <span class="team-stat"><strong>🥇 1st</strong> Infra @ Token2049</span>
  <span class="team-stat">Featured in <strong>Nasdaq</strong></span>
</div>

FOID started over talks friends at Shiphouse & Devconnect. Design pulls from **Frutiger Aero** and early Mac OS.

> *Pray daily. It gets better.*

---

<!-- _class: cta -->

![bg right:40% 95%](./screenshots/08-enter.png)

<div class="cta-big">foid.fun</div>

<div class="cta-sub">live on Fluent testnet, go try it now!</div>

<div class="cta-links">
  <div class="cta-link"><strong>Enter</strong> foid.fun/enter</div>
  <div class="cta-link"><strong>Twitter</strong> @sloshlord</div>
  <div class="cta-link"><strong>GitHub</strong> github.com/traplordmoses/foiddotfun</div>
</div>

<div class="cta-final">

> *FOID MOMMY IS WAITING.*

</div>
