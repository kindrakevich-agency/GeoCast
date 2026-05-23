<?php

declare(strict_types=1);

namespace App\Service\Questions\Resolver;

use App\Service\Questions\AnswerPoint;
use App\Service\Questions\ResolutionResult;
use App\Service\Questions\ResolverInterface;
use App\Service\Questions\Source\OpenMeteoClient;
use App\Service\Questions\Source\WorldCapitals;
use App\Service\Questions\SuggestionDraft;
use Psr\Log\LoggerInterface;
use Psr\Log\NullLogger;

/**
 * "Where will the coldest world capital be in the next 24 hours?"
 *
 * Same plumbing as HottestCapitalResolver, but sorts by daily
 * temperature_2m_min ascending. WorldCapitals dataset includes
 * Yakutsk, Reykjavik, Ulaanbaatar, Astana, Helsinki, Oslo etc. —
 * cold-snap candidates are well-represented.
 */
final class ColdestCapitalResolver implements ResolverInterface
{
    private const TIE_THRESHOLD_DAILY = 0.05;

    public function __construct(
        private readonly OpenMeteoClient $client,
        private readonly LoggerInterface $logger = new NullLogger(),
    ) {
    }

    public function code(): string
    {
        return 'openmeteo.coldest-capital';
    }

    public function suggest(\DateTimeImmutable $now): ?SuggestionDraft
    {
        $targetDay = $now->setTimezone(new \DateTimeZone('UTC'))->modify('+1 day')->setTime(0, 0, 0);

        try {
            $temps = $this->client->dailyMinTemperature(
                WorldCapitals::latitudes(),
                WorldCapitals::longitudes(),
                $targetDay,
            );
        } catch (\Throwable $e) {
            $this->logger->warning('openmeteo.coldest-capital suggest() failed', [
                'targetDay' => $targetDay->format('Y-m-d'),
                'exception' => $e::class,
                'message'   => $e->getMessage(),
            ]);
            return null;
        }

        $capitals = WorldCapitals::all();
        $rows = [];
        foreach ($capitals as $i => $c) {
            $t = $temps[$i] ?? null;
            if ($t === null) {
                continue;
            }
            $rows[] = ['name' => $c['name'], 'country' => $c['country'], 'temp' => $t];
        }
        if ($rows === []) {
            return null;
        }
        // Coldest first (ascending).
        usort($rows, static fn (array $a, array $b): int => $a['temp'] <=> $b['temp']);

        $opensAt    = $targetDay;
        $closesAt   = $targetDay->setTime(23, 59, 59);
        $resolvesAt = $targetDay->modify('+1 day')->setTime(6, 0, 0);

        return new SuggestionDraft(
            resolverCode: $this->code(),
            resolverParams: ['date' => $targetDay->format('Y-m-d')],
            question: 'Where will the coldest world capital be in the next 24 hours?',
            opensAt: $opensAt,
            closesAt: $closesAt,
            resolvesAt: $resolvesAt,
            preview: [
                'targetDate'    => $targetDay->format('Y-m-d'),
                'topForecast'   => array_slice($rows, 0, 5),
                'candidateCount'=> \count($rows),
            ],
        );
    }

    public function resolve(array $params, \DateTimeImmutable $resolvesAt): ResolutionResult
    {
        $date = $params['date'] ?? null;
        if (!\is_string($date) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
            throw new \RuntimeException('Missing/invalid `date` param for coldest-capital resolver.');
        }
        $target = new \DateTimeImmutable($date, new \DateTimeZone('UTC'));

        $capitals = WorldCapitals::all();
        $temps = $this->client->dailyMinTemperatureArchive(
            WorldCapitals::latitudes(),
            WorldCapitals::longitudes(),
            $target,
        );

        $rows = [];
        foreach ($capitals as $i => $c) {
            $t = $temps[$i] ?? null;
            if ($t === null) {
                continue;
            }
            $rows[] = ['name' => $c['name'], 'lat' => $c['lat'], 'lng' => $c['lng'], 'tempDaily' => $t];
        }
        if ($rows === []) {
            throw new \RuntimeException(sprintf(
                'No archive minimum-temperature data for any world capital on %s — try again later.',
                $date,
            ));
        }
        usort($rows, static fn (array $a, array $b): int => $a['tempDaily'] <=> $b['tempDaily']);

        $leaderTemp = $rows[0]['tempDaily'];
        $tied = array_values(array_filter(
            $rows,
            static fn (array $r): bool => abs($r['tempDaily'] - $leaderTemp) <= self::TIE_THRESHOLD_DAILY,
        ));

        if (\count($tied) === 1) {
            return new ResolutionResult(
                [new AnswerPoint($tied[0]['lat'], $tied[0]['lng'], $tied[0]['name'])],
                ['winner' => $tied[0], 'topDaily' => array_slice($rows, 0, 5)],
            );
        }

        // True tie at the daily aggregate — multi-winner. We don't run
        // an hourly probe here because coldest is typically a sustained
        // overnight reading, less prone to single-spike ties than the
        // hottest peak.
        $points = array_map(
            static fn (array $r): AnswerPoint => new AnswerPoint($r['lat'], $r['lng'], $r['name']),
            $tied,
        );
        return new ResolutionResult($points, [
            'tied'     => $tied,
            'topDaily' => array_slice($rows, 0, 5),
            'date'     => $date,
        ]);
    }
}
