<?php

declare(strict_types=1);

namespace App\Service\Questions\Resolver;

use App\Service\Questions\AnswerPoint;
use App\Service\Questions\ResolutionResult;
use App\Service\Questions\ResolverInterface;
use App\Service\Questions\Source\EuropeanCapitals;
use App\Service\Questions\Source\OpenMeteoClient;
use App\Service\Questions\SuggestionDraft;
use Psr\Log\LoggerInterface;
use Psr\Log\NullLogger;

/**
 * "Where will the hottest European capital be tomorrow?"
 *
 * Suggest: queries Open-Meteo forecast for ~47 European capitals' daily max
 * temperature on (now + 1 calendar day in UTC). Stores the target ISO date
 * in resolverParams so resolve() asks for the same day later.
 *
 * Resolve: reads the same cities from the archive endpoint (observed, not
 * forecast). Picks the city with the highest temperature_2m_max. If two or
 * more cities are within 0.05°C of each other on the daily aggregate, breaks
 * the tie with the hourly archive — comparing the peak observed temperature
 * down to the 0.1°C precision Open-Meteo actually publishes. If a tie still
 * survives, returns all tied cities as multi-winner points.
 *
 * Round timing (UTC):
 *
 *   suggested at T          opens 00:00 of (T+1)         resolves 06:00 of (T+2)
 *   ┌────────────┬──────────────────────────────────────────┬──────────────┐
 *   │ proposal   │  betting window for "tomorrow"           │ archive read │
 *   │ written to │  (closes 23:59 UTC same day)             │ + payout     │
 *   │ DB         │                                          │              │
 *   └────────────┴──────────────────────────────────────────┴──────────────┘
 *
 * The 6h archive lag is deliberate — Open-Meteo's archive endpoint usually
 * has the previous day populated by ~02:00 UTC, but 06:00 leaves room for
 * the occasional delay.
 */
final class HottestEuropeanCapitalResolver implements ResolverInterface
{
    /** Maximum daily-aggregate gap (°C) below which we look at hourly data. */
    private const TIE_THRESHOLD_DAILY = 0.05;
    /** Maximum hourly peak gap (°C) we treat as a true tie. */
    private const TIE_THRESHOLD_HOURLY = 0.001;

    public function __construct(
        private readonly OpenMeteoClient $client,
        private readonly LoggerInterface $logger = new NullLogger(),
    ) {
    }

    public function code(): string
    {
        return 'openmeteo.hottest-european-capital';
    }

