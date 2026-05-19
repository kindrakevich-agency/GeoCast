<?php

declare(strict_types=1);

namespace App\Service\Siwe;

use Predis\Client as RedisClient;

/**
 * Issues + consumes SIWE nonces (EIP-4361).
 *
 * Each nonce is a 32-char alphanumeric string, scoped per wallet, with a
 * short TTL. The nonce is the third line of the SIWE message a wallet
 * signs at `/api/auth/verify` — without it, the signature can be replayed
 * indefinitely. We delete the nonce on verify (whether the signature
 * matches or not) so it can't be reused.
 *
 * Redis keys are prefixed via the Predis client's `prefix:` option
 * (configured in services.yaml as `geocast:`) so they cannot collide
 * with any other project sharing the Redis instance.
 */
final class SiweNonceService
{
    private const KEY_PREFIX = 'siwe:nonce:';
    private const TTL_SECONDS = 5 * 60;
    private const NONCE_LENGTH = 32;

    public function __construct(private readonly RedisClient $redis)
    {
    }

    /**
     * Issue a fresh nonce for the given wallet address, store it in Redis
     * with a 5-minute TTL, and return it.
     *
     * Always replaces any prior outstanding nonce for the same address —
     * users may legitimately retry a sign-in. The previous nonce is
     * invalidated by the overwrite (Redis SET resets TTL).
     */
    public function issue(string $walletAddress): string
    {
        $nonce = $this->generateNonce();
        $this->redis->setex(
            self::KEY_PREFIX . strtolower($walletAddress),
            self::TTL_SECONDS,
            $nonce,
        );

        return $nonce;
    }

    /**
     * Look up + atomically delete the nonce for `walletAddress`, returning
     * the stored value if any. Single-use — calling this a second time
     * for the same address will return null until a fresh nonce is issued.
     *
     * Used by `/api/auth/verify` to confirm the signature was made against
     * a nonce we issued and to ensure the signature can't be replayed.
     */
    public function consume(string $walletAddress): ?string
    {
        $key = self::KEY_PREFIX . strtolower($walletAddress);
        $value = $this->redis->get($key);
        if ($value === null) {
            return null;
        }
        $this->redis->del([$key]);

        return $value;
    }

    private function generateNonce(): string
    {
        // 32 base32-ish chars, no ambiguous characters (no 0/O/1/I/l).
        // Cryptographically random via random_bytes.
        $alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
        $alphabetLen = \strlen($alphabet);
        $bytes = random_bytes(self::NONCE_LENGTH);
        $out = '';
        for ($i = 0; $i < self::NONCE_LENGTH; $i++) {
            $out .= $alphabet[\ord($bytes[$i]) % $alphabetLen];
        }

        return $out;
    }
}
