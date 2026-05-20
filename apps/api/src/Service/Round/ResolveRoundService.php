<?php

declare(strict_types=1);

namespace App\Service\Round;

use App\Entity\Round;
use App\Enum\RoundStatus;
use App\Repository\PredictionRepository;
use App\Service\Broadcast\PusherBroadcaster;
use App\Service\Leaderboard\LeaderboardZSetWriter;
use App\Service\Questions\AnswerPoint;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;

/**
 * Resolves a round and distributes payouts in a single transaction.
 *
 * Per CLAUDE.md scoring section:
 *
 *   raw_score_i = 1 / (1 + d_i)
 *   payout_i    = floor(pool_credits * raw_i / sum(raw_j))
 *
 * Distances come from MariaDB's ST_Distance_Sphere (great-circle, in meters)
 * fed POINT(lng, lat) constructed from the prediction columns and the
 * passed-in answer. We divide by 1000 to get kilometers.
 *
 * Multi-winner support: when the auto-resolver hits a true tie (two cities
 * with identical max temperature), distance_km is `LEAST(d_to_a, d_to_b, …)`
 * — the closest of the tied winners. answer_lat/answer_lng track the first
 * point for legacy callers; answer_points JSON has the full list.
 *
 * Side effects in the same DB transaction:
 *   - Round status → resolved, answer + resolvedAt set
 *   - Each Prediction gets distance_km, rank, payout
 *   - Each owning User gets credits += payout, total_score += raw_score
 *     (games_played is bumped at PLACEMENT, not here — see PlacePredictionService)
 *
 * Side effects outside the DB transaction (best-effort):
 *   - Redis ZSETs leaderboard:today/week/all incremented per user
 *   - Pusher broadcast on round-{id} channel
 */
final class ResolveRoundService
{
    public function __construct(
        private readonly EntityManagerInterface $em,
        private readonly PredictionRepository $predictions,
        private readonly LeaderboardZSetWriter $zsets,
        private readonly PusherBroadcaster $broadcaster,
    ) {
    }

    /**
     * Single-answer entry point — kept for the legacy admin-resolve flow.
     *
     * @return array<int, array{predictionId: string, userId: string, distanceKm: float, rawScore: float, rank: int, payout: int}>
     */
    public function resolve(Round $round, float $answerLat, float $answerLng): array
    {
        return $this->resolveMulti($round, [new AnswerPoint($answerLat, $answerLng)]);
    }