    public function suggest(\DateTimeImmutable $now): ?SuggestionDraft
    {
        $targetDay = $now->setTimezone(new \DateTimeZone('UTC'))->modify('+1 day')->setTime(0, 0, 0);

        try {
            $temps = $this->client->dailyMaxTemperature(
                EuropeanCapitals::latitudes(),
                EuropeanCapitals::longitudes(),
                $targetDay,
            );
        } catch (\Throwable $e) {
            // Source unavailable — log the actual reason so the next outage
            // doesn't show up as a mysterious "no candidate today". Returning
            // null lets other resolvers try; cron decides whether to write
            // zero suggestions or partial.
            $this->logger->warning('openmeteo.hottest-european-capital suggest() failed', [
                'targetDay' => $targetDay->format('Y-m-d'),
                'exception' => $e::class,
                'message'   => $e->getMessage(),
            ]);
            return null;
        }

        $capitals = EuropeanCapitals::all();
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
        usort($rows, static fn (array $a, array $b): int => $b['temp'] <=> $a['temp']);

        // Round timing — opens at midnight of the target day, closes at the
        // end of it, resolves 6h after close (when archive has populated).
        $opensAt    = $targetDay; // 00:00 UTC of T+1
        $closesAt   = $targetDay->setTime(23, 59, 59);
        $resolvesAt = $targetDay->modify('+1 day')->setTime(6, 0, 0); // 06:00 UTC of T+2

        return new SuggestionDraft(
            resolverCode: $this->code(),
            resolverParams: ['date' => $targetDay->format('Y-m-d')],
            question: 'Where will the hottest European capital be in the next 24 hours?',
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
            throw new \RuntimeException('Missing/invalid `date` param for hottest-european-capital resolver.');
        }
        $target = new \DateTimeImmutable($date, new \DateTimeZone('UTC'));

        $capitals = EuropeanCapitals::all();
        $temps = $this->client->dailyMaxTemperatureArchive(
            EuropeanCapitals::latitudes(),
            EuropeanCapitals::longitudes(),
            $target,
        );

        // Build the daily ranking, dropping nulls (cells with no archive data).
        $rows = [];
        foreach ($capitals as $i => $c) {
            $t = $temps[$i] ?? null;
            if ($t === null) {
                continue;
            }
            $rows[] = ['idx' => $i, 'name' => $c['name'], 'lat' => $c['lat'], 'lng' => $c['lng'], 'tempDaily' => $t];
        }
        if ($rows === []) {
            throw new \RuntimeException(sprintf(
                'No archive temperature data for any European capital on %s — try again later.',
                $date,
            ));
        }
        usort($rows, static fn (array $a, array $b): int => $b['tempDaily'] <=> $a['tempDaily']);

        // Pull off everyone within TIE_THRESHOLD_DAILY of the leader.
        $leaderTemp = $rows[0]['tempDaily'];
        $tied = array_values(array_filter(
            $rows,
            static fn (array $r): bool => abs($r['tempDaily'] - $leaderTemp) <= self::TIE_THRESHOLD_DAILY,
        ));

        // No tie at the daily level — single winner, return immediately.
        if (\count($tied) === 1) {
            return $this->singleWinner($tied[0], $rows);
        }

        // Tie-break: ask Open-Meteo for hourly data on JUST the tied cities
        // and compare peak observed temperatures.
        $tiedLats = array_map(static fn (array $r): float => $r['lat'], $tied);
        $tiedLngs = array_map(static fn (array $r): float => $r['lng'], $tied);
        $peaks = $this->client->hourlyPeakTemperatureArchive($tiedLats, $tiedLngs, $target);

        $hourly = [];
        foreach ($tied as $i => $r) {
            $hourly[] = [
                'name'      => $r['name'],
                'lat'       => $r['lat'],
                'lng'       => $r['lng'],
                'tempDaily' => $r['tempDaily'],
                'peak'      => $peaks[$i]['peak'] ?? null,
                'peakHour'  => $peaks[$i]['hour'] ?? null,
            ];
        }
        // Sort by hourly peak desc (null peaks sink to the bottom).
        usort($hourly, static function (array $a, array $b): int {
            $pa = $a['peak'] ?? -INF;
            $pb = $b['peak'] ?? -INF;
            return $pb <=> $pa;
        });

        $leaderPeak = $hourly[0]['peak'];
        if ($leaderPeak === null) {
            // Hourly data missing for everyone — fall back to first tied
            // city alphabetically for determinism.
            usort($tied, static fn (array $a, array $b): int => strcmp($a['name'], $b['name']));
            return $this->singleWinner($tied[0], $rows, ['fallback' => 'alphabetical-on-no-hourly']);
        }

        $survivors = array_values(array_filter(
            $hourly,
            static fn (array $r): bool => $r['peak'] !== null
                && abs($r['peak'] - $leaderPeak) <= self::TIE_THRESHOLD_HOURLY,
        ));

        if (\count($survivors) === 1) {
            return $this->singleWinner($survivors[0], $rows, ['tieBrokenBy' => 'hourly']);
        }

        // True tie — multi-winner round.
        $points = array_map(
            static fn (array $r): AnswerPoint => new AnswerPoint($r['lat'], $r['lng'], $r['name']),
            $survivors,
        );
        return new ResolutionResult($points, [
            'tied'        => $survivors,
            'topDaily'    => array_slice($rows, 0, 5),
            'date'        => $date,
        ]);
    }

    /**
     * @param array{name: string, lat: float, lng: float, tempDaily: float} $winner
     * @param list<array{name: string, lat: float, lng: float, tempDaily: float}> $allRows
     * @param array<string, mixed> $extraContext
     */
    private function singleWinner(array $winner, array $allRows, array $extraContext = []): ResolutionResult
    {
        return new ResolutionResult(
            [new AnswerPoint($winner['lat'], $winner['lng'], $winner['name'])],
            array_merge([
                'winner'   => $winner,
                'topDaily' => array_slice($allRows, 0, 5),
            ], $extraContext),
        );
    }
}
