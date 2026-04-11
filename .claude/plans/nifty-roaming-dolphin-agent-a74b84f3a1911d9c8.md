# Vote Page 10/10 Transformation Plan

## Architecture Overview

The vote page lives at `/foid_fun/src/app/vote/page.tsx` (1180 lines). It is a monolithic "use client" component containing inline sub-components (SwipeParticles, StreakBadge, GlowFlash, VoteResultText, VoteBar, SwipeCard) plus the main SwipePage. The swipe physics are in `/foid_fun/src/hooks/useSwipeVote.ts` (254 lines) and sound effects in `/foid_fun/src/lib/sfx.ts` (484 lines). The AeroToast pattern at `/foid_fun/src/effects/AeroToast.tsx` uses `spawn()` from `/foid_fun/src/lib/spawn.tsx` to mount ephemeral React trees into the DOM — the same pattern should be used for the victory celebration.

The on-chain voting hook is at `/foid_fun/src/hooks/useSwipeCastVote.ts` but the batch flow in page.tsx uses raw `walletClient.writeContract()` in a loop, not the hook. The proposals API returns: id, proposer, ipfsCid, imageUrl, createdAt, votingEndsAt, finalized, approved, placementId, forCount, againstCount, gridX/Y/W/H. The ProposalStore (server-side SQLite) has an optional `name` field but the API does not currently expose it.

Block explorer URL pattern: `https://testnet.fluentscan.xyz/tx/${hash}`

---

## Implementation Sequence (10 Phases)

### Phase 1: Extract Sub-Components Into Separate Files

**Why first**: The page is 1180 lines. Before adding features, extract the existing inline components to reduce cognitive load and enable parallel work.

**Files to create**:
- `/foid_fun/src/app/vote/_components/SwipeParticles.tsx` — Move the SwipeParticles component (lines 125-184)
- `/foid_fun/src/app/vote/_components/StreakBadge.tsx` — Move StreakBadge (lines 187-222)
- `/foid_fun/src/app/vote/_components/GlowFlash.tsx` — Move GlowFlash (lines 225-255)
- `/foid_fun/src/app/vote/_components/VoteResultText.tsx` — Move VoteResultText (lines 258-303)
- `/foid_fun/src/app/vote/_components/VoteBar.tsx` — Move VoteBar (lines 324-354)
- `/foid_fun/src/app/vote/_components/SwipeCard.tsx` — Move SwipeCard (lines 357-561)
- `/foid_fun/src/app/vote/_components/keyframes.ts` — Move injectKeyframes and KEYFRAMES_ID (lines 74-122)

**Files to modify**:
- `/foid_fun/src/app/vote/page.tsx` — Replace inline components with imports. Remove the helper functions that are already duplicated in `swipeConstants.ts` (tryNextGateway, truncateAddress, CARD_VISUALS at lines 19-71 — these already exist in `/foid_fun/src/lib/swipeConstants.ts`).

**Pattern note**: Next.js App Router convention uses `_components` folder prefix for co-located components that should not be treated as route segments.

---

### Phase 2: Add Skip Gesture (Swipe Up) to useSwipeVote.ts

**File**: `/foid_fun/src/hooks/useSwipeVote.ts`

**Changes**:

1. **Extend SwipeDirection type** (line 5):
   - Change from `"left" | "right" | null` to `"left" | "right" | "up" | null`

2. **Add `onSwipeUp` callback** to `UseSwipeVoteOptions` (line 9):
   - Add `onSwipeUp?: () => void;`

3. **Modify direction lock logic** in `onPointerMove` (lines 116-148):
   - Currently, if `Math.abs(dy) > Math.abs(dx) * 1.5`, the gesture is cancelled entirely (lines 124-129). Instead:
   - If `Math.abs(dy) > Math.abs(dx) * 1.5` AND `dy < 0` (swiping up), set a `verticalLockedRef.current = true` flag and track vertical movement
   - If `dy > 0` (swiping down), still cancel (reserved for undo, handled separately)
   - Track `deltaY` when vertically locked

