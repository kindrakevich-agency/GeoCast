<?php

declare(strict_types=1);

namespace App\Tests\Service\Questions;

use App\Service\Questions\Resolver\AftershockResolver;
use PHPUnit\Framework\TestCase;
use Symfony\Component\HttpClient\MockHttpClient;
use Symfony\Component\HttpClient\Response\MockResponse;

/**
 * AftershockResolver — covers the four resolve paths:
 *
 *   1. M5+ event found within the first 4h post-close → resolved
 *   2. No M5+ event yet → throws (cron defers to next tick)
 *   3. Magnitude floor walks down to M4.5+ after 4h of waiting
 *   4. Magnitude floor walks down to M4+ after 8h of waiting
 *
 * The resolver issues exactly one USGS FDSN call per resolve() — we
 * stub it directly and assert both the query params (so the magnitude
 * floor + time window land correctly) and the parsed result.
 */
final class AftershockResolverTest extends TestCase
{
    public function testFirstM5PlusEventResolvesImmediately(): void
    {
        $http = new MockHttpClient(function (string $method, string $url, array $options): MockResponse {
            self::assertSame('GET', $method);
            self::assertStringContainsString('earthquake.usgs.gov', $url);
            // Assert the query the resolver builds: M5 floor, time-asc, limit 1
            self::assertSame(5.0, $options['query']['minmagnitude']);
            self::assertSame('time-asc', $options['query']['orderby']);
            self::assertSame(1, $options['query']['limit']);
            return new MockResponse(json_encode([
                'features' => [[
                    'id' => 'us6000abcd',
                    'geometry' => ['coordinates' => [142.5, 38.3, 35.0]],
                    'properties' => [
                        'mag' => 6.2,
                        'place' => '120 km E of Honshu, Japan',
                        'time' => 1763_400_000_000,
                    ],
                ]],
            ]) ?: '{}');
        });

        $resolver = new AftershockResolver($http);
        // Round closed at T+0, cron runs 2h later — well inside M5+ floor.
        $closesAt = new \DateTimeImmutable('2026-05-22T00:00:00Z');
        $now = $closesAt->modify('+2 hours');

        $result = $resolver->resolve(
            ['windowEnd' => $closesAt->format(\DateTimeInterface::ATOM)],
            $now,
        );

        self::assertCount(1, $result->points);
        self::assertSame(38.3, $result->points[0]->lat);
        self::assertSame(142.5, $result->points[0]->lng);
        self::assertStringContainsString('Honshu', $result->points[0]->name);
        self::assertSame(5.0, $result->context['minMagnitude']);
        self::assertSame(7200, $result->context['waitedSeconds']);
    }

    public function testNoEventYetThrowsForDeferral(): void
    {
        $http = new MockHttpClient(fn () => new MockResponse(json_encode(['features' => []]) ?: '{}'));
        $resolver = new AftershockResolver($http);

        $closesAt = new \DateTimeImmutable('2026-05-22T00:00:00Z');
        $now = $closesAt->modify('+30 minutes');

        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessageMatches('/cron will retry/');
        $resolver->resolve(
            ['windowEnd' => $closesAt->format(\DateTimeInterface::ATOM)],
            $now,
        );
    }

    public function testMagnitudeFloorWalksDownAfter4Hours(): void
    {
        $capturedMagnitude = null;
        $http = new MockHttpClient(function (string $method, string $url, array $options) use (&$capturedMagnitude): MockResponse {
            $capturedMagnitude = $options['query']['minmagnitude'];
            return new MockResponse(json_encode(['features' => []]) ?: '{}');
        });
        $resolver = new AftershockResolver($http);

        $closesAt = new \DateTimeImmutable('2026-05-22T00:00:00Z');
        $now = $closesAt->modify('+5 hours');

        try {
            $resolver->resolve(['windowEnd' => $closesAt->format(\DateTimeInterface::ATOM)], $now);
        } catch (\RuntimeException) {
            // Expected — no events in the mock.
        }

        self::assertSame(4.5, $capturedMagnitude, 'After 4h the floor should drop to M4.5+');
    }

    public function testMagnitudeFloorWalksDownAfter8Hours(): void
    {
        $capturedMagnitude = null;
        $http = new MockHttpClient(function (string $method, string $url, array $options) use (&$capturedMagnitude): MockResponse {
            $capturedMagnitude = $options['query']['minmagnitude'];
            return new MockResponse(json_encode(['features' => []]) ?: '{}');
        });
        $resolver = new AftershockResolver($http);

        $closesAt = new \DateTimeImmutable('2026-05-22T00:00:00Z');
        $now = $closesAt->modify('+10 hours');

        try {
            $resolver->resolve(['windowEnd' => $closesAt->format(\DateTimeInterface::ATOM)], $now);
        } catch (\RuntimeException) {
            // Expected.
        }

        self::assertSame(4.0, $capturedMagnitude, 'After 8h the floor should drop to M4+');
    }

