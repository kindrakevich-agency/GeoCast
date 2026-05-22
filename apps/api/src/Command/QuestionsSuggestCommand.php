<?php

declare(strict_types=1);

namespace App\Command;

use App\Entity\Round;
use App\Entity\RoundSuggestion;
use App\Enum\RoundStatus;
use App\Enum\SuggestionStatus;
use App\Service\Onchain\OnchainBroadcaster;
use App\Service\Questions\ResolverRegistry;
use App\Service\Questions\SuggestionDraft;
use App\Service\Round\RoundService;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;

/**
 * Walks every registered resolver and asks each for a candidate
 * suggestion. Persists the non-null ones to round_suggestions for admin
 * to pick and publish.
 *
 * With --auto-publish, each new draft immediately materializes into a
 * Round (status=scheduled, auto_resolver_code wired) — no admin click.
 *
 * With --continuous (which implies --auto-publish), the command
 * re-timestamps each draft to chain-link with the previous round:
 *
 *   opens_at   = latest_round.closes_at + 1 second  (or NOW if no rounds)
 *   closes_at  = opens_at + 24h
 *   resolves_at= closes_at  (auto-resolve cron tolerates archive lag)
 *
 * Combined with --ensure-queued, the cron will maintain exactly one
 * future round at all times: when the latest is open or resolving, a
 * fresh #N+1 sits queued in scheduled state ready for the seamless
 * hand-off.
 *
 * Recommended cron line (continuous-rounds mode):
 *   * /5 * * * * bin/console app:questions:suggest \
 *                  --auto-publish --continuous --ensure-queued
 */
#[AsCommand(
    name: 'app:questions:suggest',
    description: 'Generate candidate questions from the resolver registry and write to round_suggestions.',
)]
final class QuestionsSuggestCommand extends Command
{
    /** Hard cap on pending suggestions — avoids the queue blowing up if admin stops picking. */
    private const MAX_PENDING = 20;

    /** Round duration in continuous mode. */
    private const ROUND_DURATION = 'PT24H';

    public function __construct(
        private readonly ResolverRegistry $registry,
        private readonly \App\Repository\RoundSuggestionRepository $suggestions,
        private readonly \App\Repository\RoundRepository $rounds,
        private readonly RoundService $roundService,
        private readonly EntityManagerInterface $em,
        private readonly OnchainBroadcaster $broadcaster,
    ) {
        parent::__construct();
    }

