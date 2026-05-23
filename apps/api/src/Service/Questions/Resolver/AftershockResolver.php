<?php

declare(strict_types=1);

namespace App\Service\Questions\Resolver;

use App\Service\Questions\AnswerPoint;
use App\Service\Questions\ResolutionResult;
use App\Service\Questions\ResolverInterface;
use App\Service\Questions\SuggestionDraft;
use Psr\Log\LoggerInterface;
use Psr\Log\NullLogger;
use Symfony\Contracts\HttpClient\HttpClientInterface;

/**
 * "Where will the first M5+ earthquake strike in the 24 hours after
 *  this round closes?"
 *
 * The fundamentally un-gameable question. Unlike NextM5EarthquakeResolver
 * (which scans the [opensAt, closesAt] window and lets analysts watch
 * events accumulate in real time), Aftershock looks at the FUTURE
 * window — the first M5+ event after the round closes wins. At commit
 * time the event hasn't happened yet, and earthquakes are physically
 * unpredictable, so no amount of API watching helps a player.
 *
 * Source: USGS FDSN Event Service (geojson). Same endpoint as the legacy
 * resolver, different time semantics.
 *
 *   https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson
 *     &minmagnitude=5&starttime=<closesAt>&endtime=<now>&orderby=time-asc&limit=1
 *
 * Resolve walks the magnitude floor down as elapsed wait time grows, so
 * the round always resolves within ~24h of closesAt:
 *
 *   elapsed < 4h  → M5+ only      (global rate ~4/day, 92% hit rate at 4h)
 *   elapsed < 8h  → M4.5+         (rate ~14/day, ~99% hit rate at 8h)
 *   elapsed < 24h → M4+           (rate ~50/day, essentially guaranteed)
 *   elapsed ≥ 24h → M3.5+         (last-resort floor; >99.9% within 24h)
 *
 * Magnitude floor is also captured in resolverParams.minMagnitude so the
 * audit log can show exactly which threshold the answer fired at.
 *
 * The cron retries every tick — a resolver that throws is just deferred
 * to the next attempt. See RoundsAutoResolveCommand::execute().
 */
final class AftershockResolver implements ResolverInterface
{
    private const FDSN_URL = 'https://earthquake.usgs.gov/fdsnws/event/1/query';

    /**
     * Round duration is 24h; suggest()'s timestamps are overwritten by
     * QuestionsSuggestCommand --continuous, so this constant only matters
     * for one-shot tests / manual seeding.
     */
    private const ROUND_DURATION = 'PT24H';

    public function __construct(
        private readonly HttpClientInterface $http,
        private readonly LoggerInterface $logger = new NullLogger(),
    ) {
    }

    public function code(): string
    {
        return 'usgs.aftershock';
    }

    public function suggest(\DateTimeImmutable $now): ?SuggestionDraft
    {
        $opensAt    = $now->setTimezone(new \DateTimeZone('UTC'));
        $closesAt   = $opensAt->add(new \DateInterval(self::ROUND_DURATION));
        // resolvesAt is when the cron starts looking — first attempt right
        // after close. If no event yet, cron defers and retries every tick.
        $resolvesAt = $closesAt->modify('+1 minute');

        return new SuggestionDraft(
            resolverCode: $this->code(),
            resolverParams: [
                // Continuous-mode in QuestionsSuggestCommand rewrites both
                // windowStart and windowEnd; resolve() uses windowEnd as
                // the "search after" threshold.
                'windowStart' => $opensAt->format(\DateTimeInterface::ATOM),
                'windowEnd'   => $closesAt->format(\DateTimeInterface::ATOM),
            ],
            question: 'Where will the first M5+ earthquake strike in the 24 hours after this round closes?',
            opensAt: $opensAt,
            closesAt: $closesAt,
            resolvesAt: $resolvesAt,
            preview: [
                'source'   => 'USGS FDSN Event Service',
                'semantic' => 'first M5+ event chronologically after closesAt',
                'fallback' => 'magnitude floor walks down M5 → M4.5 → M4 → M3.5 over 24h',
            ],
        );
    }

