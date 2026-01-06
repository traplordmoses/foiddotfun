// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

interface ILoreboardVM {
    struct Rect {
        int32 x;
        int32 y;
        int32 w;
        int32 h;
    }

    struct PlacementInput {
        bytes32 id;
        Rect rect;
        uint256 bidPerCellWei;
    }

    function selectWinners(
        PlacementInput[] calldata base,
        PlacementInput[] calldata candidates
    ) external view returns (bytes32[] memory accepted, bytes32[] memory rejected);
}

contract LoreboardVMWrapper {
    ILoreboardVM public immutable VM;

    constructor(address vm) {
        VM = ILoreboardVM(vm);
    }

    function selectWinners(
        ILoreboardVM.PlacementInput[] calldata base,
        ILoreboardVM.PlacementInput[] calldata candidates
    ) external view returns (bytes32[] memory accepted, bytes32[] memory rejected) {
        return VM.selectWinners(base, candidates);
    }
}
