// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Minimal on-chain anchor for finalized manifests (epoch ⇒ root, CID).
contract LoreBoardManifestStore {
    event ManifestAnchored(uint32 indexed epoch, bytes32 manifestRoot, string manifestCid);
    event OwnerChanged(address indexed oldOwner, address indexed newOwner);

    address public owner;

    struct Manifest { bytes32 root; string cid; }
    mapping(uint32 => Manifest) public manifestOf; // epoch => manifest

    // NEW: track highest finalized epoch
    uint32 public latestFinalizedEpoch;

    modifier onlyOwner() { require(msg.sender == owner, "not owner"); _; }

    constructor(address _owner) {
        require(_owner != address(0), "zero owner");
        owner = _owner;
        emit OwnerChanged(address(0), _owner);
    }

    function setOwner(address _owner) external onlyOwner {
        require(_owner != address(0), "zero owner");
        emit OwnerChanged(owner, _owner);
        owner = _owner;
    }

    /// @notice Anchor a manifest for a given epoch.
    /// Overwrites manifest for that epoch, but never moves latestFinalizedEpoch backwards.
    function anchor(uint32 epoch, bytes32 root, string calldata cid) external onlyOwner {
        manifestOf[epoch] = Manifest({root: root, cid: cid});

        if (epoch >= latestFinalizedEpoch) {
            latestFinalizedEpoch = epoch;
        }

        emit ManifestAnchored(epoch, root, cid);
    }

    function get(uint32 epoch) external view returns (bytes32, string memory) {
        Manifest storage m = manifestOf[epoch];
        return (m.root, m.cid);
    }

    /// @notice View helper: returns the latest epoch + root + CID in one call.
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
