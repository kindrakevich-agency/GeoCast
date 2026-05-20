<?php

declare(strict_types=1);

namespace App\Tests\Service\Onchain;

use App\Service\Onchain\MerkleBuilder;
use PHPUnit\Framework\TestCase;

/**
 * MerkleBuilder unit tests. Mirrors the Foundry test in contracts/test —
 * same 3-player scenario, same answer. The PHP tree's root + leaves must
 * verify against the on-chain Solidity verifier, so the leaf encoding is
 * exercised here independently.
 */
final class MerkleBuilderTest extends TestCase
{
    /**
     * 3 players, $1/pin (3 USDC pool), Lisbon answer.
     * - Alice 38.50, -9.50 → ~36 km off
     * - Bob   40.42, -3.70 → ~503 km off
     * - Carol 35.69, 139.69 → ~10870 km off
     *
     * After 5% rake (0.15 USDC), pool to distribute = 2.85 USDC.
     */
    public function testFullSettlement(): void
    {
        $builder = new MerkleBuilder();
        $result = $builder->build(
            answerLat: 38.72,
            answerLng: -9.14,
            reveals: [
                ['address' => '0x1111111111111111111111111111111111111111', 'lat' => 38.50, 'lng' => -9.50],
                ['address' => '0x2222222222222222222222222222222222222222', 'lat' => 40.42, 'lng' => -3.70],
                ['address' => '0x3333333333333333333333333333333333333333', 'lat' => 35.69, 'lng' => 139.69],
            ],
            poolMicros: 3_000_000, // 3 USDC
        );

        // Rake: 5% of 3 USDC = 0.15 USDC.
        $this->assertSame(150_000, $result['rakeMicros']);

        // Σpayouts ≤ pool − rake. Floor truncation may leave a few micros.
        $payable = 3_000_000 - 150_000;
        $this->assertLessThanOrEqual($payable, $result['totalPayoutMicros']);
        $this->assertSame($payable - $result['totalPayoutMicros'], $result['dustMicros']);

        // Closest pin should get the biggest share.
        $alice = $result['entries'][0];
        $bob = $result['entries'][1];
        $carol = $result['entries'][2];
        $this->assertGreaterThan($bob['amountMicros'], $alice['amountMicros']);
        $this->assertGreaterThan($carol['amountMicros'], $bob['amountMicros']);

        // Sanity: Alice's distance is the smallest.
        $this->assertLessThan($bob['distanceKm'], $alice['distanceKm']);
        $this->assertLessThan($carol['distanceKm'], $bob['distanceKm']);

        // Merkle root is a 32-byte hex string.
        $this->assertMatchesRegularExpression('/^0x[0-9a-f]{64}$/', $result['merkleRoot']);

        // Every entry has a proof (length ≥ ceil(log2(3)) − 1 = 1 sibling each
        // for a 3-leaf tree).
        foreach ($result['entries'] as $entry) {
            $this->assertNotEmpty($entry['proof']);
            foreach ($entry['proof'] as $hash) {
                $this->assertMatchesRegularExpression('/^0x[0-9a-f]{64}$/', $hash);
            }
        }
    }

    /**
     * Verify that the proofs we compute actually round-trip through the
     * exact sorted-pair algorithm OZ's MerkleProof.verify implements.
     * If this passes here it passes on-chain.
     */
    public function testProofsVerifyAgainstRoot(): void
    {
        $builder = new MerkleBuilder();
        $result = $builder->build(
            answerLat: 38.72,
            answerLng: -9.14,
            reveals: [
                ['address' => '0x1111111111111111111111111111111111111111', 'lat' => 38.50, 'lng' => -9.50],
                ['address' => '0x2222222222222222222222222222222222222222', 'lat' => 40.42, 'lng' => -3.70],
                ['address' => '0x3333333333333333333333333333333333333333', 'lat' => 35.69, 'lng' => 139.69],
                ['address' => '0x4444444444444444444444444444444444444444', 'lat' => -33.87, 'lng' => 151.21],
            ],
            poolMicros: 4_000_000,
        );

        $rootBin = hex2bin(substr($result['merkleRoot'], 2));
        foreach ($result['entries'] as $entry) {
            $leaf = $builder->leafHash($entry['address'], $entry['amountMicros']);
            $proofBin = array_map(fn (string $h) => hex2bin(substr($h, 2)), $entry['proof']);
            $this->assertTrue(
                $this->verify($leaf, $proofBin, $rootBin),
                sprintf('proof failed for %s (amount=%d)', $entry['address'], $entry['amountMicros']),
            );
        }
    }

    /**
     * Haversine: known distance between Lisbon and Madrid is ~500 km.
     */
    public function testHaversineKnownDistance(): void
    {
        $builder = new MerkleBuilder();
        $km = $builder->haversineKm(38.72, -9.14, 40.42, -3.70);
        $this->assertEqualsWithDelta(503.0, $km, 5.0);
    }

    /**
     * Rake on an exact-divide pool.
     */
    public function testRakeMath(): void
    {
        $builder = new MerkleBuilder();
        // 100 USDC pool, no reveals → rake is still computed.
        $result = $builder->build(38.72, -9.14, [], 100_000_000);
        $this->assertSame(5_000_000, $result['rakeMicros']);
        $this->assertSame(0, $result['totalPayoutMicros']);
        $this->assertSame(95_000_000, $result['dustMicros']);
    }

    /**
     * Replicate OZ's MerkleProof.verify locally (sorted-pair). Used purely
     * to assert that our PHP tree matches what the contract verifies.
     *
     * @param list<string> $proof binary 32-byte hashes
     */
    private function verify(string $leaf, array $proof, string $root): bool
    {
        $h = $leaf;
        foreach ($proof as $sib) {
            $h = strcmp($h, $sib) < 0
                ? $this->keccak($h . $sib)
                : $this->keccak($sib . $h);
        }
        return $h === $root;
    }

    private function keccak(string $bytes): string
    {
        return hex2bin(\kornrunner\Keccak::hash($bytes, 256));
    }
}
