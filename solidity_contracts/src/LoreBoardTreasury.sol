// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Treasury for Loreboard: escrows proposal funds, settles on finalize.
/// Winners' funds accumulate in-contract and ONLY the owner can sweep them out.
/// Losers are automatically refunded on finalize; if a push refund fails,
/// it falls back to claimable (pull by user).
contract LoreBoardTreasury {
    struct Rect { int32 x; int32 y; int32 w; int32 h; }
    struct Proposed {
        bytes32 id;          // keccak(bidder, epoch, cidHash, rect)
        address bidder;
        Rect rect;
        uint32 cells;        // precomputed; server re-checks
        uint96 bidPerCellWei;// base + tip
        bytes32 cidHash;     // keccak256(CID bytes) or digest
        uint32 epoch;
    }

    event ProposedEvt(
        bytes32 indexed id,
        address indexed bidder,
        uint32 epoch,
        Rect rect,
        uint96 bidPerCellWei,
        uint32 cells,
        bytes32 cidHash,
        uint256 value
    );

    /// @notice Finalization event with richer metadata for indexers / reconciliation.
    event Finalized(
        uint32 indexed epoch,
        bytes32 manifestRoot,
        string manifestCID,
        uint256 treasuryAdded,
        uint32 acceptedCount,
        uint32 rejectedCount
    );

    event RefundAvailable(address indexed user, uint256 amount); // fallback bucket
    event RefundPushed(address indexed user, uint256 amount, bytes32 id, bool success);
    event Withdraw(address indexed user, uint256 amount);
    event BaseFeeChanged(uint96 newFee);
    event OperatorChanged(address indexed op);
    event TreasurySwept(address indexed to, uint256 amount);

    address public owner;
    address public operator;              // LoreVM bot/key
    uint96  public baseFeePerCellWei;     // e.g. 1e13

    // Winners' ETH waiting to be swept by owner.
    uint256 public treasuryBalance;

    /// @notice Optional: onchain pointer to the manifest used for an epoch.
    mapping(uint32 => bytes32) public manifestRootOf;
    /// @dev Strings in storage cost more; this is for convenience / debugging / redundancy.
    mapping(uint32 => string) public manifestCidOf;

    mapping(bytes32 => bool) public seenProposal;  // prevents duplicate id
    mapping(bytes32 => bool) public accepted;      // marked in finalize
    mapping(bytes32 => bool) public rejected;      // marked in finalize
    mapping(bytes32 => uint256) public escrow;     // per proposal
    mapping(bytes32 => address) public bidderOf;   // id => bidder (for refunds)
    mapping(address => uint256) public claimable;  // refunds credited here

    modifier onlyOwner()    { require(msg.sender == owner,    "not owner");    _; }
    modifier onlyOperator() { require(msg.sender == operator, "not operator"); _; }

    constructor(uint96 _baseFee, address _operator) {
        owner = msg.sender;
        operator = _operator;
        baseFeePerCellWei = _baseFee;
        emit BaseFeeChanged(_baseFee);
        emit OperatorChanged(_operator);
    }

    function setBaseFeePerCell(uint96 newFee) external onlyOwner {
        baseFeePerCellWei = newFee;
        emit BaseFeeChanged(newFee);
    }

    function setOperator(address op) external onlyOwner {
        operator = op;
        emit OperatorChanged(op);
    }

    /// @notice Anyone can propose; full escrow required (bidPerCell * cells).
    function proposePlacement(Proposed calldata p) external payable {
        require(!seenProposal[p.id], "dup id");
        require(p.bidPerCellWei >= baseFeePerCellWei, "bid < base");

        uint256 need = uint256(p.bidPerCellWei) * uint256(p.cells);
        require(msg.value == need, "bad msg.value");

        seenProposal[p.id] = true;
        escrow[p.id] = msg.value;
        bidderOf[p.id] = msg.sender;

        emit ProposedEvt(
            p.id, msg.sender, p.epoch, p.rect, p.bidPerCellWei, p.cells, p.cidHash, msg.value
        );
    }

    /// @notice LoreVM calls this after computing winners/losers for the epoch.
    /// @dev Winners add to treasuryBalance; Losers refunded immediately.
    /// If a refund push fails, credit to claimable[user] instead (pull).
    function finalizeEpoch(
        uint32 epoch,
        bytes32 manifestRoot,
        string calldata manifestCID,
        bytes32[] calldata acceptedIds,
        bytes32[] calldata rejectedIds
    ) external onlyOperator {
        uint256 added = 0;

        // Winners → treasuryBalance
        unchecked {
            for (uint256 i; i < acceptedIds.length; i++) {
                bytes32 id = acceptedIds[i];
                if (!accepted[id]) {
                    accepted[id] = true;
                    uint256 amt = escrow[id];
                    if (amt > 0) {
                        escrow[id] = 0;
                        added += amt;
                    }
                }
            }
        }
        if (added > 0) {
            treasuryBalance += added;
        }

        // Losers → auto refund (push), fallback to claimable on failure
        unchecked {
            for (uint256 j; j < rejectedIds.length; j++) {
                bytes32 id = rejectedIds[j];
                if (!rejected[id]) {
                    rejected[id] = true;

                    uint256 amt = escrow[id];
                    if (amt == 0) {
                        emit RefundPushed(address(0), 0, id, true);
                        continue;
                    }
                    escrow[id] = 0; // effects before interaction

                    address to = bidderOf[id];
                    (bool ok, ) = to.call{value: amt}("");
                    if (!ok) {
                        claimable[to] += amt;
                        emit RefundAvailable(to, amt);
                    }
                    emit RefundPushed(to, amt, id, ok);

                    // Optional cleanup to save storage gas (not required):
                    // delete bidderOf[id];
                }
            }
        }

        // Store manifest pointer (optional redundancy vs ManifestStore)
        manifestRootOf[epoch] = manifestRoot;
        manifestCidOf[epoch] = manifestCID;

        emit Finalized(
            epoch,
            manifestRoot,
            manifestCID,
            added,
            uint32(acceptedIds.length),
            uint32(rejectedIds.length)
        );
    }

    /// @notice Users (losers fallback) pull their refunds if push failed.
    function withdraw() external {
        uint256 amt = claimable[msg.sender];
        require(amt > 0, "nothing");
        claimable[msg.sender] = 0; // effects before interaction
        (bool ok, ) = msg.sender.call{value: amt}("");
        require(ok, "xfer fail");
        emit Withdraw(msg.sender, amt);
    }

    /// @notice Manual credit path if pushing a refund should be skipped.
    function creditRefund(address user, uint256 amount) external onlyOperator {
        require(amount > 0, "zero");
        claimable[user] += amount;
        emit RefundAvailable(user, amount);
    }

    /// @notice Owner-only sweep of winners' funds to any address (e.g., your EOA).
    function sweepTreasury(address payable to, uint256 amount) external onlyOwner {
        require(amount > 0 && amount <= treasuryBalance, "bad amount");
        treasuryBalance -= amount; // effects
        (bool ok, ) = to.call{value: amount}(""); // interaction
        require(ok, "treasury xfer fail");
        emit TreasurySwept(to, amount);
    }

    /// @notice Convenience: sweep entire treasury balance.
    function sweepAllTreasury(address payable to) external onlyOwner {
        uint256 amt = treasuryBalance;
        require(amt > 0, "nothing");
        treasuryBalance = 0;
        (bool ok, ) = to.call{value: amt}("");
        require(ok, "treasury xfer fail");
        emit TreasurySwept(to, amt);
    }
}
