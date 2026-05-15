// src/lib/shareTemplates.ts
// Central place to tune the copy of user-initiated X (Twitter) share tweets.
//
// Both <PlacementCelebration> (after a successful placement) and
// <NotificationInbox> (when a canonization notification arrives) pull from
// here. Add/remove/edit templates freely — `pickRandom` rotates them.
//
// URL strategy: every share link points at `/board/proposal/<id>`, which has
// twitter:image + og:image metadata wired to /api/og/placement/<id>. That's
// what makes X show the rich preview card. Humans hitting that URL are
// redirected (client-side) to /board?celebrate=<id> for the celebration
// replay — see src/app/board/proposal/[id]/page.tsx.

const SITE = "https://foid.fun";

export function buildPlacementShareUrl(proposalId: number | string | null): string {
  if (proposalId == null || proposalId === "") return `${SITE}/board`;
  return `${SITE}/board/proposal/${encodeURIComponent(String(proposalId))}`;
}

/* ── PROPOSAL: user just placed a proposal, voting is open ─────────── */

export function proposalTweetTemplates(
  proposalId: number | null,
  url: string,
): string[] {
  // Build the proposal/placement references so the copy reads naturally in
  // both the "ID known" and "ID null" branches. Avoid `the #X proposal` /
  // `loreboard #X` constructions — they read awkwardly or attach the number
  // to the wrong noun.
  const proposalRef = proposalId != null ? `proposal #${proposalId}` : "a proposal";
  const placementRef = proposalId != null ? `fresh placement #${proposalId}` : "fresh placement";

  return [
    `do you know what? i just made ${proposalRef} to the @foidfun loreboard!!\n\ngo check it out and vote.\n\n${url}`,
    `yeowww i proposed a meme to the @foidfun loreboard!!\n\n${url}`,
    `yippppeeee i just proposed an image to the @foidfun loreboard!!\n\n${url}`,
    `${placementRef} on the @foidfun loreboard. 72 hours of voting. if it survives, it stays forever.\n\n${url}`,
    `dropped a meme on the @foidfun loreboard. come vote — permanence is earned.\n\n${url}`,
    `new proposal on the @foidfun loreboard. mine. go look. go vote.\n\n${url}`,
  ];
}

/* ── CANONIZATION: user's placement was approved + is now permanent ─ */

export function canonizationTweetTemplates(
  epoch: number | string | null | undefined,
  url: string,
): string[] {
  // Two epoch flavours: `epochTag` is appended after sentence-ending punctuation
  // (` epoch 5`), while `epochClause` slides inside a sentence before its final
  // period (` — epoch 5`). Picking the wrong one creates orphan fragments like
  // "loreboard. epoch 5".
  const hasEpoch = epoch != null && epoch !== "";
  const epochTag = hasEpoch ? ` epoch ${epoch}` : "";
  const epochClause = hasEpoch ? ` — epoch ${epoch}` : "";

  return [
    `my lore got canonized on the @foidfun loreboard!${epochTag}\n\nit's onchain. forever.\n\n${url}`,
    `the council voted yes. my placement is permanent on the @foidfun loreboard${epochClause}.\n\n${url}`,
    `canonized!! my meme is now part of the @foidfun loreboard forever.\n\n${url}`,
    `another image enters permanence — mine. @foidfun loreboard${epochTag}.\n\n${url}`,
    `got my meme onchain. canonized into the @foidfun loreboard${epochTag}.\n\n${url}`,
  ];
}

/* ── helpers ───────────────────────────────────────────────────────── */

export function pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

/**
 * Convenience: build the x.com intent URL for a given tweet body.
 * The caller is responsible for opening it (window.open).
 */
export function buildXIntentUrl(tweetText: string): string {
  return `https://x.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;
}
