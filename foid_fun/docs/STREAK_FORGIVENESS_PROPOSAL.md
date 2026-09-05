# Streak forgiveness: contract proposal

Audit finding G4. The ten-tier prayer ladder has no forgiveness, and
streak research (Duolingo's published numbers) says forgiveness is where
retention lives: the biggest drop is day one to day two, two streak
freezes beat one, and a repair window after a break brings people back.
FOID's streak lives onchain (`PrayerRegistry`, rWASM, plus `PrayerTiers`),
so the frontend cannot fake it. This is the contract change.

## Mechanics

- **Shields.** Every wallet earns one shield per 7 consecutive prayers,
  capped at 2 held. A missed day consumes a shield instead of resetting
  the streak. Shields do not stack past 2, so a long streak still needs
  presence.
- **Repair window.** Within 48 hours of a reset, `repairStreak()` restores
  the previous streak for a fee of 0.0005 ETH (half a placement fee).
  Revenue goes to `feeRecipient`. One repair per 30 days per wallet.
- **Tier is unchanged.** Shields and repairs preserve the day count; tiers
  keep reading `currentStreak`.

## Registry surface (rWASM)

```
struct Streak { uint32 current; uint64 lastPrayedDay; uint8 shields; uint64 lastResetAt; uint32 preResetStreak; uint64 lastRepairAt; }

fn pray(hash)            // existing; on gap==1 day: current++ ; on gap>1: if shields>0 { shields--; current++ } else { reset }
fn repairStreak() payable // require gap since reset <= 48h, msg.value >= repairFee, lastRepairAt older than 30d
fn shieldsOf(addr) -> u8
event ShieldUsed(addr, dayLost, remaining)
event StreakRepaired(addr, restoredTo, fee)
```

`PrayerTiers` needs no change. `StreakVotingPower` needs no change.

## Frontend once deployed

- Altar strip shows shields as two small icons under the day count.
- The terminal explains the rule on day 1 and day 7 (already scaffolded
  in `PrayApp` as the first-week explainer copy).
- The notification inbox gets "your streak is at risk, you have N hours"
  (needs the reminder channel from the Farcaster mini app or web push).

## Rollout

1. Testnet deploy + Foundry tests for the three gap cases and the repair
   window edges.
2. Multisig upgrade on mainnet (2-of-3).
3. Announce with a one-time "restore a lost streak" week, the way Duolingo
   did in June 2026: anyone who lost a 14+ day streak in the last 90 days
   can repair it once for free.
