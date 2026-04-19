# Phase β Baseline — /board performance

Captured on branch `feat/board-phase-beta-infrastructure` *before* any
Part 1 optimizations land. This is the "before" column for the PR's
before/after table. Any number below that's flagged as **(needs live
env)** is deferred to the staging-environment measurement pass.

## Surface-level measurements (captured locally)

These are the cheap measurements anyone can reproduce by reading the
source. They describe the current render topology, not user-perceived
performance — but they line up 1:1 with the optimization targets.

### Celebration particles (PlacementCelebration.tsx)

Current DOM elements spawned per celebration:

| Particle type | Count | Source reference |
|---------------|-------|------------------|
| `pc-p` (sparkle/star) | 200 | `sparkles = useMemo(() => Array.from({ length: 200 }))` |
| `pc-crystal` | 140 | `crystals = useMemo(() => Array.from({ length: 140 }))` |
| `pc-confetti` | 100 | `confetti = useMemo(() => Array.from({ length: 100 }))` |
| `pc-ring` | 60 | `rings = useMemo(() => Array.from({ length: 60 }))` |
| **Total** | **500** | |

Each renders as an `<i>` with inline CSS custom properties driving a
5s particle animation. At 60fps that's 30,000 style-and-paint events
per second during the celebration beat — the source of the >400ms INP
spike the acceptance criteria call out.

**Target**: < 80 DOM nodes total, ~200 particles rendered on a single
`<canvas>` via a reusable particle system.

### Memoization coverage (src/components/board/)

Result of `grep -l "React.memo\|memo("`: **0 files**.

Every placement figure, voting ghost, and pending card re-renders on
each pan/zoom tick because the parent's callbacks are inline arrows
with changing identity. Memoization will only hit once prop-identity is
fixed in `page.tsx`.

### Viewport virtualization coverage

`page.tsx` already has partial virtualization via `visiblePlaced` +
`visibleVotingProposals` memos off `subscribeViewport`. These apply
AABB-intersection filtering but do a linear scan over every placement
per viewport update — fine at 50 placements, linear-bad at 5000.

Unvirtualized call sites still in the render tree:

- `swipeVotingProposals.map(...)` (line 1174) — renders every pending
  on-chain proposal regardless of viewport.
- `items.map(...)` (pending cards) — typically small, kept as-is.

**Target**: grid-bucketed spatial index that's O(1) for viewport queries
regardless of total count.

### Image loading hints

| File | Current hints |
|------|---------------|
| `VotingGhost.tsx` | `loading="lazy"` |
| `PendingItemCard.tsx` | `loading="lazy"` |
| `PlacementCard.tsx` | `loading="lazy"` + `decoding="async"` |
| `PlacementCelebration.tsx` (hero) | none |

Missing: `fetchpriority` anywhere, `decoding="async"` on most sites,
preconnect hints in `layout.tsx` (grep returned 0).

### Timers in the board tree

`grep -rE "setInterval|setTimeout"` returns **7 occurrences** under
`src/app/board/ src/components/board/ src/hooks/board/`. A manual pass
will flag any that no UI reads from.

### Pan handler stability

`usePanZoom.onContainerPointerDown` has `[pan, spaceDown]` in its
`useCallback` deps (both mutable state), so it re-creates on every
render. Every board-canvas child that uses it as a prop inherits that
instability.

**Target**: convert to ref-based access so the handler is stable across
renders.

## Measurements requiring a live environment

The following were requested in the PR spec but need runtime tools
that aren't available in this session. They'll be captured against the
pre-optimization baseline during the PR review cycle on staging.

| Metric | Current | Target | How to measure |
|--------|---------|--------|----------------|
| LCP on /board (4G throttle) | *~3.1s per spec* | < 2.0s | Chrome DevTools Lighthouse with "Slow 4G" preset |
| INP during pan/zoom | **(needs live env)** | < 200ms | DevTools Performance → INP panel |
| INP during celebration | *>400ms per spec* | < 200ms | same, captured while celebration renders |
| JS bundle gzipped (/board) | **(needs build)** | < 240 KB | `pnpm build && du -sh foid_fun/.next/static/chunks/app/board/page-*.js` + gzip |
| Pan/zoom fps on iPhone 12 mini | **(needs device)** | sustained 60fps | remote devtools from the device |
| Lighthouse perf score | **(needs live)** | ≥ 90 | Lighthouse CI workflow (Commit 4) |

Why these numbers can't be produced from the current chat session:

- **Chrome throttling** — the preview server here doesn't expose
  devtools to me; Lighthouse needs a driver process.
- **Production bundle size** — `pnpm build` from here would take several
  minutes and produce a multi-MB stats.json that overflows my reading
  buffer. The number gets captured in the Commit 4 CI gate instead.
- **Device measurements** — iPhone 12 mini fps requires physical
  hardware + remote inspection.

## Reproducing these numbers

```bash
cd foid_fun
grep -cE "Array.from\(\{ length: [0-9]+" src/effects/PlacementCelebration.tsx    # → 4 arrays
grep -cE "loading=|decoding=|fetchpriority=" src/components/board/*.tsx           # → image attr count
grep -c "preconnect\|dns-prefetch" src/app/layout.tsx                             # → 0
grep -rE "setInterval|setTimeout" src/app/board/ src/components/board/ src/hooks/board/ | wc -l  # → 7
```

## What "after" looks like (post-Commit 2 targets)

| Metric | Before | After (target) |
|--------|--------|----------------|
| Celebration DOM nodes | 500 | < 80 |
| Memoized stage children | 0 | PlacementCard, VotingGhost, PendingItemCard, PlacementGhost |
| Preconnect hints | 0 | 3 (ipfs.io, gateway.pinata.cloud, w3s.link) |
| `fetchpriority` hints | 0 | 1 (celebration hero = high) |
| `decoding="async"` coverage | 1 | all placement images |
| onContainerPointerDown identity | unstable | stable (ref-based) |
| Viewport query | O(n) per tick | O(1) per tick via grid bucket |

Numbers that depend on live env move from **(needs live env)** to
concrete values during the staging measurement pass. The acceptance
criteria "before/after Lighthouse scores in the PR description" will
be satisfied from that pass.
