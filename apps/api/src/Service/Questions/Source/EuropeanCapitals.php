<?php

declare(strict_types=1);

namespace App\Service\Questions\Source;

/**
 * Curated list of European capital cities for weather-question resolvers.
 *
 * Why hard-coded: the truth-set for a daily question has to be deterministic
 * and reproducible across the suggestion → resolution gap (~24h). A
 * dynamic list (e.g. fetched from REST Countries) could shift between
 * suggest-time and resolve-time and change the winner.
 *
 * Coordinates are city-centre to one decimal (≈11 km accuracy) — accurate
 * enough that Open-Meteo's nearest-grid-cell resolution puts you in the
 * right metro area; vague enough to not pretend to weather-station-level
 * precision.
 *
 * 47 capitals — every internationally recognised European country.
 */
final class EuropeanCapitals
{
    /**
     * @return list<array{name: string, country: string, lat: float, lng: float}>
     */
    public static function all(): array
    {
        return [
            ['name' => 'Andorra la Vella', 'country' => 'AD', 'lat' => 42.5063, 'lng' => 1.5218],
            ['name' => 'Tirana',           'country' => 'AL', 'lat' => 41.3275, 'lng' => 19.8189],
            ['name' => 'Yerevan',          'country' => 'AM', 'lat' => 40.1872, 'lng' => 44.5152],
            ['name' => 'Vienna',           'country' => 'AT', 'lat' => 48.2082, 'lng' => 16.3738],
            ['name' => 'Baku',             'country' => 'AZ', 'lat' => 40.4093, 'lng' => 49.8671],
            ['name' => 'Sarajevo',         'country' => 'BA', 'lat' => 43.8563, 'lng' => 18.4131],
            ['name' => 'Brussels',         'country' => 'BE', 'lat' => 50.8503, 'lng' => 4.3517],
            ['name' => 'Sofia',            'country' => 'BG', 'lat' => 42.6977, 'lng' => 23.3219],
            ['name' => 'Minsk',            'country' => 'BY', 'lat' => 53.9006, 'lng' => 27.5590],
            ['name' => 'Bern',             'country' => 'CH', 'lat' => 46.9480, 'lng' => 7.4474],
            ['name' => 'Nicosia',          'country' => 'CY', 'lat' => 35.1856, 'lng' => 33.3823],
            ['name' => 'Prague',           'country' => 'CZ', 'lat' => 50.0755, 'lng' => 14.4378],
            ['name' => 'Berlin',           'country' => 'DE', 'lat' => 52.5200, 'lng' => 13.4050],
            ['name' => 'Copenhagen',       'country' => 'DK', 'lat' => 55.6761, 'lng' => 12.5683],
            ['name' => 'Tallinn',          'country' => 'EE', 'lat' => 59.4370, 'lng' => 24.7536],
            ['name' => 'Madrid',           'country' => 'ES', 'lat' => 40.4168, 'lng' => -3.7038],
            ['name' => 'Helsinki',         'country' => 'FI', 'lat' => 60.1699, 'lng' => 24.9384],
            ['name' => 'Paris',            'country' => 'FR', 'lat' => 48.8566, 'lng' => 2.3522],
            ['name' => 'Tbilisi',          'country' => 'GE', 'lat' => 41.7151, 'lng' => 44.8271],
            ['name' => 'London',           'country' => 'GB', 'lat' => 51.5074, 'lng' => -0.1278],
            ['name' => 'Athens',           'country' => 'GR', 'lat' => 37.9838, 'lng' => 23.7275],
            ['name' => 'Zagreb',           'country' => 'HR', 'lat' => 45.8150, 'lng' => 15.9819],
            ['name' => 'Budapest',         'country' => 'HU', 'lat' => 47.4979, 'lng' => 19.0402],
            ['name' => 'Dublin',           'country' => 'IE', 'lat' => 53.3498, 'lng' => -6.2603],
            ['name' => 'Reykjavik',        'country' => 'IS', 'lat' => 64.1466, 'lng' => -21.9426],
            ['name' => 'Rome',             'country' => 'IT', 'lat' => 41.9028, 'lng' => 12.4964],
            ['name' => 'Pristina',         'country' => 'XK', 'lat' => 42.6629, 'lng' => 21.1655],
            ['name' => 'Vaduz',            'country' => 'LI', 'lat' => 47.1410, 'lng' => 9.5209],
            ['name' => 'Vilnius',          'country' => 'LT', 'lat' => 54.6872, 'lng' => 25.2797],
            ['name' => 'Luxembourg',       'country' => 'LU', 'lat' => 49.6116, 'lng' => 6.1319],
            ['name' => 'Riga',             'country' => 'LV', 'lat' => 56.9496, 'lng' => 24.1052],
            ['name' => 'Monaco',           'country' => 'MC', 'lat' => 43.7384, 'lng' => 7.4246],
            ['name' => 'Chisinau',         'country' => 'MD', 'lat' => 47.0105, 'lng' => 28.8638],
            ['name' => 'Podgorica',        'country' => 'ME', 'lat' => 42.4304, 'lng' => 19.2594],
            ['name' => 'Skopje',           'country' => 'MK', 'lat' => 41.9981, 'lng' => 21.4254],
            ['name' => 'Valletta',         'country' => 'MT', 'lat' => 35.8989, 'lng' => 14.5146],
            ['name' => 'Amsterdam',        'country' => 'NL', 'lat' => 52.3676, 'lng' => 4.9041],
            ['name' => 'Oslo',             'country' => 'NO', 'lat' => 59.9139, 'lng' => 10.7522],
            ['name' => 'Warsaw',           'country' => 'PL', 'lat' => 52.2297, 'lng' => 21.0122],
            ['name' => 'Lisbon',           'country' => 'PT', 'lat' => 38.7223, 'lng' => -9.1393],
            ['name' => 'Bucharest',        'country' => 'RO', 'lat' => 44.4268, 'lng' => 26.1025],
            ['name' => 'Belgrade',         'country' => 'RS', 'lat' => 44.7866, 'lng' => 20.4489],
            ['name' => 'Stockholm',        'country' => 'SE', 'lat' => 59.3293, 'lng' => 18.0686],
            ['name' => 'Ljubljana',        'country' => 'SI', 'lat' => 46.0569, 'lng' => 14.5058],
            ['name' => 'Bratislava',       'country' => 'SK', 'lat' => 48.1486, 'lng' => 17.1077],
            ['name' => 'San Marino',       'country' => 'SM', 'lat' => 43.9333, 'lng' => 12.4500],
            ['name' => 'Kyiv',             'country' => 'UA', 'lat' => 50.4501, 'lng' => 30.5234],
            ['name' => 'Vatican City',     'country' => 'VA', 'lat' => 41.9029, 'lng' => 12.4534],
        ];
    }

    /** @return list<float> */
    public static function latitudes(): array
    {
        return array_map(static fn (array $c): float => $c['lat'], self::all());
    }

    /** @return list<float> */
    public static function longitudes(): array
    {
        return array_map(static fn (array $c): float => $c['lng'], self::all());
    }
}
