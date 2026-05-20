<?php

declare(strict_types=1);

namespace App\Command;

use App\Service\Onchain\SettlementBuilder;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputArgument;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;

/**
 * Off-chain settler. Run after the reveal window closes:
 *
 *   bin/console app:rounds:settle <roundId> <answerLat> <answerLng>
 *
 * Pulls the Revealed events for the round from onchain_events, runs the
 * 1/(1+d) payout formula via MerkleBuilder, persists per-player proofs
 * to settlement_proofs, and prints the merkleRoot + suggested resolve()
 * tx data for the admin to broadcast via /admin.
 *
 * Idempotent — re-running with the same args overwrites the proofs
 * (caller can iterate on the answer before submitting on-chain). Once
 * the on-chain resolve() lands, claim() begins working immediately.
 */
#[AsCommand(
    name: 'app:rounds:settle',
    description: 'Build the Merkle settlement for a round, prepare claim proofs.',
)]
final class RoundsSettleCommand extends Command
{
    public function __construct(private readonly SettlementBuilder $settler)
    {
        parent::__construct();
    }

    protected function configure(): void
    {
        $this
            ->addArgument('roundId', InputArgument::REQUIRED, 'On-chain round id (uint64)')
            ->addArgument('answerLat', InputArgument::REQUIRED, 'Truth latitude in degrees, e.g. 38.72')
            ->addArgument('answerLng', InputArgument::REQUIRED, 'Truth longitude in degrees, e.g. -9.14');
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $roundId = (int) $input->getArgument('roundId');
        $lat = (float) $input->getArgument('answerLat');
        $lng = (float) $input->getArgument('answerLng');

        try {
            $result = $this->settler->settle($roundId, $lat, $lng);
        } catch (\Throwable $e) {
            $output->writeln('<error>'.$e->getMessage().'</error>');
            return Command::FAILURE;
        }

        $output->writeln(sprintf('round #%d settled', $roundId));
        $output->writeln(sprintf('  answer:        %f, %f', $lat, $lng));
        $output->writeln(sprintf('  leaves:        %d', $result['leafCount']));
        $output->writeln(sprintf('  payout total:  %d micros (%.6f USDC)', $result['totalPayoutMicros'], $result['totalPayoutMicros'] / 1_000_000));
        $output->writeln(sprintf('  rake:          %d micros (%.6f USDC)',  $result['rakeMicros'], $result['rakeMicros'] / 1_000_000));
        $output->writeln(sprintf('  dust:          %d micros',             $result['dustMicros']));
        $output->writeln(sprintf('  merkleRoot:    %s',                    $result['merkleRoot']));
        $output->writeln('');
        $output->writeln('Next step: admin opens /admin → round → "Resolve on chain", which');
        $output->writeln('submits resolve(roundId, lat*1e6, lng*1e6, merkleRoot) via their wallet.');

        return Command::SUCCESS;
    }
}
