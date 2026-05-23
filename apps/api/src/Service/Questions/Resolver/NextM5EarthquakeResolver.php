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
 * "Where will the next M5+ earthquake strike in the next 24 hours?"
 *
 * Source: USGS FDSN Event Service (geojson). Global by nature — no
 * candidate list. Real-time + public + no auth.
 *
 *   https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson
 *     &minmagnitude=5
 *     &starttime=YYYY-MM-DDThh:mm:ss
 *     &endtime=YYYY-MM-DDThh:mm:ss
 *
 * Resolve picks the strongest M5+ event whose `time` lands inside the
 * round's [windowStart, windowEnd]. If zero M5+ events occurred (~22%
 * of random 24h windows globally), falls back to the strongest M4.5+
 * event — confirmed by USGS empirically: 30-day base rate showed 0%
 * of 24h windows go without an M4.5+ event.
 *
 * Suggest is a no-op data fetch — earthquakes can't be forecast, we
 * just commit to opening the question for the next 24h. The cron's
 * continuous-mode re-timestamping replaces the suggest-supplied window
 * with the real chain-of-rounds slot.
 */
final class NextM5EarthquakeResolver implements ResolverInterface
{
    private const FDSN_URL = 'https://earthquake.usgs.gov/fdsnws/event/1/query';

    public function __construct(
        private readonly HttpClientInterface $http,
        private readonly LoggerInterface $logger = new NullLogger(),
    ) {
    }

    public function code(): string
    {
        return 'usgs.next-m5-earthquake';
    }

    /**
     * Deactivated 2026-05 — superseded by {@see AftershockResolver}, which
     * uses the same data source but flips the time semantics from
     * "first event in the open window" (gameable via live API watching)
     * to "first event AFTER the round closes" (genuinely un-predictable).
     * resolve() stays functional for historical rounds.
     */
    public function suggest(\DateTimeImmutable $now): ?SuggestionDraft
    {
        return null;
    }

    public function resolve(array $params, \DateTimeImmutable $resolvesAt): ResolutionResult
    {
        $windowStart = $this->parseTime($params, 'windowStart');
        $windowEnd   = $this->parseTime($params, 'windowEnd');

        // Try M5+ first.
        $event = $this->strongest($windowStart, $windowEnd, 5.0);
        if ($event === null) {
            // 22% of random 24h windows are M5-quiet — fall back to M4.5+.
            $event = $this->strongest($windowStart, $windowEnd, 4.5);
        }

        if ($event === null) {
            throw new \RuntimeException(sprintf(
                'No M4.5+ earthquakes in the window %s → %s — try again later.',
                $windowStart->format('c'),
                $windowEnd->format('c'),
            ));
        }

        return new ResolutionResult(
            [new AnswerPoint($event['lat'], $event['lng'], $event['place'])],
            [
                'event'    => $event,
                'window'   => [
                    'start' => $windowStart->format('c'),
                    'end'   => $windowEnd->format('c'),
                ],
            ],
        );
    }

    /**
     * Pull the single highest-magnitude event from USGS in [start, end],
     * with magnitude >= $minMagnitude. Returns null when the API returns
     * an empty FeatureCollection.
     *
     * @return array{mag: float, lat: float, lng: float, place: string, time: int, id: string}|null
     */
    private function strongest(\DateTimeImmutable $start, \DateTimeImmutable $end, float $minMagnitude): ?array
    {
        try {
            $resp = $this->http->request('GET', self::FDSN_URL, [
                'query' => [
                    'format'       => 'geojson',
                    'minmagnitude' => $minMagnitude,
                    'starttime'    => $start->format('Y-m-d\TH:i:s'),
                    'endtime'      => $end->format('Y-m-d\TH:i:s'),
                    'orderby'      => 'magnitude',
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
     * @param array<string, mixed> $params
     */
    private function parseTime(array $params, string $key): \DateTimeImmutable
    {
        $raw = $params[$key] ?? null;
        if (!\is_string($raw) || $raw === '') {
            throw new \RuntimeException(sprintf('Missing %s param for usgs.next-m5-earthquake resolver.', $key));
        }
        try {
            return new \DateTimeImmutable($raw);
        } catch (\Throwable $e) {
            throw new \RuntimeException(sprintf('Invalid %s param: %s', $key, $e->getMessage()));
        }
    }
}
