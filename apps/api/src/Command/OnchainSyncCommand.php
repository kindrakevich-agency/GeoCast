<?php

declare(strict_types=1);

namespace App\Command;

use App\Service\Onchain\OnchainSync;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;

/**
 * Cron wrapper for OnchainSync::tick(). Designed to run every 30s on the
 * Hetzner box, same pattern as `app:rounds:tick`. Install with:
 *
 *   "* /30 * * * * cd /www/wwwroot/geocast.kindrakevich.com/apps/api && \
 *     APP_ENV=prod /www/server/php/83/bin/php bin/console app:onchain:sync \
 *     >> /var/log/geocast-onchain-sync.log 2>&1"
 *
 * (drop the quotes + the space-after-asterisk when copying — the space is
 * a workaround for the close-comment digraph in this docblock.)
 *
 * No-op when the contract address isn't configured (env var unset / 0x0).
 */
#[AsCommand(
    name: 'app:onchain:sync',
    description: 'Mirror new GeoCastPool events from Base into MariaDB.',
)]
final class OnchainSyncCommand extends Command
{
    public function __construct(private readonly OnchainSync $sync)
    {
        parent::__construct();
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        try {
            $ingested = $this->sync->tick();
            $output->writeln(sprintf(
                'tick @ %s — ingested=%d',
                (new \DateTimeImmutable())->format(\DateTimeInterface::ATOM),
                $ingested,
            ));
            return Command::SUCCESS;
        } catch (\Throwable $e) {
            $output->writeln(sprintf(
                '<error>onchain sync failed: %s</error>',
                $e->getMessage(),
            ));
            return Command::FAILURE;
        }
    }
}
