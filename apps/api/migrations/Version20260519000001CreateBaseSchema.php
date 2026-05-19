<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Initial schema for GeoCast — users, rounds, predictions.
 *
 * Note on coordinates: Doctrine ORM stores lat/lng as separate FLOAT columns
 * (clean, portable). For spatial queries we add a generated POINT column
 * (SRID 4326) plus a SPATIAL INDEX. The application reads lat/lng via the
 * Doctrine entity; raw DQL/SQL can call ST_Distance_Sphere on the POINT.
 */
final class Version20260519000001CreateBaseSchema extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Initial schema: users, rounds, predictions (with SPATIAL POINT + INDEX on predictions.coords)';
    }

    public function up(Schema $schema): void
    {
        // -------- users --------
        $this->addSql(<<<'SQL'
            CREATE TABLE users (
                id BINARY(16) NOT NULL,
                wallet_address VARCHAR(42) NOT NULL,
                credits_balance INT NOT NULL DEFAULT 100,
                games_played INT NOT NULL DEFAULT 0,
                total_score DOUBLE PRECISION NOT NULL DEFAULT 0,
                is_admin TINYINT(1) NOT NULL DEFAULT 0,
                created_at DATETIME NOT NULL COMMENT '(DC2Type:datetime_immutable)',
                UNIQUE INDEX UNIQ_users_wallet_address (wallet_address),
                INDEX idx_users_wallet (wallet_address),
                PRIMARY KEY(id)
            ) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB
        SQL);

        // -------- rounds --------
        $this->addSql(<<<'SQL'
            CREATE TABLE rounds (
                id BINARY(16) NOT NULL,
                question VARCHAR(280) NOT NULL,
                description LONGTEXT NULL,
                opens_at DATETIME NOT NULL COMMENT '(DC2Type:datetime_immutable)',
                closes_at DATETIME NOT NULL COMMENT '(DC2Type:datetime_immutable)',
                resolves_at DATETIME NULL COMMENT '(DC2Type:datetime_immutable)',
                status VARCHAR(16) NOT NULL DEFAULT 'scheduled',
                answer_lat DOUBLE PRECISION NULL,
                answer_lng DOUBLE PRECISION NULL,
                total_participants INT NOT NULL DEFAULT 0,
                pool_credits INT NOT NULL DEFAULT 0,
                created_at DATETIME NOT NULL COMMENT '(DC2Type:datetime_immutable)',
                resolved_at DATETIME NULL COMMENT '(DC2Type:datetime_immutable)',
                INDEX idx_rounds_status_closes (status, closes_at),
                PRIMARY KEY(id)
            ) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB
        SQL);

        // -------- predictions --------
        // `rank` is a reserved word in MariaDB 10.2+ window-function syntax — backticked.
        // `coords` is a STORED generated column from lat/lng → POINT(SRID 4326), then SPATIAL-indexed.
        $this->addSql(<<<'SQL'
            CREATE TABLE predictions (
                id BINARY(16) NOT NULL,
                user_id BINARY(16) NOT NULL,
                round_id BINARY(16) NOT NULL,
                lat DOUBLE PRECISION NOT NULL,
                lng DOUBLE PRECISION NOT NULL,
                coords POINT GENERATED ALWAYS AS (ST_SRID(POINT(lng, lat), 4326)) STORED NOT NULL,
                credits_staked INT NOT NULL DEFAULT 1,
                distance_km DOUBLE PRECISION NULL,
                `rank` INT NULL,
                payout INT NOT NULL DEFAULT 0,
                placed_at DATETIME NOT NULL COMMENT '(DC2Type:datetime_immutable)',
                UNIQUE INDEX uniq_predictions_user_round (user_id, round_id),
                INDEX idx_predictions_round_distance (round_id, distance_km),
                SPATIAL INDEX idx_predictions_coords (coords),
                PRIMARY KEY(id)
            ) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB
        SQL);

        $this->addSql(<<<'SQL'
            ALTER TABLE predictions
              ADD CONSTRAINT FK_predictions_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
              ADD CONSTRAINT FK_predictions_round FOREIGN KEY (round_id) REFERENCES rounds (id) ON DELETE CASCADE
        SQL);
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE predictions DROP FOREIGN KEY FK_predictions_user');
        $this->addSql('ALTER TABLE predictions DROP FOREIGN KEY FK_predictions_round');
        $this->addSql('DROP TABLE predictions');
        $this->addSql('DROP TABLE rounds');
        $this->addSql('DROP TABLE users');
    }
}
