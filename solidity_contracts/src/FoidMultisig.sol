// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title FoidMultisig
/// @notice Lightweight 2-of-3 multisig wallet for FOID board governance.
///         Owns all board contracts (Swipe, SwipeLoreboard, ManifestStore, Treasury).
///         The operator key handles routine ops; this multisig controls parameters and security.
contract FoidMultisig {
    // ── Constants ──

    uint8 public constant REQUIRED = 2;
    uint8 public constant SIGNER_COUNT = 3;

    // ── Types ──

    struct Transaction {
        address to;
        uint256 value;
        bytes data;
        bool executed;
        uint8 confirmCount;
    }

    // ── Events ──

    event Submit(uint256 indexed txId, address indexed signer, address indexed to, uint256 value, bytes data);
    event Confirm(uint256 indexed txId, address indexed signer);
    event Revoke(uint256 indexed txId, address indexed signer);
    event Execute(uint256 indexed txId);

    // ── State ──

    address[3] public signers;
    mapping(address => bool) public isSigner;

    uint256 public txCount;
    mapping(uint256 => Transaction) public transactions;
    mapping(uint256 => mapping(address => bool)) public confirmations;

    // ── Modifiers ──

    modifier onlySigner() {
        require(isSigner[msg.sender], "Multisig: not signer");
        _;
    }

    modifier txExists(uint256 txId) {
        require(txId < txCount, "Multisig: tx does not exist");
        _;
    }

    modifier notExecuted(uint256 txId) {
        require(!transactions[txId].executed, "Multisig: already executed");
        _;
    }

    // ── Constructor ──

    constructor(address[3] memory _signers) {
        for (uint8 i = 0; i < 3; i++) {
            address s = _signers[i];
            require(s != address(0), "Multisig: zero signer");
            require(!isSigner[s], "Multisig: duplicate signer");
            signers[i] = s;
            isSigner[s] = true;
        }
    }

    // ── Core Functions ──

    /// @notice Propose a new transaction. Only signers can submit.
    /// @param to Target contract address
    /// @param value ETH value to send
    /// @param data Encoded function call (e.g., abi.encodeWithSignature("setFee(uint256)", 123))
    /// @return txId The transaction ID
    function submitTransaction(
        address to,
        uint256 value,
        bytes calldata data
    ) external onlySigner returns (uint256 txId) {
        txId = txCount;

        transactions[txId] = Transaction({
            to: to,
            value: value,
            data: data,
            executed: false,
            confirmCount: 1 // Submitter auto-confirms
        });

        confirmations[txId][msg.sender] = true;

        unchecked { txCount++; }

        emit Submit(txId, msg.sender, to, value, data);
        emit Confirm(txId, msg.sender);
    }

    /// @notice Confirm a pending transaction. Requires signer who hasn't already confirmed.
    function confirmTransaction(uint256 txId)
        external
        onlySigner
        txExists(txId)
        notExecuted(txId)
    {
        require(!confirmations[txId][msg.sender], "Multisig: already confirmed");

        confirmations[txId][msg.sender] = true;
        transactions[txId].confirmCount++;

        emit Confirm(txId, msg.sender);
    }

    /// @notice Execute a transaction once it has enough confirmations (2 of 3).
    ///         Anyone can trigger execution once threshold is met.
    function executeTransaction(uint256 txId)
        external
        txExists(txId)
        notExecuted(txId)
    {
        Transaction storage t = transactions[txId];
        require(t.confirmCount >= REQUIRED, "Multisig: not enough confirmations");

        t.executed = true;

        (bool success, bytes memory result) = t.to.call{value: t.value}(t.data);
        require(success, _revertReason(result));

        emit Execute(txId);
    }

    /// @notice Revoke a confirmation before execution.
    function revokeConfirmation(uint256 txId)
        external
        onlySigner
        txExists(txId)
        notExecuted(txId)
    {
        require(confirmations[txId][msg.sender], "Multisig: not confirmed");

        confirmations[txId][msg.sender] = false;
        transactions[txId].confirmCount--;

        emit Revoke(txId, msg.sender);
    }

    // ── Views ──

    /// @notice Check if a transaction has enough confirmations to execute.
    function isConfirmed(uint256 txId) external view txExists(txId) returns (bool) {
        return transactions[txId].confirmCount >= REQUIRED;
    }

    /// @notice Get the confirmation count for a transaction.
    function getConfirmationCount(uint256 txId) external view txExists(txId) returns (uint8) {
        return transactions[txId].confirmCount;
    }

    /// @notice Get full transaction data.
    function getTransaction(uint256 txId)
        external
        view
        txExists(txId)
        returns (address to, uint256 value, bytes memory data, bool executed, uint8 confirmCount)
    {
        Transaction storage t = transactions[txId];
        return (t.to, t.value, t.data, t.executed, t.confirmCount);
    }

    /// @notice Check if a signer has confirmed a specific transaction.
    function hasConfirmed(uint256 txId, address signer) external view txExists(txId) returns (bool) {
        return confirmations[txId][signer];
    }

    // ── Receive ETH ──

    receive() external payable {}

    // ── Internal ──

    /// @dev Extract revert reason from failed call, or return generic message.
    function _revertReason(bytes memory data) internal pure returns (string memory) {
        if (data.length < 68) return "Multisig: call failed";

        assembly {
            // Skip length prefix (32 bytes) + Error(string) selector (4 bytes)
            data := add(data, 0x04)
        }
        return abi.decode(data, (string));
    }
}
