// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "forge-std/console2.sol";
import "../src/StreakVotingPower.sol";
import "../src/LoreboardVotingV2.sol";

contract DeployLoreboardVotingV2 is Script {
    function run()
        external
        returns (StreakVotingPower votingPower, LoreboardVotingV2 voting)
    {
        uint256 pk = vm.envUint("OPERATOR_PK");
        address deployer = vm.addr(pk);

        address boardAdmin = vm.envOr(
            "BOARD_ADMIN",
            0x1a2a5E805342D5139111488C59d72832055A3e8F
        );
        uint256 minTotalWeightQuorum = vm.envOr("MIN_TOTAL_WEIGHT_QUORUM", uint256(1));
        uint64 epochZeroUnix = uint64(vm.envOr("EPOCH_ZERO_UNIX", uint256(1730937600)));
        uint32 epochSeconds = uint32(vm.envOr("EPOCH_SECONDS", uint256(86400)));
        uint32 voteWindowSeconds = uint32(vm.envOr("VOTE_WINDOW_SECONDS", uint256(259200)));

        address existingVotingPower = vm.envOr("VOTING_POWER_SOURCE", address(0));

        vm.startBroadcast(pk);

        if (existingVotingPower == address(0)) {
            votingPower = new StreakVotingPower(address(0xdead), address(0), 1, 0);
            existingVotingPower = address(votingPower);
        }

        voting = new LoreboardVotingV2(
            existingVotingPower,
            boardAdmin,
            minTotalWeightQuorum,
            epochZeroUnix,
            epochSeconds,
            voteWindowSeconds
        );

        vm.stopBroadcast();

        console2.log("chainId", block.chainid);
        console2.log("deployer", deployer);
        console2.log("StreakVotingPower", existingVotingPower);
        console2.log("LoreboardVotingV2", address(voting));
        console2.log("epochZeroUnix", voting.epochZeroUnix());
        console2.log("epochSeconds", voting.epochSeconds());
        console2.log("voteWindowSeconds", voting.voteWindowSeconds());
    }
}
