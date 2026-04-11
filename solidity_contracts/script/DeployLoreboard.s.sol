// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {Loreboard} from "../src/Loreboard.sol";
import {LoreboardLiveNFT} from "../src/LoreboardLiveNFT.sol";

/// @title DeployLoreboard
/// @notice Deploys the Loreboard mainnet stack:
///   1. Loreboard          — propose → vote → finalize → permanent placement
///   2. LoreboardLiveNFT   — 1/1 ERC-721 board NFT, reads manifest from Loreboard
///   3. Transfer ownership to FoidMultisig (2-of-3)
///
///   Dependencies (already deployed, read from env):
///   - StreakVotingPower    — streak-weighted voting power
///   - FoidMultisig         — 2-of-3 multisig that owns all board contracts
contract DeployLoreboard is Script {
    function run() external {
        uint256 expectedChain = vm.envOr("EXPECTED_CHAIN_ID", uint256(25363));
        require(block.chainid == expectedChain, "DeployLoreboard: wrong chain");

        // ── Environment variables ──
        uint256 deployerPk = vm.envUint("OPERATOR_PK");
        address operatorAddr = vm.addr(deployerPk);

        address votingPowerSource = vm.envAddress("STREAK_VOTING_POWER_ADDRESS");
        address feeRecipient = vm.envOr("FEE_RECIPIENT", operatorAddr);
        address multisig = vm.envAddress("MULTISIG_ADDRESS");

        uint256 submissionFee = vm.envOr("SUBMISSION_FEE", uint256(0.001 ether));
        uint32 votingWindow = uint32(vm.envOr("VOTING_WINDOW", uint256(259200))); // 72h

        vm.startBroadcast(deployerPk);

        // ── 1. Deploy Loreboard ──
        Loreboard board = new Loreboard(
            votingPowerSource,
            operatorAddr,
            feeRecipient,
            submissionFee,
            votingWindow
        );
        console.log("Loreboard:         ", address(board));

        // ── 2. Deploy LoreboardLiveNFT ──
        //       treasury = Loreboard (implements manifestRootOf)
        //       manifestStore = Loreboard (implements latest)
        //       initialOwner = operator EOA (multisig can't receive via safeMint; transfer later)
        LoreboardLiveNFT nft = new LoreboardLiveNFT(
            address(board),  // treasury
            address(board),  // manifestStore
            operatorAddr     // NFT owner (EOA — can transfer to multisig later)
        );
        console.log("LoreboardLiveNFT:  ", address(nft));

        // ── 3. Transfer Loreboard ownership to multisig ──
        board.setOwner(multisig);
        console.log("Ownership transferred to multisig");

        vm.stopBroadcast();

        // ── Post-deploy verification ──
        require(board.approvalThresholdBps() == 5100, "Deploy: threshold not 5100");
        require(board.minVoterQuorum() == 3, "Deploy: quorum not 3");
        require(board.submissionFee() == submissionFee, "Deploy: fee mismatch");
        require(board.votingWindowSeconds() == votingWindow, "Deploy: window mismatch");
        require(board.votingPowerSource() == votingPowerSource, "Deploy: VP mismatch");
        require(board.operator() == operatorAddr, "Deploy: operator mismatch");
        require(board.feeRecipient() == feeRecipient, "Deploy: feeRecipient mismatch");
        require(board.owner() == multisig, "Deploy: owner not multisig");

        console.log("");
        console.log("=== LOREBOARD DEPLOYMENT COMPLETE ===");
        console.log("Loreboard:         ", address(board));
        console.log("LoreboardLiveNFT:  ", address(nft));
        console.log("Operator:          ", operatorAddr);
        console.log("Fee Recipient:     ", feeRecipient);
        console.log("Owner (Multisig):  ", multisig);
        console.log("VotingPower:       ", votingPowerSource);
        console.log("");
        console.log("Config:");
        console.log("  threshold:       51%");
        console.log("  quorum:          3 unique wallets");
        console.log("  submissionFee:   ", submissionFee);
        console.log("  votingWindow:    ", votingWindow, "s");
    }
}
