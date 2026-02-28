// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FoidTrest} from "./FoidTrest.sol";

/// @title FoidTrestGovernance
/// @notice Content removal pipeline for FoidTrest.
///         Any wallet can flag a post (paying a fee). After threshold flags,
///         a removal vote is triggered. Weighted by StreakVotingPower.
///         Simple majority => post hidden. Failed vote => flags reset.
contract FoidTrestGovernance {
    struct RemovalVote {
        uint256 entryId;
        uint64 startsAt;
        uint64 endsAt;
        uint256 votesFor;       // weighted votes for removal
        uint256 votesAgainst;   // weighted votes against removal
        bool resolved;
        bool removalPassed;
    }

    event PostFlagged(uint256 indexed entryId, address indexed flagger, uint256 flagCount);
    event RemovalVoteStarted(uint256 indexed entryId, uint256 indexed voteId);
    event RemovalVoteCast(uint256 indexed voteId, address indexed voter, bool support, uint256 weight);
    event RemovalVoteResolved(uint256 indexed voteId, uint256 indexed entryId, bool removed);
    event OwnerChanged(address indexed oldOwner, address indexed newOwner);

    address public owner;
    FoidTrest public immutable foidTrest;
    address public votingPowerSource;
    address public feeRecipient;

    uint256 public flagFeeWei;
    uint8 public flagThreshold;          // number of unique flags to trigger vote
    uint32 public removalVoteWindowSeconds;

    uint256 public voteCount;

    // entryId => list of flaggers
    mapping(uint256 => address[]) public flaggers;
    mapping(uint256 => mapping(address => bool)) public hasFlagged;

    // entryId => active vote ID (0 means no active vote; vote IDs start at 1)
    mapping(uint256 => uint256) public activeVoteForEntry;

    // voteId => RemovalVote
    mapping(uint256 => RemovalVote) public votes;
    // voteId => voter => voted
    mapping(uint256 => mapping(address => bool)) public hasVotedOnRemoval;

    modifier onlyOwner() {
        require(msg.sender == owner, "Governance: not owner");
        _;
    }

    constructor(
        address _foidTrest,
        address _votingPowerSource,
        address _feeRecipient,
        uint256 _flagFeeWei,
        uint8 _flagThreshold,
        uint32 _removalVoteWindowSeconds
    ) {
        require(_foidTrest != address(0), "Governance: zero trest");
        require(_votingPowerSource != address(0), "Governance: zero VP");
        require(_feeRecipient != address(0), "Governance: zero recipient");
        require(_flagThreshold > 0, "Governance: zero threshold");
        require(_removalVoteWindowSeconds > 0, "Governance: zero window");

        foidTrest = FoidTrest(_foidTrest);
        votingPowerSource = _votingPowerSource;
        feeRecipient = _feeRecipient;
        flagFeeWei = _flagFeeWei;
        flagThreshold = _flagThreshold;
        removalVoteWindowSeconds = _removalVoteWindowSeconds;
        owner = msg.sender;
    }

    /// @notice Flag a FoidTrest post for removal. Costs flagFeeWei.
    function flagPost(uint256 entryId) external payable {
        require(entryId < foidTrest.entryCount(), "Governance: invalid entry");
        require(msg.value >= flagFeeWei, "Governance: insufficient fee");
        require(!hasFlagged[entryId][msg.sender], "Governance: already flagged");
        require(activeVoteForEntry[entryId] == 0, "Governance: vote already active");

        hasFlagged[entryId][msg.sender] = true;
        flaggers[entryId].push(msg.sender);

        // Forward fee
        if (msg.value > 0) {
            (bool ok, ) = feeRecipient.call{value: msg.value}("");
            require(ok, "Governance: fee transfer failed");
        }

        uint256 count = flaggers[entryId].length;
        emit PostFlagged(entryId, msg.sender, count);

        // Auto-trigger removal vote at threshold
        if (count >= flagThreshold) {
            _startRemovalVote(entryId);
        }
    }

    /// @notice Vote on a removal. support=true means "remove", false means "keep".
    function voteOnRemoval(uint256 voteId, bool support) external {
        require(voteId > 0 && voteId <= voteCount, "Governance: invalid vote");

        RemovalVote storage v = votes[voteId];
        require(!v.resolved, "Governance: vote resolved");
        require(block.timestamp >= v.startsAt, "Governance: not started");
        require(block.timestamp <= v.endsAt, "Governance: voting ended");
        require(!hasVotedOnRemoval[voteId][msg.sender], "Governance: already voted");

        uint256 weight = _getVotingPower(msg.sender);
        require(weight > 0, "Governance: no voting power");

        hasVotedOnRemoval[voteId][msg.sender] = true;

        if (support) {
            v.votesFor += weight;
        } else {
            v.votesAgainst += weight;
        }

        emit RemovalVoteCast(voteId, msg.sender, support, weight);
    }

    /// @notice Resolve a removal vote after the voting window ends.
    function resolveRemovalVote(uint256 voteId) external {
        require(voteId > 0 && voteId <= voteCount, "Governance: invalid vote");

        RemovalVote storage v = votes[voteId];
        require(!v.resolved, "Governance: already resolved");
        require(block.timestamp > v.endsAt, "Governance: voting not ended");

        v.resolved = true;
        bool passed = v.votesFor > v.votesAgainst;
        v.removalPassed = passed;

        // Clear active vote
        activeVoteForEntry[v.entryId] = 0;

        if (passed) {
            // Hide the entry on FoidTrest
            foidTrest.setVisibility(v.entryId, false);
        } else {
            // Reset flags so post can be flagged again in the future
            _resetFlags(v.entryId);
        }

        emit RemovalVoteResolved(voteId, v.entryId, passed);
    }

    // ── Views ──

    function getFlagCount(uint256 entryId) external view returns (uint256) {
        return flaggers[entryId].length;
    }

    function getVote(uint256 voteId) external view returns (RemovalVote memory) {
        require(voteId > 0 && voteId <= voteCount, "Governance: invalid vote");
        return votes[voteId];
    }

    // ── Admin ──

    function setFlagFee(uint256 newFee) external onlyOwner {
        flagFeeWei = newFee;
    }

    function setFlagThreshold(uint8 newThreshold) external onlyOwner {
        require(newThreshold > 0, "Governance: zero threshold");
        flagThreshold = newThreshold;
    }

    function setRemovalVoteWindow(uint32 newWindow) external onlyOwner {
        require(newWindow > 0, "Governance: zero window");
        removalVoteWindowSeconds = newWindow;
    }

    function setOwner(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Governance: zero address");
        address old = owner;
        owner = newOwner;
        emit OwnerChanged(old, newOwner);
    }

    // ── Internal ──

    function _startRemovalVote(uint256 entryId) internal {
        voteCount++;
        uint256 voteId = voteCount;

        votes[voteId] = RemovalVote({
            entryId: entryId,
            startsAt: uint64(block.timestamp),
            endsAt: uint64(block.timestamp) + uint64(removalVoteWindowSeconds),
            votesFor: 0,
            votesAgainst: 0,
            resolved: false,
            removalPassed: false
        });

        activeVoteForEntry[entryId] = voteId;

        emit RemovalVoteStarted(entryId, voteId);
    }

    function _resetFlags(uint256 entryId) internal {
        address[] storage f = flaggers[entryId];
        for (uint256 i = 0; i < f.length; i++) {
            hasFlagged[entryId][f[i]] = false;
        }
        delete flaggers[entryId];
    }

    function _getVotingPower(address voter) internal view returns (uint256) {
        (bool ok, bytes memory data) = votingPowerSource.staticcall(
            abi.encodeWithSignature("votingPowerOf(address,uint256)", voter, uint256(0))
        );
        if (!ok || data.length < 32) return 0;
        return abi.decode(data, (uint256));
    }
}
