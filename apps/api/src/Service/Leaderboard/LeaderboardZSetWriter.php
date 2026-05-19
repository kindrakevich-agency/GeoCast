<?php

declare(strict_types=1);

namespace App\Service\Leaderboard;

use Predis\Client as RedisClient;

/**
 * Maintains the Redis ZSETs that back `GET /api/leaderboard?period=...`.
 *
 * Three keys, all under the `geocast:` prefix from services.yaml:
 *
 *   leaderboard:today:YYYY-MM-DD   — rolls over daily, TTL 48h
 *   leaderboard:week:YYYY-WW       — rolls over weekly (ISO week), TTL 9d
 *   leaderboard:all                — never expires
 *
 * Score is total raw_score (1/(1+distance_km)) accumulated across rounds.
 */
final class LeaderboardZSetWriter
{
    private const TTL_TODAY = 2 * 24 * 3600;
    private const TTL_WEEK = 9 * 24 * 3600;

    public function __construct(private readonly RedisClient $redis)
    {
    }

    /**
     * Increment the leaderboard score for a user across all three windows.
     * Called once per resolved prediction during round resolution.
     *
     * @param string $userId  ULID string (the User's id)
     * @param float  $rawScore  1 / (1 + distance_km) for this prediction
     */
    public function increment(string $userId, float $rawScore, ?\DateTimeImmutable $at = null): void
    {
        $at ??= new \DateTimeImmutable();

        $todayKey = 'leaderboard:today:'.$at->format('Y-m-d');
        $this->redis->zincrby($todayKey, $rawScore, $userId);
        $this->redis->expire($todayKey, self::TTL_TODAY);

        $weekKey = 'leaderboard:week:'.$at->format('o-W');
        $this->redis->zincrby($weekKey, $rawScore, $userId);
        $this->redis->expire($weekKey, self::TTL_WEEK);

        $this->redis->zincrby('leaderboard:all', $rawScore, $userId);
    }

    /**
     * Resolve the active ZSET key for the given period at "now".
     * Used by the (still-to-build) GET /api/leaderboard endpoint.
     */
    public function keyFor(string $period, ?\DateTimeImmutable $at = null): string
    {
        $at ??= new \DateTimeImmutable();

        return match ($period) {
            'today' => 'leaderboard:today:'.$at->format('Y-m-d'),
            'week'  => 'leaderboard:week:'.$at->format('o-W'),
            'all'   => 'leaderboard:all',
            default => throw new \InvalidArgumentException("Unknown period: $period"),
        };
    }
}
