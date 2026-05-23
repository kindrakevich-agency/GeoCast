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
 * "Where will the largest active wildfire be in the next 24 hours?"
 *
 * Source: NASA EONET (Earth Observatory Natural Event Tracker). Public,
 * no auth, no rate limit:
 *
 *   https://eonet.gsfc.nasa.gov/api/v3/events?category=wildfires
 *     &status=open
 *     &days=1
 *
 * Resolve picks the event with the highest magnitudeValue (typically
 * acres). Falls back to most-recent update when magnitude is missing —
 * EONET doesn't always carry size figures, especially for early
 * detections. Coords come from the event's latest geometry timestamp
 * that lands inside our 24h window.
 *
 * Why EONET instead of NASA FIRMS active-fire CSV: FIRMS needs a MAP_KEY
 * registered against an email, returns thousands of per-pixel detections
 * that need clustering, and is rate-limited per key. EONET serves
 * pre-clustered events (one wildfire = one entry), free-tier-friendly,
 * ready to use.
 */
final class LargestWildfireResolver implements ResolverInterface
{
    private const EONET_URL = 'https://eonet.gsfc.nasa.gov/api/v3/events';

    public function __construct(
        private readonly HttpClientInterface $http,
        private readonly LoggerInterface $logger = new NullLogger(),
    ) {
    }

    public function code(): string
    {
        return 'nasa-eonet.largest-wildfire';
    }

    public function suggest(\DateTimeImmutable $now): ?SuggestionDraft
    {
        $targetDay = $now->setTimezone(new \DateTimeZone('UTC'))->modify('+1 day')->setTime(0, 0, 0);
        $opensAt    = $targetDay;
        $closesAt   = $targetDay->setTime(23, 59, 59);
        $resolvesAt = $closesAt->modify('+5 minutes');

        return new SuggestionDraft(
            resolverCode: $this->code(),
            resolverParams: [
                'windowStart' => $opensAt->format(\DateTimeInterface::ATOM),
                'windowEnd'   => $closesAt->format(\DateTimeInterface::ATOM),
            ],
            question: 'Where will the largest active wildfire be in the next 24 hours?',
            opensAt: $opensAt,
            closesAt: $closesAt,
            resolvesAt: $resolvesAt,
            preview: [
                'source' => 'NASA EONET (Earth Observatory Natural Event Tracker)',
                'rank'   => 'magnitudeValue (acres) desc, fall back to most-recent update',
            ],
        );
    }

    public function resolve(array $params, \DateTimeImmutable $resolvesAt): ResolutionResult
    {
        $windowStart = $this->parseTime($params, 'windowStart');
        $windowEnd   = $this->parseTime($params, 'windowEnd');

        try {
            $resp = $this->http->request('GET', self::EONET_URL, [
                'query' => [
                    'category' => 'wildfires',
                    'status'   => 'open',
                    'days'     => 2, // overshoot the 24h window; we filter below
                ],
                'timeout' => 15,
            ]);
            $payload = $resp->toArray(false);
        } catch (\Throwable $e) {
            $this->logger->warning('NASA EONET call failed', [
                'exception' => $e::class,
                'message'   => $e->getMessage(),
            ]);
            throw new \RuntimeException('EONET unreachable — try again later.');
        }

        $events = $payload['events'] ?? [];
        if (!\is_array($events) || $events === []) {
            throw new \RuntimeException('No active wildfires reported by EONET right now — try again later.');
        }

        $candidates = [];
        foreach ($events as $event) {
            $geos = $event['geometry'] ?? [];
            if (!\is_array($geos) || $geos === []) {
                continue;
            }
            // Use the LATEST geometry entry whose timestamp falls inside
            // our window — most events have multiple position updates as
            // they're tracked over time.
            $latest = null;
            foreach ($geos as $g) {
                $when = $g['date'] ?? null;
                if (!\is_string($when)) {
                    continue;
                }
                try {
                    $whenDt = new \DateTimeImmutable($when);
                } catch (\Throwable) {
                    continue;
                }
                if ($whenDt < $windowStart || $whenDt > $windowEnd) {
                    continue;
                }
                if ($latest === null || $whenDt > new \DateTimeImmutable($latest['date'])) {
                    $latest = $g;
                }
            }
            if ($latest === null) {
                continue;
            }
            $coords = $latest['coordinates'] ?? null;
            if (!\is_array($coords) || \count($coords) < 2) {
                continue;
            }
            $magnitude = isset($latest['magnitudeValue']) ? (float) $latest['magnitudeValue'] : null;

            $candidates[] = [
                'id'        => isset($event['id']) && \is_string($event['id']) ? $event['id'] : '',
                'title'     => isset($event['title']) && \is_string($event['title']) ? $event['title'] : '',
                'lat'       => (float) $coords[1],
                'lng'       => (float) $coords[0],
                'magnitude' => $magnitude,
                'date'      => $latest['date'],
            ];
        }

        if ($candidates === []) {
            throw new \RuntimeException(sprintf(
                'No active wildfire updates inside the window %s → %s — try again later.',
                $windowStart->format('c'),
                $windowEnd->format('c'),
            ));
        }

        // Rank by magnitude desc — events without a magnitude reading
        // fall back to the most-recent update timestamp.
        usort($candidates, static function (array $a, array $b): int {
            $magA = $a['magnitude'] ?? -INF;
            $magB = $b['magnitude'] ?? -INF;
            if ($magA !== $magB) {
                return $magB <=> $magA;
            }
            return strcmp((string) $b['date'], (string) $a['date']);
        });

        $winner = $candidates[0];

        return new ResolutionResult(
            [new AnswerPoint($winner['lat'], $winner['lng'], $winner['title'])],
            [
                'winner'   => $winner,
                'topThree' => array_slice($candidates, 0, 3),
                'window'   => [
                    'start' => $windowStart->format('c'),
                    'end'   => $windowEnd->format('c'),
                ],
            ],
        );
    }

    /** @param array<string, mixed> $params */
    private function parseTime(array $params, string $key): \DateTimeImmutable
    {
        $raw = $params[$key] ?? null;
        if (!\is_string($raw) || $raw === '') {
            throw new \RuntimeException(sprintf('Missing %s param for nasa-eonet.largest-wildfire resolver.', $key));
        }
        try {
            return new \DateTimeImmutable($raw);
        } catch (\Throwable $e) {
            throw new \RuntimeException(sprintf('Invalid %s param: %s', $key, $e->getMessage()));
        }
    }
}
