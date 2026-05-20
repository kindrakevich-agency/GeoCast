<?php

declare(strict_types=1);

namespace App\Tests\Service\Onchain;

use App\Service\Onchain\EventDecoder;
use PHPUnit\Framework\TestCase;
use kornrunner\Keccak;

final class EventDecoderTest extends TestCase
{
    public function testTopicHashesAreStable(): void
    {
        $decoder = new EventDecoder();
        // Spot-check one — keccak256("Committed(uint64,address,bytes32)") is
        // deterministic so we can compare against the inlined keccak.
        $expected = '0x' . Keccak::hash('Committed(uint64,address,bytes32)', 256);
        $this->assertSame($expected, $decoder->topics[EventDecoder::SIG_COMMITTED]);
        $this->assertCount(4, $decoder->allTopics());
    }

    public function testDecodeCommitted(): void
    {
        $decoder = new EventDecoder();
        $log = [
            'topics' => [
                $decoder->topics[EventDecoder::SIG_COMMITTED],
                // round 7
                '0x0000000000000000000000000000000000000000000000000000000000000007',
                // player 0xabc…001
                '0x000000000000000000000000abcdef0000000000000000000000000000000001',
            ],
            'data' => '0x' . str_repeat('a1', 32),
            'transactionHash' => '0xdead',
            'blockNumber' => '0x10',
            'logIndex' => '0x2',
        ];
        $out = $decoder->decode($log);
        $this->assertNotNull($out);
        $this->assertSame('Committed', $out['event']);
        $this->assertSame(7, $out['roundId']);
        $this->assertSame('0xabcdef0000000000000000000000000000000001', $out['player']);
        $this->assertSame('0x' . str_repeat('a1', 32), $out['commit']);
        $this->assertSame(16, $out['blockNumber']);
        $this->assertSame(2, $out['logIndex']);
    }

    public function testDecodeRevealedSignedCoords(): void
    {
        $decoder = new EventDecoder();
        // Lisbon: lat 38_720_000 (positive), lng -9_140_000 (negative).
        // int32 -9_140_000 as 32-byte two's complement: 0xFF…FF724D40 (last 4 bytes)
        $latHex = str_pad(dechex(38_720_000), 64, '0', \STR_PAD_LEFT);
        $lngU = 0x100000000 - 9_140_000;  // 4286827296
        $lngHex = str_repeat('ff', 28) . str_pad(dechex($lngU), 8, '0', \STR_PAD_LEFT);

        $log = [
            'topics' => [
                $decoder->topics[EventDecoder::SIG_REVEALED],
                '0x0000000000000000000000000000000000000000000000000000000000000001',
                '0x000000000000000000000000aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
            ],
            'data' => '0x' . $latHex . $lngHex,
            'transactionHash' => '0xb1',
            'blockNumber' => '0x100',
            'logIndex' => '0x0',
        ];

        $out = $decoder->decode($log);
        $this->assertNotNull($out);
        $this->assertSame('Revealed', $out['event']);
        $this->assertSame(38_720_000, $out['lat']);
        $this->assertSame(-9_140_000, $out['lng']);
    }

    public function testDecodeResolvedBigRake(): void
    {
        $decoder = new EventDecoder();
        $merkleRoot = '0x' . str_repeat('cd', 32);
        $latHex = str_pad(dechex(38_720_000), 64, '0', \STR_PAD_LEFT);
        $lngU = 0x100000000 - 9_140_000;
        $lngHex = str_repeat('ff', 28) . str_pad(dechex($lngU), 8, '0', \STR_PAD_LEFT);
        $rakeHex = str_pad(dechex(150_000), 64, '0', \STR_PAD_LEFT);  // 0.15 USDC

        $log = [
            'topics' => [
                $decoder->topics[EventDecoder::SIG_RESOLVED],
                '0x0000000000000000000000000000000000000000000000000000000000000005',
            ],
            'data' => '0x' . $latHex . $lngHex . substr($merkleRoot, 2) . $rakeHex,
            'transactionHash' => '0xfff',
            'blockNumber' => '0x200',
            'logIndex' => '0x1',
        ];

        $out = $decoder->decode($log);
        $this->assertNotNull($out);
        $this->assertSame('Resolved', $out['event']);
        $this->assertSame(5, $out['roundId']);
        $this->assertSame(38_720_000, $out['answerLat']);
        $this->assertSame(-9_140_000, $out['answerLng']);
        $this->assertSame($merkleRoot, $out['merkleRoot']);
        // uint256 returned as int or numeric-string depending on size.
        $this->assertSame(150_000, $out['rake']);
    }

    public function testDecodeIgnoresUnknownTopic(): void
    {
        $decoder = new EventDecoder();
        $this->assertNull($decoder->decode([
            'topics' => ['0x' . str_repeat('99', 32)],
            'data'   => '0x',
            'transactionHash' => '0x0',
            'blockNumber' => '0x0',
            'logIndex' => '0x0',
        ]));
    }
}
