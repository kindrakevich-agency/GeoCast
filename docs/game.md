# GeoCast v2 — Real-money architecture

> A plan to evolve GeoCast from a portfolio prototype (fake credits, custodial
> resolution) into a working USDC prediction game on Base L2 — with on-chain
> deposits, off-chain ranking, Merkle-drop payouts, and a transparent rake
> as the primary revenue stream.

---

## 1. Goals (and explicit non-goals)

**Goals**

- Real USDC betting on Base L2 — cents per tx, no gas-bound friction.
- Trustless settlement: deposits + payouts on-chain, ranking computed off-chain
  but committed via Merkle root before claims open.
- Anti-cheat by construction: commit-reveal so the admin can't peek + bias the
  truth after seeing pins.
- 5% rake → multisig treasury. Sustainable without VC.
- Oracle path: human resolver day-1 → Chainlink Functions for deterministic
  facts (earthquakes, weather) over time.
- Preserve everything we already built: SIWE, MapLibre canvas, Pusher
  realtime, cron lifecycle, presence cursors, /me history.

**Non-goals (explicitly out)**

- Native L1 Ethereum. $5/tx kills the format.
- A custom token. USDC is the unit, no governance complexity until needed.
- Custodial pool — that makes the operator an MSB. Funds must always be in a
  contract the user can claim from.
- US/restricted geos in v1. Geofence at the edge.
- KYC in v1 (stay under FinCEN reporting thresholds with bet caps).

---

## 2. Chain + asset

| Choice               | Decision      | Why                                                              |
|----------------------|---------------|------------------------------------------------------------------|
| Chain                | **Base L2**   | Coinbase L2, ~$0.05 gas, native USDC bridge, growing user base   |
| Bet token            | **USDC**      | No volatility for players. Native on Base, no wrap needed        |
| Wallet UX            | Smart wallet  | Use Coinbase Smart Wallet / EIP-4337 → no-seedphrase onboarding  |
| Faucet / on-ramp     | Coinbase Pay  | Players who already use Coinbase can fund USDC inline            |
| Fallback bet asset   | ETH→USDC swap | Uniswap V3 router on Base; one-click "bet with ETH"              |

Why not Arbitrum / Optimism / Polygon: Base has tighter Coinbase integration
(distribution channel for non-crypto-native users), native USDC, and a
growing daily-active count. Polygon's "USDC.e" bridge wrapper is dead weight.

---

## 3. Smart-contract architecture

Three contracts, all deployed on Base mainnet. Source in `contracts/` (new
top-level directory, Foundry-based).

### 3.1 `GeoCastPool.sol` — the pool

Singleton. Holds USDC deposits per round, exposes the bet + claim surface.

```solidity
struct Round {
  uint64  opensAt;            // unix ts (mirrors backend)
  uint64  closesAt;
  uint64  revealsAt;          // closesAt + reveal window
  uint64  resolvedAt;          // 0 until resolution
  uint128 pool;               // total USDC committed
  bytes32 merkleRoot;         // payouts root (set on resolve)
  bool    paid;               // true after rake transferred
}

mapping(uint64 => Round)                              public rounds;
mapping(uint64 => mapping(address => bytes32))        public commits;
mapping(uint64 => mapping(address => bool))           public revealed;
mapping(uint64 => mapping(address => bool))           public claimed;

uint256 public constant BET = 1e6;          // 1 USDC, 6 decimals
uint256 public constant RAKE_BPS = 500;     // 5%
address public immutable treasury;
IERC20  public immutable usdc;

function createRound(uint64 id, uint64 opens, uint64 closes, uint64 reveals)
    external onlyResolver;

function commitBet(uint64 roundId, bytes32 commit) external {
    require(rounds[roundId].opensAt != 0, "no round");
    require(block.timestamp < rounds[roundId].closesAt, "closed");
    require(commits[roundId][msg.sender] == 0, "already in");
    commits[roundId][msg.sender] = commit;
    usdc.transferFrom(msg.sender, address(this), BET);
    rounds[roundId].pool += uint128(BET);
    emit Committed(roundId, msg.sender, commit);
}

function reveal(uint64 roundId, int32 lat, int32 lng, bytes32 salt) external {
    Round storage r = rounds[roundId];
    require(block.timestamp >= r.closesAt && block.timestamp < r.revealsAt, "window");
    bytes32 expected = keccak256(abi.encodePacked(msg.sender, lat, lng, salt));
    require(commits[roundId][msg.sender] == expected, "bad commit");
    revealed[roundId][msg.sender] = true;
    emit Revealed(roundId, msg.sender, lat, lng);
}

function resolve(uint64 roundId, int32 answerLat, int32 answerLng, bytes32 root)
    external onlyResolver
{
    Round storage r = rounds[roundId];
    require(block.timestamp >= r.revealsAt, "reveal window open");
    require(r.merkleRoot == 0, "already resolved");
    r.merkleRoot = root;
    r.resolvedAt = uint64(block.timestamp);

    // Take the rake immediately, before anyone claims.
    uint256 rake = (r.pool * RAKE_BPS) / 10000;
    r.paid = true;
    usdc.transfer(treasury, rake);
    emit Resolved(roundId, answerLat, answerLng, root, rake);
}

function claim(uint64 roundId, uint128 amount, bytes32[] calldata proof) external {
    require(!claimed[roundId][msg.sender], "claimed");
    bytes32 leaf = keccak256(abi.encodePacked(msg.sender, amount));
    require(MerkleProof.verify(proof, rounds[roundId].merkleRoot, leaf), "bad proof");
    claimed[roundId][msg.sender] = true;
    usdc.transfer(msg.sender, amount);
    emit Claimed(roundId, msg.sender, amount);
}
```

