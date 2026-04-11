// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {Swipe} from "../src/Swipe.sol";

/// @title DeploySwipeV2
/// @notice Deploys only the new Swipe v2 contract (direct on-chain castVote).
///         All other contracts (FoidTrest, StreakVotingPower, LoreboardVotingV2)
///         already exist — we just wire the new Swipe to them.
///
///   Required env vars:
///     OPERATOR_PK              — deployer / operator private key
///     FOID_TREST_ADDRESS       — existing FoidTrest gallery
///     STREAK_VOTING_POWER_ADDR — existing StreakVotingPower
///     LOREBOARD_VOTING_ADDRESS — existing LoreboardVotingV2
///
///   Optional env vars (fall back to sensible defaults):
///     FEE_RECIPIENT            — defaults to operator address
///     SWIPE_SUBMISSION_FEE     — default 0.001 ether
///     SWIPE_VOTING_WINDOW      — default 259200 (72 hours)
///
///   After deploy:
///     1. Call `FoidTrest.setSwipe(newSwipeAddress)` to authorise the new contract.
///     2. Update NEXT_PUBLIC_SWIPE env var in Render to the new address.
///     3. Old Swipe can be left in place — existing finalized proposals are unaffected.
contract DeploySwipeV2 is Script {
    function run() external {
        uint256 deployerPk = vm.envUint("OPERATOR_PK");
        address operator   = vm.addr(deployerPk);

        address gallery        = vm.envAddress("FOID_TREST_ADDRESS");
        address votingPower    = vm.envAddress("STREAK_VOTING_POWER_ADDR");
        address loreboardVoting = vm.envAddress("LOREBOARD_VOTING_ADDRESS");
        address feeRecipient   = vm.envOr("FEE_RECIPIENT", operator);

        uint256 submissionFee      = vm.envOr("SWIPE_SUBMISSION_FEE", uint256(0.001 ether));
        uint32  votingWindowSeconds = uint32(vm.envOr("SWIPE_VOTING_WINDOW", uint256(259200)));

        vm.startBroadcast(deployerPk);

        Swipe swipe = new Swipe(
            gallery,
            votingPower,
            operator,
            feeRecipient,
            loreboardVoting,
            submissionFee,
            votingWindowSeconds
        );

        vm.stopBroadcast();

        console.log("=== Swipe v2 deployed ===");
        console.log("Swipe v2:           ", address(swipe));
        console.log("Gallery:            ", gallery);
        console.log("VotingPower:        ", votingPower);
        console.log("LoreboardVoting:    ", loreboardVoting);
        console.log("Operator:           ", operator);
        console.log("FeeRecipient:       ", feeRecipient);
        console.log("SubmissionFee:      ", submissionFee);
        console.log("VotingWindow (sec): ", votingWindowSeconds);
        console.log("");
        console.log("Next steps:");
        console.log("  1. FoidTrest.setSwipe(", address(swipe), ")");
        console.log("  2. Set NEXT_PUBLIC_SWIPE =", address(swipe), "in Render");
    }
}
