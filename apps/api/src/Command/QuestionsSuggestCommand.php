<?php

declare(strict_types=1);

namespace App\Command;

use App\Entity\RoundSuggestion;
use App\Enum\SuggestionStatus;
use App\Service\Questions\ResolverRegistry;
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
 * Idempotent across runs in the sense that resolvers themselves choose
 * whether to propose — they can no-op when their data source has
 * nothing dramatic for the day, so re-running won't pile up duplicates
 * (each call returns at most one draft per resolver, and we cap the
 * pending queue length).
 *
 * With --auto-publish, each new draft immediately materializes into a
 * Round (status=scheduled, auto_resolver_code wired). The cron uses this
 * flag so daily rounds appear without admin clicks; manual invocations
 * default to the safer admin-gated mode.
 *
 * Recommended cron: every 6 hours, --auto-publish on.
 */
#[AsCommand(
    name: 'app:questions:suggest',
    description: 'Generate candidate questions from the resolver registry and write to round_suggestions.',
)]
final class QuestionsSuggestCommand extends Command
{
    /** Hard cap on pending suggestions — avoids the queue blowing up if admin stops picking. */
    private const MAX_PENDING = 20;

    public function __construct(
        private readonly ResolverRegistry $registry,
        private readonly \App\Repository\RoundSuggestionRepository $suggestions,
        private readonly \App\Repository\RoundRepository $rounds,
        private readonly RoundService $roundService,
        private readonly EntityManagerInterface $em,
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
            'skip-if-active',
            null,
            InputOption::VALUE_NONE,
            'When combined with --auto-publish, skip publishing if there is already a scheduled or open round.',
        );
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $autoPublish = (bool) $input->getOption('auto-publish');
        $skipIfActive = (bool) $input->getOption('skip-if-active');

        // Defensive: when auto-publishing, optionally short-circuit if a
        // playable round already exists. Avoids publishing #N+1 while #N
        // is still mid-cycle.
        if ($autoPublish && $skipIfActive && $this->hasActiveRound()) {
            $output->writeln('<comment>An active round already exists — skipping auto-publish.</comment>');
            return Command::SUCCESS;
        }

        $existing = $this->suggestions->countPending();
        if ($existing >= self::MAX_PENDING) {
            $output->writeln(sprintf('<comment>queue already at %d pending — skipping.</comment>', $existing));
            return Command::SUCCESS;
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
     * Is there already a Round that hasn't been resolved? Used by
     * --skip-if-active to avoid stacking up future rounds while one is in
     * flight.
     */
    private function hasActiveRound(): bool
    {
        $qb = $this->rounds->createQueryBuilder('r')
            ->select('COUNT(r.id)')
            ->where('r.status IN (:active)')
            ->setParameter('active', [
                \App\Enum\RoundStatus::Scheduled,
                \App\Enum\RoundStatus::Open,
                \App\Enum\RoundStatus::Closed,
            ]);
        return (int) $qb->getQuery()->getSingleScalarResult() > 0;
    }
}
