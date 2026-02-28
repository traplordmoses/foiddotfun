// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {PrayerTiers} from "../src/PrayerTiers.sol";
import {StreakVotingPower} from "../src/StreakVotingPower.sol";
import {MiFOID} from "../src/MiFOID.sol";
import {FoidTrest} from "../src/FoidTrest.sol";
import {DuelArena} from "../src/DuelArena.sol";
import {FoidTrestGovernance} from "../src/FoidTrestGovernance.sol";
import {LoreboardVotingV2} from "../src/LoreboardVotingV2.sol";

/// @title DeployV1
/// @notice Deploys the full v1 stack to Fluent:
///   1. PrayerTiers
///   2. StreakVotingPower
///   3. MiFOID
///   4. FoidTrest
///   5. DuelArena
///   6. FoidTrestGovernance
///   7. Wire up authorizations
contract DeployV1 is Script {
    function run() external {
        // ── Environment variables ──
        uint256 deployerPk = vm.envUint("OPERATOR_PK");
        address operator = vm.addr(deployerPk);

        address prayerMirror = vm.envAddress("PRAYER_MIRROR_ADDRESS");
        address feeRecipient = vm.envOr("FEE_RECIPIENT", operator);

        uint256 placementFeeWei = vm.envOr("PLACEMENT_FEE_WEI", uint256(0.001 ether));
        uint256 mintFee = vm.envOr("MIFOID_MINT_FEE", uint256(0.01 ether));
        uint256 mintOpensAt = vm.envOr("MIFOID_MINT_OPENS_AT", block.timestamp + 90 days);
        uint32 votingWindowSeconds = uint32(vm.envOr("DUEL_VOTING_WINDOW", uint256(86400)));
        uint256 submissionFee = vm.envOr("DUEL_SUBMISSION_FEE", uint256(0.001 ether));

        // Voting power config
        uint256 baseWeight = vm.envOr("VP_BASE_WEIGHT", uint256(100));
        uint256 mifoidBonus = vm.envOr("VP_MIFOID_BONUS", uint256(50));

        // Governance config
        uint256 flagFeeWei = vm.envOr("FLAG_FEE_WEI", uint256(0.001 ether));
        uint8 flagThreshold = uint8(vm.envOr("FLAG_THRESHOLD", uint256(7)));
        uint32 removalVoteWindow = uint32(vm.envOr("REMOVAL_VOTE_WINDOW", uint256(259200)));

        vm.startBroadcast(deployerPk);

        // 1. Deploy PrayerTiers
        PrayerTiers prayerTiersContract = new PrayerTiers(prayerMirror);
        console.log("PrayerTiers:      ", address(prayerTiersContract));

        // 2. Deploy StreakVotingPower (MiFOID = address(0) initially)
        StreakVotingPower votingPower = new StreakVotingPower(
            prayerMirror,
            address(0), // set after MiFOID deploy
            baseWeight,
            mifoidBonus
        );
        votingPower.setPrayerTiers(address(prayerTiersContract));
        console.log("StreakVotingPower:", address(votingPower));

        // 3. Deploy MiFOID
        MiFOID mifoid = new MiFOID(prayerMirror, mintFee, mintOpensAt);
        console.log("MiFOID:           ", address(mifoid));

        // 4. Wire MiFOID into VotingPower
        votingPower.setMifoidNFT(address(mifoid));

        // 5. Deploy FoidTrest
        FoidTrest trest = new FoidTrest();
        console.log("FoidTrest:        ", address(trest));

        // 6. Deploy DuelArena
        DuelArena arena = new DuelArena(
            address(trest),
            address(votingPower),
            operator,
            votingWindowSeconds,
            submissionFee
        );
        console.log("DuelArena:        ", address(arena));

        // 7. Deploy FoidTrestGovernance
        FoidTrestGovernance governance = new FoidTrestGovernance(
            address(trest),
            address(votingPower),
            feeRecipient,
            flagFeeWei,
            flagThreshold,
            removalVoteWindow
        );
        console.log("Governance:       ", address(governance));

        // ── Wire up authorizations ──

        // FoidTrest: authorize entry points
        trest.authorizeEntryPoint(address(arena));

        // Transfer FoidTrest ownership to governance (for setVisibility)
        trest.setOwner(address(governance));

        // MiFOID: authorize DuelArena to increment wins
        mifoid.authorizeUpdater(address(arena));

        // Set MiFOID reference on DuelArena
        arena.setMifoidNFT(address(mifoid));

        // ── Wire StreakVotingPower into existing LoreboardVotingV2 ──
        // If LOREBOARD_VOTING_V2 is set, call setVotingPowerSource to replace
        // OnePerPlacementVotingPower with the new StreakVotingPower.
        // The caller must be the boardAdmin of LoreboardVotingV2.
        address loreboardVotingAddr = vm.envOr("LOREBOARD_VOTING_V2", address(0));
        if (loreboardVotingAddr != address(0)) {
            LoreboardVotingV2 loreboardVoting = LoreboardVotingV2(loreboardVotingAddr);
            loreboardVoting.setVotingPowerSource(address(votingPower));
            console.log("Wired StreakVotingPower into LoreboardVotingV2 at", loreboardVotingAddr);
        }

        vm.stopBroadcast();

        console.log("");
        console.log("=== V1 DEPLOYMENT COMPLETE ===");
        console.log("PrayerTiers:       ", address(prayerTiersContract));
        console.log("StreakVotingPower:  ", address(votingPower));
        console.log("MiFOID:            ", address(mifoid));
        console.log("FoidTrest:         ", address(trest));
        console.log("DuelArena:         ", address(arena));
        console.log("Governance:        ", address(governance));
        console.log("Operator:          ", operator);
        console.log("Fee Recipient:     ", feeRecipient);
    }
}
