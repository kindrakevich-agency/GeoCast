<?php

declare(strict_types=1);

namespace App\Service\Onchain;

use Doctrine\DBAL\Connection;
use Psr\Log\LoggerInterface;
use Psr\Log\NullLogger;

/**
 * Polls Base RPC for GeoCastPool events and mirrors them into MariaDB.
 *
 * Designed to run on a cron tick (every 30s). Stateless across invocations
 * — the `onchain_sync` table holds the cursor (last block we've fully
 * ingested), so a missed tick is automatically caught up on the next run.
 *
 * Idempotent at the log-row granularity: events are deduped by
 * (chain_id, block_number, log_index) UNIQUE constraint. Re-running across
 * the same window cannot create duplicates.
 *
 * No-op if any of contractAddress / rpcUrl / chainId are zero/empty —
 * lets us ship this code before the contract is actually deployed.
 */
final class OnchainSync
{
    /** Max blocks per eth_getLogs call. Most providers cap at 1000–10000. */
    private const MAX_BLOCK_WINDOW = 1_000;

    /** Don't trust the chain head — wait this many confirmations. */
    private const CONFIRMATIONS = 2;

    public function __construct(
        private readonly Connection $db,
        private readonly EthRpcClient $rpc,
        private readonly EventDecoder $decoder,
        private readonly int $chainId,
        private readonly string $contractAddress,
        private readonly int $genesisBlock,  // block at which contract was deployed
        private readonly LoggerInterface $logger = new NullLogger(),
    ) {
    }

    /**
     * Run one sync tick. Returns the number of new events ingested.
     */
    public function tick(): int
    {
        if ($this->contractAddress === '' || str_starts_with($this->contractAddress, '0x0000')) {
            return 0; // not configured yet
        }

        $head = $this->rpc->blockNumber() - self::CONFIRMATIONS;
        if ($head <= 0) {
            return 0;
        }

        $cursor = $this->loadCursor();
        if ($cursor === 0) {
            // First run — start from genesis (where the contract was deployed).
            $cursor = max(0, $this->genesisBlock - 1);
        }

        if ($cursor >= $head) {
            return 0; // up-to-date
        }

        $fromBlock = $cursor + 1;
        $toBlock = min($head, $fromBlock + self::MAX_BLOCK_WINDOW - 1);

        $logs = $this->rpc->getLogs(
            $this->contractAddress,
            $fromBlock,
            $toBlock,
            $this->decoder->allTopics(),
        );

        $ingested = 0;
        $this->db->beginTransaction();
        try {
            foreach ($logs as $log) {
                $event = $this->decoder->decode($log);
                if ($event === null) {
                    continue;
                }
                $this->insertEvent($event);
                $ingested++;
            }
            $this->saveCursor($toBlock);
            $this->db->commit();
        } catch (\Throwable $e) {
            $this->db->rollBack();
            throw $e;
        }

        $this->logger->info('onchain_sync tick', [
            'chain' => $this->chainId,
            'from' => $fromBlock,
            'to' => $toBlock,
            'ingested' => $ingested,
        ]);

        return $ingested;
    }

    private function loadCursor(): int
    {
        $row = $this->db->fetchAssociative(
            'SELECT last_block FROM onchain_sync WHERE chain_id = ? AND contract_address = ?',
            [$this->chainId, strtolower($this->contractAddress)],
        );
        return $row === false ? 0 : (int) $row['last_block'];
    }

    private function saveCursor(int $block): void
    {
        $this->db->executeStatement(
            'INSERT INTO onchain_sync (chain_id, contract_address, last_block, updated_at)
             VALUES (?, ?, ?, NOW())
             ON DUPLICATE KEY UPDATE last_block = VALUES(last_block), updated_at = NOW()',
            [$this->chainId, strtolower($this->contractAddress), $block],
        );
    }

    /**
     * @param array<string, mixed> $event
     */
    private function insertEvent(array $event): void
    {
        $this->db->executeStatement(
            'INSERT IGNORE INTO onchain_events
             (chain_id, contract_address, block_number, log_index, tx_hash,
              event_name, round_id, player_address, payload_json, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())',
            [
                $this->chainId,
                strtolower($this->contractAddress),
                $event['blockNumber'],
                $event['logIndex'],
                $event['txHash'],
                $event['event'],
                $event['roundId'] ?? null,
                isset($event['player']) ? strtolower($event['player']) : null,
                json_encode($event, \JSON_UNESCAPED_SLASHES),
            ],
        );
    }
}