4. **Add vertical threshold check** in `onPointerUp` (lines 151-190):
   - If `verticalLockedRef.current` and `Math.abs(deltaY) > threshold * 0.8` (upward), trigger skip exit
   - Set `exitDirRef.current = "up"` (needs new type)
   - Fire `onSwipeUp?.()` after exit animation

5. **Add exit style for "up" direction** (lines 207-221):
   - When `phase === "exiting"` and `exitDirRef.current === "up"`:
     ```
     transform: translateY(-800px) scale(0.7)
     opacity: 0
     transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease
     ```

6. **Add keyboard shortcut** — Space key for skip (in the existing keydown handler, lines 54-93):
   - `e.key === " "` (Space) triggers the "up" exit direction and calls `onSwipeUp?.()`

7. **Return `exitDirection`** in the hook's return value so the card component can show a "SKIP" stamp instead of "YES"/"NOPE"

**New return fields**: `exitDirection: "left" | "right" | "up" | null`

---

### Phase 3: Add Undo Capability

**File**: `/foid_fun/src/app/vote/page.tsx` (and the extracted SwipeCard if Phase 1 is done)

**New state in SwipePage**:
```typescript
const [lastDecision, setLastDecision] = useState<{ proposalId: number; approve: boolean; direction: "left" | "right" } | null>(null);
const [showUndoPill, setShowUndoPill] = useState(false);
const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
```

**New component**: `/foid_fun/src/app/vote/_components/UndoPill.tsx`
- Floating pill at bottom-center: "Undo" with a left-arrow icon
- 3-second auto-dismiss with a shrinking progress bar inside the pill
- Styled with glass-morphism (matching the existing `vista-window` design language): `bg-white/10 backdrop-blur-md border border-white/20 rounded-full px-4 py-2`
- Fade-in on mount, slide-down-and-fade on dismiss
- On click: calls `onUndo()` callback

**Logic changes in `handleVote` callback** (currently lines 712-735):
- After recording the pending decision, save the decision to `lastDecision` state
- Show the undo pill for 3 seconds
- Clear the undo pill timer when next vote happens

**New `handleUndo` callback**:
- Remove the `lastDecision.proposalId` from `pendingDecisions` map
- Remove from `votedIds` set
- Remove from `voteChoices` map
- Set `showUndoPill` to false
- Clear `lastDecision`
- Decrement `sessionVoteCount` (streak count)
- The proposal will naturally reappear as `activeProposals[0]` because it is no longer in `votedIds`

**Keyboard shortcut**: Z key triggers undo (add to the keyboard handler in useSwipeVote or add a separate `useEffect` in the page)

---

### Phase 4: Card Detail Drawer (Tap to Expand)

**New component**: `/foid_fun/src/app/vote/_components/DetailDrawer.tsx`

**Trigger**: Tapping the card image area without initiating a swipe. In the current architecture, `onPointerDown`/`onPointerUp` fire for both taps and swipes. A tap is distinguished by: `!lockedRef.current && Math.abs(deltaX) < 5 && Math.abs(deltaY) < 5 && elapsed < 200ms`.

**Implementation approach**:
1. In `SwipeCard`, add an `onClick` handler on the image container that checks for tap vs swipe. The swipe hook already has `isDragging` and `phase` — if `!isDragging && phase !== "exiting"`, it is a tap.
2. Lift a `detailOpen` state to the SwipePage, or keep it in SwipeCard with a callback.
3. The drawer is a bottom-sheet overlay:

**Drawer contents**:
- Full-size image (with pinch-to-zoom using CSS `touch-action: pinch-zoom`)
- Proposal info section:
  - "Prop #{id}" header
  - Proposer address (full, with copy button)
  - Proposal name if available (from API — requires API change to include `name` from ProposalStore, or fallback to "Untitled Meme")
  - Submission time (human-readable from `createdAt`)
- Vote tally section:
  - Reuse `VoteBar` component with `showThreshold={true}`
  - Show raw numbers: "X weight for / Y weight against"
  - Show percentage and pass/fail status
- Countdown ring:
  - Circular SVG ring showing time remaining as a percentage of total voting duration
  - Text in center: "Xh Ym left" using the existing `useCountdown` hook
- Action buttons at bottom:
  - Two full-width buttons: "Vote YES" (green) and "Vote NO" (red)
  - These call `onVote(proposalId, true/false)` and dismiss the drawer

