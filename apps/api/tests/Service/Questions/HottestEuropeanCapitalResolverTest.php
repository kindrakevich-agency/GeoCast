<?php

declare(strict_types=1);

namespace App\Tests\Service\Questions;

use App\Service\Questions\Resolver\HottestEuropeanCapitalResolver;
use App\Service\Questions\Source\EuropeanCapitals;
use App\Service\Questions\Source\OpenMeteoClient;
use PHPUnit\Framework\TestCase;
use Symfony\Component\HttpClient\MockHttpClient;
use Symfony\Component\HttpClient\Response\MockResponse;

/**
 * HottestEuropeanCapitalResolver — covers the three resolution paths:
 *
 *   1. Single clear winner — daily aggregate has one city ahead by > 0.05°C
 *   2. Tie at daily, broken by hourly — two cities tie at 32.1°C daily,
 *      hourly peaks reveal one was actually higher
 *   3. True multi-winner — two cities identical at hourly resolution too
 *
 * The daily endpoint is asked for ALL ~47 capitals, so we have to stub a
 * full array of responses keyed by input order. EuropeanCapitals::all()
 * is the canonical order.
 */
final class HottestEuropeanCapitalResolverTest extends TestCase
{
    public function testSingleClearWinner(): void
    {
        // Build a per-city daily-temp dataset where Madrid is clearly hottest.
        $temps = $this->flatTemps(20.0);
        $temps[$this->idxOf('Madrid')] = 35.0;
        $temps[$this->idxOf('Rome')] = 30.0;

        $resolver = new HottestEuropeanCapitalResolver(
            new OpenMeteoClient(new MockHttpClient($this->respondDaily($temps))),
        );

        $result = $resolver->resolve(['date' => '2026-05-21'], new \DateTimeImmutable('2026-05-22T06:00:00Z'));
        $this->assertCount(1, $result->points);
        $this->assertSame('Madrid', $result->points[0]->name);
    }

    public function testTieAtDailyBrokenByHourly(): void
    {
        // Madrid and Rome both at 32.1°C daily.
        $temps = $this->flatTemps(20.0);
        $temps[$this->idxOf('Madrid')] = 32.1;
        $temps[$this->idxOf('Rome')] = 32.1;

        // After the daily call, the resolver issues a second hourly call
        // for ONLY the tied cities. The MockHttpClient cycles through
        // pre-queued responses in order.
        $hourlyBody = json_encode([
            [
                'hourly' => [
                    'time'           => ['2026-05-21T16:00','2026-05-21T17:00'],
                    'temperature_2m' => [31.8, 32.3], // Madrid peak 32.3
                ],
            ],
            [
                'hourly' => [
                    'time'           => ['2026-05-21T16:00','2026-05-21T17:00'],
                    'temperature_2m' => [32.1, 31.9], // Rome peak 32.1
                ],
            ],
        ]);

        $resolver = new HottestEuropeanCapitalResolver(
            new OpenMeteoClient(new MockHttpClient([
                $this->respondDailyOnce($temps),
                new MockResponse($hourlyBody),
            ])),
        );

        $result = $resolver->resolve(['date' => '2026-05-21'], new \DateTimeImmutable('2026-05-22T06:00:00Z'));
        $this->assertCount(1, $result->points);
        $this->assertSame('Madrid', $result->points[0]->name);
        $this->assertSame('hourly', $result->context['tieBrokenBy'] ?? null);
    }

    public function testTrueTieBecomesMultiWinner(): void
    {
        $temps = $this->flatTemps(20.0);
        $temps[$this->idxOf('Madrid')] = 32.1;
        $temps[$this->idxOf('Rome')] = 32.1;

        // Identical hourly peaks too — multi-winner.
        $hourlyBody = json_encode([
            ['hourly' => ['time' => ['2026-05-21T17:00'], 'temperature_2m' => [32.1]]],
            ['hourly' => ['time' => ['2026-05-21T17:00'], 'temperature_2m' => [32.1]]],
        ]);

        $resolver = new HottestEuropeanCapitalResolver(
            new OpenMeteoClient(new MockHttpClient([
                $this->respondDailyOnce($temps),
                new MockResponse($hourlyBody),
            ])),
        );

        $result = $resolver->resolve(['date' => '2026-05-21'], new \DateTimeImmutable('2026-05-22T06:00:00Z'));
        $this->assertCount(2, $result->points);
        $names = array_map(static fn ($p) => $p->name, $result->points);
        $this->assertContains('Madrid', $names);
        $this->assertContains('Rome', $names);
    }

    public function testRejectsMissingDateParam(): void
    {
        $resolver = new HottestEuropeanCapitalResolver(
            new OpenMeteoClient(new MockHttpClient([])),
        );

        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessageMatches('/date/');
        $resolver->resolve([], new \DateTimeImmutable());
    }

    /** Build a flat list of temperatures, one per capital. */
    private function flatTemps(float $base): array
    {
        return array_fill(0, count(EuropeanCapitals::all()), $base);
    }

    /** Index of a named capital in EuropeanCapitals::all(). */
    private function idxOf(string $name): int
    {
        foreach (EuropeanCapitals::all() as $i => $c) {
            if ($c['name'] === $name) return $i;
        }
        throw new \LogicException("No capital named '$name' — update the dataset or fix the test.");
    }

    /** @param list<float> $temps */
    private function respondDailyOnce(array $temps): MockResponse
    {
        $items = array_map(static fn (float $t): array =>
            ['daily' => ['temperature_2m_max' => [$t]]],
            $temps,
        );
        return new MockResponse(json_encode($items));
    }

    /** @param list<float> $temps */
    private function respondDaily(array $temps): callable
    {
        $resp = $this->respondDailyOnce($temps);
        return static fn () => $resp;
    }
}
