// GeoCastPool — minimal ABI for the methods we actually call from the frontend.
// Mirrors apps/api/contracts/src/GeoCastPool.sol. Re-generate by hand if the
// signatures shift; we don't ingest the Foundry artifact JSON to keep the
// bundle small and types tight (wagmi reads these `as const`).

export const geoCastPoolAbi = [
  {
    type: "function",
    name: "BET",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "rounds",
    stateMutability: "view",
    inputs: [{ name: "roundId", type: "uint64" }],
    outputs: [
      { name: "opensAt", type: "uint64" },
      { name: "closesAt", type: "uint64" },
      { name: "revealsAt", type: "uint64" },
      { name: "resolvedAt", type: "uint64" },
      { name: "pool", type: "uint128" },
      { name: "merkleRoot", type: "bytes32" },
      { name: "answerLat", type: "int32" },
      { name: "answerLng", type: "int32" },
      { name: "rakeTaken", type: "bool" },
    ],
  },
  {
    type: "function",
    name: "commits",
    stateMutability: "view",
    inputs: [
      { name: "roundId", type: "uint64" },
      { name: "player", type: "address" },
    ],
    outputs: [{ type: "bytes32" }],
  },
  {
    type: "function",
    name: "claimed",
    stateMutability: "view",
    inputs: [
      { name: "roundId", type: "uint64" },
      { name: "player", type: "address" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "commitBet",
    stateMutability: "nonpayable",
    inputs: [
      { name: "roundId", type: "uint64" },
      { name: "commit", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "reveal",
    stateMutability: "nonpayable",
    inputs: [
      { name: "roundId", type: "uint64" },
      { name: "lat", type: "int32" },
      { name: "lng", type: "int32" },
      { name: "salt", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "claim",
    stateMutability: "nonpayable",
    inputs: [
      { name: "roundId", type: "uint64" },
      { name: "amount", type: "uint128" },
      { name: "proof", type: "bytes32[]" },
    ],
    outputs: [],
  },
  {
    type: "event",
    name: "Committed",
    inputs: [
      { name: "roundId", type: "uint64", indexed: true },
      { name: "player", type: "address", indexed: true },
      { name: "commit", type: "bytes32", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Revealed",
    inputs: [
      { name: "roundId", type: "uint64", indexed: true },
      { name: "player", type: "address", indexed: true },
      { name: "lat", type: "int32", indexed: false },
      { name: "lng", type: "int32", indexed: false },
    ],
  },
] as const;

// ERC-20 — just the slice we need (allowance read + approve write).
export const erc20Abi = [
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "value", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
] as const;

// MockUSDC — testnet faucet ABI. The `mint(to, amount)` function is public
// (anyone can mint themselves test USDC). On Base mainnet we use Circle's
// real USDC contract, which has no public mint — the testnet hooks check
// the chain before calling this.
export const mockUsdcAbi = [
  ...erc20Abi,
  {
    type: "function",
    name: "mint",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
] as const;

// GeoCastPool admin-side ABI extension — round lifecycle. Kept separate
// from the player-side ABI so non-admin pages don't pull it in.
export const geoCastPoolAdminAbi = [
  {
    type: "function",
    name: "createRound",
    stateMutability: "nonpayable",
    inputs: [
      { name: "roundId", type: "uint64" },
      { name: "opensAt", type: "uint64" },
      { name: "closesAt", type: "uint64" },
      { name: "revealsAt", type: "uint64" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "resolve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "roundId", type: "uint64" },
      { name: "answerLat", type: "int32" },
      { name: "answerLng", type: "int32" },
      { name: "merkleRoot", type: "bytes32" },
    ],
    outputs: [],
  },
] as const;
