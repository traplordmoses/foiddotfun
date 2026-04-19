// /src/lib/board/fees.ts
// Single source of truth for the Loreboard placement fee.
//
// The contract charges a FLAT fee per propose() call, regardless of cell
// count. Earlier versions of the UI used a per-cell `BASE_FEE_PER_CELL_WEI`
// env var (defaulting to 0) which silently displayed "0 ETH" in the ghost
// label while the modal showed the real fee — two sources of truth that
// disagreed. This module is the one place that imports the env and
// exports a BigInt for all consumers.
import { CONTRACTS } from "@/lib/contracts/addresses";

/** Per-placement submission fee charged by Loreboard.propose() (wei). */
export const SUBMISSION_FEE_WEI = BigInt(
  CONTRACTS.SWIPE_SUBMISSION_FEE ?? "1000000000000000"
);
