# GeoCast contracts

On-chain pool for real-USDC prediction rounds on Base L2. Foundry project.

See [`../docs/game.md`](../docs/game.md) for the full architecture.

## Quick start

```bash
cd contracts
curl -L https://foundry.paradigm.xyz | bash   # if you don't have Foundry
foundryup

# Pull deps (OpenZeppelin + forge-std)
forge install OpenZeppelin/openzeppelin-contracts --no-commit
forge install foundry-rs/forge-std --no-commit

# Build + test
forge build
forge test -vvv
```

## What's here

- `src/GeoCastPool.sol` — main contract. Commit-reveal pool, 5 % rake,
  Merkle-drop claims. ~300 lines.
- `src/MockUSDC.sol` — 6-decimal ERC-20 for testing; **never deploy to mainnet**.
- `test/GeoCastPool.t.sol` — end-to-end happy path + anti-cheat guards +
  lifecycle reverts. 9 cases.
- `test/util/Merkle.sol` — sorted-pair Merkle helper for the tests.
- `script/Deploy.s.sol` — deploys Pool + (on testnet) a MockUSDC faucet.

## Deploy

Required env (put in `contracts/.env`, never commit):

```
BASE_RPC_URL=https://mainnet.base.org
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
BASESCAN_API_KEY=...
DEPLOYER_PRIVATE_KEY=0x...
TREASURY_ADDRESS=0x...   # Gnosis Safe address (raked USDC goes here)
ADMIN_ADDRESS=0x...      # Resolver / pause owner (Safe in prod)
```

```bash
# Testnet
source .env
forge script script/Deploy.s.sol --rpc-url base_sepolia --broadcast --verify

# Mainnet (only after audit)
forge script script/Deploy.s.sol --rpc-url base --broadcast --verify
```

## Contract surface

### Lifecycle (`onlyRole(RESOLVER_ROLE)`)
- `createRound(roundId, opensAt, closesAt, revealsAt)` — open a new round
- `resolve(roundId, lat, lng, merkleRoot)` — post truth + payouts root, takes rake

### Players
- `commitBet(roundId, commitHash)` — lock 1 USDC, hide your coords
- `reveal(roundId, lat, lng, salt)` — open your card during the reveal window
- `claim(roundId, amount, proof)` — withdraw your payout post-resolution

### Read helpers
- `computeCommit(player, lat, lng, salt)` — client-side reference
- `leafFor(player, amount)` — Merkle leaf shape for the settler

## Backend integration

The Symfony API does the heavy off-chain work:

1. **Round creator** — `app:rounds:tick` calls `createRound()` when the
   wall-clock crosses `opensAt`, same way it flips `scheduled → open` today.
2. **Event mirror** — `OnchainEventListener` subscribes to Base RPC, mirrors
   `Committed` / `Revealed` events into MariaDB so the existing UI (heatmap,
   live count, presence) keeps working.
3. **Merkle settler** — `app:rounds:settle` runs after the reveal window
   closes, reads the `Revealed` events, computes per-address payouts via the
   `1/(1+d)` formula, builds the tree, posts the root via `resolve()`, and
   pins per-address proofs to a small JSON the frontend can read.

See `../apps/api/src/Service/Onchain/` (TODO — phase 1 deliverable).

## Security notes

- Coordinates are stored as `int32` fixed-point (degrees × 1e6). Range:
  lat ∈ [-90 000 000, 90 000 000], lng ∈ [-180 000 000, 180 000 000].
- Salts MUST be 32 random bytes per pin per player. Reusing a salt across
  rounds gives an attacker who later learns the coords a way to predict
  your future commit shapes.
- The off-chain settler MUST verify that `Σ(payout)` over all leaves equals
  `pool − rake` exactly. Any discrepancy fails when the contract's USDC
  balance can't cover the next `claim()`.
- `resolve()` is guarded by `RESOLVER_ROLE`. In production this is a
  Gnosis Safe. EOA only acceptable for testnet.
