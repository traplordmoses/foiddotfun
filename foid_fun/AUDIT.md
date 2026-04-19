# AUDIT

Short log of post-merge regressions caught in the wild and the fixes.
Intended as a source of "don't repeat this" context. Newest first.

---

## 2026-04-19 — /board placements not rendering (mobile + desktop)

**Regressed by:** commit `3c3fcd0` (merged as `7e38b2d`)

**Symptom:** Board loads fast, API `/api/proposals` returns correct data
(CIDs + imageUrls), but placement `<img>` tags never render pixels. No
network requests go out for IPFS content on first paint. When they do
fire, they cascade through CSP-blocked gateways until the session
circuit breaker marks every gateway as failed.

**Two interacting root causes:**

1. **`loading="lazy"` inside a CSS-transformed ancestor.** The Phase 2
   pan/zoom refactor writes `transform: translate(…) scale(…)` directly
   to `.board-stage` via rAF (see `usePanZoom.ts:applyTransform`). Every
   placement `<img>` lives inside that transformed ancestor.
   IntersectionObserver (which powers `loading="lazy"`) is unreliable
   inside transformed ancestors in Chrome and Safari, especially when
   the transform is applied via direct DOM mutation (bypassing React's
   style reconciliation). On a 65536² stage, images never register as
   "near viewport" and never begin loading.

2. **CSP mismatch with the IPFS fallback gateway list.** The CSP in
   `next.config.mjs:20` whitelists 4 gateways (ipfs.io, pinata,
   cloudflare-ipfs, dweb.link). `src/lib/ipfsUrl.ts` was using 6
   (adding filebase, 4everland, w3s.link — all CSP-blocked). When a
   primary gateway stalled, PlacementCard's retry advanced to a
   CSP-blocked gateway, got `Refused to load the image` from the
   browser, fired onError, and poisoned `ipfsGatewayCache` by marking
   it failed. Three blocked gateways in a row was enough to taint the
   entire session.

**Fix:**

- `PlacementCard.tsx` and `MobileBoard.tsx`: `loading="lazy"` →
  `loading="eager"` on the placement `<img>`. Viewport virtualization
  already caps rendered placements to ~15–25 so eager is cheap.
- `ipfsUrl.ts`: trimmed `FALLBACK_GATEWAY_BASES` to the 4 CSP-whitelisted
  gateways. Added a comment at the top of the array pointing at
  `next.config.mjs:20` — the two lists MUST stay in sync.
- `ipfsGatewayCache.ts`: added a session-reset escape hatch —
  `markGatewayFailure` now clears the failed list when every whitelisted
  gateway has been marked failed. Prevents runaway circuit-breaker
  poisoning from transient network issues.

**Left intact (still correct):** multicall refactor in
`api/proposals/route.ts`, Phase 2 ref+rAF pan/zoom in `usePanZoom.ts`,
viewport virtualization in `board/page.tsx`.

**Follow-up flagged (not changed in this pass):**
`src/app/board/page.tsx:1342` renders a proposal `<img loading="lazy">`
inside the same transformed stage — same class of bug. Out of scope
for this fix, worth addressing separately.

**Lesson:** any change to the CSP `img-src`/`connect-src` whitelist in
`next.config.mjs` must be mirrored in `FALLBACK_GATEWAY_BASES` (and
vice versa). The comment there now spells this out, but future reviewers
should treat the two lists as paired.
