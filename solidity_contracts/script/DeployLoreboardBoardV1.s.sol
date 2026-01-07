// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "forge-std/console2.sol";
import "../src/LoreboardBoardV1.sol";

contract DeployLoreboardBoardV1 is Script {
    function run() external returns (LoreboardBoardV1 board) {
        uint256 pk = vm.envUint("OPERATOR_PK");
        address deployer = vm.addr(pk);

        address treasury = vm.envAddress("TREASURY_ADDRESS");
        address votingV2 = vm.envAddress("VOTING_V2_ADDRESS");
        uint64 epochZeroUnix = uint64(vm.envOr("EPOCH_ZERO_UNIX", uint256(1730937600)));
        uint32 epochSeconds = uint32(vm.envOr("EPOCH_SECONDS", uint256(86400)));
        require(
            epochZeroUnix == LoreboardVotingV2(votingV2).epochZeroUnix(),
            "epochZero mismatch"
        );
        require(
            epochSeconds == LoreboardVotingV2(votingV2).epochSeconds(),
            "epochSeconds mismatch"
        );

        vm.startBroadcast(pk);
        board = new LoreboardBoardV1(
            treasury,
            votingV2,
            epochZeroUnix,
            epochSeconds
        );

        bool skipSetAdmin = vm.envOr("SKIP_SET_ADMIN", uint256(0)) == 1;
        if (!skipSetAdmin) {
            LoreboardVotingV2(votingV2).setBoardAdmin(address(board));
        }
        vm.stopBroadcast();

        console2.log("chainId", block.chainid);
        console2.log("deployer", deployer);
        console2.log("Treasury", treasury);
        console2.log("VotingV2", votingV2);
        console2.log("LoreboardBoardV1", address(board));
        console2.log("VotingV2.boardAdmin", LoreboardVotingV2(votingV2).boardAdmin());
    }
}
