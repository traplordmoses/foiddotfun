// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title IVotingPower
/// @notice Interface for pluggable voting power logic.
interface IVotingPower {
    /// @notice Return the voting power for a given voter in a given epoch.
    /// @dev For v0 you'll just return 1 for everyone.
    /// @param voter Address to query voting power for.
    /// @param epochId Epoch context for the query.
    /// @return Voting weight of the voter for the given epoch.
    function votingPowerOf(address voter, uint256 epochId) external view returns (uint256);
}
