// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./IVotingPower.sol";

/// @title OnePerPlacementVotingPower
/// @notice v0 stub: every address has weight = 1 for all epochs.
///         - works with LoreboardVoting's IVotingPower interface
///         - ignores epochId completely
contract OnePerPlacementVotingPower is IVotingPower {
    /// @notice Always returns 1 regardless of voter or epoch.
    /// @return Always 1.
    function votingPowerOf(address /*voter*/, uint256 /*epochId*/)
        external
        pure
        override
        returns (uint256)
    {
        return 1;
    }
}
