// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title FoidTrest
/// @notice Permanent on-chain gallery. Every entry is immutable once placed.
///         Two authorized entry points feed into this contract:
///         1. FoidTrestDirect (pay flat fee)
///         2. DuelArena (win a duel)
contract FoidTrest {
    struct TrestEntry {
        uint256 id;
        address creator;
        string ipfsCid;
        string title;
        string description;
        uint64 placedAt;
        uint8 path;        // 0 = direct, 1 = duel
        uint256 duelId;    // 0 if direct placement
        bool visible;      // admin can hide (not delete) for moderation
    }

    event EntryPlaced(
        uint256 indexed id,
        address indexed creator,
        uint8 path,
        string ipfsCid
    );
    event MetadataUpdated(uint256 indexed id, string title, string description);
    event VisibilityChanged(uint256 indexed id, bool visible);
    event EntryPointAuthorized(address indexed entryPoint);
    event EntryPointRevoked(address indexed entryPoint);
    event OwnerChanged(address indexed oldOwner, address indexed newOwner);

    address public owner;
    uint256 public entryCount;

    mapping(uint256 => TrestEntry) public entries;
    mapping(address => bool) public authorizedEntryPoints;

    modifier onlyOwner() {
        require(msg.sender == owner, "FoidTrest: not owner");
        _;
    }

    modifier onlyEntryPoint() {
        require(authorizedEntryPoints[msg.sender], "FoidTrest: unauthorized entry point");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    /// @notice Authorize a contract to add entries (e.g., FoidTrestDirect, DuelArena).
    function authorizeEntryPoint(address entryPoint) external onlyOwner {
        require(entryPoint != address(0), "FoidTrest: zero address");
        authorizedEntryPoints[entryPoint] = true;
        emit EntryPointAuthorized(entryPoint);
    }

    /// @notice Revoke an entry point's authorization.
    function revokeEntryPoint(address entryPoint) external onlyOwner {
        authorizedEntryPoints[entryPoint] = false;
        emit EntryPointRevoked(entryPoint);
    }

    /// @notice Add an entry to the gallery. Only callable by authorized entry points.
    /// @param creator The address that created the content.
    /// @param ipfsCid IPFS CID of the content.
    /// @param title Title of the entry.
    /// @param description Description of the entry.
    /// @param path 0 for direct placement, 1 for duel winner.
    /// @param duelId Duel ID if path=1, 0 otherwise.
    /// @return entryId The ID of the newly created entry.
    function addEntry(
        address creator,
        string calldata ipfsCid,
        string calldata title,
        string calldata description,
        uint8 path,
        uint256 duelId
    ) external onlyEntryPoint returns (uint256 entryId) {
        require(bytes(ipfsCid).length > 0, "FoidTrest: empty CID");
        require(path <= 1, "FoidTrest: invalid path");

        entryId = entryCount;
        entries[entryId] = TrestEntry({
            id: entryId,
            creator: creator,
            ipfsCid: ipfsCid,
            title: title,
            description: description,
            placedAt: uint64(block.timestamp),
            path: path,
            duelId: duelId,
            visible: true
        });

        unchecked { entryCount++; }

        emit EntryPlaced(entryId, creator, path, ipfsCid);
    }

    /// @notice Update metadata for an entry. Only the creator can call this.
    /// @dev Used by duel winners to add title/description after winning.
    function setMetadata(
        uint256 entryId,
        string calldata title,
        string calldata description
    ) external {
        require(entryId < entryCount, "FoidTrest: invalid entry");
        TrestEntry storage entry = entries[entryId];
        require(msg.sender == entry.creator, "FoidTrest: not creator");

        entry.title = title;
        entry.description = description;

        emit MetadataUpdated(entryId, title, description);
    }

    /// @notice Admin can toggle visibility for moderation (content is never deleted).
    function setVisibility(uint256 entryId, bool visible) external onlyOwner {
        require(entryId < entryCount, "FoidTrest: invalid entry");
        entries[entryId].visible = visible;
        emit VisibilityChanged(entryId, visible);
    }

    /// @notice Transfer ownership.
    function setOwner(address newOwner) external onlyOwner {
        require(newOwner != address(0), "FoidTrest: zero address");
        address old = owner;
        owner = newOwner;
        emit OwnerChanged(old, newOwner);
    }

    /// @notice Get an entry by ID.
    function getEntry(uint256 entryId) external view returns (TrestEntry memory) {
        require(entryId < entryCount, "FoidTrest: invalid entry");
        return entries[entryId];
    }
}
