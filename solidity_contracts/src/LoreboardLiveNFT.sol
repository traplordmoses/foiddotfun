// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";

/// EIP-4906
interface IERC4906 is IERC165 {
    event MetadataUpdate(uint256 _tokenId);
    event BatchMetadataUpdate(uint256 _fromTokenId, uint256 _toTokenId);
}

interface ILoreboardTreasury {
    function manifestRootOf(uint256 epoch) external view returns (bytes32);
}

interface ILoreboardManifestStore {
    function latest() external view returns (uint256 epoch, bytes32 root, string memory cid);
}

/// @title LoreboardLiveNFT
/// @notice Single 1/1 Loreboard ERC-721 (tokenId 0) whose metadata auto-updates to the latest
/// finalized epoch. Anyone can call syncLatest() to advance; it verifies against Treasury
/// finality and root matching. Emits ERC-4906 MetadataUpdate on each advance.
contract LoreboardLiveNFT is ERC721, IERC4906 {
    using Strings for uint256;

    uint256 public constant TOKEN_ID = 0;

    ILoreboardTreasury public immutable treasury;
    ILoreboardManifestStore public immutable manifestStore;

    uint256 public liveEpoch;
    bytes32 public liveManifestRoot;
    string public liveManifestCID;

    error NotMinted();
    error BadTokenId(uint256 tokenId);
    error EpochNotFinalized(uint256 epoch);
    error RootMismatch(bytes32 treasuryRoot, bytes32 storeRoot);

    /// @notice Deploy the live NFT and mint tokenId 0 to the initial owner.
    /// @param treasury_ Address of the deployed LoreBoardTreasury.
    /// @param manifestStore_ Address of the deployed LoreBoardManifestStore.
    /// @param initialOwner_ Address that receives the minted 1/1 NFT.
    constructor(
        address treasury_,
        address manifestStore_,
        address initialOwner_
    ) ERC721("Loreboard", "LORE") {
        require(treasury_ != address(0), "treasury=0");
        require(manifestStore_ != address(0), "manifestStore=0");
        require(initialOwner_ != address(0), "owner=0");

        treasury = ILoreboardTreasury(treasury_);
        manifestStore = ILoreboardManifestStore(manifestStore_);

        _safeMint(initialOwner_, TOKEN_ID);
    }

    /// @notice ERC-165 introspection including ERC-4906 metadata update interface.
    /// @param interfaceId Interface identifier to check.
    /// @return True if the interface is supported.
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, IERC165)
        returns (bool)
    {
        return interfaceId == type(IERC4906).interfaceId || super.supportsInterface(interfaceId);
    }

    /// @notice Permissionless sync to ManifestStore.latest(), verified against Treasury finality.
    /// Emits ERC-4906 MetadataUpdate(0) when liveEpoch advances.
    function syncLatest() external {
        (uint256 epoch, bytes32 root, string memory cid) = manifestStore.latest();

        bytes32 treasuryRoot = treasury.manifestRootOf(epoch);
        if (treasuryRoot == bytes32(0)) revert EpochNotFinalized(epoch);
        if (treasuryRoot != root) revert RootMismatch(treasuryRoot, root);

        // Only update when epoch advances
        if (epoch > liveEpoch) {
            liveEpoch = epoch;
            liveManifestRoot = root;
            liveManifestCID = cid;

            emit MetadataUpdate(TOKEN_ID);
        }
    }

    /// @notice Returns on-chain JSON metadata with an embedded SVG for the live NFT.
    /// @param tokenId Must be TOKEN_ID (0).
    /// @return Base64-encoded data URI containing JSON metadata.
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        if (tokenId != TOKEN_ID) revert BadTokenId(tokenId);

        // OZ v5: no _exists(); use _ownerOf(tokenId) != address(0)
        if (_ownerOf(TOKEN_ID) == address(0)) revert NotMinted();

        string memory name = string(abi.encodePacked("Loreboard Live 1/1 (Epoch ", liveEpoch.toString(), ")"));
        string memory description =
            "A single live Loreboard NFT. Metadata updates at epoch finalization and points to the canonical manifest on IPFS, verified against on-chain settlement.";

        string memory image = _imageDataURI(liveEpoch, liveManifestRoot);

        bytes memory json = abi.encodePacked(
            "{",
                "\"name\":\"", name, "\",",
                "\"description\":\"", description, "\",",
                "\"image\":\"", image, "\",",
                "\"attributes\":[",
                    "{\"trait_type\":\"epoch\",\"value\":", liveEpoch.toString(), "}",
                "],",
                "\"properties\":{",
                    "\"epoch\":", liveEpoch.toString(), ",",
                    "\"manifest_cid\":\"", liveManifestCID, "\",",
                    "\"manifest_root\":\"", _toHex(liveManifestRoot), "\",",
                    "\"treasury\":\"", _toHex(address(treasury)), "\",",
                    "\"manifest_store\":\"", _toHex(address(manifestStore)), "\"",
                "}",
            "}"
        );

        return string(
            abi.encodePacked(
                "data:application/json;base64,",
                Base64.encode(json)
            )
        );
    }

    function _imageDataURI(uint256 epoch, bytes32 root) internal pure returns (string memory) {
        string memory svg = string(
            abi.encodePacked(
                "<svg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024'>",
                    "<rect width='100%' height='100%' fill='black'/>",
                    "<text x='64' y='128' fill='white' font-size='56' font-family='monospace'>LOREBOARD LIVE 1/1</text>",
                    "<text x='64' y='220' fill='white' font-size='36' font-family='monospace'>EPOCH: ", epoch.toString(), "</text>",
                    "<text x='64' y='280' fill='white' font-size='20' font-family='monospace'>ROOT: ", _toHex(root), "</text>",
                    "<text x='64' y='360' fill='white' font-size='20' font-family='monospace'>Render via manifest_cid</text>",
                "</svg>"
            )
        );

        return string(
            abi.encodePacked(
                "data:image/svg+xml;base64,",
                Base64.encode(bytes(svg))
            )
        );
    }

    function _toHex(bytes32 x) internal pure returns (string memory) {
        bytes memory s = new bytes(66);
        s[0] = "0";
        s[1] = "x";
        bytes16 hexSymbols = "0123456789abcdef";
        for (uint256 i = 0; i < 32; i++) {
            uint8 b = uint8(x[i]);
            s[2 + i * 2] = hexSymbols[b >> 4];
            s[3 + i * 2] = hexSymbols[b & 0x0f];
        }
        return string(s);
    }

    function _toHex(address a) internal pure returns (string memory) {
        bytes20 x = bytes20(a);
        bytes memory s = new bytes(42);
        s[0] = "0";
        s[1] = "x";
        bytes16 hexSymbols = "0123456789abcdef";
        for (uint256 i = 0; i < 20; i++) {
            uint8 b = uint8(x[i]);
            s[2 + i * 2] = hexSymbols[b >> 4];
            s[3 + i * 2] = hexSymbols[b & 0x0f];
        }
        return string(s);
    }
}
