<?php

declare(strict_types=1);

namespace App\Service\Round;

use App\Entity\Round;
use App\Enum\RoundStatus;
use App\Repository\PredictionRepository;
use App\Service\Broadcast\PusherBroadcaster;
use App\Service\Leaderboard\LeaderboardZSetWriter;
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
 * Side effects in the same DB transaction:
 *   - Round status → resolved, answer + resolvedAt set
 *   - Each Prediction gets distance_km, rank, payout
 *   - Each owning User gets credits += payout, total_score += raw_score,
 *     games_played += 1
 *
 * Side effects outside the DB transaction (best-effort):
 *   - Redis ZSETs leaderboard:today/week/all incremented per user
 *   - (Pusher broadcast in follow-up commit)
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
     * @return array<int, array{predictionId: string, userId: string, distanceKm: float, rawScore: float, rank: int, payout: int}>
     */
    public function resolve(Round $round, float $answerLat, float $answerLng): array
    {
        if ($round->getStatus() === RoundStatus::Resolved) {
            throw new ConflictHttpException(sprintf('Round #%d is already resolved.', $round->getNumber()));
        }
        if ($answerLat < -90 || $answerLat > 90 || $answerLng < -180 || $answerLng > 180) {
            throw new ConflictHttpException('Answer coordinates out of range.');
        }

        $resolveAt = new \DateTimeImmutable();

        $rows = $this->em->wrapInTransaction(function () use ($round, $answerLat, $answerLng, $resolveAt): array {
            // Pull predictions + computed distances in one query so we don't
            // round-trip per row. Returns Prediction entities with a `distance`
            // alias (km) populated via a custom column.
            $conn = $this->em->getConnection();
            $idBin = $round->getId()->toBinary();
            // HEX()/UNHEX() is portable across MySQL 8 + MariaDB 10.11.
            // MariaDB doesn't ship BIN_TO_UUID — that's MySQL 8-only.
            $stmt = $conn->prepare(<<<'SQL'
                SELECT
                    HEX(p.id) AS prediction_id_hex,
                    HEX(p.user_id) AS user_id_hex,
                    ST_Distance_Sphere(POINT(p.lng, p.lat), POINT(:lng, :lat)) / 1000.0 AS distance_km
                FROM predictions p
                WHERE p.round_id = :round_id
                ORDER BY distance_km ASC, p.placed_at ASC
            SQL);
            $stmt->bindValue('lat', $answerLat);
            $stmt->bindValue('lng', $answerLng);
            $stmt->bindValue('round_id', $idBin);
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
                    'UPDATE users SET credits_balance = credits_balance + :p, total_score = total_score + :s, games_played = games_played + 1 WHERE id = UNHEX(:id_hex)',
                    ['p' => $payout, 's' => $row['raw_score'], 'id_hex' => $row['user_id_hex']],
                );

                // Convert binary id (hex form) → Symfony ULID base32 for JSON.
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

            // Flip the round itself
            $round->setAnswer($answerLat, $answerLng);
            $round->setStatus(RoundStatus::Resolved);
            $round->setResolvedAt($resolveAt);
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
        $this->broadcaster->broadcastRoundResolved(
            (string) $round->getId(),
            $answerLat,
            $answerLng,
            $rows,
        );
        $this->broadcaster->broadcastLeaderboardUpdated();

        return $rows;
    }
}
