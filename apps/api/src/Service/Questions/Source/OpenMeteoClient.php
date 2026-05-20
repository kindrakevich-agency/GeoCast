<?php

declare(strict_types=1);

namespace App\Service\Questions\Source;

use Symfony\Contracts\HttpClient\HttpClientInterface;

/**
 * Thin typed wrapper around the Open-Meteo public APIs.
 *
 * Two endpoints:
 *
 *   forecast — api.open-meteo.com/v1/forecast
 *   archive  — archive-api.open-meteo.com/v1/archive
 *
 * Both accept comma-separated lat/lng pairs (batched request returns
 * a top-level array of per-city objects). Both are free, no API key,
 * generous rate limits (10,000 calls/day per IP for the free tier).
 *
 * This class is intentionally `class` not `final` so PHPUnit can mock
 * the HttpClient through the constructor in tests.
 */
class OpenMeteoClient
{
    private const FORECAST_BASE = 'https://api.open-meteo.com/v1/forecast';
    private const ARCHIVE_BASE  = 'https://archive-api.open-meteo.com/v1/archive';

    public function __construct(private readonly HttpClientInterface $http)
    {
    }

    /**
     * Daily max temperature for each (lat, lng) pair, for a single date.
     *
     * Returns the same order as the input arrays. Open-Meteo grid resolution
     * snaps to ~11 km, so values are nearest-cell — accurate enough for
     * city-scale questions, not for street-level.
     *
     * @param list<float> $lats
     * @param list<float> $lngs
     * @return list<float|null>  null when Open-Meteo has no data for that cell
     */
    public function dailyMaxTemperature(array $lats, array $lngs, \DateTimeImmutable $date): array
    {
        $iso = $date->format('Y-m-d');
        $payload = $this->call(self::FORECAST_BASE, [
            'latitude'   => implode(',', $lats),
            'longitude'  => implode(',', $lngs),
            'daily'      => 'temperature_2m_max',
            'timezone'   => 'auto',
            'start_date' => $iso,
            'end_date'   => $iso,
        ]);
        return $this->extractDailyMax($payload, \count($lats));
    }

    /**
     * Same shape, but reads from the archive endpoint — used at resolve
     * time, after the day has passed, to get observed (not forecast)
     * temperatures.
     *
     * @param list<float> $lats
     * @param list<float> $lngs
     * @return list<float|null>
     */
    public function dailyMaxTemperatureArchive(array $lats, array $lngs, \DateTimeImmutable $date): array
    {
        $iso = $date->format('Y-m-d');
        $payload = $this->call(self::ARCHIVE_BASE, [
            'latitude'   => implode(',', $lats),
            'longitude'  => implode(',', $lngs),
            'daily'      => 'temperature_2m_max',
            'timezone'   => 'auto',
            'start_date' => $iso,
            'end_date'   => $iso,
        ]);
        return $this->extractDailyMax($payload, \count($lats));
    }

    /**
     * Hourly temperatures over the given UTC day. Used at resolution time
     * to break daily-temperature ties — two cities tying at 32.1°C on the
     * daily aggregate almost always peak in different hours.
     *
     * Returns the peak temperature AND the ISO hour string it happened at,
     * for each city. NaN-on-no-data → null.
     *
     * @param list<float> $lats
     * @param list<float> $lngs
     * @return list<array{peak: float|null, hour: string|null}>
     */
    public function hourlyPeakTemperatureArchive(array $lats, array $lngs, \DateTimeImmutable $date): array
    {
        $iso = $date->format('Y-m-d');
        $payload = $this->call(self::ARCHIVE_BASE, [
            'latitude'   => implode(',', $lats),
            'longitude'  => implode(',', $lngs),
            'hourly'     => 'temperature_2m',
            'timezone'   => 'auto',
            'start_date' => $iso,
            'end_date'   => $iso,
        ]);

        $items = $this->itemsOf($payload, \count($lats));
        $out = [];
        foreach ($items as $item) {
            $temps = $item['hourly']['temperature_2m'] ?? [];
            $times = $item['hourly']['time'] ?? [];
            if (!\is_array($temps) || !\is_array($times) || $temps === []) {
                $out[] = ['peak' => null, 'hour' => null];
                continue;
            }
            $peakI = 0;
            $peak = (float) $temps[0];
            foreach ($temps as $i => $t) {
                if ($t !== null && (float) $t > $peak) {
                    $peak = (float) $t;
                    $peakI = $i;
                }
            }
            $out[] = ['peak' => $peak, 'hour' => (string) ($times[$peakI] ?? '')];
        }
        return $out;
    }

    /**
     * Open-Meteo's behaviour: with a single coordinate, the response is one
     * object; with multiple, it's an array of objects in the input order.
     * Normalise both into a list.
     *
     * @param array<mixed> $payload
     * @return list<array<string, mixed>>
     */
    private function itemsOf(array $payload, int $expected): array
    {
        // Detect array-of-objects vs single-object payload by presence of
        // a numeric 0 key with a city-shaped value.
        if ($expected === 1 || isset($payload['daily']) || isset($payload['hourly'])) {
            return [$payload];
        }
        // Already a JSON array.
        return array_values($payload);
    }

    /**
     * @param array<mixed> $payload
     * @return list<float|null>
     */
    private function extractDailyMax(array $payload, int $expected): array
    {
        $items = $this->itemsOf($payload, $expected);
        $out = [];
        foreach ($items as $item) {
            $vals = $item['daily']['temperature_2m_max'] ?? null;
            if (!\is_array($vals) || $vals === []) {
                $out[] = null;
                continue;
            }
            $first = $vals[0];
            $out[] = $first === null ? null : (float) $first;
        }
        return $out;
    }

    /**
     * @param array<string, string|int> $query
     * @return array<mixed>
     */
    private function call(string $base, array $query): array
    {
        $resp = $this->http->request('GET', $base, ['query' => $query, 'timeout' => 15]);
        if ($resp->getStatusCode() >= 400) {
            throw new \RuntimeException(
                sprintf('Open-Meteo %d: %s', $resp->getStatusCode(), $resp->getContent(false)),
            );
        }
        /** @var array<mixed> $json */
        $json = $resp->toArray(false);
        return $json;
    }
}
