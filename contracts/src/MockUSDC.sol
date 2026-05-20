// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice Mintable 6-decimal ERC-20 for local testing. Mirrors the real
///         USDC interface enough to drive GeoCastPool tests. NEVER deploy
///         to mainnet — Base mainnet uses the real USDC contract at
///         0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913.
contract MockUSDC is ERC20 {
    constructor() ERC20("Mock USDC", "USDC") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
