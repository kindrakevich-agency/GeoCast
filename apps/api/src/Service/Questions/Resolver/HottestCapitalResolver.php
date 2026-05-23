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
 * "Where will the hottest world capital be in the next 24 hours?"
 *
 * Candidate set: ~244 cities = 195 UN capitals + 49 top non-capital metros
 * (NYC, LA, Shanghai, Mumbai, São Paulo, Lagos, Cape Town, Sydney, …).
 *
 * Suggest: Open-Meteo forecast of daily max temperature for every
 * candidate. Picks the city with the highest forecast.
 *
 * Resolve: Open-Meteo archive endpoint (observed, not forecast). Two-stage
 * tie-break — if the daily aggregate is within 0.05°C, probe the hourly
 * archive at 0.1°C precision. If a tie still survives, returns all tied
 * cities as multi-winner points (round scores by min-distance).
 */
final class HottestCapitalResolver implements ResolverInterface
{
    private const TIE_THRESHOLD_DAILY = 0.05;
    private const TIE_THRESHOLD_HOURLY = 0.001;

    public function __construct(
        private readonly OpenMeteoClient $client,
        private readonly LoggerInterface $logger = new NullLogger(),
    ) {
    }

    public function code(): string
    {
        return 'openmeteo.hottest-capital';
    }

    /**
     * Deactivated 2026-05 — the "hottest capital" question is trivially
     * gameable via Open-Meteo's 24h forecast (~85% accuracy). GeoCast now
     * runs a single un-gameable question via {@see AftershockResolver}.
     * resolve() stays functional so historical rounds still settle.
     */
    public function suggest(\DateTimeImmutable $now): ?SuggestionDraft
    {
        return null;
    }

    private function suggestLegacy(\DateTimeImmutable $now): ?SuggestionDraft
    {
        $targetDay = $now->setTimezone(new \DateTimeZone('UTC'))->modify('+1 day')->setTime(0, 0, 0);

        try {
            $temps = $this->client->dailyMaxTemperature(
                WorldCapitals::latitudes(),
                WorldCapitals::longitudes(),
                $targetDay,
            );
        } catch (\Throwable $e) {
            $this->logger->warning('openmeteo.hottest-capital suggest() failed', [
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
        usort($rows, static fn (array $a, array $b): int => $b['temp'] <=> $a['temp']);

        $opensAt    = $targetDay;
        $closesAt   = $targetDay->setTime(23, 59, 59);
        $resolvesAt = $targetDay->modify('+1 day')->setTime(6, 0, 0);

        return new SuggestionDraft(
            resolverCode: $this->code(),
            resolverParams: ['date' => $targetDay->format('Y-m-d')],
            question: 'Where will the hottest world capital be in the next 24 hours?',
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
            throw new \RuntimeException('Missing/invalid `date` param for hottest-capital resolver.');
        }
        $target = new \DateTimeImmutable($date, new \DateTimeZone('UTC'));

        $capitals = WorldCapitals::all();
        $temps = $this->client->dailyMaxTemperatureArchive(
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
            $rows[] = ['idx' => $i, 'name' => $c['name'], 'lat' => $c['lat'], 'lng' => $c['lng'], 'tempDaily' => $t];
        }
        if ($rows === []) {
            throw new \RuntimeException(sprintf(
                'No archive temperature data for any world capital on %s — try again later.',
                $date,
            ));
        }
        usort($rows, static fn (array $a, array $b): int => $b['tempDaily'] <=> $a['tempDaily']);

        $leaderTemp = $rows[0]['tempDaily'];
        $tied = array_values(array_filter(
            $rows,
            static fn (array $r): bool => abs($r['tempDaily'] - $leaderTemp) <= self::TIE_THRESHOLD_DAILY,
        ));

        if (\count($tied) === 1) {
            return $this->singleWinner($tied[0], $rows);
        }

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
        usort($hourly, static function (array $a, array $b): int {
            $pa = $a['peak'] ?? -INF;
            $pb = $b['peak'] ?? -INF;
            return $pb <=> $pa;
        });

        $leaderPeak = $hourly[0]['peak'];
        if ($leaderPeak === null) {
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
     * @param array{name: string, lat: float, lng: float, tempDaily?: float} $winner
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
