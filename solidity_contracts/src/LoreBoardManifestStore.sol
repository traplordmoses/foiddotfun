// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title LoreBoardManifestStore
/// @notice Minimal on-chain anchor mapping epoch to (manifestRoot, manifestCID).
contract LoreBoardManifestStore {
    /// @notice Emitted when a manifest is anchored for an epoch.
    event ManifestAnchored(uint32 indexed epoch, bytes32 manifestRoot, string manifestCid);
    /// @notice Emitted when the contract owner is transferred.
    event OwnerChanged(address indexed oldOwner, address indexed newOwner);

    address public owner;

    struct Manifest { bytes32 root; string cid; }
    mapping(uint32 => Manifest) public manifestOf; // epoch => manifest

    // NEW: track highest finalized epoch
    uint32 public latestFinalizedEpoch;

    modifier onlyOwner() { require(msg.sender == owner, "not owner"); _; }

    /// @notice Deploy the manifest store with an initial owner.
    /// @param _owner Address that can anchor manifests and transfer ownership.
    constructor(address _owner) {
        require(_owner != address(0), "zero owner");
        owner = _owner;
        emit OwnerChanged(address(0), _owner);
    }

    /// @notice Transfer ownership to a new address.
    /// @param _owner New owner address (must not be zero).
    function setOwner(address _owner) external onlyOwner {
        require(_owner != address(0), "zero owner");
        emit OwnerChanged(owner, _owner);
        owner = _owner;
    }

    /// @notice Anchor a manifest for a given epoch.
    /// Overwrites manifest for that epoch, but never moves latestFinalizedEpoch backwards.
    /// @param epoch Epoch number to anchor the manifest for.
    /// @param root Keccak root hash of the manifest.
    /// @param cid IPFS CID string of the manifest.
    function anchor(uint32 epoch, bytes32 root, string calldata cid) external onlyOwner {
        manifestOf[epoch] = Manifest({root: root, cid: cid});

        if (epoch >= latestFinalizedEpoch) {
            latestFinalizedEpoch = epoch;
        }

        emit ManifestAnchored(epoch, root, cid);
    }

    /// @notice Retrieve the manifest root and CID for a given epoch.
    /// @param epoch Epoch number to query.
    /// @return Manifest root hash.
    /// @return Manifest IPFS CID string.
    function get(uint32 epoch) external view returns (bytes32, string memory) {
        Manifest storage m = manifestOf[epoch];
        return (m.root, m.cid);
    }

    /// @notice View helper: returns the latest epoch + root + CID in one call.
    /// @return epoch The highest finalized epoch number.
    /// @return root Manifest root hash for that epoch.
    /// @return cid Manifest IPFS CID string for that epoch.
    function latest()
        external
        view
        returns (uint32 epoch, bytes32 root, string memory cid)
    {
        epoch = latestFinalizedEpoch;
        Manifest storage m = manifestOf[epoch];
        return (epoch, m.root, m.cid);
    }
}
