<?php

declare(strict_types=1);

namespace App\Service\Onchain;

use kornrunner\Keccak;

/**
 * Builds the on-chain settlement payload for a resolved round:
 *
 *   1. For each revealed pin, computes haversine distance to the answer
 *      (kilometers).
 *   2. Computes per-player raw_score = 1 / (1 + distance_km).
 *   3. Allocates the post-rake pool proportional to raw_score, floored
 *      to USDC micros (6 decimals). Floor + total invariant guarantee
 *      Σpayouts ≤ pool − rake — any dust stays in the contract.
 *   4. Builds a sorted-pair Merkle tree where each leaf is
 *      `keccak256(keccak256(abi.encode(address, amount)))` — exactly the
 *      shape `GeoCastPool.claim()` expects.
 *
 * The output is a per-address row containing `amount` + `proof`, ready
 * for the resolver to (a) call `resolve()` with `merkleRoot`, and (b)
 * publish the per-player proofs JSON so clients can call `claim()`.
 *
 * Pure: no DB, no Doctrine, no chain. Tested by a PHPUnit suite that
 * mirrors the Foundry test in contracts/.
 */
final class MerkleBuilder
{
    public const RAKE_BPS = 500;       // 5% — must match GeoCastPool.RAKE_BPS
    public const EARTH_RADIUS_KM = 6371.0;

    /**
     * @param list<array{address: string, lat: float, lng: float}> $reveals
     * @param int $poolMicros total USDC pool, in 6-decimal micros (3 USDC = 3_000_000)
     * @return array{
     *     merkleRoot: string,         // 0x-prefixed 32-byte hash
     *     rakeMicros: int,
     *     totalPayoutMicros: int,
     *     dustMicros: int,            // (pool − rake) − totalPayout (stays in contract)
     *     entries: list<array{address: string, distanceKm: float, rawScore: float, amountMicros: int, proof: list<string>}>
     * }
     */
    public function build(float $answerLat, float $answerLng, array $reveals, int $poolMicros): array
    {
        $rakeMicros = intdiv($poolMicros * self::RAKE_BPS, 10_000);
        $payable = $poolMicros - $rakeMicros;

        // Step 1: distance + raw_score per reveal.
        $rows = [];
        $sumRaw = 0.0;
        foreach ($reveals as $r) {
            $d = $this->haversineKm($answerLat, $answerLng, $r['lat'], $r['lng']);
            $raw = 1.0 / (1.0 + $d);
            $rows[] = [
                'address' => $this->normalizeAddress($r['address']),
                'distanceKm' => $d,
                'rawScore' => $raw,
            ];
            $sumRaw += $raw;
        }

        // Step 2: payouts. Floor protects the contract from running short.
        $totalPayout = 0;
        foreach ($rows as $i => $row) {
            $amount = $sumRaw > 0
                ? (int) floor($payable * $row['rawScore'] / $sumRaw)
                : 0;
            $rows[$i]['amountMicros'] = $amount;
            $totalPayout += $amount;
        }

        // Step 3: build the Merkle tree.
        $leaves = array_map(
            fn (array $row) => $this->leafHash($row['address'], $row['amountMicros']),
            $rows,
        );
        $tree = $this->buildTree($leaves);
        $root = $tree[count($tree) - 1][0];

        // Step 4: per-leaf proofs.
        foreach ($rows as $i => $row) {
            $rows[$i]['proof'] = array_map(
                fn (string $h) => '0x' . bin2hex($h),
                $this->getProof($tree, $i),
            );
        }

        return [
            'merkleRoot' => '0x' . bin2hex($root),
            'rakeMicros' => $rakeMicros,
            'totalPayoutMicros' => $totalPayout,
            'dustMicros' => $payable - $totalPayout,
            'entries' => $rows,
        ];
    }

    /**
     * Haversine distance in kilometers between two lat/lng pairs in degrees.
     * Matches MariaDB's ST_Distance_Sphere / 1000 within rounding (~6 decimals).
     */
    public function haversineKm(float $lat1, float $lng1, float $lat2, float $lng2): float
    {
        $phi1 = deg2rad($lat1);
        $phi2 = deg2rad($lat2);
        $dPhi = deg2rad($lat2 - $lat1);
        $dLam = deg2rad($lng2 - $lng1);

        $a = sin($dPhi / 2) ** 2 + cos($phi1) * cos($phi2) * sin($dLam / 2) ** 2;
        $c = 2 * atan2(sqrt($a), sqrt(1 - $a));
        return self::EARTH_RADIUS_KM * $c;
    }

