<?php

declare(strict_types=1);

namespace App\Command;

use App\Enum\RoundStatus;
use App\Repository\RoundRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;

/**
 * Promote rounds through their lifecycle based on wall-clock:
 *   scheduled → open    when opensAt has passed
 *   open      → closed  when closesAt has passed
 *
 * Idempotent — designed to run every minute via cron. The closed → resolved
 * transition is intentionally NOT automatic: an admin (or future oracle)
 * supplies the answer coordinates via POST /api/admin/rounds/{id}/resolve.
 */
#[AsCommand(
    name: 'app:rounds:tick',
    description: 'Advance round statuses based on the current time. Idempotent — safe to run on a cron tick.',
)]
final class RoundsTickCommand extends Command
{
    public function __construct(
        private readonly RoundRepository $rounds,
        private readonly EntityManagerInterface $em,
    ) {
        parent::__construct();
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $now = new \DateTimeImmutable();
        $opened = 0;
        $closed = 0;

        foreach ($this->rounds->findDueToOpen($now) as $round) {
            $round->setStatus(RoundStatus::Open);
            ++$opened;
            $output->writeln(sprintf('  opened  #%d %s', $round->getNumber(), (string) $round->getId()));
        }

        foreach ($this->rounds->findDueToClose($now) as $round) {
            $round->setStatus(RoundStatus::Closed);
            ++$closed;
            $output->writeln(sprintf('  closed  #%d %s', $round->getNumber(), (string) $round->getId()));
        }

        if ($opened > 0 || $closed > 0) {
            $this->em->flush();
        }

        $output->writeln(sprintf('tick @ %s — opened=%d closed=%d', $now->format(\DateTimeInterface::ATOM), $opened, $closed));

        return Command::SUCCESS;
    }
}
