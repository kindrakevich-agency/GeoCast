<?php

declare(strict_types=1);

namespace App\Tests\Service\Onchain;

use App\Service\Onchain\MerkleBuilder;
use App\Service\Onchain\SettlementBuilder;
use Doctrine\DBAL\Connection;
use PHPUnit\Framework\TestCase;

/**
 * SettlementBuilder unit tests. Mocks the DBAL Connection so the orchestrator
 * is exercised against a controlled set of onchain_events rows + we verify
 * the right INSERT … ON DUPLICATE KEY UPDATE shape is emitted per leaf.
 */
final class SettlementBuilderTest extends TestCase
{
    public function testRejectsZeroCommitRound(): void
    {
        $db = $this->createMock(Connection::class);
        $db->method('fetchAllAssociative')->willReturn([]);
        $db->method('fetchOne')->willReturn(0);
        $db->expects($this->never())->method('executeStatement');

        $settler = new SettlementBuilder($db, new MerkleBuilder());
        $this->expectException(\RuntimeException::class);
        $settler->settle(7, 38.72, -9.14);
    }

    public function testHappyPath3Players(): void
    {
        $db = $this->createMock(Connection::class);
        // 3 Revealed events. Coordinates are int32 fixed-point (degrees × 1e6)
        // — matches the on-chain encoding the EventDecoder produces.
        $db->method('fetchAllAssociative')->willReturn([
            ['payload_json' => json_encode([
                'event' => 'Revealed', 'player' => '0x1111111111111111111111111111111111111111',
                'lat' => 38_500_000, 'lng' => -9_500_000,
            ])],
            ['payload_json' => json_encode([
                'event' => 'Revealed', 'player' => '0x2222222222222222222222222222222222222222',
                'lat' => 40_416_000, 'lng' => -3_703_000,
            ])],
            ['payload_json' => json_encode([
                'event' => 'Revealed', 'player' => '0x3333333333333333333333333333333333333333',
                'lat' => 35_689_000, 'lng' => 139_692_000,
            ])],
        ]);
        $db->method('fetchOne')->willReturn(3); // 3 commits → 3 USDC pool

        // Expect 3 INSERT ON DUPLICATE … (one per leaf).
        $db->expects($this->exactly(3))->method('executeStatement');

        $settler = new SettlementBuilder($db, new MerkleBuilder());
        $result = $settler->settle(5, 38.72, -9.14);

        $this->assertSame(3, $result['leafCount']);
        $this->assertSame(150_000, $result['rakeMicros']);          // 5% of 3 USDC
        $this->assertLessThanOrEqual(2_850_000, $result['totalPayoutMicros']);
        $this->assertMatchesRegularExpression('/^0x[0-9a-f]{64}$/', $result['merkleRoot']);
    }

    public function testGetProofMissesUnsettledRound(): void
    {
        $db = $this->createMock(Connection::class);
        $db->method('fetchAssociative')->willReturn(false);

        $settler = new SettlementBuilder($db, new MerkleBuilder());
        $this->assertNull($settler->getProof(99, '0x1111111111111111111111111111111111111111'));
    }

    public function testGetProofReturnsStoredEntry(): void
    {
        $db = $this->createMock(Connection::class);
        $db->method('fetchAssociative')->willReturn([
            'amount_micros' => 950_000,
            'proof_json' => json_encode(['0xabc', '0xdef']),
            'merkle_root' => '0x' . str_repeat('cd', 32),
            'distance_km' => 27.3,
            'rank_pos' => 1,
        ]);

        $settler = new SettlementBuilder($db, new MerkleBuilder());
        $proof = $settler->getProof(5, '0x1111111111111111111111111111111111111111');
        $this->assertNotNull($proof);
        $this->assertSame(950_000, $proof['amountMicros']);
        $this->assertSame(['0xabc', '0xdef'], $proof['proof']);
        $this->assertSame(27.3, $proof['distanceKm']);
        $this->assertSame(1, $proof['rank']);
    }
}
