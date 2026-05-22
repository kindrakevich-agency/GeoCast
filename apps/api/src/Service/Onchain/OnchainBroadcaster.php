<?php

declare(strict_types=1);

namespace App\Service\Onchain;

use Psr\Log\LoggerInterface;
use Psr\Log\NullLogger;
use Symfony\Component\Process\Process;

/**
 * Shells out to Foundry's `cast send` to broadcast transactions from a
 * server-held resolver wallet. Why cast and not native PHP secp256k1 +
 * RLP signing: cast handles EIP-1559 fees, nonce management, and the
 * Base Sepolia gas oracle quirks for free. Reinventing it in PHP would
 * be 600+ lines of crypto + lots of edge cases.
 *
 * No-op when ONCHAIN_RESOLVER_PRIVATE_KEY is unset → command-line callers
 * keep working unchanged on environments without a configured key
 * (CI, dev, etc.).
 *
 * SAFETY GUARDS:
 *   • Hard-codes a refusal on chainId 8453 (Base mainnet). Auto-resolving
 *     on mainnet with a server-held key would be a real-money attack
 *     surface (server compromise = arbitrary payouts). Mainnet should
 *     use a Gnosis Safe + human signer.
 *   • Logs every broadcast attempt to monolog.
 *
 * Configuration (apps/api/.env.local on the server):
 *   ONCHAIN_RESOLVER_PRIVATE_KEY=0x…
 *   ONCHAIN_RESOLVER_ADDRESS=0x…  (used for diagnostics only)
 *   ONCHAIN_POOL_ADDRESS=0x1160c91c9cce77e19699f604622af9e7e7420e70
 *   ONCHAIN_RPC_URL=https://sepolia.base.org
 *   ONCHAIN_CHAIN_ID=84532
 *
 * The CAST_BIN env var (or /root/.foundry/bin/cast as a fallback) tells
 * us where the cast binary lives.
 */
final class OnchainBroadcaster
{
    /** Hard guard — refusal on Base mainnet. */
    private const MAINNET_CHAIN_ID = 8453;

    /** Coords are stored in the contract as int32, microdegrees. */
    private const COORD_SCALE = 1_000_000;

    public function __construct(
        private readonly ?string $privateKey,
        private readonly ?string $poolAddress,
        private readonly ?string $rpcUrl,
        private readonly ?int $chainId,
        private readonly string $castBin = '/root/.foundry/bin/cast',
        private readonly LoggerInterface $logger = new NullLogger(),
    ) {
        // Constructor params are nullable because Symfony's
        // %env(default::VAR)% resolves to null when the env var isn't
        // set — typical state on CI / dev. isEnabled() handles the
        // null-equivalent-to-disabled mapping.
    }

    /**
     * True when the env is configured AND we're on a chain we're willing
     * to auto-broadcast on.
     */
    public function isEnabled(): bool
    {
        if (
            $this->privateKey === null || $this->privateKey === ''
            || $this->poolAddress === null || $this->poolAddress === ''
            || $this->rpcUrl === null || $this->rpcUrl === ''
        ) {
            return false;
        }
        if ($this->chainId === self::MAINNET_CHAIN_ID) {
            // Refuse to auto-sign on mainnet — server-held keys are
            // testnet-only territory.
            return false;
        }
        return is_executable($this->castBin);
    }

    /**
     * Broadcast GeoCastPool.createRound(roundId, opensAt, closesAt, revealsAt).
     * Returns the tx hash on success, null on failure (caller logs + continues).
     */
    public function createRound(
        int $roundNumber,
        \DateTimeImmutable $opensAt,
        \DateTimeImmutable $closesAt,
        \DateTimeImmutable $revealsAt,
    ): ?string {
        if (!$this->isEnabled()) {
            $this->logger->info('OnchainBroadcaster disabled — skipping createRound', [
                'roundNumber' => $roundNumber,
            ]);
            return null;
        }

        $args = [
            $this->poolAddress,
            'createRound(uint64,uint64,uint64,uint64)',
            (string) $roundNumber,
            (string) $opensAt->getTimestamp(),
            (string) $closesAt->getTimestamp(),
            (string) $revealsAt->getTimestamp(),
        ];

        return $this->send($args, 'createRound', ['roundNumber' => $roundNumber]);
    }

    /**
     * Broadcast GeoCastPool.resolve(roundId, lat, lng, merkleRoot).
     * Coords are passed in degrees; the contract expects microdegree int32.
     */
    public function resolve(
        int $roundNumber,
        float $answerLat,
        float $answerLng,
        string $merkleRoot,
    ): ?string {
        if (!$this->isEnabled()) {
            $this->logger->info('OnchainBroadcaster disabled — skipping resolve', [
                'roundNumber' => $roundNumber,
            ]);
            return null;
        }

        $latMicros = (int) round($answerLat * self::COORD_SCALE);
        $lngMicros = (int) round($answerLng * self::COORD_SCALE);

        $args = [
            $this->poolAddress,
            'resolve(uint64,int32,int32,bytes32)',
            (string) $roundNumber,
            (string) $latMicros,
            (string) $lngMicros,
            $merkleRoot,
        ];

        return $this->send($args, 'resolve', [
            'roundNumber' => $roundNumber,
            'lat' => $answerLat,
            'lng' => $answerLng,
        ]);
    }

    /**
     * @param list<string> $contractArgs
     * @param array<string, mixed> $logContext
     */
    private function send(array $contractArgs, string $opName, array $logContext): ?string
    {
        // isEnabled() already null-checked these — the assertion exists
        // to convince the typechecker.
        \assert($this->rpcUrl !== null && $this->privateKey !== null);
        $cmd = [
            $this->castBin,
            'send',
            ...$contractArgs,
            '--rpc-url', $this->rpcUrl,
            '--private-key', $this->privateKey,
            '--json',
        ];

        // 60s should easily cover a Base Sepolia tx (2s confirms typically).
        $proc = new Process($cmd, timeout: 60);
        // Don't inherit the parent's env — the key is already in the args.
        $proc->setEnv(['PATH' => '/usr/bin:/bin:/usr/local/bin']);

        try {
            $proc->mustRun();
        } catch (\Throwable $e) {
            // mustRun() throws on non-zero exit. cast prints the revert
            // reason / error to stderr.
            $this->logger->error('OnchainBroadcaster ' . $opName . ' failed', $logContext + [
                'stderr' => trim($proc->getErrorOutput()),
                'stdout' => trim($proc->getOutput()),
                'exit'   => $proc->getExitCode(),
            ]);
            return null;
        }

        $raw = trim($proc->getOutput());
        // cast --json emits: { transactionHash, ... }. Pull the hash.
        $txHash = null;
        $decoded = json_decode($raw, true);
        if (\is_array($decoded) && isset($decoded['transactionHash']) && \is_string($decoded['transactionHash'])) {
            $txHash = $decoded['transactionHash'];
        }

        $this->logger->info('OnchainBroadcaster ' . $opName . ' sent', $logContext + ['txHash' => $txHash]);
        return $txHash;
    }
}
