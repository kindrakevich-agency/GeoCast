<?php

declare(strict_types=1);

namespace App\Service\Onchain;

use kornrunner\Keccak;

/**
 * Decodes GeoCastPool event logs from raw `eth_getLogs` output.
 *
 * Event signatures (computed once at class load):
 *
 *   Committed(uint64 indexed roundId, address indexed player, bytes32 commit)
 *   Revealed (uint64 indexed roundId, address indexed player, int32 lat, int32 lng)
 *   Resolved (uint64 indexed roundId, int32 answerLat, int32 answerLng, bytes32 merkleRoot, uint256 rake)
 *   Claimed  (uint64 indexed roundId, address indexed player, uint256 amount)
 *
 * Indexed params live in `topics[1..]`, non-indexed in `data` (32-byte slots).
 */
final class EventDecoder
{
    public const SIG_COMMITTED = 'Committed(uint64,address,bytes32)';
    public const SIG_REVEALED  = 'Revealed(uint64,address,int32,int32)';
    public const SIG_RESOLVED  = 'Resolved(uint64,int32,int32,bytes32,uint256)';
    public const SIG_CLAIMED   = 'Claimed(uint64,address,uint256)';

    /** @var array<string, string> sig → topic0 hash (0x…) */
    public readonly array $topics;

    public function __construct()
    {
        $sigs = [self::SIG_COMMITTED, self::SIG_REVEALED, self::SIG_RESOLVED, self::SIG_CLAIMED];
        $map = [];
        foreach ($sigs as $s) {
            $map[$s] = '0x' . Keccak::hash($s, 256);
        }
        $this->topics = $map;
    }

    /** @return list<string> the four topic0 hashes — pass into eth_getLogs */
    public function allTopics(): array
    {
        return array_values($this->topics);
    }

    /**
     * Decode a single raw log object. Returns the event shape or null if
     * the topic0 doesn't match one of our four events.
     *
     * @param array<string, mixed> $log
     * @return array{event: string, roundId: int, player?: string, commit?: string, lat?: int, lng?: int, answerLat?: int, answerLng?: int, merkleRoot?: string, rake?: string, amount?: string, txHash: string, blockNumber: int, logIndex: int}|null
     */
    public function decode(array $log): ?array
    {
        $topics = $log['topics'] ?? [];
        if (!\is_array($topics) || $topics === []) {
            return null;
        }
        $sig0 = strtolower((string) $topics[0]);
        $base = [
            'txHash'      => (string) ($log['transactionHash'] ?? ''),
            'blockNumber' => (int) hexdec(substr((string) ($log['blockNumber'] ?? '0x0'), 2)),
            'logIndex'    => (int) hexdec(substr((string) ($log['logIndex'] ?? '0x0'), 2)),
        ];
        $data = (string) ($log['data'] ?? '0x');

        if ($sig0 === $this->topics[self::SIG_COMMITTED]) {
            return $base + [
                'event'   => 'Committed',
                'roundId' => $this->decodeUint($topics[1] ?? ''),
                'player'  => $this->decodeAddress($topics[2] ?? ''),
                'commit'  => $this->slice($data, 0),
            ];
        }
        if ($sig0 === $this->topics[self::SIG_REVEALED]) {
            return $base + [
                'event'   => 'Revealed',
                'roundId' => $this->decodeUint($topics[1] ?? ''),
                'player'  => $this->decodeAddress($topics[2] ?? ''),
                'lat'     => $this->decodeInt32($this->slice($data, 0)),
                'lng'     => $this->decodeInt32($this->slice($data, 1)),
            ];
        }
        if ($sig0 === $this->topics[self::SIG_RESOLVED]) {
            return $base + [
                'event'      => 'Resolved',
                'roundId'    => $this->decodeUint($topics[1] ?? ''),
                'answerLat'  => $this->decodeInt32($this->slice($data, 0)),
                'answerLng'  => $this->decodeInt32($this->slice($data, 1)),
                'merkleRoot' => $this->slice($data, 2),
                'rake'       => $this->decodeUint($this->slice($data, 3)),
            ];
        }
        if ($sig0 === $this->topics[self::SIG_CLAIMED]) {
            return $base + [
                'event'   => 'Claimed',
                'roundId' => $this->decodeUint($topics[1] ?? ''),
                'player'  => $this->decodeAddress($topics[2] ?? ''),
                'amount'  => $this->decodeUint($this->slice($data, 0)),
            ];
        }
        return null;
    }

    /** Slice the n-th 32-byte (64-hex-char) word from a 0x-prefixed blob. */
    private function slice(string $hexData, int $word): string
    {
        // strip 0x, pull bytes 64n .. 64n+64
        $payload = substr($hexData, 2);
        $chunk = substr($payload, $word * 64, 64);
        return '0x' . $chunk;
    }

    private function decodeUint(string $hexWord): string|int
    {
        // For small numbers (round ids) the int cast is fine. For uint256
        // (rake/amount) we keep it as a decimal string to avoid PHP's int
        // overflow on 32-bit. Callers should treat the return as numeric-string.
        $hex = ltrim(substr($hexWord, 2), '0');
        if ($hex === '') {
            return 0;
        }
        if (\strlen($hex) <= 15) {
            return (int) hexdec($hex);
        }
        // bcmath-free big-int parse: gmp is required by the SIWE verifier
        // (we compiled it earlier), so it's guaranteed present.
        return gmp_strval(gmp_init($hex, 16));
    }

    private function decodeInt32(string $hexWord): int
    {
        // int32 sign-extended into a 32-byte slot. The leading 28 bytes are
        // 0xFF when negative, 0x00 when positive. Take the last 4 bytes,
        // re-interpret as signed.
        $tail = substr($hexWord, -8);
        $u = (int) hexdec($tail);
        // 32-bit signed: anything ≥ 2^31 is negative.
        return $u >= 0x80000000 ? $u - 0x100000000 : $u;
    }

    private function decodeAddress(string $hexWord): string
    {
        // Address sits in the rightmost 20 bytes of the topic word.
        return '0x' . strtolower(substr($hexWord, -40));
    }
}