**Animation**:
- Enter: `transform: translateY(100%) -> translateY(0)` with spring easing
- Backdrop: `opacity: 0 -> 0.6` black overlay
- Dismiss: swipe down gesture OR tap backdrop OR vote action

**Keyboard**: Enter key opens the drawer when a card is focused (add to the useSwipeVote keyboard handler)

**API change needed**: Modify `/foid_fun/src/app/api/swipe/proposals/route.ts` to include the `name` field from ProposalStore. Currently (line 129-145), the route reads from chain only. Add a server-side lookup:
```typescript
import { ProposalStore } from "@/lib/proposalStore";
// After reading on-chain data:
const meta = ProposalStore.get(String(p.id));
proposals.push({
  ...existingFields,
  name: meta?.name ?? null,
});
```
This also means updating the `SwipeProposal` type to include `name?: string`.

---

### Phase 5: Transaction Overlay (Replace Jarring MetaMask)

**New component**: `/foid_fun/src/app/vote/_components/TxOverlay.tsx`

**State machine** (controlled from SwipePage):
```typescript
type TxPhase = "idle" | "preparing" | "confirming" | "broadcasting" | "confirmed" | "error";
```

**Visual design**:
- Full-screen fixed overlay with glass-morphism background: `bg-black/60 backdrop-blur-sm`
- Centered card with the current phase indicator
- Phase progression shown as a vertical stepper:
  1. "Preparing transaction..." — spinner icon
  2. "Confirm in wallet" — wallet icon, pulsing (this is when MetaMask pops up)
  3. "Broadcasting..." — signal/wave icon
  4. "Confirmed!" — checkmark icon with green glow
- Each completed step gets a green checkmark
- Progress bar that fills across the bottom

**Integration with handleBatchSign** (currently lines 738-789):
1. Before the for-loop, set `txPhase` to "preparing"
2. Before each `walletClient.writeContract()`, set `txPhase` to "confirming"
3. After writeContract returns (hash received), set `txPhase` to "broadcasting"
4. After the hash is received (the current code does not wait for receipt in batch mode — it fire-and-forgets), set `txPhase` to "confirmed" briefly, then reset for next proposal
5. After all votes, transition to victory celebration

**Error handling**:
- If user rejects in wallet: show "Transaction cancelled" in the overlay with a "Try Again" button
- The overlay does NOT block the MetaMask popup — MetaMask appears on top, the overlay stays visible underneath

**Counter display**: "Vote 1 of 3" with proposal thumbnail and YES/NO badge

**Modification to the batch button text** (currently line 937): Replace `Voting ${batchProgress.signed}/${batchProgress.total}...` with a proper human label: `Signing vote ${batchProgress.signed + 1} of ${batchProgress.total}`

---

### Phase 6: Victory Celebration Screen

**New component**: `/foid_fun/src/app/vote/_components/VictoryCelebration.tsx`

**Trigger**: After all batch votes are confirmed (currently line 773: `if (submitted > 0)`)

**Design** (inspired by existing AeroToast pattern but full-screen):
- Full-screen overlay using `spawn()` pattern OR inline state (inline is better here since it needs access to vote data)
- Gold/purple/cyan particle explosion — reuse the SwipeParticles pattern but with 60+ particles in gold colors
- Central content:
  - Animated counter: "X VOTES CAST" where X counts up from 0 to the total with a spring easing
  - Each proposal thumbnail appears in a row/grid with its YES/NO badge
  - Voting power display: "Your votes weighed Xx"
  - Transaction hashes with explorer links (clickable): `https://testnet.fluentscan.xyz/tx/${hash}`
- Sound: Call `playReward()` from sfx.ts (already exists)
- Auto-transition: After 4 seconds, fade into the "All caught up" state

**New keyframes** (add to the keyframes injection):
```css
@keyframes count-up-bounce {
  0% { transform: scale(0.3); opacity: 0; }
  60% { transform: scale(1.15); opacity: 1; }
  100% { transform: scale(1); opacity: 1; }
}
@keyframes victory-particle {
  0% { transform: translate(0,0) scale(1); opacity: 1; }
  100% { transform: translate(var(--vx), var(--vy)) scale(0.2); opacity: 0; }
}
@keyframes trophy-glow {
  0%, 100% { filter: drop-shadow(0 0 20px rgba(251,191,36,0.4)); }
  50% { filter: drop-shadow(0 0 40px rgba(251,191,36,0.8)); }
}
```