Key invariants:

- Total payouts ≤ `pool − rake` by Merkle construction.
- A player who didn't reveal in the window loses their bet (forfeited to pool —
  attackers can't grief by committing then ghosting). We can soften this later
  by auto-revealing if the player signed a "reveal-by-default" message.
- `resolve` only callable by the resolver address (eventually multisig +
  Chainlink Automation).

### 3.2 `GeoCastTreasury.sol` — the rake bucket

```solidity
contract GeoCastTreasury is OwnerSafe {
    // 2-of-3 Gnosis Safe owner. Holds raked USDC.
    // Can deposit into Aave's aUSDC vault for yield on float.
    // Owners are the founder + 2 independent (legal counsel + DeFi advisor).
}
```

For v1, this can literally be `0x…` (a Safe multisig address). On-chain logic
only matters once you want trustless yield deployment.

### 3.3 `GeoCastResolver.sol` — pluggable answer source

```solidity
interface IResolver {
    function answer(uint64 roundId) external view returns (int32 lat, int32 lng);
}

contract HumanResolver is IResolver {
    // Owner posts the answer per round. Owner = the geocast admin EOA.
}

contract ChainlinkResolver is IResolver {
    // Pulls earthquake feed via Chainlink Functions, exposes USGS data.
    // Used for "next M5+ earthquake" rounds without an admin.
}
```

`GeoCastPool` accepts a different resolver per round type. Phase 1 ships with
`HumanResolver` only.

---

## 4. Anti-cheat: commit-reveal

Spec problem: admin sees player pins, then picks an answer that maximises
the house's friends' payout (rug). Solution: 2-phase betting.

```
open phase   (closes_at − 24h to closes_at)
    player: hash(lat || lng || salt || addr) → commitBet(roundId, hash)
    contract: holds USDC, records commit, no lat/lng known yet

reveal phase (closes_at to closes_at + 6h)
    player: reveal(roundId, lat, lng, salt) → contract checks hash
    contract: records reveal in event log

resolve phase (after reveal_at)
    admin/oracle: posts answer + Merkle root computed off-chain over
                  every revealed pin
    contract: emits Resolved, takes rake, opens claims

claim phase (forever after resolve)
    players: claim(roundId, amount, proof) → withdraw payout
```

The salt is unique per pin (random bytes), known only to the player. This
means the answer-setter can't see ANYONE's pin until the reveal window — at
which point everything is public + on the event log + the answer is already
constrained to a smaller decision surface.

**Off-chain ranking script** (Node or PHP):

```
1. Subscribe to Revealed events for the round
2. Compute distance = haversine(answer, eachReveal) in km
3. Sort ascending
4. payout[i] = (pool − rake) × (1 / (1+d[i])) / Σ(1/(1+d[j]))
5. Build Merkle tree of (address, payout)
6. Submit root via resolve()
7. Pin (address, payout, proof) JSON to IPFS for player wallets
```

Off-chain ranking is acceptably trustless because the **leaves are
on-chain** (from Revealed events) and the formula is published. Anyone can
re-run the script and verify the root matches.

