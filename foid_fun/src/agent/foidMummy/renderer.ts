import type { WeeklyData } from "./dataCollector";

/** Convert markdown to basic HTML (headings, bold, bullets, paragraphs) */
function mdToHtml(md: string): string {
  return md
    .split("\n")
    .map((line) => {
      // Headings
      if (line.startsWith("# ")) return `<h1>${line.slice(2)}</h1>`;
      if (line.startsWith("## ")) return `<h2>${line.slice(3)}</h2>`;
      if (line.startsWith("### ")) return `<h3>${line.slice(4)}</h3>`;
      // Bullets
      if (line.startsWith("- ")) {
        const content = line.slice(2).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
        return `<li>${content}</li>`;
      }
      // Bold in paragraphs
      const processed = line.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
      if (processed.trim() === "") return "";
      return `<p>${processed}</p>`;
    })
    .join("\n");
}

export function renderReport(narrative: string, data: WeeklyData): string {
  const periodFrom = new Date(data.period.from * 1000).toLocaleDateString("en-US", {
    year: "numeric", month: "short", day: "numeric",
  });
  const periodTo = new Date(data.period.to * 1000).toLocaleDateString("en-US", {
    year: "numeric", month: "short", day: "numeric",
  });

  const narrativeHtml = mdToHtml(narrative);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>FOID MUMMY WEEKLY — ${periodFrom} to ${periodTo}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: 'Inter', sans-serif;
    background: #0a0a1a;
    color: #e0e0f0;
    min-height: 100vh;
    overflow-x: hidden;
  }

  /* Aurora gradient background */
  body::before {
    content: '';
    position: fixed;
    inset: 0;
    background:
      radial-gradient(ellipse 80% 60% at 20% 10%, rgba(62, 238, 196, 0.12) 0%, transparent 60%),
      radial-gradient(ellipse 60% 50% at 80% 80%, rgba(139, 92, 246, 0.10) 0%, transparent 60%),
      radial-gradient(ellipse 90% 40% at 50% 50%, rgba(255, 215, 0, 0.05) 0%, transparent 50%);
    z-index: 0;
    pointer-events: none;
  }

  .page { position: relative; z-index: 1; max-width: 720px; margin: 0 auto; padding: 40px 20px 80px; }

  /* .EXE window chrome */
  .window {
    background: rgba(15, 15, 35, 0.75);
    backdrop-filter: blur(24px) saturate(1.4);
    -webkit-backdrop-filter: blur(24px) saturate(1.4);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    overflow: hidden;
    margin-bottom: 24px;
  }

  .window__titlebar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    background: rgba(255, 255, 255, 0.03);
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    font-family: 'Orbitron', monospace;
    font-size: 10px;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    color: rgba(255, 215, 0, 0.8);
  }

  .window__dots {
    display: flex; gap: 6px;
  }
  .window__dots span {
    width: 10px; height: 10px; border-radius: 50%;
    background: rgba(255, 255, 255, 0.12);
  }
  .window__dots span:first-child { background: rgba(255, 100, 100, 0.6); }
  .window__dots span:nth-child(2) { background: rgba(255, 200, 50, 0.6); }
  .window__dots span:nth-child(3) { background: rgba(72, 255, 171, 0.6); }

  .window__body { padding: 24px; }

  /* Header */
  .report-header {
    text-align: center;
    padding: 48px 24px 32px;
  }

  .report-header h1 {
    font-family: 'Orbitron', monospace;
    font-size: 28px;
    font-weight: 900;
    letter-spacing: 0.1em;
    background: linear-gradient(135deg, #FFD700, #3EEEC4, #FFD700);
    background-size: 200% 200%;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    animation: shimmer 4s ease-in-out infinite;
  }

  @keyframes shimmer {
    0%, 100% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
  }

  .report-header .period {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.4);
    margin-top: 8px;
    font-family: 'Orbitron', monospace;
    letter-spacing: 0.2em;
    text-transform: uppercase;
  }

  /* Content typography */
  .window__body h1 {
    font-family: 'Orbitron', monospace;
    font-size: 22px;
    font-weight: 700;
    color: #FFD700;
    margin: 0 0 16px;
    letter-spacing: 0.05em;
  }

  .window__body h2 {
    font-family: 'Orbitron', monospace;
    font-size: 14px;
    font-weight: 700;
    color: #FFD700;
    margin: 24px 0 12px;
    padding-bottom: 6px;
    border-bottom: 1px solid rgba(255, 215, 0, 0.15);
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  .window__body h3 {
    font-size: 13px;
    font-weight: 600;
    color: #3EEEC4;
    margin: 16px 0 8px;
  }

  .window__body p {
    font-size: 14px;
    line-height: 1.7;
    color: rgba(224, 224, 240, 0.85);
    margin: 8px 0;
  }

  .window__body li {
    font-size: 13px;
    line-height: 1.6;
    color: rgba(224, 224, 240, 0.8);
    margin: 4px 0;
    padding-left: 16px;
    list-style: none;
    position: relative;
  }
  .window__body li::before {
    content: '>';
    position: absolute;
    left: 0;
    color: #3EEEC4;
    font-family: 'Orbitron', monospace;
    font-size: 11px;
  }

  .window__body strong {
    color: #3EEEC4;
    font-weight: 600;
  }

  /* Stats bar */
  .stats-bar {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 12px;
    margin: 24px 0;
  }

  .stat-card {
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 8px;
    padding: 16px;
    text-align: center;
  }

  .stat-card .value {
    font-family: 'Orbitron', monospace;
    font-size: 24px;
    font-weight: 700;
    color: #3EEEC4;
  }

  .stat-card .label {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.15em;
    color: rgba(255, 255, 255, 0.4);
    margin-top: 4px;
  }

  /* Footer */
  .footer {
    text-align: center;
    padding: 32px;
    font-size: 10px;
    color: rgba(255, 255, 255, 0.25);
    font-family: 'Orbitron', monospace;
    letter-spacing: 0.2em;
  }
</style>
</head>
<body>
<div class="page">

  <!-- Header -->
  <div class="report-header">
    <h1>FOID MUMMY</h1>
    <div class="period">${periodFrom} — ${periodTo}</div>
  </div>

  <!-- Stats overview -->
  <div class="stats-bar">
    <div class="stat-card">
      <div class="value">${data.prayer.totalPrayersThisWeek}</div>
      <div class="label">Prayers</div>
    </div>
    <div class="stat-card">
      <div class="value">${data.loreboard.proposals.length}</div>
      <div class="label">Proposals</div>
    </div>
    <div class="stat-card">
      <div class="value">${data.voting.totalVotesCast}</div>
      <div class="label">Votes</div>
    </div>
    <div class="stat-card">
      <div class="value">${data.community.activeWallets.length}</div>
      <div class="label">Active Wallets</div>
    </div>
  </div>

  <!-- Narrative -->
  <div class="window">
    <div class="window__titlebar">
      <div class="window__dots"><span></span><span></span><span></span></div>
      FOID_MUMMY_WEEKLY.EXE
    </div>
    <div class="window__body">
      ${narrativeHtml}
    </div>
  </div>

  <div class="footer">
    FOID FOUNDATION — LOREBOARD IS THE ZONING LAW — ${new Date().getFullYear()}
  </div>

</div>
</body>
</html>`;
}
