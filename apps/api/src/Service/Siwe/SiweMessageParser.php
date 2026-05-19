<?php

declare(strict_types=1);

namespace App\Service\Siwe;

/**
 * Parses an EIP-4361 (SIWE) message into its fields.
 *
 * The wire format is fixed enough that a regex parse is more reliable
 * than a full grammar — and faster than pulling a third-party SIWE
 * library that would inflate the dependency surface.
 *
 * Reference message:
 *
 *   geocast.kindrakevich.com wants you to sign in with your Ethereum account:
 *   0x7f4c2b8e9a3d1f6c0b2e1a4d5c6b7a8e9f0a3b1d
 *
 *   Sign in to GeoCast — daily geo-prediction game.
 *
 *   URI: https://geocast.kindrakevich.com
 *   Version: 1
 *   Chain ID: 1
 *   Nonce: V8FUHWPASU68HQWMQF32WZKU4UN56VAV
 *   Issued At: 2026-05-19T20:45:00.000Z
 *   Expiration Time: 2026-05-19T20:50:00.000Z
 */
final class SiweMessageParser
{
    public function parse(string $message): ParsedSiweMessage
    {
        // First line: "<domain> wants you to sign in with your Ethereum account:"
        if (!preg_match('/^(\S+) wants you to sign in with your Ethereum account:$/m', $message, $domainMatch)) {
            throw new \InvalidArgumentException('Missing or malformed SIWE first line ("<domain> wants you to sign in...").');
        }
        $domain = $domainMatch[1];

        // Second line: 0x-prefixed 40-hex address
        if (!preg_match('/^(0x[a-fA-F0-9]{40})$/m', $message, $addressMatch)) {
            throw new \InvalidArgumentException('Missing or malformed SIWE address line.');
        }
        $address = strtolower($addressMatch[1]);

        // Required fields — exact wire format. (Whitespace after colon is mandatory.)
        $uri = $this->extract($message, '/^URI: (.+)$/m', 'URI');
        $version = $this->extract($message, '/^Version: (.+)$/m', 'Version');
        $chainId = (int) $this->extract($message, '/^Chain ID: (\d+)$/m', 'Chain ID');
        $nonce = $this->extract($message, '/^Nonce: ([A-Za-z0-9_-]+)$/m', 'Nonce');
        $issuedAt = $this->extract($message, '/^Issued At: (.+)$/m', 'Issued At');

        // Optional: Statement (between blank lines after address)
        $statement = null;
        if (preg_match('/^0x[a-fA-F0-9]{40}\n\n(.+?)\n\nURI:/sm', $message, $stmtMatch)) {
            $statement = trim($stmtMatch[1]);
        }

        // Optional: Expiration Time
        $expirationTime = null;
        if (preg_match('/^Expiration Time: (.+)$/m', $message, $expMatch)) {
            $expirationTime = new \DateTimeImmutable($expMatch[1]);
        }

        return new ParsedSiweMessage(
            domain: $domain,
            address: $address,
            statement: $statement,
            uri: $uri,
            version: $version,
            chainId: $chainId,
            nonce: $nonce,
            issuedAt: new \DateTimeImmutable($issuedAt),
            expirationTime: $expirationTime,
        );
    }

    private function extract(string $message, string $regex, string $fieldName): string
    {
        if (!preg_match($regex, $message, $m)) {
            throw new \InvalidArgumentException("Missing or malformed SIWE \"$fieldName\" line.");
        }

        return $m[1];
    }
}