    protected function configure(): void
    {
        $this->addOption(
            'auto-publish',
            null,
            InputOption::VALUE_NONE,
            'Immediately accept each new draft and materialize a Round (no admin click needed).',
        );
        $this->addOption(
            'continuous',
            null,
            InputOption::VALUE_NONE,
            'Re-timestamp each draft so the new round starts exactly when the previous one ends. Implies --auto-publish.',
        );
        $this->addOption(
            'ensure-queued',
            null,
            InputOption::VALUE_NONE,
            'Skip if a scheduled round already exists — keeps the queue at exactly one future round.',
        );
        $this->addOption(
            'skip-if-active',
            null,
            InputOption::VALUE_NONE,
            '[deprecated] Skip if any scheduled/open/closed round exists. Use --ensure-queued for continuous mode.',
        );
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $autoPublish = (bool) $input->getOption('auto-publish');
        $continuous  = (bool) $input->getOption('continuous');
        $ensureQueued = (bool) $input->getOption('ensure-queued');
        $skipIfActive = (bool) $input->getOption('skip-if-active');

        // --continuous implies --auto-publish (the whole point is fully automatic round creation)
        if ($continuous) {
            $autoPublish = true;
        }

        // Legacy: --skip-if-active short-circuits if ANY non-resolved round exists.
        if ($skipIfActive && $this->hasActiveRound()) {
            $output->writeln('<comment>--skip-if-active: an active round already exists — skipping.</comment>');
            return Command::SUCCESS;
        }

        // New: --ensure-queued only skips if a SCHEDULED round is already queued.
        // Active (open/closed/resolving) rounds DON'T block — we want #N+1
        // ready before #N's closes_at, so the cron can publish while #N is
        // still open.
        if ($ensureQueued && $this->hasScheduledRound()) {
            $output->writeln('<comment>--ensure-queued: a scheduled round is already queued — skipping.</comment>');
            return Command::SUCCESS;
        }

        $existing = $this->suggestions->countPending();
        if ($existing >= self::MAX_PENDING) {
            $output->writeln(sprintf('<comment>queue already at %d pending — skipping.</comment>', $existing));
            return Command::SUCCESS;
        }

        // Compute the next opens_at slot for continuous mode. Once a round
        // exists this is the previous round's closes_at + 1s — seamless
        // hand-off. Before any rounds exist, falls back to next UTC midnight.
        $nextOpensAt = null;
        if ($continuous) {
            $latest = $this->latestRound();
            if ($latest !== null) {
                $nextOpensAt = $latest->getClosesAt()->modify('+1 second');
            } else {
                $nextOpensAt = (new \DateTimeImmutable('now', new \DateTimeZone('UTC')))
                    ->modify('+1 day')->setTime(0, 0, 0);
            }
        }

        $now = new \DateTimeImmutable();
        $written = 0;
        $published = 0;
        $skipped = 0;
        $errors = 0;

        foreach ($this->registry->all() as $resolver) {
            try {
                $draft = $resolver->suggest($now);
            } catch (\Throwable $e) {
                ++$errors;
                $output->writeln(sprintf(
                    '<error>  %s: suggest() threw: %s — %s</error>',
                    $resolver->code(),
                    $e::class,
                    $e->getMessage(),
                ));
                continue;
            }
            if ($draft === null) {
                ++$skipped;
                $output->writeln(sprintf('  %s: no candidate today', $resolver->code()));
                continue;
            }

            // Continuous mode: re-timestamp the draft so the round chains
            // directly off the previous round's closes_at.
            if ($continuous && $nextOpensAt !== null) {
                $closesAt = $nextOpensAt->add(new \DateInterval(self::ROUND_DURATION));
                $resolvesAt = $closesAt;
                $draft = new SuggestionDraft(
                    resolverCode: $draft->resolverCode,
                    resolverParams: ['date' => $nextOpensAt->format('Y-m-d')],
                    question: $draft->question,
                    opensAt: $nextOpensAt,
                    closesAt: $closesAt,
                    resolvesAt: $resolvesAt,
                    preview: $draft->preview,
                );
            }

            $suggestion = new RoundSuggestion(
                resolverCode: $draft->resolverCode,
                resolverParams: $draft->resolverParams,
                proposedQuestion: $draft->question,
                opensAt: $draft->opensAt,
                closesAt: $draft->closesAt,
                resolvesAt: $draft->resolvesAt,
                previewJson: $draft->preview === [] ? null : $draft->preview,
            );
            $this->em->persist($suggestion);
            ++$written;

            $output->writeln(sprintf(
                '<info>  %s → "%s" (opens %s)</info>',
                $resolver->code(),
                $draft->question,
                $draft->opensAt->format('Y-m-d H:i'),
            ));

            if ($autoPublish) {
                $round = $this->roundService->createWithAutoResolver(
                    $draft->question,
                    $draft->opensAt,
                    $draft->closesAt,
                    $draft->resolvesAt,
                    $draft->resolverCode,
                    $draft->resolverParams,
                );
                $suggestion->setStatus(SuggestionStatus::Accepted);
                $suggestion->setUsedForRoundId($round->getId());
                ++$published;
                $output->writeln(sprintf(
                    '<info>    ↳ auto-published as round #%d</info>',
                    $round->getNumber(),
                ));

                // Best-effort mirror to the GeoCastPool contract. Broadcaster
                // is a no-op when the resolver key isn't configured AND/OR
                // we're on mainnet — so this is safe to call unconditionally.
                // revealsAt = resolvesAt for now (reveal window collapses with
                // resolution in the credit-only flow; if any player committed
                // on-chain they get the full close→reveal→resolve cadence via
                // the existing manual flow on /admin).
                $txHash = $this->broadcaster->createRound(
                    $round->getNumber(),
                    $round->getOpensAt(),
                    $round->getClosesAt(),
                    $round->getResolvesAt() ?? $round->getClosesAt(),
                );
                if ($txHash !== null) {
                    $output->writeln(sprintf(
                        '<info>    ↳ on-chain createRound: %s</info>',
                        $txHash,
                    ));
                }
            }
        }

        $this->em->flush();

        if ($autoPublish) {
            $output->writeln(sprintf(
                '<info>Done — %d written · %d published · %d skipped · %d errors</info>',
                $written, $published, $skipped, $errors,
            ));
        } else {
            $output->writeln(sprintf(
                '<info>Done — %d written · %d skipped · %d errors</info>',
                $written, $skipped, $errors,
            ));
        }

        return Command::SUCCESS;
    }

    /**
     * Any Round that isn't yet resolved. Used by the legacy --skip-if-active.
     */
    private function hasActiveRound(): bool
    {
        $qb = $this->rounds->createQueryBuilder('r')
            ->select('COUNT(r.id)')
            ->where('r.status IN (:active)')
            ->setParameter('active', [
                RoundStatus::Scheduled,
                RoundStatus::Open,
                RoundStatus::Closed,
            ]);
        return (int) $qb->getQuery()->getSingleScalarResult() > 0;
    }

    /**
     * Is a Round already queued in scheduled state? Used by --ensure-queued.
     * Open and closed rounds DON'T block — we want #N+1 ready while #N is
     * still in flight so the hand-off is seamless.
     */
    private function hasScheduledRound(): bool
    {
        $qb = $this->rounds->createQueryBuilder('r')
            ->select('COUNT(r.id)')
            ->where('r.status = :s')
            ->setParameter('s', RoundStatus::Scheduled);
        return (int) $qb->getQuery()->getSingleScalarResult() > 0;
    }

    /**
     * Highest-numbered Round in the system, or null if none exist.
     */
    private function latestRound(): ?Round
    {
        return $this->rounds->createQueryBuilder('r')
            ->orderBy('r.number', 'DESC')
            ->setMaxResults(1)
            ->getQuery()
            ->getOneOrNullResult();
    }
}
