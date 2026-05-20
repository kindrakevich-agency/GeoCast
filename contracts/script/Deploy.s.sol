// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {GeoCastPool} from "../src/GeoCastPool.sol";
import {MockUSDC} from "../src/MockUSDC.sol";

/// @notice Deploy script for GeoCastPool.
///   - On Base Sepolia: deploys a MockUSDC + Pool, mints a faucet supply
///     to the deployer for testing.
///   - On Base mainnet: wires up the real USDC at
///     0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913.
///
///   Usage:
///     forge script script/Deploy.s.sol --rpc-url base_sepolia --broadcast
///     forge script script/Deploy.s.sol --rpc-url base --broadcast
contract Deploy is Script {
    address constant BASE_MAINNET_USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;

    function run() external {
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address treasury = vm.envAddress("TREASURY_ADDRESS");
        address admin = vm.envAddress("ADMIN_ADDRESS");

        vm.startBroadcast(pk);

        IERC20 usdc;
        if (block.chainid == 8453) {
            usdc = IERC20(BASE_MAINNET_USDC);
            console2.log("Using real USDC at", BASE_MAINNET_USDC);
        } else {
            MockUSDC mock = new MockUSDC();
            usdc = IERC20(address(mock));
            console2.log("Deployed MockUSDC at", address(mock));
            // Seed the deployer with 10k USDC for testing.
            mock.mint(vm.addr(pk), 10_000e6);
        }

        GeoCastPool pool = new GeoCastPool(usdc, treasury, admin);
        console2.log("Deployed GeoCastPool at", address(pool));
        console2.log("  USDC:", address(usdc));
        console2.log("  treasury:", treasury);
        console2.log("  admin/resolver:", admin);

        vm.stopBroadcast();
    }
}