    /**
     * Multi-answer entry point. Pass one AnswerPoint for the classic flow,
     * or two+ when the auto-resolver hit a true tie.
     *
     * @param list<AnswerPoint> $points
     * @return array<int, array{predictionId: string, userId: string, distanceKm: float, rawScore: float, rank: int, payout: int}>
     */
    public function resolveMulti(Round $round, array $points): array
    {
        if ($round->getStatus() === RoundStatus::Resolved) {
            throw new ConflictHttpException(sprintf('Round #%d is already resolved.', $round->getNumber()));
        }
        if ($points === []) {
            throw new ConflictHttpException('At least one answer point is required.');
        }
        foreach ($points as $p) {
            if ($p->lat < -90 || $p->lat > 90 || $p->lng < -180 || $p->lng > 180) {
                throw new ConflictHttpException('Answer coordinates out of range.');
            }
        }

        $resolveAt = new \DateTimeImmutable();

        $rows = $this->em->wrapInTransaction(function () use ($round, $points, $resolveAt): array {
            $conn = $this->em->getConnection();
            $idBin = $round->getId()->toBinary();

            // Build a dynamic LEAST(d_to_p1, d_to_p2, …) expression. With
            // one point this is a single ST_Distance_Sphere — same plan as
            // before. With two+ points the engine evaluates each and takes
            // the min; tiny cost vs the great-circle math itself.
            $distExprs = [];
            $params = ['round_id' => $idBin];
            foreach ($points as $i => $p) {
                $distExprs[] = sprintf('ST_Distance_Sphere(POINT(p.lng, p.lat), POINT(:lng%d, :lat%d)) / 1000.0', $i, $i);
                $params['lat'.$i] = $p->lat;
                $params['lng'.$i] = $p->lng;
            }
            $distExpr = \count($distExprs) === 1
                ? $distExprs[0]
                : 'LEAST('.implode(', ', $distExprs).')';

            $sql = sprintf(<<<'SQL'
                SELECT
                    HEX(p.id) AS prediction_id_hex,
                    HEX(p.user_id) AS user_id_hex,
                    %s AS distance_km
                FROM predictions p
                WHERE p.round_id = :round_id
                ORDER BY distance_km ASC, p.placed_at ASC
            SQL, $distExpr);

            $stmt = $conn->prepare($sql);
            foreach ($params as $k => $v) {
                $stmt->bindValue($k, $v);
            }
            $raw = $stmt->executeQuery()->fetchAllAssociative();

            // Compute raw scores and the normalization sum first.
            $scored = [];
            $sumRaw = 0.0;
            foreach ($raw as $row) {
                $dKm = (float) $row['distance_km'];
                $rawScore = 1.0 / (1.0 + $dKm);
                $sumRaw += $rawScore;
                $scored[] = [
                    'prediction_id_hex' => $row['prediction_id_hex'],
                    'user_id_hex'       => $row['user_id_hex'],
                    'distance_km'       => $dKm,
                    'raw_score'         => $rawScore,
                ];
            }
            $pool = $round->getPoolCredits();

            // Persist per-prediction + per-user updates row by row. With the
            // volumes the spec anticipates (~300 players/round) this is in
            // the noise compared to setting up + tearing down a Doctrine
            // UnitOfWork for 300 entities.
            $rows = [];
            $rank = 1;
            foreach ($scored as $row) {
                $payout = $sumRaw > 0 ? (int) floor($pool * $row['raw_score'] / $sumRaw) : 0;

                $conn->executeStatement(
                    'UPDATE predictions SET distance_km = :d, `rank` = :r, payout = :p WHERE id = UNHEX(:id_hex)',
                    ['d' => $row['distance_km'], 'r' => $rank, 'p' => $payout, 'id_hex' => $row['prediction_id_hex']],
                );
                $conn->executeStatement(
                    'UPDATE users SET credits_balance = credits_balance + :p, total_score = total_score + :s WHERE id = UNHEX(:id_hex)',
                    ['p' => $payout, 's' => $row['raw_score'], 'id_hex' => $row['user_id_hex']],
                );

                $predictionUlid = \Symfony\Component\Uid\Ulid::fromBinary(hex2bin($row['prediction_id_hex']));
                $userUlid = \Symfony\Component\Uid\Ulid::fromBinary(hex2bin($row['user_id_hex']));

                $rows[] = [
                    'predictionId' => (string) $predictionUlid,
                    'userId'       => (string) $userUlid,
                    'distanceKm'   => $row['distance_km'],
                    'rawScore'     => $row['raw_score'],
                    'rank'         => $rank,
                    'payout'       => $payout,
                ];
                $rank++;
            }

            // Flip the round itself. First point is the canonical answer for
            // legacy single-point readers; answer_points carries the full
            // list. Single-winner rounds set answer_points to null so older
            // queries can still detect "no multi-winner data here".
            $first = $points[0];
            $round->setAnswer($first->lat, $first->lng);
            $round->setStatus(RoundStatus::Resolved);
            $round->setResolvedAt($resolveAt);
            if (\count($points) > 1) {
                $round->setAnswerPoints(array_map(static fn (AnswerPoint $p): array => $p->toArray(), $points));
            } else {
                $round->setAnswerPoints(null);
            }
            $this->em->flush();

            return $rows;
        });

        // Best-effort leaderboard update — outside the DB txn so a Redis
        // hiccup doesn't roll back the round resolution. If Redis is down,
        // the scoreboard will lag but the on-disk results stand.
        foreach ($rows as $r) {
            try {
                $this->zsets->increment($r['userId'], $r['rawScore'], $resolveAt);
            } catch (\Throwable) {
                // swallow — we'd log via monolog if it were wired
            }
        }

        // Real-time broadcast — same best-effort posture. PusherBroadcaster
        // is a no-op when creds aren't configured, so this is safe to call
        // unconditionally.
        $first = $points[0];
        $this->broadcaster->broadcastRoundResolved(
            (string) $round->getId(),
            $first->lat,
            $first->lng,
            $rows,
        );
        $this->broadcaster->broadcastLeaderboardUpdated();

        return $rows;
    }
}
