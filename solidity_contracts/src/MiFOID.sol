// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";

/// @title MiFOID
/// @notice Soul-bound-style identity NFT. One per wallet.
///         Traits are frozen at mint time: prayer streak, tier, duel entries, trest placements.
///         The 3D visual is an external IPFS asset linked via setTokenURI (owner-only).
///         Holding a MiFOID gives bonus voting weight in duel voting.
contract MiFOID is ERC721 {
    using Strings for uint256;

    struct Traits {
        uint64 mintedAt;
        uint256 mintStreak;       // prayer streak snapshot at mint
        uint256 duelWins;         // incremented by DuelArena
        uint256 trestPlacements;  // incremented by FoidTrest or entry points
    }

    event Minted(uint256 indexed tokenId, address indexed owner);
    event TokenURISet(uint256 indexed tokenId, string ipfsUri);
    event TraitUpdaterAuthorized(address indexed updater);
    event TraitUpdaterRevoked(address indexed updater);
    event OwnerChanged(address indexed oldOwner, address indexed newOwner);

    address public contractOwner;
    uint256 public totalMinted;
    uint256 public mintFee;
    uint256 public mintOpensAt;

    // Prayer mirror for streak reads
    address public prayerMirror;

    // tokenId => traits
    mapping(uint256 => Traits) public traits;
    // tokenId => IPFS URI for the 3D visual
    mapping(uint256 => string) public tokenIPFSUri;
    // wallet => tokenId (for lookup; 0 is valid so we use a separate exists check)
    mapping(address => uint256) public tokenOfOwner;
    mapping(address => bool) public hasMiFOID;
    // Authorized updaters (DuelArena, FoidTrest, etc.)
    mapping(address => bool) public authorizedUpdaters;

    modifier onlyContractOwner() {
        require(msg.sender == contractOwner, "MiFOID: not owner");
        _;
    }

    modifier onlyUpdater() {
        require(authorizedUpdaters[msg.sender], "MiFOID: not authorized updater");
        _;
    }

    constructor(
        address _prayerMirror,
        uint256 _mintFee,
        uint256 _mintOpensAt
    ) ERC721("MiFOID", "MIFOID") {
        require(_prayerMirror != address(0), "MiFOID: zero prayer mirror");
        contractOwner = msg.sender;
        prayerMirror = _prayerMirror;
        mintFee = _mintFee;
        mintOpensAt = _mintOpensAt;
    }

    /// @notice Mint your MiFOID identity NFT. One per wallet. Snapshots your current streak.
    function mint() external payable returns (uint256 tokenId) {
        require(block.timestamp >= mintOpensAt, "MiFOID: minting not open yet");
        require(!hasMiFOID[msg.sender], "MiFOID: already minted");
        require(msg.value >= mintFee, "MiFOID: insufficient fee");

        tokenId = totalMinted;

        // Snapshot prayer streak from mirror
        uint256 streak = _readStreak(msg.sender);

        traits[tokenId] = Traits({
            mintedAt: uint64(block.timestamp),
            mintStreak: streak,
            duelWins: 0,
            trestPlacements: 0
        });

        hasMiFOID[msg.sender] = true;
        tokenOfOwner[msg.sender] = tokenId;

        unchecked { totalMinted++; }

        _safeMint(msg.sender, tokenId);

        // Forward mint fee to contract owner
        if (msg.value > 0) {
            (bool ok, ) = contractOwner.call{value: msg.value}("");
            require(ok, "MiFOID: fee transfer failed");
        }

        emit Minted(tokenId, msg.sender);
    }

    /// @notice Set the IPFS URI for a token's 3D visual. Owner-only.
    ///         The designer creates the Blender render off-chain, uploads to IPFS,
    ///         then the team links it here.
    function setTokenURI(uint256 tokenId, string calldata ipfsUri) external onlyContractOwner {
        require(tokenId < totalMinted, "MiFOID: invalid token");
        tokenIPFSUri[tokenId] = ipfsUri;
        emit TokenURISet(tokenId, ipfsUri);
    }

    /// @notice Returns metadata JSON with on-chain traits + external IPFS image.
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(tokenId < totalMinted, "MiFOID: invalid token");
        require(_ownerOf(tokenId) != address(0), "MiFOID: not minted");

        Traits memory t = traits[tokenId];
        string memory imageUri = bytes(tokenIPFSUri[tokenId]).length > 0
            ? tokenIPFSUri[tokenId]
            : ""; // empty until 3D render is linked

        bytes memory json = abi.encodePacked(
            '{"name":"MiFOID #', tokenId.toString(),
            '","description":"FOID Foundation Identity NFT. One per soul.',
            '","image":"', imageUri,
            '","attributes":[',
                '{"trait_type":"Mint Streak","value":', t.mintStreak.toString(), '},',
                '{"trait_type":"Duel Wins","value":', t.duelWins.toString(), '},',
                '{"trait_type":"Trest Placements","value":', t.trestPlacements.toString(), '},',
                '{"trait_type":"Minted At","display_type":"date","value":', uint256(t.mintedAt).toString(), '}',
            ']}'
        );

        return string(abi.encodePacked(
            "data:application/json;base64,",
            Base64.encode(json)
        ));
    }

    /// @notice Increment duel wins for a token holder. Only authorized updaters.
    function incrementDuelWins(address holder) external onlyUpdater {
        require(hasMiFOID[holder], "MiFOID: no token");
        uint256 tokenId = tokenOfOwner[holder];
        traits[tokenId].duelWins++;
    }

    /// @notice Increment trest placements for a token holder. Only authorized updaters.
    function incrementTrestPlacements(address holder) external onlyUpdater {
        require(hasMiFOID[holder], "MiFOID: no token");
        uint256 tokenId = tokenOfOwner[holder];
        traits[tokenId].trestPlacements++;
    }

    /// @notice Authorize a contract to update traits (DuelArena, FoidTrest).
    function authorizeUpdater(address updater) external onlyContractOwner {
        require(updater != address(0), "MiFOID: zero address");
        authorizedUpdaters[updater] = true;
        emit TraitUpdaterAuthorized(updater);
    }

    /// @notice Revoke updater authorization.
    function revokeUpdater(address updater) external onlyContractOwner {
        authorizedUpdaters[updater] = false;
        emit TraitUpdaterRevoked(updater);
    }

    function setMintFee(uint256 newFee) external onlyContractOwner {
        mintFee = newFee;
    }

    function setMintOpensAt(uint256 _mintOpensAt) external onlyContractOwner {
        mintOpensAt = _mintOpensAt;
    }

    function setOwner(address newOwner) external onlyContractOwner {
        require(newOwner != address(0), "MiFOID: zero address");
        address old = contractOwner;
        contractOwner = newOwner;
        emit OwnerChanged(old, newOwner);
    }

    /// @notice Check if an address holds a MiFOID.
    function holdsToken(address user) external view returns (bool) {
        return hasMiFOID[user];
    }

    /// @notice Get traits for a token.
    function getTraits(uint256 tokenId) external view returns (Traits memory) {
        require(tokenId < totalMinted, "MiFOID: invalid token");
        return traits[tokenId];
    }

    // ── Internal ──

    function _readStreak(address user) internal view returns (uint256) {
        (bool ok, bytes memory data) = prayerMirror.staticcall(
            abi.encodeWithSignature("get(address)", user)
        );
        if (!ok || data.length < 32) return 0;
        (uint256 currentStreak,,) = abi.decode(data, (uint256, uint256, uint256));
        return currentStreak;
    }
}
