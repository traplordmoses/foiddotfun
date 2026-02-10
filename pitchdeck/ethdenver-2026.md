---
marp: true
theme: default
paginate: true
backgroundColor: transparent
color: #ffffff
style: |
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

  .marpit {
    background: linear-gradient(120deg,
      #97c0c2 0%,
      #667f8d 18%,
      #505671 45%,
      #43375b 70%,
      #663a5d 100%
    ) !important;
  }

  section > * {
    position: relative;
    z-index: 2;
  }

  section {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    background-color: transparent !important;
    background:
      linear-gradient(180deg, rgba(0,0,0,0.10) 0%, rgba(0,0,0,0.55) 100%),
      linear-gradient(120deg,
        #97c0c2 0%,
        #667f8d 18%,
        #505671 45%,
        #43375b 70%,
        #663a5d 100%
      ) !important;
    padding: 58px 72px;
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    position: relative;
    overflow: hidden;
  }

  section::before {
    content: "";
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 0;
    background:
      radial-gradient(1200px 420px at 50% -10%, rgba(255,255,255,0.11) 0%, rgba(255,255,255,0.00) 62%),
      radial-gradient(900px 700px at 50% 120%, rgba(0,0,0,0.42) 0%, rgba(0,0,0,0.00) 58%),
      linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.00) 22%);
    mix-blend-mode: screen;
    opacity: 0.52;
  }

  section::after {
    content: "";
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 1;
    background-image:
      url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)' opacity='.35'/%3E%3C/svg%3E");
    opacity: 0.055;
    mix-blend-mode: overlay;
  }

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
    margin-bottom: 18px;
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

  strong { color: #00ffd5; font-weight: 600; }
  em { color: #ff6b9d; font-style: italic; }
  a { color: #00ffd5; text-decoration: none; }

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

  blockquote {
    border-left: 2px solid rgba(255,107,157,0.95);
    padding-left: 18px;
    margin: 32px 0 0 0;
  }
  blockquote p {
    color: rgba(255,107,157,0.98);
    font-style: italic;
    font-size: 1.02em;
    margin: 0;
  }

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
    margin-top: 24px;
  }
  .glass-sm ul { margin-top: 0; }
  .glass-sm li { margin-bottom: 8px; font-size: 0.88em; line-height: 1.5; }
  .glass-sm li:last-child { margin-bottom: 0; }
  .glass-sm.list-inset { padding-left: 24px; padding-right: 12px; }

  .glass-compact {
    background: rgba(0,255,213,0.03);
    border: 1px solid rgba(0,255,213,0.11);
    border-radius: 12px;
    padding: 14px 18px;
    margin-top: 24px;
  }
  .glass-compact ul { margin-top: 0; }
  .glass-compact li { margin-bottom: 8px; font-size: 0.92em; }
  .glass-compact li:last-child { margin-bottom: 0; }

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
    margin-top: 48px;
    color: rgba(255,255,255,0.9);
    font-size: 0.85em;
  }

  .insight-balance { margin-top: 24px; }

  .rm-kicker {
    color: rgba(0,255,213,0.72);
    font-size: 0.74em;
    font-weight: 600;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    margin: 0 0 8px 0;
  }

  .rm-title {
    color: rgba(255,255,255,0.98);
    font-size: 2.0em;
    font-weight: 800;
    letter-spacing: -0.03em;
    line-height: 1.05;
    margin: 0 0 10px 0;
  }

  .rm-lede {
    color: rgba(255,255,255,0.76);
    font-size: 0.90em;
    line-height: 1.5;
    max-width: 70%;
    margin: 0 0 22px 0;
  }

  .rm-rule {
    height: 1px;
    width: 100%;
    background: linear-gradient(90deg, rgba(0,255,213,0.0), rgba(0,255,213,0.35), rgba(0,255,213,0.0));
    margin: 10px 0 20px 0;
  }

  .rm-grid {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr 1fr;
    gap: 12px;
  }

  .rm-item {
    background: rgba(0,255,213,0.08);
    border: 2px solid rgba(0,255,213,0.4);
    border-radius: 10px;
    padding: 12px 12px;
  }

  .rm-itemTop {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 8px;
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
    color: rgba(255,255,255,0.85);
    font-size: 0.88em;
    line-height: 1.45;
  }

  .rm-item p strong {
    display: block;
    margin-bottom: 6px;
  }

  .rm-item p .rm-point {
    display: block;
    position: relative;
    padding-left: 14px;
  }

  .rm-item p .rm-point::before {
    content: "›";
    position: absolute;
    left: 0;
    top: 0;
    color: #00ffd5;
    font-weight: 800;
  }

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
    font-size: 1.0em;
    margin: 0;
    white-space: nowrap;
  }

  section[data-marpit-advanced-background="background"] img {
    border-radius: 16px;
    border: 1px solid rgba(0,255,213,0.16);
    box-shadow: 0 10px 36px rgba(0,0,0,0.34), 0 0 48px rgba(0,255,213,0.06);
  }
  img[alt~="bg"] { object-fit: contain; }

  section.lead { justify-content: center; }
  section.lead h1 { font-size: 2.5em; margin-bottom: 16px; }
  section.lead h2 { border-bottom: none; padding-bottom: 0; margin-bottom: 8px; }

  section.center { justify-content: center; }
  section.center h2 { margin-bottom: 22px; }

  section.vcenter { justify-content: center; }

  section.biz {
    justify-content: flex-start;
    padding-top: 54px;
  }
  section.biz h1 { margin-bottom: 10px; }
  section.biz h2 { margin-bottom: 18px; }
  section.biz .cards {
    margin-top: 24px;
    gap: 20px;
  }
  section.biz .card { padding: 22px 24px; }
  section.biz .card p { font-size: 0.92em; line-height: 1.52; }
  section.biz .card ul { margin: 10px 0 0 0; }
  section.biz .card li {
    font-size: 0.86em;
    line-height: 1.45;
    margin-bottom: 10px;
    padding-left: 18px;
  }
  section.biz .card li:last-child { margin-bottom: 0; }
  section.biz .highlight { margin-top: 26px; }
  section.biz .highlight.biz-highlight {
    margin-top: 48px;
    font-size: 0.83em;
    white-space: nowrap;
  }

  section.cta { justify-content: center; }

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

  .quote-card-compact {
    background: rgba(0,255,213,0.03);
    border: 1px solid rgba(0,255,213,0.11);
    border-radius: 12px;
    padding: 14px 18px;
    margin-top: 28px;
  }

  .quote-text-sm {
    color: rgba(255,255,255,0.88);
    font-size: 0.88em;
    font-style: italic;
    line-height: 1.45;
    margin: 0 0 6px 0;
  }

  .quote-author {
    color: #00ffd5;
    font-size: 0.82em;
    font-weight: 600;
  }

  .team-row {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 6px;
    margin-bottom: 8px;
  }

  .team-stat {
    background: rgba(0,255,213,0.06);
    border: 1px solid rgba(0,255,213,0.15);
    border-radius: 4px;
    padding: 2px 6px;
    font-size: 0.62em;
    color: rgba(255,255,255,0.85);
    white-space: nowrap;
  }

  .team-stat strong { color: #00ffd5; }

  small { font-size: 0.82em; color: rgba(255,255,255,0.50); }

  /* Compact matrix for competitive slide */
  .matrix-container {
    display: flex;
    justify-content: center;
    align-items: center;
    margin-top: 8px;
    padding: 20px 100px 36px 100px;
  }

  .matrix {
    display: grid;
    grid-template-columns: 1fr 1fr;
    grid-template-rows: auto auto;
    gap: 8px;
    width: 480px;
    position: relative;
  }

  .matrix-cell {
    background: rgba(0,255,213,0.03);
    border: 1px solid rgba(0,255,213,0.11);
    border-radius: 8px;
    padding: 8px 10px;
    text-align: center;
  }

  .matrix-cell.highlight-cell {
    background: rgba(0,255,213,0.08);
    border: 2px solid rgba(0,255,213,0.4);
  }

  .matrix-cell h4 {
    color: #00ffd5;
    font-size: 0.75em;
    font-weight: 700;
    margin: 0 0 3px 0;
  }

  .matrix-cell.highlight-cell h4 {
    font-size: 0.80em;
  }

  .matrix-cell p {
    color: rgba(255,255,255,0.6);
    font-size: 0.58em;
    margin: 0;
    line-height: 1.25;
  }

  .matrix-cell.highlight-cell p {
    color: rgba(255,255,255,0.85);
  }

  .matrix-label-top {
    position: absolute;
    top: -28px;
    left: 50%;
    transform: translateX(-50%);
    color: rgba(255,255,255,0.5);
    font-size: 0.58em;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  .matrix-label-bottom {
    position: absolute;
    bottom: -31px;
    left: 50%;
    transform: translateX(-50%);
    color: rgba(255,255,255,0.5);
    font-size: 0.58em;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  .matrix-label-left {
    position: absolute;
    left: -93px;
    top: 50%;
    transform: translateY(-50%) rotate(-90deg);
    color: rgba(255,255,255,0.5);
    font-size: 0.58em;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  .matrix-label-right {
    position: absolute;
    right: -85px;
    top: 50%;
    transform: translateY(-50%) rotate(90deg);
    color: rgba(255,255,255,0.5);
    font-size: 0.58em;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  .ask-big {
    font-size: 2.8em;
    font-weight: 800;
    color: #00ffd5;
    margin: 0 0 8px 0;
    letter-spacing: -0.02em;
  }

  .ask-sub {
    color: rgba(255,255,255,0.7);
    font-size: 1.1em;
    margin: 0 0 32px 0;
  }

  .ask-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
    margin-top: 20px;
  }

  .ask-card {
    background: rgba(0,255,213,0.03);
    border: 1px solid rgba(0,255,213,0.11);
    border-radius: 12px;
    padding: 18px 20px;
  }

  .ask-card h4 {
    color: #00ffd5;
    font-size: 0.78em;
    font-weight: 700;
    margin: 0 0 10px 0;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .ask-card ul { margin: 0; }

  .ask-card li {
    font-size: 0.88em;
    margin-bottom: 6px;
    line-height: 1.4;
  }

  .ask-card li:last-child { margin-bottom: 0; }

  /* Dense mode */
  section.dense { padding: 42px 56px; }
  section.dense h1 { font-size: 1.9em; margin-bottom: 4px; line-height: 1.05; }
  section.dense h2 { font-size: 0.95em; margin-bottom: 12px; padding-bottom: 8px; line-height: 1.25; }
  section.dense p { font-size: 0.85em; line-height: 1.5; margin-bottom: 8px; }
  section.dense ul { margin-top: 8px; }
  section.dense li { font-size: 0.85em; line-height: 1.42; margin-bottom: 8px; }
  section.dense blockquote { margin-top: 10px; }
  section.dense blockquote p { font-size: 0.88em; }
  section.dense .cards { margin-top: 12px; gap: 10px; }
  section.dense .card { padding: 12px 14px; }
  section.dense .card h3 { margin-bottom: 5px; font-size: 0.70em; }
  section.dense .card p { font-size: 0.78em; line-height: 1.38; }
  section.dense .quote-card-compact { padding: 10px 14px; margin-top: 10px; }
  section.dense .quote-text-sm { font-size: 0.80em; line-height: 1.38; margin-bottom: 4px; }
  section.dense .quote-author { font-size: 0.75em; }
  section.dense .glass-compact { padding: 10px 14px; margin-top: 8px; }
  section.dense .glass-compact li { font-size: 0.80em; margin-bottom: 5px; line-height: 1.38; }
  section.dense .glass { padding: 12px 14px; margin-top: 10px; }
  section.dense .glass li { font-size: 0.80em; margin-bottom: 5px; line-height: 1.38; }
  section.dense .glass-sm { padding: 10px 12px; margin-top: 8px; }
  section.dense .glass-sm.list-inset { padding-left: 16px; padding-right: 8px; }
  section.dense .glass-sm li { font-size: 0.78em; margin-bottom: 5px; line-height: 1.35; }
  section.dense .highlight { font-size: 0.82em; padding: 8px 12px; margin-top: 10px; }
  section.dense .highlight-sm { font-size: 0.75em; padding: 6px 10px; margin-top: 48px; }
  section.dense.insight-layout { padding-top: 54px; }
  section.dense.insight-layout h1 { font-size: 2.0em; margin: 10px 0 10px 0; }
  section.dense.insight-layout h2 { font-size: 1.0em; margin-bottom: 18px; }
  section.dense.insight-layout h2 + p { margin-bottom: 18px; line-height: 1.5; }
  section.dense.insight-layout .glass-sm { margin-top: 14px; }
  section.dense.insight-layout .highlight-sm.insight-balance { margin-top: 48px; }
  section.dense.solution-layout { padding-top: 54px; }
  section.dense.solution-layout h1 { font-size: 2.0em; margin: 10px 0 10px 0; }
  section.dense.solution-layout h2 { font-size: 1.0em; margin-bottom: 18px; }
  section.dense.solution-layout h2 + p { margin-bottom: 18px; line-height: 1.5; }
  section.dense.solution-layout ul { margin-top: 14px; }
  section.dense.solution-layout li { margin-bottom: 10px; line-height: 1.45; }
  section.dense.solution-layout .glass-sm { margin-top: 16px; }
  section.dense.solution-layout .highlight-sm { margin-top: 48px; }
  section.mommy-layout h2 { margin-bottom: 20px; }
  section.mommy-layout .glass-sm { margin-top: 18px; }
  section.mommy-layout .highlight-sm { margin-top: 48px; }
  section.loreboard-layout h2 { margin-bottom: 20px; }
  section.loreboard-layout .glass-sm { margin-top: 18px; }
  section.loreboard-layout .highlight-sm { margin-top: 48px; }
  section.mifoid-layout h2 { margin-bottom: 20px; }
  section.mifoid-layout .glass-sm { margin-top: 18px; }
  section.mifoid-layout .highlight-sm { margin-top: 48px; }
  section.vision-layout { padding-top: 54px; }
  section.vision-layout h1 { font-size: 2.0em; margin: 10px 0 10px 0; }
  section.vision-layout h2 { font-size: 1.0em; margin-bottom: 16px; }
  section.vision-layout p { font-size: 0.95em; margin-bottom: 12px; line-height: 1.5; }
  section.vision-layout .quote-card-compact { margin-top: 14px; }
  section.vision-layout .highlight-sm { margin-top: 48px; }
  section.dense.competitive-layout .highlight-sm {
    max-width: 90%;
    margin-top: 12px;
    margin-left: 0;
    margin-right: 0;
  }
  section.dense.competitive-layout .matrix-container {
    margin-top: 14px;
    padding-top: 24px;
  }
  section.traction-layout h1 { font-size: 2.05em; margin: 8px 0 10px 0; }
  section.traction-layout h2 { font-size: 1.0em; margin-bottom: 18px; }
  section.traction-layout .quote-card-compact { margin-top: 18px; padding: 13px 17px; }
  section.traction-layout .quote-text-sm { font-size: 0.82em; line-height: 1.4; margin-bottom: 4px; }
  section.traction-layout .quote-author { font-size: 0.76em; }
  section.traction-layout .glass-compact { margin-top: 18px; padding: 13px 17px; }
  section.traction-layout .glass-compact li { font-size: 0.84em; margin-bottom: 8px; line-height: 1.42; }
  section.team-layout {
    justify-content: flex-start;
    padding-top: 52px;
  }
  section.team-layout h1 { margin: 6px 0 8px 0; }
  section.team-layout h2 { margin-bottom: 18px; }
  section.team-layout .cards { margin-top: 18px; gap: 18px; }
  section.team-layout .card { padding: 18px 20px; }
  section.team-layout .card h3 { font-size: 0.76em; margin-bottom: 8px; }
  section.team-layout .team-row {
    margin: 8px 0 10px 0;
    gap: 4px;
    flex-wrap: wrap;
    row-gap: 4px;
  }
  section.team-layout .team-stat { font-size: 0.56em; padding: 2px 6px; }
  section.team-layout .team-points { margin: 8px 0 0 0; }
  section.team-layout .team-points li {
    font-size: 0.78em;
    line-height: 1.36;
    margin-bottom: 7px;
    padding-left: 16px;
  }
  section.team-layout .team-points li:last-child { margin-bottom: 0; }
  section.team-layout .pattern-line { margin-top: 10px; font-size: 0.78em; }
  section.team-layout .highlight-sm { margin-top: 26px; }
  section.dense .team-row { margin-bottom: 6px; margin-top: 4px; }
  section.dense .team-stat { font-size: 0.55em; padding: 2px 4px; }
  section.dense .rm-title { font-size: 1.92em; }
  section.dense .rm-grid { gap: 14px; }
  section.dense .rm-item { padding: 13px 13px; }
  section.dense .rm-itemTop { margin-bottom: 10px; }
  section.dense .rm-item p { font-size: 0.86em; line-height: 1.48; }
  section .highlight-sm {
    margin-top: auto !important;
    margin-bottom: 0 !important;
  }
  section.dense .highlight-sm { margin-bottom: 16px !important; }

  /* Pattern callout */
  .pattern-line {
    color: #ff6b9d;
    font-style: italic;
    font-size: 0.82em;
    display: block;
    margin-top: 8px;
  }

---

<!-- _class: lead -->

<div class="hero-kicker">ETHDenver 2026</div>

<div class="hero-title">FOID Foundation</div>

<div class="hero-tagline">the internet's permanent memory.<br/>log in, pray daily, and win forever.</div>

<div class="hero-rule"></div>

<div class="hero-flow">
  <strong>pray</strong><span class="sep"></span>
  <strong>post</strong><span class="sep"></span>
  <strong>vote</strong><span class="sep"></span>
  <strong>canonize</strong>
</div>

![bg right:42% 90% opacity:0.75](./screenshots/01-title-hero.png)

<div class="hero-pills">
  <span class="pill-sm">foid.fun</span>
  <span class="pill-sm">Fluent Labs Grant</span>
  <span class="pill-sm">Live on Testnet</span>
</div>

---

<!-- _class: center -->

# The Problem

## Your best memes die in your camera roll.

- one moment you're at dinner making an inside joke. the next day you tweet it.
- a week later, it's **buried in the algorithm**. a month later, it's gone.
- your favorite memes get screenshotted, then **forgotten in the graveyard of your camera roll**

> *Culture is collectively created but individually preserved. That's fucked up.*

---

<!-- _class: dense insight-layout -->

# The Insight

## Humans are collectors.

We put **Pokemon cards in binders** and brought them to school to show our friends. These objects let us **time-travel**. We look at them and we're back in that moment.

![bg right:31% 84%](./screenshots/777-fun.png)

<div class="glass-sm list-inset">
<ul>
  <li><strong>crypto runs on memes + vibes + identity</strong>, but culture has no permanent home</li>
  <li><strong>platforms own your culture</strong> - deleted when banned, lost when they shut down</li>
  <li><strong>using the computer used to be fun.</strong> we forgot that.</li>
</ul>
</div>

<div class="highlight-sm insight-balance">what if we could collect internet moments the way we collected pokemon cards?</div>

---

<!-- _class: dense solution-layout -->

# The Solution

## A museum for internet culture.

FOID is a **permanent cultural coordination layer**:

- a place to **pray, post, vote**
- **crypto's gallery** - curated democratically
- a **living canon** that grows forever

<div class="glass-sm list-inset">
<ul>
  <li><strong>Mommy Terminal</strong> - daily AI ritual, proof of prayer on-chain</li>
  <li><strong>Loreboard</strong> - infinite canvas, 72hr democratic voting</li>
  <li><strong>MiFOID</strong> - evolving identity NFTs tied to participation</li>
</ul>
</div>

<div class="highlight-sm">three linked apps. one world. not just for humans.</div>

---
<!-- _class: mommy-layout -->

# Mommy Terminal

## *Pray with foid mommy.*

![bg left:44% 90% opacity:0.8](./screenshots/04-mommy-terminal.png)

<div class="glass-sm">
<ul>
  <li><strong>daily check-in</strong> - tell her how you're feeling</li>
  <li><strong>proof of prayer</strong> + streaks stored on-chain</li>
  <li>a personalized ritual - she's AI, but she's <strong>yours</strong></li>
  <li><strong>privacy-first</strong>: only hashes on-chain, never your words</li>
</ul>
</div>

<div class="highlight-sm">the internet wants your attention. foid mommy gives you yours back.</div>

---
<!-- _class: loreboard-layout -->

# Loreboard

## *Crypto's permanent gallery.*

![bg right:41% 84% opacity:0.8](./screenshots/05-loreboard-canvas.png)

<div class="glass-sm">
<ul>
  <li>an <strong>infinite collaborative canvas</strong> for memes</li>
  <li>anyone can <strong>propose</strong> a placement</li>
  <li><strong>72-hour voting window</strong> - community decides</li>
  <li><strong>51%+ approval + quorum</strong> = canonized forever</li>
  <li>losers get <strong>90% refunded</strong>, minus anti-spam fee</li>
</ul>
</div>

<div class="highlight-sm">propose → vote → preserve</div>

---

<!-- _class: mifoid-layout -->

# MiFOID

## *Your evolving on-chain identity.*

![bg right:42% 84% opacity:0.8](./screenshots/06-mifoids.png)

<div class="glass-sm list-inset">
<ul>
  <li>identity NFT tying you to the <strong>FOID universe</strong></li>
  <li><strong>traits evolve</strong> based on prayers, proposals, votes</li>
  <li><strong>provenance matters</strong>: transfer count = "body count"</li>
  <li><strong>gated chat rooms</strong> for committed holders</li>
</ul>
</div>

<div class="highlight-sm">your consistency, visualized. your participation, permanent.</div>

---

<!-- _class: vision-layout -->

# The Bigger Vision

## We started with humans. We're building for everyone.

**AI agents are already forming culture.** Moltbook has **30,000+ autonomous agents** creating religions, governments, economies. *Crustafarianism emerged in 24 hours.*

**But they have no persistent memory.** No collective canvas. No way to preserve what they create.

<div class="quote-card-compact">
  <p class="quote-text-sm">"milady deserves canonization"</p>
  <p class="quote-author">— Charlotte Fang, November 2025</p>
</div>

<div class="highlight-sm">She's right. The best internet art has no permanent home. <strong>FOID is the cultural infrastructure they need.</strong></div>

---

<!-- _class: dense competitive-layout -->

# Competitive Position

## *The only player in permanent + preservative.*

<div class="matrix-container">
  <div class="matrix">
    <div class="matrix-label-top">permanent</div>
    <div class="matrix-label-bottom">ephemeral</div>
    <div class="matrix-label-left">preservative</div>
    <div class="matrix-label-right">extractive</div>
    <div class="matrix-cell highlight-cell">
      <h4>FOID</h4>
      <p>democratic curation<br/>on-chain forever</p>
    </div>
    <div class="matrix-cell highlight-cell">
      <h4>Zora / Mirror</h4>
      <p>monetizes creation<br/>individual ownership</p>
    </div>
    <div class="matrix-cell highlight-cell">
      <h4>Reddit / Twitter</h4>
      <p>platform-dependent<br/>ephemeral</p>
    </div>
    <div class="matrix-cell highlight-cell">
      <h4>Pump.fun</h4>
      <p>extractive<br/>speculative</p>
    </div>
  </div>
</div>

<div class="highlight-sm">pump.fun monetizes attention. zora monetizes creation. <strong>foid monetizes preservation.</strong></div>

---

<!-- _class: traction-layout -->

# Traction

## *Private beta on Fluent testnet.*

<div class="quote-card-compact">
  <p class="quote-text-sm">"I keep coming back for the BGM player 😂 ... noticing these little details is what makes a product stick."</p>
  <p class="quote-author">— @ethjup2</p>
</div>

<div class="glass-compact">
<ul>
  <li><strong>11+ cultural moments canonized</strong> (72hr voting cycles)</li>
  <li><strong>7 Rust smart contracts</strong> deployed + worker automation</li>
  <li><strong>51 audit issues resolved</strong> in 48 hours (ship-ready)</li>
  <li><strong>Fluent Labs grant recipient</strong></li>
  <li><strong>Movement Labs</strong>—active partnership discussions</li>
</ul>
</div>

---

<!-- _class: biz -->

# Business Model

## Simple. Sustainable. On-chain.

<div class="cards">
  <div class="card">
    <h3>Loreboard</h3>
    <ul>
      <li><strong>pokemon pack pricing</strong>: $3-$20 per placement by grid size</li>
      <li><strong>90% refund</strong> on failed proposals (minus anti-spam fee)</li>
      <li><strong>prime spots</strong> competed for via higher bids</li>
    </ul>
  </div>
  <div class="card">
    <h3>MiFOID</h3>
    <ul>
      <li><strong>3,333 supply</strong> at 0.02 ETH (~$200K total mint value)</li>
      <li><strong>indie-game pricing</strong> to maximize participation</li>
      <li><strong>trait evolutions</strong> drive retention + companion economy</li>
    </ul>
  </div>
</div>

<div class="highlight biz-highlight">participation-driven revenue, not ads. next: agent APIs + white-label infrastructure licensing.</div>

---

<!-- _class: dense -->

# Roadmap

![bg right:22% 75% opacity:0.7](./screenshots/444-seed.png)

<div class="rm-kicker">Building in Layers</div>

<div class="rm-title">Ship. Learn. Expand.</div>

<div class="rm-lede">
Mainnet stability → Cross-chain expansion → MiFOID identity → Agent-native features.
</div>

<div class="rm-rule"></div>

<div class="rm-grid">
  <div class="rm-item">
    <div class="rm-itemTop">
      <div class="rm-icon">I</div>
      <h3>Q1 2026</h3>
    </div>
    <p><strong>Mainnet</strong><span class="rm-point">Fluent goes live, so do we.</span></p>
  </div>
  <div class="rm-item">
    <div class="rm-itemTop">
      <div class="rm-icon">III</div>
      <h3>Q2 2026</h3>
    </div>
    <p><strong>MiFOID</strong><span class="rm-point">minting live, identity layer active.</span></p>
  </div>
  <div class="rm-item">
    <div class="rm-itemTop">
      <div class="rm-icon">II</div>
      <h3>Q2 2026</h3>
    </div>
    <p><strong>Cross-chain</strong><span class="rm-point">multichain support, white-label pilot.</span></p>
  </div>
  <div class="rm-item">
    <div class="rm-itemTop">
      <div class="rm-icon">IV</div>
      <h3>2027</h3>
    </div>
    <p><strong>Foidspace</strong><span class="rm-point">agent APIs, social layer, futarchy.</span></p>
  </div>
</div>

---

<!-- _class: team-layout -->

# Team

## Founding team of two. Hiring one.

<style scoped>
  .team-card-with-photo {
    display: grid;
    grid-template-columns: 1fr 88px;
    gap: 18px;
    align-items: start;
  }
  .team-photo {
    width: 88px;
    height: 88px;
    border-radius: 50%;
    clip-path: circle(50% at 50% 50%);
    object-fit: cover;
    display: block;
    border: 2px solid rgba(0,255,213,0.3);
  }
</style>

<div class="cards">
  <div class="card">
    <div class="team-card-with-photo">
      <div>
        <h3>Moses - Founder, Full Stack</h3>
        <ul class="team-points">
          <li><strong>Zero coding experience one year ago.</strong></li>
          <li>MSc in Blockchain & Digital Currency. BA Economics. Featured in Nasdaq.</li>
        </ul>
        <div class="team-row">
          <span class="team-stat"><strong>1st</strong> Infra @ Token2049</span>
          <span class="team-stat"><strong>ETH Global</strong> track winner</span>
          <span class="team-stat"><strong>4 weeks</strong> Fluent Shiphouse</span>
        </div>
      </div>
      <img src="./screenshots/09-pfp.png" alt="Moses" class="team-photo">
    </div>
  </div>
  <div class="card">
    <div class="team-card-with-photo">
      <div>
        <h3>AP - 3D Design, MiFOID Art</h3>
        <ul class="team-points">
          <li><strong>CS grad turned 3D artist.</strong></li>
          <li>Blender + Source Filmmaker veteran.</li>
          <li>Bringing MiFOIDs to life through character and world design.</li>
        </ul>
        <div class="team-row">
          <span class="team-stat">BS Computer Science</span>
          <span class="team-stat">Blender + SFM</span>
        </div>
        <span class="pattern-line">This user likes to screenshot NFT's...</span>
      </div>
      <img src="./screenshots/07-stolenpfp.png" alt="AP" class="team-photo" />
    </div>
  </div>
</div>

<div class="highlight-sm"><strong>Hiring:</strong> Community & Growth Lead. Equity + future comp. Looking for someone who believes.</div>

---

<!-- _class: center -->

# Why Now

## The window is open.

![bg right:22% 80%](./screenshots/333-success.png)

<div class="stats-row">
  <div class="stat-card">
    <div class="stat-number">30K+</div>
    <div class="stat-label">agents on Moltbook<br/>forming culture NOW</div>
  </div>
  <div class="stat-card">
    <div class="stat-number">Q1 '26</div>
    <div class="stat-label">Fluent mainnet<br/>infrastructure ready</div>
  </div>
  <div class="stat-card">
    <div class="stat-number">0</div>
    <div class="stat-label">competitors building<br/>agent cultural infra</div>
  </div>
</div>

<div class="highlight">most people think AI agents = trading bots. we're building for when they're artists, curators, cultural participants. <strong>we're 2 years early. log in, pray daily, and win forever.</strong></div>

---

<!-- _class: center -->

# The Ask

<div class="ask-big">$500K Pre-Seed</div>
<div class="ask-sub">$7.5M post-money SAFE</div>

<div class="ask-grid">
  <div class="ask-card">
    <h4>Use of Funds</h4>
    <ul>
      <li><strong>40%</strong> Engineering & security audits</li>
      <li><strong>25%</strong> Growth & community hire</li>
      <li><strong>20%</strong> Operations & runway</li>
      <li><strong>15%</strong> Marketing & MiFOID launch</li>
    </ul>
  </div>
  <div class="ask-card">
    <h4>Also Seeking</h4>
    <ul>
      <li>Protocol partnerships (identity, storage)</li>
      <li>Ecosystem grants</li>
      <li>White-label deployment partners</li>
      <li>Community/Growth co-founder</li>
    </ul>
  </div>
</div>

---

<!-- _class: cta -->

<div class="cta-big">foid.fun</div>

<div class="cta-sub">live on Fluent testnet. try it now.</div>

![bg right:42% 90%](./screenshots/01-title-hero.png)

<div class="cta-links">
  <div class="cta-link"><strong>Enter</strong> foid.fun</div>
  <div class="cta-link"><strong>Twitter</strong> @foidfun</div>
  <div class="cta-link"><strong>GitHub</strong> github.com/traplordmoses/foiddotfun</div>
</div>

<div class="cta-final">

> *The internet forgets. FOID remembers.*

</div>