**State needed**: Track `txHashes: string[]` array during batch signing (currently only the last hash is available). Modify `handleBatchSign` to collect all hashes.

---

### Phase 7: Enhanced Card UI

**File**: `/foid_fun/src/app/vote/_components/SwipeCard.tsx` (or the SwipeCard section of page.tsx)

**Changes to the card info section** (currently lines 503-525):

1. **Proposal name**: Show `proposal.name` above the proposer address if available. Style: `text-sm font-semibold text-white/80 truncate`. Falls back to hidden if no name.

2. **Community sentiment ring**: A thin (3px) colored ring around the entire card border, replacing the plain `border-neutral-700`. Color interpolates between green (100% for) and red (100% against) based on current vote ratio. Implementation: compute `hue` from forCount/againstCount ratio, apply as `border-color` with `hsla()`.

3. **Hot indicator**: When `forCount + againstCount > 10` (threshold TBD), show a small fire emoji badge in the top-right corner of the image with a subtle pulse animation.

4. **First-card swipe hint**: Add a one-time hint animation on the very first card the user sees in a session. Use `sessionStorage` to track if shown. A ghost-hand SVG that slides right, pauses, then fades. Only shows for 2 seconds.

5. **SKIP stamp**: When `exitDirection === "up"` (from the skip gesture in Phase 2), show a purple "SKIP" stamp matching the existing YES/NOPE stamp pattern but with purple color: `border-purple-400 text-purple-400`.

6. **Skip button**: Add a third button between the NO and YES buttons — a smaller circular button with an up-arrow icon. Style: `border-purple-500/30 bg-purple-500/5 text-purple-400`.

---

### Phase 8: Enhanced Sound Design

**File**: `/foid_fun/src/lib/sfx.ts`

**New exports to add**:

1. **`playSwipeSkip()`**: A neutral "whoosh" sound. Implementation: white noise burst with bandpass filter, 150ms duration. Similar to the existing oscillator-based approach.
   ```typescript
   // Create a short noise burst via BufferSourceNode with random samples
   // Apply bandpass filter at 2kHz, fade out over 150ms
   ```

2. **`playCardEnter()`**: A soft "thunk" — low-frequency sine pulse. 80ms, 120Hz sine with quick attack/decay.

3. **`playUndoWhoosh()`**: Reverse of the swipe sound — ascending 2-note tone.

4. **`playBatchDrumRoll()`**: Rising-intensity snare-like pattern using noise bursts at increasing tempo. Duration: ~1.5 seconds. Called when "Vote All" is pressed.

5. **`playVictoryChord()`**: A triumphant major 7th chord (C4-E4-G4-B4) with a slight arpeggio, 800ms total duration. Rich with harmonics using triangle waves.

6. **Streak pitch escalation**: Modify `playSwipeYes()` and `playSwipeNo()` to accept an optional `streak: number` parameter. Each successive vote raises the base frequency by 20 cents (the `detune` parameter). The page passes `sessionVoteCount` to determine the pitch offset.

**Integration**: Add all new functions to the `sfx` default export object (line 469-483).

---

### Phase 9: Batch Review UX Improvements

**File**: `/foid_fun/src/app/vote/page.tsx` (batch summary section, lines 882-949)

**Changes**:

1. **Flip-to-change gesture**: Each review item gets a click/tap handler that toggles YES <-> NO. When toggled:
   - The item does a subtle horizontal flip animation (rotateY)
   - The badge changes color
   - `pendingDecisions` map is updated
   - Sound: `playSwipeYes()` or `playSwipeNo()` depending on new choice

2. **Running tally**: Below the list, show a live summary bar:
   - Visual bar identical to VoteBar but showing YOUR pending decisions
   - "X YES / Y NO — total weight: Z" (weight = count * multiplier)