---

## 5. Off-chain stack — what stays, what changes

### Stays as-is
- Symfony API: round metadata, question + opens_at + closes_at
- MariaDB: rounds, predictions (now with `commit_hash` + `revealed_at`)
- Pusher: realtime UX
- Cron `app:rounds:tick`: scheduled → open → closed (still wall-clock based)
- SIWE: authentication, unchanged
- /admin: still the resolution UI, but instead of POST /resolve setting `answer_lat/lng` in DB, it signs a `resolve(roundId, ...)` tx via wagmi from the admin's connected wallet

### New
- `apps/api/src/Service/Onchain/MerkleBuilder.php` — reads revealed pins from
  the DB after the reveal window, computes payouts, builds the Merkle tree,
  stores the proofs per-address for the frontend's claim UI.
- `apps/api/src/Command/app:rounds:settle` — runs after reveal window closes,
  pings the admin "ready to resolve" + uploads proofs.
- `apps/api/src/EventListener/OnchainEventListener` — watches Base RPC for
  `Committed` / `Revealed` events, mirrors them to MariaDB so the live UI
  (heatmap, count) stays accurate.
- `contracts/` — Foundry project. Pool, Treasury, Resolver, tests, deploy
  script.
- `apps/web/src/lib/onchain.ts` — wagmi hooks for `commitBet`, `reveal`,
  `claim`. Same UX as today's pin placement, but the click triggers a wallet
  tx instead of an API POST.

### Removed
- The `credits_balance` column. Players don't have credits — they have a USDC
  balance in their wallet.
