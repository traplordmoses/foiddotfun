// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import {FOID20Factory} from "../src/FOID20Factory.sol";
import {FOID20} from "../src/FOID20.sol";

/**
 * Usage:
 *  export FACTORY=0xYourFactory
 *  export FLUENT_RPC=https://rpc.testnet.fluent.xyz
 *  export PRIVATE_KEY=...                       # pk of the broadcaster/creator
 *  # optional:
 *  # export FOID_NAME="Foid Token"
 *  # export FOID_SYMBOL="FOID"
 *  # export FOID_DECIMALS=18
 *  # export FOID_CAP=100000000000000000000000000   (100M * 1e18)
 *  # export FOID_MINT_TO=0xYourEOA
 *  # export FOID_INITIAL_MINT=0
 *
 *  forge script script/GrindAndDeployF01D.s.sol:GrindAndDeploy \
 *    --rpc-url $FLUENT_RPC --private-key $PRIVATE_KEY --broadcast
 */
contract GrindAndDeploy is Script {
    // read from env (with reasonable defaults)
    string  name_ = vm.envOr("FOID_NAME", string("Foid Token"));
    string  symbol_ = vm.envOr("FOID_SYMBOL", string("FOID"));
    uint8   decimals_ = uint8(vm.envOr("FOID_DECIMALS", uint256(18)));
    uint256 cap_ = vm.envOr("FOID_CAP", uint256(100_000_000 ether));
    uint256 initialMintAmount_ = vm.envOr("FOID_INITIAL_MINT", uint256(0));

    function run() external {
        address factory = vm.envAddress("FACTORY");
        // creator/broadcaster is derived from PRIVATE_KEY
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address creator = vm.addr(pk);

        // FOID_MINT_TO defaults to creator if not set
        address initialMintTo_ = vm.envOr("FOID_MINT_TO", creator);

        // Build init code to hash (must match deploy params exactly)
        bytes memory bytecode = abi.encodePacked(
            type(FOID20).creationCode,
            abi.encode(name_, symbol_, decimals_, cap_, creator, initialMintTo_, initialMintAmount_)
        );
        bytes32 initHash = keccak256(bytecode);

        // grind userSalt so predicted ends with 0xf01d
        bytes32 userSalt;
        bytes32 namespaced;
        address predicted;
        for (uint256 i; ; i++) {
            userSalt = bytes32(i);
            namespaced = keccak256(abi.encode(creator, userSalt));
            bytes32 digest = keccak256(abi.encodePacked(bytes1(0xff), factory, namespaced, initHash));
            predicted = address(uint160(uint256(digest)));
            if (_endsWithF01D(predicted)) break;
        }

        console2.log("creator         :", creator);
        console2.log("factory         :", factory);
        console2.log("userSalt (hex)  :", vm.toString(userSalt));
        console2.log("predicted token :", predicted);
        require(_endsWithF01D(predicted), "vanity not matched");

        vm.startBroadcast(pk);
        address tok = FOID20Factory(factory).deployToken(
            name_, symbol_, decimals_, cap_, initialMintTo_, initialMintAmount_, userSalt
        );
        vm.stopBroadcast();

        console2.log("deployed token  :", tok);
        require(tok == predicted, "address mismatch");
    }

    function _endsWithF01D(address a) internal pure returns (bool) {
        // last 2 bytes (big-endian) equal 0xf01d
        return uint16(uint160(a)) == 0xf01d;
    }
}
