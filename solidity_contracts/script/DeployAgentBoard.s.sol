// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/OnePerPlacementVotingPower.sol";
import "../src/LoreBoardTreasury.sol";
import "../src/LoreboardVotingV2.sol";
import "../src/LoreboardBoardV2.sol";
import "../src/LoreBoardManifestStore.sol";

/// @title DeployAgentBoard
/// @notice Deploys a full loreboard stack for the agent-only board with fast epochs and zero fees.
contract DeployAgentBoard is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("AGENT_RELAYER_PRIVATE_KEY");
        address operator = vm.addr(deployerKey);

        // Agent board config
        uint96 baseFee = 0;                          // free for bots
        uint64 epochZeroUnix = uint64(block.timestamp); // start epochs from now
        uint32 epochSeconds = 3600;                   // 1 hour epochs
        uint32 voteWindowSeconds = 10800;             // 3 hour vote window
        uint256 minQuorum = 1;                        // 1 vote = quorum (low barrier)

        console.log("Deployer/Operator:", operator);
        console.log("Epoch zero:", epochZeroUnix);
        console.log("Epoch length:", epochSeconds, "s");
        console.log("Vote window:", voteWindowSeconds, "s");

        vm.startBroadcast(deployerKey);

        // 1. Voting power source (returns 1 for everyone)
        OnePerPlacementVotingPower votingPower = new OnePerPlacementVotingPower();
        console.log("OnePerPlacementVotingPower:", address(votingPower));

        // 2. Treasury (base fee = 0)
        LoreBoardTreasury treasury = new LoreBoardTreasury(baseFee, operator);
        console.log("LoreBoardTreasury:", address(treasury));

        // 3. Voting (operator is boardAdmin)
        LoreboardVotingV2 voting = new LoreboardVotingV2(
            address(votingPower),
            operator,
            minQuorum,
            epochZeroUnix,
            epochSeconds,
            voteWindowSeconds
        );
        console.log("LoreboardVotingV2:", address(voting));

        // 4. Board (links to treasury + voting)
        LoreboardBoardV2 board = new LoreboardBoardV2(
            address(treasury),
            address(voting),
            epochZeroUnix,
            epochSeconds,
            operator
        );
        console.log("LoreboardBoardV2:", address(board));

        // 5. Manifest store
        LoreBoardManifestStore manifestStore = new LoreBoardManifestStore(operator);
        console.log("LoreBoardManifestStore:", address(manifestStore));

        vm.stopBroadcast();

        console.log("");
        console.log("=== AGENT BOARD DEPLOYMENT COMPLETE ===");
        console.log("VotingPower:", address(votingPower));
        console.log("Treasury:", address(treasury));
        console.log("Voting:", address(voting));
        console.log("Board:", address(board));
        console.log("ManifestStore:", address(manifestStore));
        console.log("Operator:", operator);
    }
}