    public function resolve(array $params, \DateTimeImmutable $resolvesAt): ResolutionResult
    {
        // windowEnd in continuous mode == round's closesAt == the moment
        // commits stopped, search-after threshold for the live event hunt.
        $searchStart = $this->parseTime($params, 'windowEnd');

        // resolvesAt is "now" — the cron tick's current wall clock.
        $now = $resolvesAt;
        if ($now <= $searchStart) {
            // Cron ran early (clock skew?). Defer.
            throw new \RuntimeException('Search window starts in the future — try again next tick.');
        }

        $minMagnitude = $this->magnitudeFloorFor($searchStart, $now);
        $event = $this->firstEventAfter($searchStart, $now, $minMagnitude);

        if ($event === null) {
            throw new \RuntimeException(sprintf(
                'No M%.1f+ earthquake yet in [%s → %s] — cron will retry.',
                $minMagnitude,
                $searchStart->format('c'),
                $now->format('c'),
            ));
        }

        return new ResolutionResult(
            [new AnswerPoint($event['lat'], $event['lng'], $event['place'])],
            [
                'event'         => $event,
                'searchStart'   => $searchStart->format('c'),
                'searchEnd'     => $now->format('c'),
                'minMagnitude'  => $minMagnitude,
                'waitedSeconds' => $now->getTimestamp() - $searchStart->getTimestamp(),
            ],
        );
    }

    /**
     * Pull the chronologically-first event after $start, magnitude ≥ floor.
     *
     * @return array{mag: float, lat: float, lng: float, place: string, time: int, id: string}|null
     */
    private function firstEventAfter(
        \DateTimeImmutable $start,
        \DateTimeImmutable $end,
        float $minMagnitude,
    ): ?array {
        try {
            $resp = $this->http->request('GET', self::FDSN_URL, [
                'query' => [
                    'format'       => 'geojson',
                    'minmagnitude' => $minMagnitude,
                    'starttime'    => $start->format('Y-m-d\TH:i:s'),
                    'endtime'      => $end->format('Y-m-d\TH:i:s'),
                    'orderby'      => 'time-asc',
                    'limit'        => 1,
                ],
                'timeout' => 15,
            ]);
            $payload = $resp->toArray(false);
        } catch (\Throwable $e) {
            $this->logger->warning('USGS FDSN call failed', [
                'minMagnitude' => $minMagnitude,
                'exception'    => $e::class,
                'message'      => $e->getMessage(),
            ]);
            return null;
        }

        $features = $payload['features'] ?? [];
        if (!\is_array($features) || $features === []) {
            return null;
        }
        $first = $features[0];
        $coords = $first['geometry']['coordinates'] ?? null;
        $props  = $first['properties'] ?? [];
        if (!\is_array($coords) || \count($coords) < 2) {
            return null;
        }

        return [
            'mag'   => isset($props['mag']) ? (float) $props['mag'] : 0.0,
            'lat'   => (float) $coords[1],
            'lng'   => (float) $coords[0],
            'place' => isset($props['place']) && \is_string($props['place']) ? $props['place'] : '',
            'time'  => isset($props['time']) ? (int) $props['time'] : 0,
            'id'    => isset($first['id']) && \is_string($first['id']) ? $first['id'] : '',
        ];
    }

    /**
     * Walk the magnitude floor down as elapsed wait time grows so the
     * round always resolves within 24h of closesAt. Values picked from
     * USGS 30-day base rates: M5+ ~4/day, M4.5+ ~14/day, M4+ ~50/day.
     */
    private function magnitudeFloorFor(\DateTimeImmutable $start, \DateTimeImmutable $now): float
    {
        $elapsedHours = ($now->getTimestamp() - $start->getTimestamp()) / 3600.0;

        if ($elapsedHours < 4.0) {
            return 5.0;
        }
        if ($elapsedHours < 8.0) {
            return 4.5;
        }
        if ($elapsedHours < 24.0) {
            return 4.0;
        }
        return 3.5;
    }

    /**
     * @param array<string, mixed> $params
     */
    private function parseTime(array $params, string $key): \DateTimeImmutable
    {
        $raw = $params[$key] ?? null;
        if (!\is_string($raw) || $raw === '') {
            throw new \RuntimeException(sprintf('Missing %s param for usgs.aftershock resolver.', $key));
        }
        try {
            return new \DateTimeImmutable($raw);
        } catch (\Throwable $e) {
            throw new \RuntimeException(sprintf('Invalid %s param: %s', $key, $e->getMessage()));
        }
    }
}
