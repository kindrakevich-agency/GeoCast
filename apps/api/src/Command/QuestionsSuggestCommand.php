<?php

declare(strict_types=1);

namespace App\Command;

use App\Entity\RoundSuggestion;
use App\Service\Questions\ResolverRegistry;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
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
 * Recommended cron: every 6 hours.
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
        private readonly EntityManagerInterface $em,
    ) {
        parent::__construct();
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $existing = $this->suggestions->countPending();
        if ($existing >= self::MAX_PENDING) {
            $output->writeln(sprintf('<comment>queue already at %d pending — skipping.</comment>', $existing));
            return Command::SUCCESS;
        }

        $now = new \DateTimeImmutable();
        $written = 0;
        $skipped = 0;
        $errors = 0;

        foreach ($this->registry->all() as $resolver) {
            try {
                $draft = $resolver->suggest($now);
            } catch (\Throwable $e) {
                ++$errors;
                $output->writeln(sprintf(
                    '<error>  %s: suggest() threw: %s</error>',
                    $resolver->code(),
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
        }

        $this->em->flush();

        $output->writeln(sprintf(
            '<info>Done — %d written · %d skipped · %d errors</info>',
            $written, $skipped, $errors,
        ));

        return Command::SUCCESS;
    }
}
