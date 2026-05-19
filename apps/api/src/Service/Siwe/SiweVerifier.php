<?php

declare(strict_types=1);

namespace App\Service\Siwe;

use kornrunner\Keccak;
use kornrunner\Secp256k1;
use kornrunner\Signature\Signature;

/**
 * Verifies an EIP-4361 (SIWE) signed message + signature pair.
 *
 * The wallet signs an "Ethereum signed message" of the form:
 *
 *     "\x19Ethereum Signed Message:\n" . strlen($msg) . $msg
 *
 * hashed with Keccak-256, then the secp256k1 signature is ECDSA over
 * that digest. To verify, we recover the public key from the digest
 * + signature (the canonical `ecrecover` operation), derive the
 * Ethereum address from `keccak256(pubkey)[12:]`, and compare it to
 * the address embedded in the SIWE message.
 *
 * On match we consume the Redis nonce so the signature can't be
 * replayed. On mismatch the nonce is also consumed — a SIWE message
 * is one-shot regardless of whether the verifier accepted it.
 */
final class SiweVerifier
{
    /** @var list<int> Allowed chain IDs (e.g. [1, 8453, 137]). Empty list = accept any. */
    private array $allowedChainIds;

    public function __construct(
        private readonly SiweMessageParser $parser,
        private readonly SiweNonceService $nonces,
        string $allowedChainIdsCsv = '',
    ) {
        $this->allowedChainIds = array_values(array_filter(array_map(
            'intval',
            array_filter(array_map('trim', explode(',', $allowedChainIdsCsv))),
        )));
    }

    /**
     * @throws SiweVerificationException on any failure (bad parse, bad nonce, bad sig).
     */
    public function verify(string $message, string $signature): ParsedSiweMessage
    {
        try {
            $parsed = $this->parser->parse($message);
        } catch (\InvalidArgumentException $e) {
            throw new SiweVerificationException('Malformed SIWE message: '.$e->getMessage(), previous: $e);
        }

        // Chain ID allowlist
        if ($this->allowedChainIds !== [] && !\in_array($parsed->chainId, $this->allowedChainIds, true)) {
            throw new SiweVerificationException("Chain ID {$parsed->chainId} not in allowlist.");
        }

        // Expiration
        if ($parsed->expirationTime !== null && $parsed->expirationTime < new \DateTimeImmutable()) {
            throw new SiweVerificationException('SIWE message has expired.');
        }

        // Nonce — single-use, consumed regardless of signature outcome
        $storedNonce = $this->nonces->consume($parsed->address);
        if ($storedNonce === null) {
            throw new SiweVerificationException('No outstanding nonce for this address (expired or already consumed).');
        }
        if (!hash_equals($storedNonce, $parsed->nonce)) {
            throw new SiweVerificationException('Nonce in SIWE message does not match issued nonce.');
        }

        // Recover the address from the signature and compare
        $recovered = $this->recoverAddress($message, $signature);
        if (!hash_equals(strtolower($recovered), strtolower($parsed->address))) {
            throw new SiweVerificationException(
                sprintf('Signature recovered address %s does not match claimed %s.', $recovered, $parsed->address),
            );
        }

        return $parsed;
    }

    /**
     * Recover the 0x-prefixed Ethereum address that produced `signature`
     * over an Ethereum-signed `message`.
     */
    private function recoverAddress(string $message, string $signature): string
    {
        $sig = ltrim($signature, '0x');
        if (\strlen($sig) !== 130) {
            throw new SiweVerificationException('Signature must be 65 bytes (130 hex chars + optional 0x prefix).');
        }
        $r = substr($sig, 0, 64);
        $s = substr($sig, 64, 64);
        $v = (int) hexdec(substr($sig, 128, 2));
        // EIP-155 / legacy v: 27/28 → recovery id 0/1
        $recoveryId = $v >= 27 ? $v - 27 : $v;
        if ($recoveryId < 0 || $recoveryId > 1) {
            throw new SiweVerificationException("Invalid signature recovery byte (v=$v).");
        }

        // "\x19Ethereum Signed Message:\n<len><msg>" — Keccak-256 of that is the digest
        $prefix = "\x19Ethereum Signed Message:\n".\strlen($message);
        $hashHex = Keccak::hash($prefix.$message, 256);

        $secp = new Secp256k1();
        $publicKeyHex = $secp->recoverPublicKey($hashHex, new Signature($r, $s), $recoveryId);

        // Strip leading 0x04 (uncompressed point marker), keccak256(64 bytes)[12:] is the address
        $pubKeyBytes = hex2bin(ltrim($publicKeyHex, '04'));
        if ($pubKeyBytes === false || \strlen($pubKeyBytes) !== 64) {
            throw new SiweVerificationException('Could not derive public key bytes from signature.');
        }
        $addressHex = substr(Keccak::hash($pubKeyBytes, 256), 24);

        return '0x'.strtolower($addressHex);
    }
}
