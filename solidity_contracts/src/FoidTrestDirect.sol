// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FoidTrest} from "./FoidTrest.sol";

/// @title FoidTrestDirect
/// @notice Path 1: Pay a flat fee to permanently place content on the FoidTrest gallery.
///         No voting required — payment = placement.
contract FoidTrestDirect {
    event DirectPlacement(
        uint256 indexed entryId,
        address indexed creator,
        uint256 feePaid
    );
    event PlacementFeeChanged(uint256 oldFee, uint256 newFee);
    event FeeRecipientChanged(address indexed oldRecipient, address indexed newRecipient);
    event OwnerChanged(address indexed oldOwner, address indexed newOwner);

    FoidTrest public immutable foidTrest;
    address public owner;
    address public feeRecipient;
    uint256 public placementFeeWei;

    modifier onlyOwner() {
        require(msg.sender == owner, "FoidTrestDirect: not owner");
        _;
    }

    /// @param _foidTrest The FoidTrest gallery contract.
    /// @param _feeRecipient Address that receives placement fees.
    /// @param _placementFeeWei Initial fee in wei (~$3 USD equivalent).
    constructor(
        address _foidTrest,
        address _feeRecipient,
        uint256 _placementFeeWei
    ) {
        require(_foidTrest != address(0), "FoidTrestDirect: zero trest");
        require(_feeRecipient != address(0), "FoidTrestDirect: zero recipient");

        foidTrest = FoidTrest(_foidTrest);
        owner = msg.sender;
        feeRecipient = _feeRecipient;
        placementFeeWei = _placementFeeWei;
    }

    /// @notice Place content directly on the FoidTrest by paying the flat fee.
    /// @param ipfsCid IPFS CID of the image/content.
    /// @param title Title for the gallery entry.
    /// @param description Description for the gallery entry.
    /// @return entryId The ID of the new FoidTrest entry.
    function placeDirect(
        string calldata ipfsCid,
        string calldata title,
        string calldata description
    ) external payable returns (uint256 entryId) {
        require(msg.value >= placementFeeWei, "FoidTrestDirect: insufficient fee");

        // Send fee to recipient
        (bool ok, ) = feeRecipient.call{value: msg.value}("");
        require(ok, "FoidTrestDirect: fee transfer failed");

        // Add entry to gallery via FoidTrest
        entryId = foidTrest.addEntry(
            msg.sender,
            ipfsCid,
            title,
            description,
            0,  // path = direct
            0   // no duel
        );

        emit DirectPlacement(entryId, msg.sender, msg.value);
    }

    /// @notice Update the placement fee. Owner only.
    function setPlacementFee(uint256 newFee) external onlyOwner {
        uint256 old = placementFeeWei;
        placementFeeWei = newFee;
        emit PlacementFeeChanged(old, newFee);
    }

    /// @notice Update the fee recipient. Owner only.
    function setFeeRecipient(address newRecipient) external onlyOwner {
        require(newRecipient != address(0), "FoidTrestDirect: zero address");
        address old = feeRecipient;
        feeRecipient = newRecipient;
        emit FeeRecipientChanged(old, newRecipient);
    }

    /// @notice Transfer ownership.
    function setOwner(address newOwner) external onlyOwner {
        require(newOwner != address(0), "FoidTrestDirect: zero address");
        address old = owner;
        owner = newOwner;
        emit OwnerChanged(old, newOwner);
    }
}