- The synthetic `pool_credits` field (replaced by the contract's `pool`).
- `app:dev:mint-jwt --admin` based fake admin (admins become a multisig
  signer set).

---

## 6. Revenue model — knobs ranked by leverage

| Knob | Setup cost | Annual upside (assume 200 DAU, 5 rounds/day, $1/pin) | Confidence |
|---|---|---|---|
| **5% rake**                | 1 week     | ~$18k                                          | High |
| **Float yield (Aave)**     | 2 weeks    | ~$1.5k (on $50k float at 3% APY)               | High |
| **Round sponsorships**     | 4 weeks    | $0–$60k (depends on sales)                     | Medium |
| **Premium leagues**        | 3 weeks    | $5k–$25k (10–15% conversion at $5/mo)          | Medium |
| **NFT achievements**       | 2 weeks    | $1k–$10k (one-off mints)                       | Low |
| **Oracle API**             | 6 weeks    | $0–$? (third-party integration)                | Low |

**Day-1 monetization = rake.** Float yield + sponsorships are quarter-2.
NFTs + premium + API are year-2 once retention's proven.

### Why rake is enough

The 5% rake is invisible to most players (poker conditioned them) and applied
at resolution before the Merkle drop. Treasury contract receives USDC
directly. No subscription billing, no Stripe, no fiat surface — fully on-chain
revenue.

---

## 7. Phased rollout

### Phase 0 — Migration prep (week 1)
- Add a `chain_address` field to User (already there as `wallet_address`).
- Snapshot existing fake-credit balances → spreadsheet for goodwill credits
  (e.g. give existing players bonus USDC airdrop equal to credits/100).
- Schema additions: `predictions.commit_hash`, `predictions.revealed_at`,
  `predictions.payout_usdc`, `predictions.tx_hash`, `rounds.merkle_root`.
- Both modes co-exist behind a feature flag (`ROUND_MODE = credits | usdc`)
  set per-round. New rounds default to USDC, old credit rounds stay readable
  for /me history.

### Phase 1 — Base Sepolia testnet (weeks 2-4)
- Foundry contracts: Pool + Treasury (Safe stub) + HumanResolver.
- 100% test coverage on the contracts. Forge fuzz tests for the formula.
- Deploy to Base Sepolia. Players bet with test-USDC from a faucet.
- Frontend dual-mode: "demo" (mock credits) + "testnet" (Sepolia USDC). The
  prod URL serves demo mode; `testnet.geocast.kindrakevich.com` serves testnet.
- Internal play-test for 1 week. Fix UX gaps.

### Phase 2 — Audit + mainnet beta (weeks 5-8)
- Spearbit / Trail of Bits audit (~$20–40k, 2 weeks). The Pool contract is
  small enough that this is the right price point. Skip if budget tight and
  ship a public bug bounty instead via Immunefi.
- Deploy contracts to Base mainnet.
- Hard cap: $1/pin, $50/day per address. Sanity bound while the gas + UX
  patterns stabilize.
- Open to 100 invitees first.
- Public after 2 weeks of clean operation.

### Phase 3 — Production (week 9+)
- Lift caps progressively.
- Chainlink Functions integration for an "earthquake" round type that
  resolves itself.
- Treasury starts deploying float into Aave's Base USDC market.
- Sponsorship pipeline — outreach to weather APIs / sports books / media.

---

## 8. Engineering scope

| Component                          | Estimate                    |
|------------------------------------|-----------------------------|
| Solidity contracts                 | ~700 lines + tests, 2 weeks |
| Foundry deploy scripts + ops       | 1 week                      |
| Backend chain event listener (PHP) | ~600 lines, 1 week          |
| Backend Merkle builder + settle    | ~400 lines, 0.5 week        |
| Schema migrations + flag           | 0.5 week                    |
| Frontend wagmi/viem write paths    | ~800 lines, 1.5 weeks       |
| Frontend "claim winnings" UI       | ~300 lines, 0.5 week        |
| Audit (external)                   | 2 weeks (external clock)    |
| **Total engineering**              | **~6 weeks dev + 2 audit**  |

For a solo builder: 2–3 months end-to-end is realistic.

---

## 9. Risks & open questions

### Regulatory
- Prediction markets in the US sit in a CFTC grey area. Polymarket precedent:
  USDC, ToS, US geofence at Cloudflare edge.
- Action item before mainnet: Terms of Service + jurisdictional geofence
  (block US, China, OFAC sanction list). Use a Cloudflare Worker rule.
- Below FinCEN MSB threshold (no fiat surface, contract holds funds), but
  consult counsel before mainnet for the operator entity's structure.

### Smart contract
- Standard re-entry / overflow / signature replay risks. Mitigated by audit
  + using OpenZeppelin standards.
- Resolver capture: who controls the resolver multisig? Recommend 2-of-3 with
  the founder + legal counsel + DeFi advisor for v1.
- Oracle failure: if Chainlink stale, fall back to admin override with a
  cool-down period (24h grace before manual override).

### Open questions (need user input before phase 1)
1. **Multi-round/day vs single?** Spec currently is one open round at a time.
   Real games often run 5–10 concurrent (different question types). Plan: keep
   one prediction round/day but add side-bet rounds (yes/no, over-under) later.
2. **Reveal-by-default vs explicit reveal?** Explicit reveal punishes
   forgetful players; reveal-by-default needs the player to sign a "auto-reveal
   if I don't show up" message at commit time. Recommend explicit for v1, add
   default later.
3. **Treasury yield strategy:** Aave aUSDC (~3-4% APY, audited) vs Yearn vault
   (~5-6%, more risk). Recommend Aave for v1.
4. **Bet size:** fixed $1 or variable up to a cap? Variable rewards
   "conviction" but complicates the formula. Recommend fixed $1 for v1.
5. **Resolver identity:** founder EOA, founder Safe, or independent multisig
   from day 1? Recommend founder Safe alone, transition to mixed multisig
   when treasury hits $100k.

---

## 10. The first slice to ship

If we start tomorrow, the smallest demo-able end-to-end is:

**"Place a real testnet-USDC bet on a round, reveal coords, see your wallet
get the payout if you won."**

Concretely, week-1 deliverables:

- [ ] `contracts/` — Foundry project bootstrapped, Pool.sol + Treasury.sol
      first pass + happy-path tests
- [ ] Deploy to Base Sepolia, contract addresses in `.env`
- [ ] Frontend: replace today's POST /predictions with a wagmi
      `useWriteContract` call to `commitBet`. Two-step UX: approve USDC →
      commit
- [ ] Backend: listen for `Committed` events, mirror to DB so existing UI
      (heatmap, count) keeps working
- [ ] `/admin` resolve form: instead of POSTing to PHP, sign + send a
      `resolve()` tx with the answer + Merkle root computed server-side
- [ ] `/me`: new "Claimable winnings" section that shows pending Merkle
      proofs and a Claim button per round

Estimated 5–7 working days for that slice. After it works on Sepolia, the
audit + mainnet path becomes a deploy script + a contract address swap.

---

*Last updated: 2026-05-20. Living document — update as decisions land.*
