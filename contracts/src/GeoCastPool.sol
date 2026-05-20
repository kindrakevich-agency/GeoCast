// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

/// @title GeoCastPool — commit-reveal prediction pool on Base L2
/// @notice Holds USDC bets for a sequence of geo-prediction rounds. Anti-cheat
///         by construction: players commit `hash(addr, lat, lng, salt)`
///         during the open phase, reveal `(lat, lng, salt)` during the
///         reveal phase, and only then does the resolver post the answer +
///         a Merkle root of `(addr, payout)`. Players claim by proof.
///
/// @dev    Designed for Base L2 with native USDC (6 decimals). The fixed
///         bet size (1 USDC) keeps the formula + UX simple in v1; future
///         versions can lift this to variable-stake with payout = stake *
///         (1/(1+d)) / Σ(stake/(1+d)).
contract GeoCastPool is AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // ---------- Roles ----------
    bytes32 public constant RESOLVER_ROLE = keccak256("RESOLVER_ROLE");

    // ---------- Constants ----------
    /// @notice Fixed bet size — 1 USDC (6 decimals).
    uint256 public constant BET = 1e6;

    /// @notice Rake taken from each resolved round's pool, in basis points.
    ///         500 = 5%. Constant for v1; change requires a redeploy.
    uint256 public constant RAKE_BPS = 500;

    /// @notice Coordinate fixed-point scale. We pack lat/lng as int32
    ///         degrees × 1e6 (so lat=38.72 → 38_720_000). Range is
    ///         [-90e6, 90e6] for lat and [-180e6, 180e6] for lng, both
    ///         well inside int32 (-2.1e9 to 2.1e9).
    int32 public constant COORD_SCALE = 1_000_000;

    // ---------- Immutable wiring ----------
    IERC20  public immutable usdc;
    address public immutable treasury;

    // ---------- Per-round state ----------
    struct Round {
        uint64  opensAt;       // unix ts, when commits become valid
        uint64  closesAt;      // commits must arrive before this
        uint64  revealsAt;     // reveals must arrive before this
        uint64  resolvedAt;    // 0 until resolve() runs
        uint128 pool;          // total USDC committed
        bytes32 merkleRoot;    // payouts root, set on resolve
        int32   answerLat;     // scaled coords, set on resolve
        int32   answerLng;
        bool    rakeTaken;     // guard against double-rake
    }

    /// @notice roundId → Round. Round IDs mirror the backend's sequential
    ///         `number` column so off-chain + on-chain stay in lockstep.
    mapping(uint64 => Round) public rounds;

    /// @notice roundId → player → commit hash. Zero means no commit.
    mapping(uint64 => mapping(address => bytes32)) public commits;

    /// @notice roundId → player → revealed flag. Used in the off-chain
    ///         Merkle-root computation to know who's eligible.
    mapping(uint64 => mapping(address => bool)) public revealed;

    /// @notice roundId → player → claimed flag. Prevents double-claims.
    mapping(uint64 => mapping(address => bool)) public claimed;

    // ---------- Events ----------
    event RoundCreated(uint64 indexed roundId, uint64 opensAt, uint64 closesAt, uint64 revealsAt);
    event Committed(uint64 indexed roundId, address indexed player, bytes32 commit);
    event Revealed(uint64 indexed roundId, address indexed player, int32 lat, int32 lng);
    event Resolved(uint64 indexed roundId, int32 answerLat, int32 answerLng, bytes32 merkleRoot, uint256 rake);
    event Claimed(uint64 indexed roundId, address indexed player, uint256 amount);

    // ---------- Errors ----------
    error RoundNotFound();
    error RoundAlreadyExists();
    error CommitWindowClosed();
    error RevealWindowClosed();
    error AlreadyCommitted();
    error CommitMismatch();
    error AlreadyRevealed();
    error NotRevealed();
    error AlreadyResolved();
    error NotResolved();
    error AlreadyClaimed();
    error InvalidProof();
    error InvalidWindow();

    // ---------- Construction ----------
    constructor(IERC20 _usdc, address _treasury, address _admin) {
        require(address(_usdc) != address(0), "usdc=0");
        require(_treasury != address(0), "treasury=0");
        require(_admin != address(0), "admin=0");
        usdc = _usdc;
        treasury = _treasury;
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(RESOLVER_ROLE, _admin);
    }

    // ---------- Admin: round lifecycle ----------

    /// @notice Open a new round. The backend's app:rounds:tick cron will call
    ///         this when the wall-clock crosses opens_at — same mechanism
    ///         that handled scheduled→open in the credit-only version.
    function createRound(
        uint64 roundId,
        uint64 opensAt,
        uint64 closesAt,
        uint64 revealsAt
    ) external onlyRole(RESOLVER_ROLE) {
        if (rounds[roundId].opensAt != 0) revert RoundAlreadyExists();
        if (closesAt <= opensAt) revert InvalidWindow();
        if (revealsAt <= closesAt) revert InvalidWindow();
        rounds[roundId].opensAt = opensAt;
        rounds[roundId].closesAt = closesAt;
        rounds[roundId].revealsAt = revealsAt;
        emit RoundCreated(roundId, opensAt, closesAt, revealsAt);
    }

    /// @notice Post the answer + Merkle root after the reveal window.
    ///         Takes the 5% rake atomically — players can claim immediately.
    ///
    /// @dev    The off-chain settler reads Revealed events, computes
    ///         distances + payouts, builds a tree of `(address, amount)`
    ///         leaves, and passes the root here. Total of `amount` across
    ///         all leaves MUST equal `pool − rake` exactly (the off-chain
    ///         code enforces this).
    function resolve(
        uint64 roundId,
        int32 answerLat,
        int32 answerLng,
        bytes32 merkleRoot
    ) external onlyRole(RESOLVER_ROLE) {
        Round storage r = rounds[roundId];
        if (r.opensAt == 0) revert RoundNotFound();
        if (block.timestamp < r.revealsAt) revert RevealWindowClosed();
        if (r.merkleRoot != 0) revert AlreadyResolved();

        r.merkleRoot = merkleRoot;
        r.answerLat = answerLat;
        r.answerLng = answerLng;
        r.resolvedAt = uint64(block.timestamp);

        uint256 rake = (uint256(r.pool) * RAKE_BPS) / 10_000;
        r.rakeTaken = true;
        if (rake > 0) {
            usdc.safeTransfer(treasury, rake);
        }
        emit Resolved(roundId, answerLat, answerLng, merkleRoot, rake);
    }

    // ---------- Player: commit / reveal / claim ----------

    /// @notice Lock in your bet. Sends `BET` USDC to the contract and stores
    ///         `commit = keccak256(addr, lat, lng, salt)`. The contract
    ///         never learns your coords until you reveal.
    function commitBet(uint64 roundId, bytes32 commit) external whenNotPaused {
        Round storage r = rounds[roundId];
        if (r.opensAt == 0) revert RoundNotFound();
        if (block.timestamp < r.opensAt || block.timestamp >= r.closesAt) {
            revert CommitWindowClosed();
        }
        if (commits[roundId][msg.sender] != 0) revert AlreadyCommitted();

        commits[roundId][msg.sender] = commit;
        r.pool += uint128(BET);

        usdc.safeTransferFrom(msg.sender, address(this), BET);
        emit Committed(roundId, msg.sender, commit);
    }

    /// @notice Reveal your pin during the reveal window. The contract
    ///         verifies the commit matches; the resolver reads Revealed
    ///         events to build the payout Merkle tree.
    function reveal(
        uint64 roundId,
        int32 lat,
        int32 lng,
        bytes32 salt
    ) external {
        Round storage r = rounds[roundId];
        if (r.opensAt == 0) revert RoundNotFound();
        if (block.timestamp < r.closesAt || block.timestamp >= r.revealsAt) {
            revert RevealWindowClosed();
        }
        if (revealed[roundId][msg.sender]) revert AlreadyRevealed();

        bytes32 expected = keccak256(abi.encodePacked(msg.sender, lat, lng, salt));
        if (commits[roundId][msg.sender] != expected) revert CommitMismatch();

        revealed[roundId][msg.sender] = true;
        emit Revealed(roundId, msg.sender, lat, lng);
    }

    /// @notice Claim your share of the pool after the round resolves.
    ///         `amount` and `proof` are the per-address leaf + Merkle proof
    ///         the off-chain settler published after building the tree.
    function claim(
        uint64 roundId,
        uint128 amount,
        bytes32[] calldata proof
    ) external nonReentrant {
        Round storage r = rounds[roundId];
        if (r.merkleRoot == 0) revert NotResolved();
        if (claimed[roundId][msg.sender]) revert AlreadyClaimed();

        bytes32 leaf = keccak256(bytes.concat(keccak256(abi.encode(msg.sender, amount))));
        if (!MerkleProof.verify(proof, r.merkleRoot, leaf)) revert InvalidProof();

        claimed[roundId][msg.sender] = true;
        usdc.safeTransfer(msg.sender, amount);
        emit Claimed(roundId, msg.sender, amount);
    }

    // ---------- Read helpers ----------

    /// @notice Compute the commit hash a player would submit. Useful for
    ///         testing + as a reference for client implementations.
    function computeCommit(
        address player,
        int32 lat,
        int32 lng,
        bytes32 salt
    ) external pure returns (bytes32) {
        return keccak256(abi.encodePacked(player, lat, lng, salt));
    }

    /// @notice Convenience: leaf encoding the claim() function expects.
    function leafFor(address player, uint128 amount) external pure returns (bytes32) {
        return keccak256(bytes.concat(keccak256(abi.encode(player, amount))));
    }

    // ---------- Admin escape hatches ----------

    /// @notice Pause new commits in case of incident. Reveals + claims keep
    ///         working — players already in the round can't be locked out.
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }
}
