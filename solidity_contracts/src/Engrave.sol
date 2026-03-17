// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title Engrave
 * @notice Lets Gallery (FoidTrest) entry creators add a permanent on-chain
 *         engraving — like signing a yearbook with a Sharpie.
 *
 *         One engraving per entry. Only the original creator can engrave.
 *         140 chars max. Immutable once written.
 *
 *         This contract reads the Gallery to verify creator ownership.
 *         No NFTs, no tokens — just on-chain text storage.
 */

interface IFoidTrest {
    /// @notice Returns the creator address for a gallery entry
    function getEntry(uint256 id) external view returns (
        address creator,
        string memory ipfsCid,
        uint256 placedAt,
        bool visible
    );
}

contract Engrave {
    IFoidTrest public immutable gallery;

    /// @notice entryId => engraving text
    mapping(uint256 => string) public engravings;

    /// @notice entryId => whether it has been engraved
    mapping(uint256 => bool) public isEngraved;

    /// @notice entryId => engraver address (for verification)
    mapping(uint256 => address) public engravedBy;

    /// @notice entryId => timestamp of engraving
    mapping(uint256 => uint256) public engravedAt;

    event Engraved(
        uint256 indexed entryId,
        address indexed creator,
        string message,
        uint256 timestamp
    );

    error AlreadyEngraved(uint256 entryId);
    error NotCreator(uint256 entryId, address caller, address creator);
    error MessageTooLong(uint256 length, uint256 maxLength);
    error EmptyMessage();

    uint256 public constant MAX_LENGTH = 140;

    constructor(address _gallery) {
        gallery = IFoidTrest(_gallery);
    }

    /**
     * @notice Engrave a message on your Gallery entry. Permanent. One shot.
     * @param entryId The Gallery entry ID you created
     * @param message Your message (max 140 chars, UTF-8)
     */
    function engrave(uint256 entryId, string calldata message) external {
        // Check not already engraved
        if (isEngraved[entryId]) revert AlreadyEngraved(entryId);

        // Check message length
        uint256 len = bytes(message).length;
        if (len == 0) revert EmptyMessage();
        if (len > MAX_LENGTH) revert MessageTooLong(len, MAX_LENGTH);

        // Verify caller is the creator of this Gallery entry
        (address creator, , , ) = gallery.getEntry(entryId);
        if (msg.sender != creator) revert NotCreator(entryId, msg.sender, creator);

        // Store the engraving — permanent, immutable
        engravings[entryId] = message;
        isEngraved[entryId] = true;
        engravedBy[entryId] = msg.sender;
        engravedAt[entryId] = block.timestamp;

        emit Engraved(entryId, msg.sender, message, block.timestamp);
    }

    /**
     * @notice Read an engraving for a Gallery entry
     * @return message The engraving text (empty string if not engraved)
     */
    function getEngraving(uint256 entryId) external view returns (string memory message) {
        return engravings[entryId];
    }

    /**
     * @notice Batch read engravings for multiple entries
     * @return messages Array of engraving texts
     */
    function getEngravings(uint256[] calldata entryIds) external view returns (string[] memory messages) {
        messages = new string[](entryIds.length);
        for (uint256 i = 0; i < entryIds.length; i++) {
            messages[i] = engravings[entryIds[i]];
        }
    }
}
