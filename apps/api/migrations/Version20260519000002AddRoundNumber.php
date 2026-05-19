<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Adds rounds.number — sequential display number (#482 style).
 *
 * Unique-constrained at the DB level. The round-create service is
 * responsible for issuing the next number atomically (MAX(number)+1
 * inside a transaction works for our throughput).
 */
final class Version20260519000002AddRoundNumber extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Add rounds.number (sequential display number, unique)';
    }

    public function up(Schema $schema): void
    {
        // Add column; default 0 lets existing rows (if any) pass NOT NULL,
        // then we'll backfill with row_number ordering by created_at.
        $this->addSql('ALTER TABLE rounds ADD number INT NOT NULL DEFAULT 0');
        $this->addSql(<<<'SQL'
            UPDATE rounds r
            JOIN (
                SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) AS rn FROM rounds
            ) AS o ON o.id = r.id
            SET r.number = o.rn
        SQL);
        $this->addSql('ALTER TABLE rounds MODIFY COLUMN number INT NOT NULL');
        $this->addSql('ALTER TABLE rounds ADD UNIQUE INDEX uniq_rounds_number (number)');
        // Drop the placeholder default so future inserts must supply a value
        $this->addSql('ALTER TABLE rounds ALTER number DROP DEFAULT');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE rounds DROP INDEX uniq_rounds_number');
        $this->addSql('ALTER TABLE rounds DROP COLUMN number');
    }
}