3. **Better button states**: The "Vote All" button (line 926-939):
   - Idle: gradient shimmer animation (CSS `background-size: 200%` with animation)
   - During signing: each completed vote adds a small green dot/checkmark next to the button text
   - Progress bar already exists (lines 940-947) — enhance with glow: `box-shadow: 0 0 20px rgba(168,130,255,0.3)`

4. **Remove individual items**: The X button (line 902-907) already exists. Add a swipe-left-to-remove gesture for mobile (a simpler version of the main swipe — just 50px threshold, item slides off left).

5. **Empty review guard**: If user removes all items via the X buttons, show the "All caught up" state instead of an empty review screen.

---

### Phase 10: Better Empty States and Keyboard Power-User Mode

**Empty state improvements** (lines 950-978):

1. **Transition from last card**: After the last swipe, instead of abruptly showing "Review your votes," add a 300ms pause with the card area fading out, then the review section fading in from below.

2. **"All caught up" screen** (lines 951-978):
   - Add session stats: "You voted on X proposals this session" using `sessionVoteCount`
   - Animate the sword icon with a gentle floating animation: `translateY(0) -> translateY(-8px)` over 3s, infinite
   - If `sessionVoteCount >= 5`, trigger a mini confetti burst using the existing SwipeParticles component with gold colors
   - Show countdown to next voting window if available (requires knowing epoch end time — may not be available from current data)

3. **Keyboard shortcuts overlay**: 
   - New component: `/foid_fun/src/app/vote/_components/KeyboardHints.tsx`
   - Desktop-only (detect via media query or pointer type)
   - Small, dismissible tooltip in bottom-right showing:
     ```
     Arrow keys: Vote  |  Space: Skip  |  Z: Undo  |  Enter: Details  |  Tab: Switch tabs
     ```
   - Shows on first visit, then has a small "?" button to re-show
   - Uses `localStorage` to track dismissal

4. **Tab keyboard navigation**: In the existing keyboard handler (useSwipeVote.ts lines 54-93), add Tab key support:
   - Tab cycles through the three tabs: "active" -> "completed" -> "history" -> "active"
   - This requires lifting the tab state change handler into the keyboard event, or passing a callback

---

## Dependency Graph

```
Phase 1 (Extract) ── no dependencies, do first
    |
    v
Phase 2 (Skip Gesture) ── depends on understanding useSwipeVote.ts
    |
    v
Phase 3 (Undo) ── depends on Phase 2 (needs skip gesture integrated)
    |
Phase 4 (Detail Drawer) ── independent of 2/3, depends on Phase 1
    |
Phase 5 (Tx Overlay) ── independent, depends on Phase 1
    |
    v
Phase 6 (Victory Celebration) ── depends on Phase 5 (transitions from overlay)
    |
Phase 7 (Enhanced Card UI) ── depends on Phase 1 and 2 (skip stamp)
    |
Phase 8 (Sound Design) ── independent, but needed by 2, 3, 6, 7
    |
Phase 9 (Batch Review) ── depends on Phase 1 and 5
    |
Phase 10 (Empty States + Keyboard) ── depends on Phase 1, 2, 3
```

**Recommended execution order**:
1. Phase 1 (Extract) + Phase 8 (Sound) — parallel
2. Phase 2 (Skip) + Phase 4 (Detail Drawer) — parallel
3. Phase 3 (Undo) + Phase 7 (Enhanced Card UI) — parallel
4. Phase 5 (Tx Overlay) + Phase 9 (Batch Review) — parallel
5. Phase 6 (Victory) + Phase 10 (Empty States + Keyboard) — parallel

---

## Files Summary

### Files to Create (new)
| File | Purpose |
|------|---------|
| `foid_fun/src/app/vote/_components/SwipeParticles.tsx` | Extracted particle burst |
| `foid_fun/src/app/vote/_components/StreakBadge.tsx` | Extracted streak badge |
| `foid_fun/src/app/vote/_components/GlowFlash.tsx` | Extracted glow flash |
| `foid_fun/src/app/vote/_components/VoteResultText.tsx` | Extracted vote text flash |
| `foid_fun/src/app/vote/_components/VoteBar.tsx` | Extracted vote bar |
| `foid_fun/src/app/vote/_components/SwipeCard.tsx` | Extracted swipe card |
| `foid_fun/src/app/vote/_components/keyframes.ts` | Extracted CSS keyframe injection |
| `foid_fun/src/app/vote/_components/DetailDrawer.tsx` | New: tap-to-expand bottom sheet |
| `foid_fun/src/app/vote/_components/UndoPill.tsx` | New: floating undo button |
| `foid_fun/src/app/vote/_components/TxOverlay.tsx` | New: transaction progress overlay |
| `foid_fun/src/app/vote/_components/VictoryCelebration.tsx` | New: full-screen vote success |
| `foid_fun/src/app/vote/_components/KeyboardHints.tsx` | New: keyboard shortcut guide |

