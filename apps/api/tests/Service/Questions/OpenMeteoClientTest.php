<?php

declare(strict_types=1);

namespace App\Tests\Service\Questions;

use App\Service\Questions\Source\OpenMeteoClient;
use PHPUnit\Framework\TestCase;
use Symfony\Component\HttpClient\MockHttpClient;
use Symfony\Component\HttpClient\Response\MockResponse;

/**
 * OpenMeteoClient unit tests. Uses MockHttpClient so no network is touched.
 *
 * We assert two behaviours:
 *
 *   1. Multi-coordinate requests come back as an array of per-city objects
 *      in input order, and extractDailyMax() preserves that order.
 *   2. Hourly peak detection picks the highest temperature and reports the
 *      ISO hour string it occurred at.
 */
final class OpenMeteoClientTest extends TestCase
{
    public function testDailyMaxForFourCapitalsInOrder(): void
    {
        $body = json_encode([
            ['daily' => ['temperature_2m_max' => [31.2]]], // Madrid
            ['daily' => ['temperature_2m_max' => [28.4]]], // Rome
            ['daily' => ['temperature_2m_max' => [25.0]]], // Paris
            ['daily' => ['temperature_2m_max' => [17.4]]], // London
        ]);
        $client = new OpenMeteoClient(new MockHttpClient(new MockResponse($body)));

        $temps = $client->dailyMaxTemperature(
            [40.4168, 41.9028, 48.8566, 51.5074],
            [-3.7038, 12.4964, 2.3522, -0.1278],
            new \DateTimeImmutable('2026-05-21'),
        );

        $this->assertSame([31.2, 28.4, 25.0, 17.4], $temps);
    }

    public function testDailyMaxHandlesSingleCityObjectShape(): void
    {
        // With a single city Open-Meteo returns the object directly,
        // not an array — make sure the client normalises this.
        $body = json_encode(['daily' => ['temperature_2m_max' => [33.7]]]);
        $client = new OpenMeteoClient(new MockHttpClient(new MockResponse($body)));

        $temps = $client->dailyMaxTemperature([40.4168], [-3.7038], new \DateTimeImmutable('2026-05-21'));
        $this->assertSame([33.7], $temps);
    }

    public function testDailyMaxYieldsNullForMissingData(): void
    {
        $body = json_encode([
            ['daily' => ['temperature_2m_max' => [31.2]]],
            ['daily' => ['temperature_2m_max' => []]], // empty -> null
            ['daily' => ['temperature_2m_max' => [null]]], // explicit null
        ]);
        $client = new OpenMeteoClient(new MockHttpClient(new MockResponse($body)));

        $temps = $client->dailyMaxTemperature(
            [1.0, 2.0, 3.0], [10.0, 20.0, 30.0],
            new \DateTimeImmutable('2026-05-21'),
        );
        $this->assertSame([31.2, null, null], $temps);
    }

    public function testHourlyPeakDetection(): void
    {
        // Madrid peaks at 17:00 (32.1), Rome peaks at 16:00 (28.4).
        $body = json_encode([
            [
                'hourly' => [
                    'time'           => ['2026-05-21T15:00','2026-05-21T16:00','2026-05-21T17:00','2026-05-21T18:00'],
                    'temperature_2m' => [30.5, 31.6, 32.1, 31.8],
                ],
            ],
            [
                'hourly' => [
                    'time'           => ['2026-05-21T15:00','2026-05-21T16:00','2026-05-21T17:00','2026-05-21T18:00'],
                    'temperature_2m' => [27.0, 28.4, 28.0, 26.5],
                ],
            ],
        ]);
        $client = new OpenMeteoClient(new MockHttpClient(new MockResponse($body)));

        $peaks = $client->hourlyPeakTemperatureArchive(
            [40.4168, 41.9028],
            [-3.7038, 12.4964],
            new \DateTimeImmutable('2026-05-21'),
        );

        $this->assertCount(2, $peaks);
        $this->assertSame(32.1, $peaks[0]['peak']);
        $this->assertSame('2026-05-21T17:00', $peaks[0]['hour']);
        $this->assertSame(28.4, $peaks[1]['peak']);
        $this->assertSame('2026-05-21T16:00', $peaks[1]['hour']);
    }

    public function testThrowsOnHttp5xx(): void
    {
        $client = new OpenMeteoClient(new MockHttpClient(
            new MockResponse('Service unavailable', ['http_code' => 503]),
        ));

        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessageMatches('/Open-Meteo 503/');
        $client->dailyMaxTemperature([1.0], [1.0], new \DateTimeImmutable('2026-05-21'));
    }
}
