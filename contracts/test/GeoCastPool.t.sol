// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {GeoCastPool} from "../src/GeoCastPool.sol";
import {MockUSDC} from "../src/MockUSDC.sol";
import {Merkle} from "./util/Merkle.sol";

contract GeoCastPoolTest is Test {
    GeoCastPool pool;
    MockUSDC usdc;

    address admin = address(0xA1);
    address treasury = address(0xBEEF);
    address alice = address(0x4);
    address bob = address(0x5);
    address carol = address(0x6);

    uint64 constant ROUND_ID = 1;
    uint64 OPENS = 1_000;
    uint64 CLOSES = 2_000;
    uint64 REVEALS = 3_000;

    // Lisbon answer for the test: 38.72N, -9.14W → fixed-point ×1e6.
    int32 constant ANSWER_LAT = 38_720_000;
    int32 constant ANSWER_LNG = -9_140_000;

    function setUp() public {
        usdc = new MockUSDC();
        pool = new GeoCastPool(usdc, treasury, admin);

        // Each player gets 100 USDC.
        usdc.mint(alice, 100e6);
        usdc.mint(bob, 100e6);
        usdc.mint(carol, 100e6);

        vm.warp(OPENS - 100); // before opensAt
        vm.prank(admin);
        pool.createRound(ROUND_ID, OPENS, CLOSES, REVEALS);
    }

    function _approveAndCommit(address player, int32 lat, int32 lng, bytes32 salt)
        internal
        returns (bytes32 commit)
    {
        commit = keccak256(abi.encodePacked(player, lat, lng, salt));
        vm.startPrank(player);
        usdc.approve(address(pool), pool.BET());
        pool.commitBet(ROUND_ID, commit);
        vm.stopPrank();
    }

    // ------------------------------------------------------------------ //
    // Happy path: 3 players commit, all reveal, resolver posts answer,   //
    // closest gets biggest share, rake hits treasury, everyone claims.   //
    // ------------------------------------------------------------------ //
    function test_FullRoundEndToEnd() public {
        // ---- commit phase ----
        vm.warp(OPENS + 1);

        // Alice picks Lisbon-ish (0.5° off), Bob picks Madrid (distant by ~500km),
        // Carol picks Tokyo (huge miss).
        bytes32 saltA = bytes32(uint256(0xAA));
        bytes32 saltB = bytes32(uint256(0xBB));
        bytes32 saltC = bytes32(uint256(0xCC));

        _approveAndCommit(alice, 38_500_000, -9_500_000, saltA);
        _approveAndCommit(bob, 40_416_000, -3_703_000, saltB);
        _approveAndCommit(carol, 35_689_000, 139_692_000, saltC);

        assertEq(usdc.balanceOf(address(pool)), 3 * pool.BET());
        (, , , , uint128 poolAmount, , , , ) = pool.rounds(ROUND_ID);
        assertEq(poolAmount, 3 * pool.BET());

        // ---- reveal phase ----
        vm.warp(CLOSES + 1);

        vm.prank(alice); pool.reveal(ROUND_ID, 38_500_000, -9_500_000, saltA);
        vm.prank(bob);   pool.reveal(ROUND_ID, 40_416_000, -3_703_000, saltB);
        vm.prank(carol); pool.reveal(ROUND_ID, 35_689_000, 139_692_000, saltC);

        // ---- resolve phase ----
        vm.warp(REVEALS + 1);

        // Off-chain we computed payouts (after 5% rake): Alice 2_650_000,
        // Bob 200_000, Carol 0 (rounding gave Alice almost everything).
        // The total is 2_850_000 = 3 USDC − 5% rake = 2.85 USDC.
        uint128 alicePay = 2_650_000;
        uint128 bobPay   = 200_000;
        uint128 carolPay = 0; // included as a 0-leaf for completeness

        bytes32[] memory leaves = new bytes32[](3);
        leaves[0] = _leaf(alice, alicePay);
        leaves[1] = _leaf(bob,   bobPay);
        leaves[2] = _leaf(carol, carolPay);

        bytes32 root = Merkle.getRoot(leaves);

        uint256 treasuryBefore = usdc.balanceOf(treasury);
        vm.prank(admin);
        pool.resolve(ROUND_ID, ANSWER_LAT, ANSWER_LNG, root);
        uint256 treasuryAfter = usdc.balanceOf(treasury);

        // 5% of 3 USDC = 150_000 (0.15 USDC).
        assertEq(treasuryAfter - treasuryBefore, 150_000, "rake to treasury");

        // ---- claims ----
        bytes32[] memory proofA = Merkle.getProof(leaves, 0);
        bytes32[] memory proofB = Merkle.getProof(leaves, 1);

        uint256 aliceBefore = usdc.balanceOf(alice);
        vm.prank(alice);
        pool.claim(ROUND_ID, alicePay, proofA);
        assertEq(usdc.balanceOf(alice) - aliceBefore, alicePay, "alice payout");

        uint256 bobBefore = usdc.balanceOf(bob);
        vm.prank(bob);
        pool.claim(ROUND_ID, bobPay, proofB);
        assertEq(usdc.balanceOf(bob) - bobBefore, bobPay, "bob payout");

        // Total drained from pool = rake + payouts = 150k + 2_650k + 200k = 3 USDC.
        assertEq(usdc.balanceOf(address(pool)), 0);
    }

    // ------------------------------------------------------------------ //
    // Anti-cheat: the contract cannot learn anyone's coords until reveal.//
    // ------------------------------------------------------------------ //
    function test_CommitDoesNotRevealCoords() public {
        vm.warp(OPENS + 1);
        bytes32 commit = _approveAndCommit(alice, ANSWER_LAT, ANSWER_LNG, bytes32(uint256(1)));
        // The on-chain state only has the commit hash. No lat/lng.
        assertEq(pool.commits(ROUND_ID, alice), commit);
        assertFalse(pool.revealed(ROUND_ID, alice));
    }

    function test_RevealRejectsWrongSalt() public {
        vm.warp(OPENS + 1);
        _approveAndCommit(alice, ANSWER_LAT, ANSWER_LNG, bytes32(uint256(0xCAFE)));

        vm.warp(CLOSES + 1);
        vm.prank(alice);
        vm.expectRevert(GeoCastPool.CommitMismatch.selector);
        pool.reveal(ROUND_ID, ANSWER_LAT, ANSWER_LNG, bytes32(uint256(0xDEAD)));
    }

    function test_ClaimRejectsForgedProof() public {
        // Run the full path, then try to claim with garbage.
        vm.warp(OPENS + 1);
        _approveAndCommit(alice, ANSWER_LAT, ANSWER_LNG, bytes32(uint256(1)));
        vm.warp(CLOSES + 1);
        vm.prank(alice);
        pool.reveal(ROUND_ID, ANSWER_LAT, ANSWER_LNG, bytes32(uint256(1)));
        vm.warp(REVEALS + 1);

        bytes32[] memory leaves = new bytes32[](1);
        leaves[0] = _leaf(alice, 950_000);
        bytes32 root = Merkle.getRoot(leaves);

        vm.prank(admin);
        pool.resolve(ROUND_ID, ANSWER_LAT, ANSWER_LNG, root);

        // Attacker tries to claim Alice's slot to attacker's wallet.
        bytes32[] memory fakeProof = new bytes32[](0);
        vm.prank(bob);
        vm.expectRevert(GeoCastPool.InvalidProof.selector);
        pool.claim(ROUND_ID, 950_000, fakeProof);
    }

    // ------------------------------------------------------------------ //
    // Lifecycle guards                                                    //
    // ------------------------------------------------------------------ //
    function test_CannotCommitBeforeOpen() public {
        vm.warp(OPENS - 1);
        vm.startPrank(alice);
        usdc.approve(address(pool), pool.BET());
        vm.expectRevert(GeoCastPool.CommitWindowClosed.selector);
        pool.commitBet(ROUND_ID, bytes32(uint256(1)));
        vm.stopPrank();
    }

    function test_CannotCommitTwice() public {
        vm.warp(OPENS + 1);
        _approveAndCommit(alice, 1, 1, bytes32(uint256(1)));

        vm.startPrank(alice);
        usdc.approve(address(pool), pool.BET());
        vm.expectRevert(GeoCastPool.AlreadyCommitted.selector);
        pool.commitBet(ROUND_ID, bytes32(uint256(2)));
        vm.stopPrank();
    }

    function test_CannotResolveBeforeRevealWindowEnds() public {
        vm.warp(REVEALS - 1);
        vm.prank(admin);
        vm.expectRevert(GeoCastPool.RevealWindowClosed.selector);
        pool.resolve(ROUND_ID, ANSWER_LAT, ANSWER_LNG, bytes32(uint256(1)));
    }

    function test_OnlyResolverCanResolve() public {
        vm.warp(REVEALS + 1);
        vm.prank(bob);
        vm.expectRevert();
        pool.resolve(ROUND_ID, ANSWER_LAT, ANSWER_LNG, bytes32(uint256(1)));
    }

    function test_CannotClaimTwice() public {
        // Setup: alice commits, reveals, resolver posts a 1-leaf tree.
        vm.warp(OPENS + 1);
        _approveAndCommit(alice, ANSWER_LAT, ANSWER_LNG, bytes32(uint256(1)));
        vm.warp(CLOSES + 1);
        vm.prank(alice);
        pool.reveal(ROUND_ID, ANSWER_LAT, ANSWER_LNG, bytes32(uint256(1)));
        vm.warp(REVEALS + 1);

        bytes32[] memory leaves = new bytes32[](1);
        leaves[0] = _leaf(alice, 950_000);
        bytes32 root = Merkle.getRoot(leaves);

        vm.prank(admin);
        pool.resolve(ROUND_ID, ANSWER_LAT, ANSWER_LNG, root);

        bytes32[] memory emptyProof = new bytes32[](0);

        vm.prank(alice);
        pool.claim(ROUND_ID, 950_000, emptyProof);

        vm.prank(alice);
        vm.expectRevert(GeoCastPool.AlreadyClaimed.selector);
        pool.claim(ROUND_ID, 950_000, emptyProof);
    }

    function _leaf(address player, uint128 amount) internal pure returns (bytes32) {
        return keccak256(bytes.concat(keccak256(abi.encode(player, amount))));
    }
}