### Files to Modify (existing)
| File | Changes |
|------|---------|
| `foid_fun/src/app/vote/page.tsx` | Major refactor: extract components, add undo/skip/detail/overlay state, modify handleVote, modify handleBatchSign, improve empty states, add keyboard shortcuts |
| `foid_fun/src/hooks/useSwipeVote.ts` | Add vertical swipe detection for skip, add "up" exit animation, add Space/Z/Enter keyboard shortcuts, expose exitDirection |
| `foid_fun/src/lib/sfx.ts` | Add playSwipeSkip, playCardEnter, playUndoWhoosh, playBatchDrumRoll, playVictoryChord; modify playSwipeYes/No for streak pitch |
| `foid_fun/src/app/api/swipe/proposals/route.ts` | Add ProposalStore lookup for `name` field |

---

## Key Design Decisions

1. **No Framer Motion** — The codebase does not use Framer Motion. All animations are CSS keyframes + inline styles. This plan follows that pattern. Adding Framer Motion would add ~30KB to the bundle for what CSS can handle.

2. **spawn() vs inline state for overlays** — The TxOverlay and VictoryCelebration should be inline state (not spawn()) because they need access to live state (batch progress, tx hashes). The spawn() pattern is better for fire-and-forget toasts.

3. **Component extraction uses `_components` prefix** — Next.js App Router treats folders without `_` prefix as route segments. The underscore prevents these from being accessible as URLs.

4. **ProposalStore name field** — This is a server-side SQLite store. The API route already runs on Node.js (`export const runtime = "nodejs"`), so importing ProposalStore is safe. The name field may be null for most proposals since submission via the swipe UI does not collect a name.

5. **Skip goes to end of queue** — Skipped proposals are not added to `votedIds`, so they naturally reappear. But `activeProposals` is derived as `proposals.filter(p => !votedIds.has(p.id))`. Since the current proposal is `activeProposals[0]`, skipping it needs to temporarily hide it. Solution: maintain a `skippedIds: Set<number>` that filters from `activeProposals` display order but rotates skipped items to the end. After all non-skipped items are voted on, skipped items reappear.

6. **MetaMask cannot be suppressed** — The TxOverlay is purely a UX wrapper. MetaMask will still appear as a system popup. The overlay provides context before and after the wallet interaction.

7. **Mobile-first** — All new components must work on mobile. The DetailDrawer uses touch gestures for dismiss. The UndoPill is placed in a thumb-reachable zone. Keyboard shortcuts are desktop-only enhancements.

---

## Risk Areas

1. **Skip gesture conflicts with page scroll** — The current code cancels vertical gestures (line 124-129). Phase 2 changes this to capture upward gestures. Must ensure that downward scroll on the page still works. The `touchAction: "pan-y"` CSS property (line 443) allows the browser to handle vertical scrolling. The fix: only capture upward gestures that start ON the card element, and only when `dy < -threshold`.

2. **Undo + batch integrity** — If the user undoes after swiping the last card, they go back to the swiping view (the proposal reappears). If the review screen was showing, it should transition back to the card view. This needs careful state management.

3. **Detail drawer + swipe conflict** — Tapping must be distinguished from swiping. The threshold is movement < 5px AND duration < 200ms. This may need tuning on slower devices.

4. **Large batch signing** — If a user has 10+ pending votes, the sequential writeContract loop will require 10+ wallet confirmations. The TxOverlay makes this tolerable but does not solve the fundamental UX issue. Future improvement: EIP-712 batch signing (out of scope here since the contract requires individual castVote calls).
