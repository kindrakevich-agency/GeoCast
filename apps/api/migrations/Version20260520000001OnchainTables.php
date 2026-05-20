<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Two operational tables for the v2 on-chain event mirror:
 *
 *   onchain_sync   — single row per (chain_id, contract). Cursor of the
 *                    last block we've ingested. Cron command reads + writes.
 *   onchain_events — append-only log of decoded GeoCastPool events. The
 *                    domain code (predictions/rounds) reads from here later
 *                    to surface chain state in the existing UI.
 */
final class Version20260520000001OnchainTables extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'v2: onchain_sync + onchain_events tables';
    }

    public function up(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            CREATE TABLE onchain_sync (
                chain_id INT NOT NULL,
                contract_address VARCHAR(42) NOT NULL,
                last_block BIGINT NOT NULL DEFAULT 0,
                updated_at DATETIME NOT NULL,
                PRIMARY KEY (chain_id, contract_address)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        SQL);

        $this->addSql(<<<'SQL'
            CREATE TABLE onchain_events (
                id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                chain_id INT NOT NULL,
                contract_address VARCHAR(42) NOT NULL,
                block_number BIGINT NOT NULL,
                log_index INT NOT NULL,
                tx_hash VARCHAR(66) NOT NULL,
                event_name VARCHAR(32) NOT NULL,
                round_id BIGINT NULL,
                player_address VARCHAR(42) NULL,
                payload_json TEXT NOT NULL,
                created_at DATETIME NOT NULL,
                UNIQUE KEY uniq_log_position (chain_id, block_number, log_index),
                KEY idx_event_name (event_name),
                KEY idx_round (round_id),
                KEY idx_player (player_address)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        SQL);
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP TABLE IF EXISTS onchain_events');
        $this->addSql('DROP TABLE IF EXISTS onchain_sync');
    }
}
