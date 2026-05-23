<?php

declare(strict_types=1);

namespace App\Command;

use App\Service\Questions\ResolverRegistry;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;

/**
 * Layer-2 smoke test: invoke a resolver against a real upstream API
 * with a chosen "closesAt" timestamp and print the result. Touches no
 * database, no rounds, no Redis — pure read-only verification that
 * (a) the resolver builds the right query, (b) the upstream answers,
 * (c) the parsing produces sensible coordinates.
 *
 *   bin/console app:resolvers:smoke \
 *       --code=usgs.aftershock \
 *       --after='2026-05-22T00:00:00Z'
 *
 * For Aftershock: the `--after` value plays the role of the round's
 * closesAt. The resolver searches for the first M5+ event chronologically
 * after that moment (or M4.5/M4/M3.5 if elapsed wait exceeds 4/8/24h
 * from --after to --now).
 *
 * For legacy window-based resolvers (NextM5EarthquakeResolver, etc.)
 * the smoke command passes the SAME timestamp as both windowStart and
 * windowEnd-minus-24h so you can sanity-check old resolvers too.
 */
#[AsCommand(
    name: 'app:resolvers:smoke',
    description: 'Smoke-test a question resolver against real upstream APIs with a chosen closesAt timestamp.',
)]
final class ResolversSmokeCommand extends Command
{
    public function __construct(private readonly ResolverRegistry $registry)
    {
        parent::__construct();
    }

    protected function configure(): void
    {
        $this
            ->addOption(
                'code',
                null,
                InputOption::VALUE_REQUIRED,
                'Resolver code (e.g. usgs.aftershock). Required.',
            )
            ->addOption(
                'after',
                null,
                InputOption::VALUE_REQUIRED,
                'Simulated round closesAt timestamp (ISO 8601, UTC). Search starts here.',
            )
            ->addOption(
                'now',
                null,
                InputOption::VALUE_REQUIRED,
                'Override the "current time" (ISO 8601). Defaults to actual now. Use this '
                . 'to test the magnitude-floor walk-down for Aftershock.',
            );
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $code = $input->getOption('code');
        $after = $input->getOption('after');
        $nowOpt = $input->getOption('now');

        if (!\is_string($code) || $code === '') {
            $output->writeln('<error>--code is required (e.g. --code=usgs.aftershock)</error>');
            $output->writeln('<comment>Available resolvers:</comment>');
            foreach ($this->registry->all() as $r) {
                $output->writeln(sprintf('  · %s', $r->code()));
            }
            return Command::INVALID;
        }
        if (!$this->registry->has($code)) {
            $output->writeln(sprintf('<error>resolver "%s" not registered</error>', $code));
            return Command::INVALID;
        }

        if (!\is_string($after) || $after === '') {
            $output->writeln('<error>--after is required (e.g. --after=2026-05-22T00:00:00Z)</error>');
            return Command::INVALID;
        }
        try {
            $closesAt = new \DateTimeImmutable($after);
        } catch (\Throwable $e) {
            $output->writeln(sprintf('<error>invalid --after timestamp: %s</error>', $e->getMessage()));
            return Command::INVALID;
        }

        if (\is_string($nowOpt) && $nowOpt !== '') {
            try {
                $now = new \DateTimeImmutable($nowOpt);
            } catch (\Throwable $e) {
                $output->writeln(sprintf('<error>invalid --now timestamp: %s</error>', $e->getMessage()));
                return Command::INVALID;
            }
        } else {
            $now = new \DateTimeImmutable();
        }

        $params = [
            // Aftershock reads windowEnd as the search-after threshold.
            // Window-based legacy resolvers read windowStart..windowEnd —
            // for those we feed both equal to --after so the smoke at
            // least exercises the parse + HTTP layer (results won't be
            // meaningful for window resolvers since the window is 0-width).
            'windowStart' => $closesAt->format(\DateTimeInterface::ATOM),
            'windowEnd'   => $closesAt->format(\DateTimeInterface::ATOM),
            // HottestCapitalResolver and friends key off the 'date' string.
            'date'        => $closesAt->format('Y-m-d'),
        ];

        $output->writeln(sprintf('<info>→ %s</info>', $code));
        $output->writeln(sprintf('  windowEnd (search-after): %s', $closesAt->format('c')));
        $output->writeln(sprintf('  now                      : %s', $now->format('c')));
        $output->writeln(sprintf(
            '  elapsed wait             : %.2f hours',
            ($now->getTimestamp() - $closesAt->getTimestamp()) / 3600.0,
        ));
        $output->writeln('');

        $started = microtime(true);
        try {
            $result = $this->registry->get($code)->resolve($params, $now);
        } catch (\Throwable $e) {
            $elapsed = (microtime(true) - $started) * 1000.0;
            $output->writeln(sprintf('<error>✗ resolver threw (%.0fms): %s</error>', $elapsed, $e->getMessage()));
            $output->writeln('<comment>  this is the normal "defer to next cron tick" signal — try a later --now</comment>');
            return Command::FAILURE;
        }
        $elapsed = (microtime(true) - $started) * 1000.0;

        $output->writeln(sprintf('<info>✓ resolved in %.0fms · %d answer point%s</info>',
            $elapsed,
            \count($result->points),
            \count($result->points) === 1 ? '' : 's',
        ));
        foreach ($result->points as $i => $p) {
            $output->writeln(sprintf(
                '  [%d] %s  (%.4f, %.4f)',
                $i + 1,
                $p->name === '' ? '<no name>' : $p->name,
                $p->lat,
                $p->lng,
            ));
        }

        $output->writeln('');
        $output->writeln('<comment>audit log:</comment>');
        $output->writeln($this->prettyJson($result->context));

        return Command::SUCCESS;
    }

    /**
     * @param array<string, mixed> $payload
     */
    private function prettyJson(array $payload): string
    {
        $json = json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        return $json === false ? '<encoding failed>' : $json;
    }
}
