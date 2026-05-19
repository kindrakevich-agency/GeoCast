<?php

declare(strict_types=1);

namespace App\Service\Siwe;

/**
 * The fields a SIWE message carries after parsing. Immutable.
 */
final readonly class ParsedSiweMessage
{
    public function __construct(
        public string $domain,
        /** Lowercase, 0x-prefixed, 42 chars. */
        public string $address,
        public ?string $statement,
        public string $uri,
        public string $version,
        public int $chainId,
        public string $nonce,
        public \DateTimeImmutable $issuedAt,
        public ?\DateTimeImmutable $expirationTime,
    ) {
    }
}