    /**
     * Solidity leaf: keccak256(bytes.concat(keccak256(abi.encode(address, uint128))))
     *
     * abi.encode for (address, uint128):
     *   - address: 32 bytes (12 zero bytes + 20-byte address)
     *   - uint128: 32 bytes (16 zero bytes + 16-byte big-endian amount)
     *
     * The double-hash is OpenZeppelin's standard anti-collision shape so
     * a leaf can't be confused with an internal-node hash.
     */
    public function leafHash(string $address, int $amount): string
    {
        $addrHex = strtolower(ltrim($address, '0'));
        if (str_starts_with($addrHex, 'x')) {
            $addrHex = substr($addrHex, 1);
        }
        // Pad address to 20 bytes, then to 32 bytes for the abi slot.
        $addrHex = str_pad($addrHex, 40, '0', \STR_PAD_LEFT);
        if (\strlen($addrHex) !== 40) {
            throw new \InvalidArgumentException("Bad address: $address");
        }
        $addrSlot = str_repeat("\x00", 12) . hex2bin($addrHex);

        // uint128 — fits in 16 bytes, but the abi slot is still 32 bytes.
        if ($amount < 0) {
            throw new \InvalidArgumentException('Negative amount.');
        }
        $amountHex = str_pad(dechex($amount), 32, '0', \STR_PAD_LEFT);
        $amountSlot = hex2bin($amountHex);

        $packed = $addrSlot . $amountSlot;          // 64 bytes
        $inner = $this->keccak($packed);             // 32 bytes
        return $this->keccak($inner);                // 32 bytes — the leaf
    }

    /**
     * Build the full tree as an array of layers (leaves first, root last).
     * Sorted-pair hashing matches OZ's MerkleProof.verify.
     *
     * @param list<string> $leaves
     * @return list<list<string>>
     */
    private function buildTree(array $leaves): array
    {
        if ($leaves === []) {
            return [[str_repeat("\x00", 32)]];
        }
        $tree = [$leaves];
        $layer = $leaves;
        while (\count($layer) > 1) {
            $next = [];
            for ($i = 0, $n = \count($layer); $i < $n; $i += 2) {
                $left = $layer[$i];
                $right = $layer[$i + 1] ?? $layer[$i];
                $next[] = $this->pairHash($left, $right);
            }
            $tree[] = $next;
            $layer = $next;
        }
        return $tree;
    }

    /**
     * Sorted-pair hash — smaller (bytewise) goes first. PHP's binary
     * `strcmp` operates lexicographically over raw bytes, which matches
     * Solidity's `bytes32 < bytes32` (big-endian numeric).
     */
    private function pairHash(string $a, string $b): string
    {
        if (strcmp($a, $b) < 0) {
            return $this->keccak($a . $b);
        }
        return $this->keccak($b . $a);
    }

    /**
     * @param list<list<string>> $tree
     * @return list<string>
     */
    private function getProof(array $tree, int $leafIndex): array
    {
        $proof = [];
        $idx = $leafIndex;
        for ($level = 0; $level < \count($tree) - 1; $level++) {
            $sibling = $idx ^ 1;
            if ($sibling < \count($tree[$level])) {
                $proof[] = $tree[$level][$sibling];
            }
            $idx = intdiv($idx, 2);
        }
        return $proof;
    }

    private function keccak(string $bytes): string
    {
        // kornrunner/keccak returns lowercase hex; we want binary.
        return hex2bin(Keccak::hash($bytes, 256));
    }

    private function normalizeAddress(string $address): string
    {
        $hex = strtolower($address);
        if (str_starts_with($hex, '0x')) {
            $hex = substr($hex, 2);
        }
        if (!preg_match('/^[0-9a-f]{40}$/', $hex)) {
            throw new \InvalidArgumentException("Invalid address: $address");
        }
        return '0x' . $hex;
    }
}
