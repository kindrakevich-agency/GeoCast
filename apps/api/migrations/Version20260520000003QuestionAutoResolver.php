<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Auto-resolver scaffolding for daily-question automation.
 *
 * Three pieces:
 *
 * 1. rounds.auto_resolver_code + .auto_resolver_params — when a round is
 *    created from a Suggestion (admin-accepted), these point at the
 *    resolver registry entry that knows how to fetch the truth from an
 *    external API at resolves_at time.
 *
 * 2. rounds.answer_points — multi-winner support. answer_lat/answer_lng
 *    stay populated with the *first* winner for backwards-compat with
 *    existing single-answer code paths; answer_points is the JSON array
 *    `[{lat, lng, name}, …]` consulted by the multi-winner distance math.
 *    NULL = legacy single-answer round.
 *
 * 3. round_suggestions — admin-pickable candidate questions, written by
 *    app:questions:suggest. Admin accepts one to materialize a Round
 *    with auto_resolver_code wired in.
 */
final class Version20260520000003QuestionAutoResolver extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'auto-resolver: round_suggestions + auto_resolver_code/params + answer_points';
    }

    public function up(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            ALTER TABLE rounds
                ADD COLUMN auto_resolver_code VARCHAR(64) NULL,
                ADD COLUMN auto_resolver_params JSON NULL,
                ADD COLUMN answer_points JSON NULL
        SQL);

        $this->addSql(<<<'SQL'
            CREATE TABLE round_suggestions (
                id BINARY(16) NOT NULL,
                resolver_code VARCHAR(64) NOT NULL,
                resolver_params JSON NOT NULL,
                proposed_question VARCHAR(280) NOT NULL,
                proposed_opens_at DATETIME NOT NULL,
                proposed_closes_at DATETIME NOT NULL,
                proposed_resolves_at DATETIME NOT NULL,
                preview_json JSON NULL,
                status VARCHAR(16) NOT NULL,
                created_at DATETIME NOT NULL,
                used_for_round_id BINARY(16) NULL,
                PRIMARY KEY (id),
                KEY idx_status (status, created_at),
                CONSTRAINT chk_status CHECK (status IN ('pending','accepted','rejected','expired'))
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        SQL);
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP TABLE round_suggestions');
        $this->addSql(<<<'SQL'
            ALTER TABLE rounds
                DROP COLUMN auto_resolver_code,
                DROP COLUMN auto_resolver_params,
                DROP COLUMN answer_points
        SQL);
    }
}
