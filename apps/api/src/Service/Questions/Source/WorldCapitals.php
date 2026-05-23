<?php

declare(strict_types=1);

namespace App\Service\Questions\Source;

/**
 * Global candidate dataset for weather/cloud/UV questions.
 *
 * 195 UN-recognised capitals + 49 of the world's top metro areas that
 * aren't capitals (NYC, LA, Shanghai, Mumbai, São Paulo, Lagos, …). The
 * "+" gives geographic equity AND name recognition — without them, the
 * heaviest-rainfall round in California or the strongest-wind-gust round
 * along the Gulf Coast would have to resolve to "Washington D.C." just
 * because there's no closer candidate.
 *
 * Why hard-coded: the truth-set for a round must be deterministic across
 * the suggest → resolve gap (~24h). A dynamic list (REST Countries API,
 * Wikipedia, etc.) could shift between suggest-time and resolve-time and
 * change the winner. The data here is geographically stable.
 *
 * Coordinates are city-centre to ~3 decimal places (≈100m accuracy) —
 * way more than the ~11km grid resolution Open-Meteo snaps to. Source:
 * Wikipedia / GeoNames for capitals; UN World Urbanization Prospects
 * 2024 for the megacity ranking.
 */
final class WorldCapitals
{
    /**
     * @return list<array{name: string, country: string, lat: float, lng: float, coastal?: bool}>
     */
    public static function all(): array
    {
        return [
            // ==== AFRICA (54 capitals) ====
            ['name' => 'Algiers',           'country' => 'DZ', 'lat' =>  36.7538, 'lng' =>   3.0588, 'coastal' => true],
            ['name' => 'Luanda',            'country' => 'AO', 'lat' =>  -8.8390, 'lng' =>  13.2894, 'coastal' => true],
            ['name' => 'Porto-Novo',        'country' => 'BJ', 'lat' =>   6.4969, 'lng' =>   2.6289, 'coastal' => true],
            ['name' => 'Gaborone',          'country' => 'BW', 'lat' => -24.6282, 'lng' =>  25.9231],
            ['name' => 'Ouagadougou',       'country' => 'BF', 'lat' =>  12.3714, 'lng' =>  -1.5197],
            ['name' => 'Bujumbura',         'country' => 'BI', 'lat' =>  -3.3614, 'lng' =>  29.3599],
            ['name' => 'Yaoundé',           'country' => 'CM', 'lat' =>   3.8480, 'lng' =>  11.5021],
            ['name' => 'Praia',             'country' => 'CV', 'lat' =>  14.9333, 'lng' => -23.5133, 'coastal' => true],
            ['name' => 'Bangui',            'country' => 'CF', 'lat' =>   4.3947, 'lng' =>  18.5582],
            ['name' => "N'Djamena",         'country' => 'TD', 'lat' =>  12.1348, 'lng' =>  15.0557],
            ['name' => 'Moroni',            'country' => 'KM', 'lat' => -11.7172, 'lng' =>  43.2473, 'coastal' => true],
            ['name' => 'Kinshasa',          'country' => 'CD', 'lat' =>  -4.4419, 'lng' =>  15.2663],
            ['name' => 'Brazzaville',       'country' => 'CG', 'lat' =>  -4.2634, 'lng' =>  15.2429],
            ['name' => 'Yamoussoukro',      'country' => 'CI', 'lat' =>   6.8276, 'lng' =>  -5.2893],
            ['name' => 'Djibouti',          'country' => 'DJ', 'lat' =>  11.5721, 'lng' =>  43.1456, 'coastal' => true],
            ['name' => 'Cairo',             'country' => 'EG', 'lat' =>  30.0444, 'lng' =>  31.2357],
            ['name' => 'Malabo',            'country' => 'GQ', 'lat' =>   3.7523, 'lng' =>   8.7742, 'coastal' => true],
            ['name' => 'Asmara',            'country' => 'ER', 'lat' =>  15.3229, 'lng' =>  38.9251],
            ['name' => 'Mbabane',           'country' => 'SZ', 'lat' => -26.3054, 'lng' =>  31.1367],
            ['name' => 'Addis Ababa',       'country' => 'ET', 'lat' =>   9.0320, 'lng' =>  38.7469],
            ['name' => 'Libreville',        'country' => 'GA', 'lat' =>   0.4162, 'lng' =>   9.4673, 'coastal' => true],
            ['name' => 'Banjul',            'country' => 'GM', 'lat' =>  13.4549, 'lng' => -16.5790, 'coastal' => true],
            ['name' => 'Accra',             'country' => 'GH', 'lat' =>   5.6037, 'lng' =>  -0.1870, 'coastal' => true],
            ['name' => 'Conakry',           'country' => 'GN', 'lat' =>   9.6412, 'lng' => -13.5784, 'coastal' => true],
            ['name' => 'Bissau',            'country' => 'GW', 'lat' =>  11.8636, 'lng' => -15.5977, 'coastal' => true],
            ['name' => 'Nairobi',           'country' => 'KE', 'lat' =>  -1.2921, 'lng' =>  36.8219],
            ['name' => 'Maseru',            'country' => 'LS', 'lat' => -29.3142, 'lng' =>  27.4833],
            ['name' => 'Monrovia',          'country' => 'LR', 'lat' =>   6.3004, 'lng' => -10.7969, 'coastal' => true],
            ['name' => 'Tripoli',           'country' => 'LY', 'lat' =>  32.8872, 'lng' =>  13.1913, 'coastal' => true],
            ['name' => 'Antananarivo',      'country' => 'MG', 'lat' => -18.8792, 'lng' =>  47.5079],
            ['name' => 'Lilongwe',          'country' => 'MW', 'lat' => -13.9626, 'lng' =>  33.7741],
            ['name' => 'Bamako',            'country' => 'ML', 'lat' =>  12.6392, 'lng' =>  -8.0029],
            ['name' => 'Nouakchott',        'country' => 'MR', 'lat' =>  18.0735, 'lng' => -15.9582, 'coastal' => true],
            ['name' => 'Port Louis',        'country' => 'MU', 'lat' => -20.1609, 'lng' =>  57.5012, 'coastal' => true],
            ['name' => 'Rabat',             'country' => 'MA', 'lat' =>  34.0209, 'lng' =>  -6.8416, 'coastal' => true],
            ['name' => 'Maputo',            'country' => 'MZ', 'lat' => -25.9692, 'lng' =>  32.5732, 'coastal' => true],
            ['name' => 'Windhoek',          'country' => 'NA', 'lat' => -22.5609, 'lng' =>  17.0658],
            ['name' => 'Niamey',            'country' => 'NE', 'lat' =>  13.5117, 'lng' =>   2.1251],
            ['name' => 'Abuja',             'country' => 'NG', 'lat' =>   9.0765, 'lng' =>   7.3986],
            ['name' => 'Kigali',            'country' => 'RW', 'lat' =>  -1.9706, 'lng' =>  30.1044],
            ['name' => 'São Tomé',          'country' => 'ST', 'lat' =>   0.3365, 'lng' =>   6.7273, 'coastal' => true],
            ['name' => 'Dakar',             'country' => 'SN', 'lat' =>  14.7167, 'lng' => -17.4677, 'coastal' => true],
            ['name' => 'Victoria',          'country' => 'SC', 'lat' =>  -4.6191, 'lng' =>  55.4513, 'coastal' => true],
            ['name' => 'Freetown',          'country' => 'SL', 'lat' =>   8.4657, 'lng' => -13.2317, 'coastal' => true],
            ['name' => 'Mogadishu',         'country' => 'SO', 'lat' =>   2.0469, 'lng' =>  45.3182, 'coastal' => true],
            ['name' => 'Pretoria',          'country' => 'ZA', 'lat' => -25.7479, 'lng' =>  28.2293],
            ['name' => 'Juba',              'country' => 'SS', 'lat' =>   4.8517, 'lng' =>  31.5825],
            ['name' => 'Khartoum',          'country' => 'SD', 'lat' =>  15.5007, 'lng' =>  32.5599],
            ['name' => 'Dodoma',            'country' => 'TZ', 'lat' =>  -6.1630, 'lng' =>  35.7516],
            ['name' => 'Lomé',              'country' => 'TG', 'lat' =>   6.1725, 'lng' =>   1.2314, 'coastal' => true],
            ['name' => 'Tunis',             'country' => 'TN', 'lat' =>  36.8065, 'lng' =>  10.1815, 'coastal' => true],
            ['name' => 'Kampala',           'country' => 'UG', 'lat' =>   0.3476, 'lng' =>  32.5825],
            ['name' => 'Lusaka',            'country' => 'ZM', 'lat' => -15.3875, 'lng' =>  28.3228],
            ['name' => 'Harare',            'country' => 'ZW', 'lat' => -17.8252, 'lng' =>  31.0335],

            // ==== AMERICAS (35 capitals) ====
            ['name' => "St. John's",        'country' => 'AG', 'lat' =>  17.1175, 'lng' => -61.8456, 'coastal' => true],
            ['name' => 'Buenos Aires',      'country' => 'AR', 'lat' => -34.6037, 'lng' => -58.3816, 'coastal' => true],
            ['name' => 'Nassau',            'country' => 'BS', 'lat' =>  25.0443, 'lng' => -77.3504, 'coastal' => true],
            ['name' => 'Bridgetown',        'country' => 'BB', 'lat' =>  13.1132, 'lng' => -59.5988, 'coastal' => true],
            ['name' => 'Belmopan',          'country' => 'BZ', 'lat' =>  17.2510, 'lng' => -88.7590],
            ['name' => 'La Paz',            'country' => 'BO', 'lat' => -16.4897, 'lng' => -68.1193],
            ['name' => 'Brasília',          'country' => 'BR', 'lat' => -15.8267, 'lng' => -47.9218],
            ['name' => 'Ottawa',            'country' => 'CA', 'lat' =>  45.4215, 'lng' => -75.6972],
            ['name' => 'Santiago',          'country' => 'CL', 'lat' => -33.4489, 'lng' => -70.6693],
            ['name' => 'Bogotá',            'country' => 'CO', 'lat' =>   4.7110, 'lng' => -74.0721],
            ['name' => 'San José',          'country' => 'CR', 'lat' =>   9.9281, 'lng' => -84.0907],
            ['name' => 'Havana',            'country' => 'CU', 'lat' =>  23.1136, 'lng' => -82.3666, 'coastal' => true],
            ['name' => 'Roseau',            'country' => 'DM', 'lat' =>  15.3010, 'lng' => -61.3870, 'coastal' => true],
            ['name' => 'Santo Domingo',     'country' => 'DO', 'lat' =>  18.4861, 'lng' => -69.9312, 'coastal' => true],
            ['name' => 'Quito',             'country' => 'EC', 'lat' =>  -0.1807, 'lng' => -78.4678],
            ['name' => 'San Salvador',      'country' => 'SV', 'lat' =>  13.6929, 'lng' => -89.2182],
            ['name' => "St. George's",      'country' => 'GD', 'lat' =>  12.0561, 'lng' => -61.7488, 'coastal' => true],
            ['name' => 'Guatemala City',    'country' => 'GT', 'lat' =>  14.6349, 'lng' => -90.5069],
            ['name' => 'Georgetown',        'country' => 'GY', 'lat' =>   6.8013, 'lng' => -58.1551, 'coastal' => true],
            ['name' => 'Port-au-Prince',    'country' => 'HT', 'lat' =>  18.5944, 'lng' => -72.3074, 'coastal' => true],
            ['name' => 'Tegucigalpa',       'country' => 'HN', 'lat' =>  14.0723, 'lng' => -87.1921],
            ['name' => 'Kingston',          'country' => 'JM', 'lat' =>  17.9970, 'lng' => -76.7936, 'coastal' => true],
            ['name' => 'Mexico City',       'country' => 'MX', 'lat' =>  19.4326, 'lng' => -99.1332],
            ['name' => 'Managua',           'country' => 'NI', 'lat' =>  12.1364, 'lng' => -86.2514],
            ['name' => 'Panama City',       'country' => 'PA', 'lat' =>   8.9824, 'lng' => -79.5199, 'coastal' => true],
            ['name' => 'Asunción',          'country' => 'PY', 'lat' => -25.2637, 'lng' => -57.5759],
            ['name' => 'Lima',              'country' => 'PE', 'lat' => -12.0464, 'lng' => -77.0428, 'coastal' => true],
            ['name' => 'Basseterre',        'country' => 'KN', 'lat' =>  17.2955, 'lng' => -62.7261, 'coastal' => true],
            ['name' => 'Castries',          'country' => 'LC', 'lat' =>  14.0101, 'lng' => -60.9875, 'coastal' => true],
            ['name' => 'Kingstown',         'country' => 'VC', 'lat' =>  13.1574, 'lng' => -61.2249, 'coastal' => true],
            ['name' => 'Paramaribo',        'country' => 'SR', 'lat' =>   5.8520, 'lng' => -55.2038, 'coastal' => true],
            ['name' => 'Port of Spain',     'country' => 'TT', 'lat' =>  10.6918, 'lng' => -61.2225, 'coastal' => true],
            ['name' => 'Washington D.C.',   'country' => 'US', 'lat' =>  38.9072, 'lng' => -77.0369],
            ['name' => 'Montevideo',        'country' => 'UY', 'lat' => -34.9011, 'lng' => -56.1645, 'coastal' => true],
            ['name' => 'Caracas',           'country' => 'VE', 'lat' =>  10.4806, 'lng' => -66.9036],

            // ==== ASIA (49 capitals) ====
            ['name' => 'Kabul',             'country' => 'AF', 'lat' =>  34.5553, 'lng' =>  69.2075],
            ['name' => 'Manama',            'country' => 'BH', 'lat' =>  26.2235, 'lng' =>  50.5876, 'coastal' => true],
            ['name' => 'Dhaka',             'country' => 'BD', 'lat' =>  23.8103, 'lng' =>  90.4125],
            ['name' => 'Thimphu',           'country' => 'BT', 'lat' =>  27.4728, 'lng' =>  89.6390],
            ['name' => 'Bandar Seri Begawan','country' => 'BN','lat' =>   4.9031, 'lng' => 114.9398],
            ['name' => 'Phnom Penh',        'country' => 'KH', 'lat' =>  11.5564, 'lng' => 104.9282],
            ['name' => 'Beijing',           'country' => 'CN', 'lat' =>  39.9042, 'lng' => 116.4074],
            ['name' => 'New Delhi',         'country' => 'IN', 'lat' =>  28.6139, 'lng' =>  77.2090],
            ['name' => 'Jakarta',           'country' => 'ID', 'lat' =>  -6.2088, 'lng' => 106.8456, 'coastal' => true],
            ['name' => 'Tehran',            'country' => 'IR', 'lat' =>  35.6892, 'lng' =>  51.3890],
            ['name' => 'Baghdad',           'country' => 'IQ', 'lat' =>  33.3152, 'lng' =>  44.3661],
            ['name' => 'Jerusalem',         'country' => 'IL', 'lat' =>  31.7683, 'lng' =>  35.2137],
            ['name' => 'Tokyo',             'country' => 'JP', 'lat' =>  35.6762, 'lng' => 139.6503, 'coastal' => true],
            ['name' => 'Amman',             'country' => 'JO', 'lat' =>  31.9454, 'lng' =>  35.9284],
            ['name' => 'Astana',            'country' => 'KZ', 'lat' =>  51.1605, 'lng' =>  71.4704],
            ['name' => 'Kuwait City',       'country' => 'KW', 'lat' =>  29.3759, 'lng' =>  47.9774, 'coastal' => true],
            ['name' => 'Bishkek',           'country' => 'KG', 'lat' =>  42.8746, 'lng' =>  74.5698],
            ['name' => 'Vientiane',         'country' => 'LA', 'lat' =>  17.9757, 'lng' => 102.6331],
            ['name' => 'Beirut',            'country' => 'LB', 'lat' =>  33.8938, 'lng' =>  35.5018, 'coastal' => true],
            ['name' => 'Kuala Lumpur',      'country' => 'MY', 'lat' =>   3.1390, 'lng' => 101.6869],
            ['name' => 'Malé',              'country' => 'MV', 'lat' =>   4.1755, 'lng' =>  73.5093, 'coastal' => true],
            ['name' => 'Ulaanbaatar',       'country' => 'MN', 'lat' =>  47.8864, 'lng' => 106.9057],
            ['name' => 'Naypyidaw',         'country' => 'MM', 'lat' =>  19.7633, 'lng' =>  96.0785],
            ['name' => 'Kathmandu',         'country' => 'NP', 'lat' =>  27.7172, 'lng' =>  85.3240],
            ['name' => 'Pyongyang',         'country' => 'KP', 'lat' =>  39.0392, 'lng' => 125.7625],
            ['name' => 'Muscat',            'country' => 'OM', 'lat' =>  23.5880, 'lng' =>  58.3829, 'coastal' => true],
            ['name' => 'Islamabad',         'country' => 'PK', 'lat' =>  33.6844, 'lng' =>  73.0479],
            ['name' => 'Manila',            'country' => 'PH', 'lat' =>  14.5995, 'lng' => 120.9842, 'coastal' => true],
            ['name' => 'Doha',              'country' => 'QA', 'lat' =>  25.2854, 'lng' =>  51.5310, 'coastal' => true],
            ['name' => 'Riyadh',            'country' => 'SA', 'lat' =>  24.7136, 'lng' =>  46.6753],
            ['name' => 'Singapore',         'country' => 'SG', 'lat' =>   1.3521, 'lng' => 103.8198, 'coastal' => true],
            ['name' => 'Seoul',             'country' => 'KR', 'lat' =>  37.5665, 'lng' => 126.9780],
            ['name' => 'Sri Jayawardenepura','country' => 'LK','lat' =>   6.9019, 'lng' =>  79.8617, 'coastal' => true],
            ['name' => 'Damascus',          'country' => 'SY', 'lat' =>  33.5138, 'lng' =>  36.2765],
            ['name' => 'Taipei',            'country' => 'TW', 'lat' =>  25.0330, 'lng' => 121.5654],
            ['name' => 'Dushanbe',          'country' => 'TJ', 'lat' =>  38.5598, 'lng' =>  68.7870],
            ['name' => 'Bangkok',           'country' => 'TH', 'lat' =>  13.7563, 'lng' => 100.5018],
            ['name' => 'Dili',              'country' => 'TL', 'lat' =>  -8.5586, 'lng' => 125.5742, 'coastal' => true],
            ['name' => 'Ankara',            'country' => 'TR', 'lat' =>  39.9334, 'lng' =>  32.8597],
            ['name' => 'Ashgabat',          'country' => 'TM', 'lat' =>  37.9601, 'lng' =>  58.3261],
            ['name' => 'Abu Dhabi',         'country' => 'AE', 'lat' =>  24.4539, 'lng' =>  54.3773, 'coastal' => true],
            ['name' => 'Tashkent',          'country' => 'UZ', 'lat' =>  41.2995, 'lng' =>  69.2401],
            ['name' => 'Hanoi',             'country' => 'VN', 'lat' =>  21.0285, 'lng' => 105.8542],
            ['name' => 'Sanaa',             'country' => 'YE', 'lat' =>  15.3694, 'lng' =>  44.1910],

            // ==== EUROPE (47 — same as old EuropeanCapitals) ====
            ['name' => 'Andorra la Vella',  'country' => 'AD', 'lat' =>  42.5063, 'lng' =>   1.5218],
            ['name' => 'Tirana',            'country' => 'AL', 'lat' =>  41.3275, 'lng' =>  19.8189],
            ['name' => 'Yerevan',           'country' => 'AM', 'lat' =>  40.1872, 'lng' =>  44.5152],
            ['name' => 'Vienna',            'country' => 'AT', 'lat' =>  48.2082, 'lng' =>  16.3738],
            ['name' => 'Baku',              'country' => 'AZ', 'lat' =>  40.4093, 'lng' =>  49.8671, 'coastal' => true],
            ['name' => 'Sarajevo',          'country' => 'BA', 'lat' =>  43.8563, 'lng' =>  18.4131],
            ['name' => 'Brussels',          'country' => 'BE', 'lat' =>  50.8503, 'lng' =>   4.3517],
            ['name' => 'Sofia',             'country' => 'BG', 'lat' =>  42.6977, 'lng' =>  23.3219],
            ['name' => 'Minsk',             'country' => 'BY', 'lat' =>  53.9006, 'lng' =>  27.5590],
            ['name' => 'Bern',              'country' => 'CH', 'lat' =>  46.9480, 'lng' =>   7.4474],
            ['name' => 'Nicosia',           'country' => 'CY', 'lat' =>  35.1856, 'lng' =>  33.3823],
            ['name' => 'Prague',            'country' => 'CZ', 'lat' =>  50.0755, 'lng' =>  14.4378],
            ['name' => 'Berlin',            'country' => 'DE', 'lat' =>  52.5200, 'lng' =>  13.4050],
            ['name' => 'Copenhagen',        'country' => 'DK', 'lat' =>  55.6761, 'lng' =>  12.5683, 'coastal' => true],
            ['name' => 'Tallinn',           'country' => 'EE', 'lat' =>  59.4370, 'lng' =>  24.7536, 'coastal' => true],
            ['name' => 'Madrid',            'country' => 'ES', 'lat' =>  40.4168, 'lng' =>  -3.7038],
            ['name' => 'Helsinki',          'country' => 'FI', 'lat' =>  60.1699, 'lng' =>  24.9384, 'coastal' => true],
            ['name' => 'Paris',             'country' => 'FR', 'lat' =>  48.8566, 'lng' =>   2.3522],
            ['name' => 'Tbilisi',           'country' => 'GE', 'lat' =>  41.7151, 'lng' =>  44.8271],
            ['name' => 'London',            'country' => 'GB', 'lat' =>  51.5074, 'lng' =>  -0.1278],
            ['name' => 'Athens',            'country' => 'GR', 'lat' =>  37.9838, 'lng' =>  23.7275, 'coastal' => true],
            ['name' => 'Zagreb',            'country' => 'HR', 'lat' =>  45.8150, 'lng' =>  15.9819],
            ['name' => 'Budapest',          'country' => 'HU', 'lat' =>  47.4979, 'lng' =>  19.0402],
            ['name' => 'Dublin',            'country' => 'IE', 'lat' =>  53.3498, 'lng' =>  -6.2603, 'coastal' => true],
            ['name' => 'Reykjavik',         'country' => 'IS', 'lat' =>  64.1466, 'lng' => -21.9426, 'coastal' => true],
            ['name' => 'Rome',              'country' => 'IT', 'lat' =>  41.9028, 'lng' =>  12.4964],
            ['name' => 'Pristina',          'country' => 'XK', 'lat' =>  42.6629, 'lng' =>  21.1655],
            ['name' => 'Vaduz',             'country' => 'LI', 'lat' =>  47.1410, 'lng' =>   9.5209],
            ['name' => 'Vilnius',           'country' => 'LT', 'lat' =>  54.6872, 'lng' =>  25.2797],
            ['name' => 'Luxembourg',        'country' => 'LU', 'lat' =>  49.6116, 'lng' =>   6.1319],
            ['name' => 'Riga',              'country' => 'LV', 'lat' =>  56.9496, 'lng' =>  24.1052, 'coastal' => true],
            ['name' => 'Monaco',            'country' => 'MC', 'lat' =>  43.7384, 'lng' =>   7.4246, 'coastal' => true],
            ['name' => 'Chisinau',          'country' => 'MD', 'lat' =>  47.0105, 'lng' =>  28.8638],
            ['name' => 'Podgorica',         'country' => 'ME', 'lat' =>  42.4304, 'lng' =>  19.2594],
            ['name' => 'Skopje',            'country' => 'MK', 'lat' =>  41.9981, 'lng' =>  21.4254],
            ['name' => 'Valletta',          'country' => 'MT', 'lat' =>  35.8989, 'lng' =>  14.5146, 'coastal' => true],
            ['name' => 'Amsterdam',         'country' => 'NL', 'lat' =>  52.3676, 'lng' =>   4.9041, 'coastal' => true],
            ['name' => 'Oslo',              'country' => 'NO', 'lat' =>  59.9139, 'lng' =>  10.7522, 'coastal' => true],
            ['name' => 'Warsaw',            'country' => 'PL', 'lat' =>  52.2297, 'lng' =>  21.0122],
            ['name' => 'Lisbon',            'country' => 'PT', 'lat' =>  38.7223, 'lng' =>  -9.1393, 'coastal' => true],
            ['name' => 'Bucharest',         'country' => 'RO', 'lat' =>  44.4268, 'lng' =>  26.1025],
            ['name' => 'Belgrade',          'country' => 'RS', 'lat' =>  44.7866, 'lng' =>  20.4489],
            ['name' => 'Moscow',            'country' => 'RU', 'lat' =>  55.7558, 'lng' =>  37.6173],
            ['name' => 'Stockholm',         'country' => 'SE', 'lat' =>  59.3293, 'lng' =>  18.0686, 'coastal' => true],
            ['name' => 'Ljubljana',         'country' => 'SI', 'lat' =>  46.0569, 'lng' =>  14.5058],
            ['name' => 'Bratislava',        'country' => 'SK', 'lat' =>  48.1486, 'lng' =>  17.1077],
            ['name' => 'San Marino',        'country' => 'SM', 'lat' =>  43.9333, 'lng' =>  12.4500],
            ['name' => 'Kyiv',              'country' => 'UA', 'lat' =>  50.4501, 'lng' =>  30.5234],
            ['name' => 'Vatican City',      'country' => 'VA', 'lat' =>  41.9029, 'lng' =>  12.4534],

            // ==== OCEANIA (14 capitals) ====
            ['name' => 'Canberra',          'country' => 'AU', 'lat' => -35.2809, 'lng' => 149.1300],
            ['name' => 'Suva',              'country' => 'FJ', 'lat' => -18.1416, 'lng' => 178.4419, 'coastal' => true],
            ['name' => 'Tarawa',            'country' => 'KI', 'lat' =>   1.4518, 'lng' => 172.9717, 'coastal' => true],
            ['name' => 'Majuro',            'country' => 'MH', 'lat' =>   7.1164, 'lng' => 171.1858, 'coastal' => true],
            ['name' => 'Palikir',           'country' => 'FM', 'lat' =>   6.9248, 'lng' => 158.1611, 'coastal' => true],
            ['name' => 'Yaren',             'country' => 'NR', 'lat' =>  -0.5477, 'lng' => 166.9209, 'coastal' => true],
            ['name' => 'Wellington',        'country' => 'NZ', 'lat' => -41.2865, 'lng' => 174.7762, 'coastal' => true],
            ['name' => 'Ngerulmud',         'country' => 'PW', 'lat' =>   7.5006, 'lng' => 134.6242, 'coastal' => true],
            ['name' => 'Port Moresby',      'country' => 'PG', 'lat' =>  -9.4438, 'lng' => 147.1803, 'coastal' => true],
            ['name' => 'Apia',              'country' => 'WS', 'lat' => -13.8506, 'lng' => -171.7513,'coastal' => true],
            ['name' => 'Honiara',           'country' => 'SB', 'lat' =>  -9.4380, 'lng' => 159.9498, 'coastal' => true],
            ['name' => "Nuku'alofa",        'country' => 'TO', 'lat' => -21.1789, 'lng' => -175.1982,'coastal' => true],
            ['name' => 'Funafuti',          'country' => 'TV', 'lat' =>  -8.5211, 'lng' => 179.1962, 'coastal' => true],
            ['name' => 'Port Vila',         'country' => 'VU', 'lat' => -17.7333, 'lng' => 168.3273, 'coastal' => true],

            // ==== MEGACITIES (top non-capital metros — recognition + geographic equity) ====
            ['name' => 'New York City',     'country' => 'US', 'lat' =>  40.7128, 'lng' => -74.0060, 'coastal' => true],
            ['name' => 'Los Angeles',       'country' => 'US', 'lat' =>  34.0522, 'lng' => -118.2437,'coastal' => true],
            ['name' => 'Chicago',           'country' => 'US', 'lat' =>  41.8781, 'lng' => -87.6298],
            ['name' => 'Houston',           'country' => 'US', 'lat' =>  29.7604, 'lng' => -95.3698],
            ['name' => 'Phoenix',           'country' => 'US', 'lat' =>  33.4484, 'lng' => -112.0740],
            ['name' => 'Miami',             'country' => 'US', 'lat' =>  25.7617, 'lng' => -80.1918, 'coastal' => true],
            ['name' => 'San Francisco',     'country' => 'US', 'lat' =>  37.7749, 'lng' => -122.4194,'coastal' => true],
            ['name' => 'Seattle',           'country' => 'US', 'lat' =>  47.6062, 'lng' => -122.3321,'coastal' => true],
            ['name' => 'Toronto',           'country' => 'CA', 'lat' =>  43.6532, 'lng' => -79.3832],
            ['name' => 'Vancouver',         'country' => 'CA', 'lat' =>  49.2827, 'lng' => -123.1207,'coastal' => true],
            ['name' => 'Montreal',          'country' => 'CA', 'lat' =>  45.5019, 'lng' => -73.5674],
            ['name' => 'São Paulo',         'country' => 'BR', 'lat' => -23.5505, 'lng' => -46.6333],
            ['name' => 'Rio de Janeiro',    'country' => 'BR', 'lat' => -22.9068, 'lng' => -43.1729, 'coastal' => true],
            ['name' => 'Mumbai',            'country' => 'IN', 'lat' =>  19.0760, 'lng' =>  72.8777, 'coastal' => true],
            ['name' => 'Kolkata',           'country' => 'IN', 'lat' =>  22.5726, 'lng' =>  88.3639],
            ['name' => 'Bengaluru',         'country' => 'IN', 'lat' =>  12.9716, 'lng' =>  77.5946],
            ['name' => 'Chennai',           'country' => 'IN', 'lat' =>  13.0827, 'lng' =>  80.2707, 'coastal' => true],
            ['name' => 'Hyderabad',         'country' => 'IN', 'lat' =>  17.3850, 'lng' =>  78.4867],
            ['name' => 'Shanghai',          'country' => 'CN', 'lat' =>  31.2304, 'lng' => 121.4737, 'coastal' => true],
            ['name' => 'Shenzhen',          'country' => 'CN', 'lat' =>  22.5431, 'lng' => 114.0579, 'coastal' => true],
            ['name' => 'Guangzhou',         'country' => 'CN', 'lat' =>  23.1291, 'lng' => 113.2644],
            ['name' => 'Chongqing',         'country' => 'CN', 'lat' =>  29.5630, 'lng' => 106.5516],
            ['name' => 'Hong Kong',         'country' => 'CN', 'lat' =>  22.3193, 'lng' => 114.1694, 'coastal' => true],
            ['name' => 'Osaka',             'country' => 'JP', 'lat' =>  34.6937, 'lng' => 135.5023, 'coastal' => true],
            ['name' => 'Karachi',           'country' => 'PK', 'lat' =>  24.8607, 'lng' =>  67.0011, 'coastal' => true],
            ['name' => 'Lahore',            'country' => 'PK', 'lat' =>  31.5204, 'lng' =>  74.3587],
            ['name' => 'Istanbul',          'country' => 'TR', 'lat' =>  41.0082, 'lng' =>  28.9784, 'coastal' => true],
            ['name' => 'Lagos',             'country' => 'NG', 'lat' =>   6.5244, 'lng' =>   3.3792, 'coastal' => true],
            ['name' => 'Alexandria',        'country' => 'EG', 'lat' =>  31.2001, 'lng' =>  29.9187, 'coastal' => true],
            ['name' => 'Casablanca',        'country' => 'MA', 'lat' =>  33.5731, 'lng' =>  -7.5898, 'coastal' => true],
            ['name' => 'Cape Town',         'country' => 'ZA', 'lat' => -33.9249, 'lng' =>  18.4241, 'coastal' => true],
            ['name' => 'Johannesburg',      'country' => 'ZA', 'lat' => -26.2041, 'lng' =>  28.0473],
            ['name' => 'Sydney',            'country' => 'AU', 'lat' => -33.8688, 'lng' => 151.2093, 'coastal' => true],
            ['name' => 'Melbourne',         'country' => 'AU', 'lat' => -37.8136, 'lng' => 144.9631, 'coastal' => true],
            ['name' => 'Perth',             'country' => 'AU', 'lat' => -31.9505, 'lng' => 115.8605, 'coastal' => true],
            ['name' => 'Auckland',          'country' => 'NZ', 'lat' => -36.8485, 'lng' => 174.7633, 'coastal' => true],
            ['name' => 'Saint Petersburg',  'country' => 'RU', 'lat' =>  59.9311, 'lng' =>  30.3609, 'coastal' => true],
            ['name' => 'Novosibirsk',       'country' => 'RU', 'lat' =>  55.0084, 'lng' =>  82.9357],
            ['name' => 'Yakutsk',           'country' => 'RU', 'lat' =>  62.0355, 'lng' => 129.6755],
            ['name' => 'Barcelona',         'country' => 'ES', 'lat' =>  41.3851, 'lng' =>   2.1734, 'coastal' => true],
            ['name' => 'Munich',            'country' => 'DE', 'lat' =>  48.1351, 'lng' =>  11.5820],
            ['name' => 'Milan',             'country' => 'IT', 'lat' =>  45.4642, 'lng' =>   9.1900],
            ['name' => 'Tel Aviv',          'country' => 'IL', 'lat' =>  32.0853, 'lng' =>  34.7818, 'coastal' => true],
            ['name' => 'Dubai',             'country' => 'AE', 'lat' =>  25.2048, 'lng' =>  55.2708, 'coastal' => true],
            ['name' => 'Ho Chi Minh City',  'country' => 'VN', 'lat' =>  10.8231, 'lng' => 106.6297],
            ['name' => 'Bogor',             'country' => 'ID', 'lat' =>  -6.5950, 'lng' => 106.8164],
            ['name' => 'Surabaya',          'country' => 'ID', 'lat' =>  -7.2575, 'lng' => 112.7521, 'coastal' => true],
            ['name' => 'Medellín',          'country' => 'CO', 'lat' =>   6.2476, 'lng' => -75.5658],
            ['name' => 'Guayaquil',         'country' => 'EC', 'lat' =>  -2.1709, 'lng' => -79.9224, 'coastal' => true],
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

    /**
     * Subset to coastal candidates only — for questions where the data
     * source is meaningless inland (wind gust over open water, storm
     * landfall, etc.). Coastal flag is hand-curated above; "coastal"
     * here means within ~50km of an ocean or major sea, NOT lake.
     *
     * @return list<array{name: string, country: string, lat: float, lng: float, coastal?: bool}>
     */
    public static function coastal(): array
    {
        return array_values(array_filter(
            self::all(),
            static fn (array $c): bool => ($c['coastal'] ?? false) === true,
        ));
    }
}
