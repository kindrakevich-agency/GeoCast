<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * settlement_proofs — per-player Merkle leaf + proof, computed off-chain
 * after the reveal window closes. The frontend reads from here so the
 * "Claim" button can post the right `(amount, proof[])` to GeoCastPool.
 *
 * One row per (round_id, player_address). round_id is the on-chain uint64
 * round number, mirroring rounds.number.
 */
final class Version20260520000002SettlementProofs extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'v2: settlement_proofs table';
    }

    public function up(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            CREATE TABLE settlement_proofs (
                round_id BIGINT UNSIGNED NOT NULL,
                player_address VARCHAR(42) NOT NULL,
                amount_micros BIGINT UNSIGNED NOT NULL,
                proof_json TEXT NOT NULL,
                merkle_root VARCHAR(66) NOT NULL,
                distance_km DOUBLE NULL,
                rank_pos INT NULL,
                created_at DATETIME NOT NULL,
                claimed_tx_hash VARCHAR(66) NULL,
                PRIMARY KEY (round_id, player_address),
                KEY idx_player (player_address),
                KEY idx_round (round_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        SQL);
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP TABLE IF EXISTS settlement_proofs');
    }
}
