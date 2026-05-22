<?php

declare(strict_types=1);

namespace App\Command;

use App\Enum\RoundStatus;
use App\Repository\RoundRepository;
use App\Service\Onchain\OnchainBroadcaster;
use App\Service\Onchain\SettlementBuilder;
use App\Service\Questions\ResolverRegistry;
use App\Service\Round\ResolveRoundService;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;

/**
 * Auto-resolves rounds whose auto_resolver_code is set and whose
 * resolves_at has passed. Looks up the resolver in the registry, calls
 * resolve(), and hands the AnswerPoint[] off to ResolveRoundService.
 *
 * Graceful degradation: a resolver that throws (data source down, no
 * answer yet) leaves the round unresolved. Next tick retries. After
 * some patience the admin can step in manually via the existing
 * /api/admin/rounds/{id}/resolve flow.
 *
 * Recommended cron: every 5 minutes (or every minute — it's cheap when
 * there's nothing to do).
 */
#[AsCommand(
    name: 'app:rounds:auto-resolve',
    description: 'Resolve closed rounds whose auto_resolver_code is set, by calling the registered resolver.',
)]
final class RoundsAutoResolveCommand extends Command
{
    public function __construct(
        private readonly RoundRepository $rounds,
        private readonly ResolverRegistry $registry,
        private readonly ResolveRoundService $resolver,
        private readonly OnchainBroadcaster $broadcaster,
        private readonly SettlementBuilder $settler,
    ) {
        parent::__construct();
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $now = new \DateTimeImmutable();
        $candidates = $this->rounds->findDueForAutoResolve($now);

        if ($candidates === []) {
            $output->writeln('<comment>no rounds due for auto-resolve</comment>');
            return Command::SUCCESS;
        }

        $resolved = 0;
        $deferred = 0;
        foreach ($candidates as $round) {
            $code = $round->getAutoResolverCode();
            if ($code === null) {
                continue; // shouldn't happen — repo filters this
            }
            if (!$this->registry->has($code)) {
                $output->writeln(sprintf(
                    '<error>  #%d: resolver "%s" not in registry — skipping.</error>',
                    $round->getNumber(), $code,
                ));
                ++$deferred;
                continue;
            }

            try {
                $result = $this->registry->get($code)->resolve(
                    $round->getAutoResolverParams() ?? [],
                    $now,
                );
                $this->resolver->resolveMulti($round, $result->points);
                ++$resolved;
                $output->writeln(sprintf(
                    '<info>  #%d resolved via %s — %d winner%s (%s)</info>',
                    $round->getNumber(),
                    $code,
                    \count($result->points),
                    \count($result->points) === 1 ? '' : 's',
                    implode(', ', array_map(static fn ($p) => $p->name, $result->points)),
                ));

                // Best-effort on-chain mirror: if the round has any on-chain
                // commits, settle them (build the Merkle root) and broadcast
                // resolve() so claim() works for those players. Broadcaster
                // is a no-op when the resolver key isn't configured. The
                // settler throws if no commits exist (credit-only round) —
                // we swallow that and move on.
                $first = $result->points[0];
                try {
                    $settled = $this->settler->settle(
                        $round->getNumber(),
                        $first->lat,
                        $first->lng,
                    );
                    $txHash = $this->broadcaster->resolve(
                        $round->getNumber(),
                        $first->lat,
                        $first->lng,
                        $settled['merkleRoot'],
                    );
                    if ($txHash !== null) {
                        $output->writeln(sprintf(
                            '<info>    ↳ on-chain resolve: %s</info>',
                            $txHash,
                        ));
                    }
                } catch (\Throwable $e) {
                    // No on-chain commits / settler errored — credit-only
                    // round. Off-chain resolution already succeeded above.
                    $output->writeln(sprintf(
                        '    ↳ no on-chain settle (%s)',
                        $e->getMessage(),
                    ));
                }
            } catch (\Throwable $e) {
                ++$deferred;
                $output->writeln(sprintf(
                    '<comment>  #%d deferred — %s</comment>',
                    $round->getNumber(),
                    $e->getMessage(),
                ));
            }
        }

        $output->writeln(sprintf('<info>Done — %d resolved · %d deferred</info>', $resolved, $deferred));
        return Command::SUCCESS;
    }
}