    public function testSearchStartIsClosesAtNotOpensAt(): void
    {
        $capturedStart = null;
        $capturedEnd = null;
        $http = new MockHttpClient(function (string $method, string $url, array $options) use (&$capturedStart, &$capturedEnd): MockResponse {
            $capturedStart = $options['query']['starttime'];
            $capturedEnd = $options['query']['endtime'];
            return new MockResponse(json_encode(['features' => []]) ?: '{}');
        });
        $resolver = new AftershockResolver($http);

        $closesAt = new \DateTimeImmutable('2026-05-22T00:00:00Z');
        $now = $closesAt->modify('+1 hour');

        try {
            $resolver->resolve(['windowEnd' => $closesAt->format(\DateTimeInterface::ATOM)], $now);
        } catch (\RuntimeException) {
            // Expected.
        }

        // Critical assertion: the search starts AFTER the round closes, not at opensAt.
        self::assertSame('2026-05-22T00:00:00', $capturedStart);
        self::assertSame('2026-05-22T01:00:00', $capturedEnd);
    }

    public function testSuggestProducesValidDraft(): void
    {
        $resolver = new AftershockResolver(new MockHttpClient());
        $now = new \DateTimeImmutable('2026-05-22T12:00:00Z');
        $draft = $resolver->suggest($now);

        self::assertNotNull($draft);
        self::assertSame('usgs.aftershock', $draft->resolverCode);
        self::assertStringContainsString('first M5+ earthquake', $draft->question);
        self::assertStringContainsString('24 hours after this round closes', $draft->question);
        self::assertArrayHasKey('windowEnd', $draft->resolverParams);
    }

    public function testMagnitudeFloorDropsToM35After24Hours(): void
    {
        $capturedMagnitude = null;
        $http = new MockHttpClient(function (string $method, string $url, array $options) use (&$capturedMagnitude): MockResponse {
            $capturedMagnitude = $options['query']['minmagnitude'];
            return new MockResponse(json_encode(['features' => []]) ?: '{}');
        });
        $resolver = new AftershockResolver($http);

        $closesAt = new \DateTimeImmutable('2026-05-22T00:00:00Z');
        $now = $closesAt->modify('+25 hours');

        try {
            $resolver->resolve(['windowEnd' => $closesAt->format(\DateTimeInterface::ATOM)], $now);
        } catch (\RuntimeException) {
            // Expected — no events in the mock.
        }

        self::assertSame(3.5, $capturedMagnitude, 'After 24h the last-resort floor M3.5+ must engage');
    }

    public function testClockSkewBeforeCloseThrowsCleanly(): void
    {
        // Cron fires before windowEnd (clock skew between web + cron boxes)
        // — must throw rather than silently query a backwards time window.
        $resolver = new AftershockResolver(new MockHttpClient());
        $closesAt = new \DateTimeImmutable('2026-05-22T00:00:00Z');
        $now = $closesAt->modify('-5 minutes');

        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessageMatches('/future/');
        $resolver->resolve(['windowEnd' => $closesAt->format(\DateTimeInterface::ATOM)], $now);
    }

    public function testMalformedGeojsonGracefullyDefers(): void
    {
        // USGS returned a feature without geometry.coordinates — treat as
        // "no resolvable event yet" and defer to the next cron tick rather
        // than crashing the whole auto-resolve loop.
        $http = new MockHttpClient(fn () => new MockResponse(json_encode([
            'features' => [[
                'id' => 'us-broken',
                'geometry' => null,
                'properties' => ['mag' => 6.0, 'time' => 1763_400_000_000],
            ]],
        ]) ?: '{}'));
        $resolver = new AftershockResolver($http);

        $closesAt = new \DateTimeImmutable('2026-05-22T00:00:00Z');
        $now = $closesAt->modify('+1 hour');

        $this->expectException(\RuntimeException::class);
        $resolver->resolve(['windowEnd' => $closesAt->format(\DateTimeInterface::ATOM)], $now);
    }

    public function testMissingWindowEndParamThrowsDescriptively(): void
    {
        // Resolver params arrive from RoundSuggestion JSON — if continuous-
        // mode rewriting fails to set windowEnd, we want a descriptive error
        // instead of a generic null-access fatal.
        $resolver = new AftershockResolver(new MockHttpClient());
        $now = new \DateTimeImmutable('2026-05-22T01:00:00Z');

        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessageMatches('/Missing windowEnd/');
        $resolver->resolve([], $now);
    }

    public function testCodeIsStableIdentifier(): void
    {
        // code() is persisted to round.auto_resolver_code on every round —
        // changing it would orphan historical rows from the registry.
        // Pin it explicitly so a refactor can't silently rename.
        $resolver = new AftershockResolver(new MockHttpClient());
        self::assertSame('usgs.aftershock', $resolver->code());
    }
}
