<?php

declare(strict_types=1);

namespace App\Controller;

use Doctrine\DBAL\Connection;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;

/**
 * Public site stats — drives the landing page's live numbers
 * (pins this week, active rounds, total explorers, last winner).
 *
 * All queries are direct DBAL — no entity hydration — and each is a
 * single index lookup or COUNT(*). No caching for now; if the landing
 * gets hammered we can wrap this in a 30s Redis cache later.
 *
 * Routed under the api_public firewall so it works without a JWT.
 */
final class StatsController
{
    public function __construct(private readonly Connection $db)
    {
    }

    #[Route('/stats', name: 'api_stats', methods: ['GET'])]
    public function __invoke(): JsonResponse
    {
        $pinsThisWeek = (int) $this->db->fetchOne(
            'SELECT COUNT(*) FROM predictions WHERE placed_at >= NOW() - INTERVAL 7 DAY'
        );

        $activeRounds = (int) $this->db->fetchOne(
            "SELECT COUNT(*) FROM rounds WHERE status = 'open'"
        );

        $totalExplorers = (int) $this->db->fetchOne(
            'SELECT COUNT(DISTINCT user_id) FROM predictions'
        );

        // Most recent winner = rank #1 from the most-recently-resolved round.
        $winner = $this->db->fetchAssociative(
            "SELECT u.wallet_address AS wallet, p.distance_km AS distance_km, p.payout AS payout
             FROM predictions p
             INNER JOIN rounds r ON r.id = p.round_id
             INNER JOIN users  u ON u.id = p.user_id
             WHERE r.status = 'resolved' AND p.`rank` = 1
             ORDER BY r.resolved_at DESC
             LIMIT 1"
        );

        $lastWinner = $winner === false ? null : [
            'wallet' => $this->shorten((string) $winner['wallet']),
            'kmOff' => round((float) $winner['distance_km'], 1),
            'payout' => (int) $winner['payout'],
        ];

        return new JsonResponse([
            'pinsThisWeek' => $pinsThisWeek,
            'activeRounds' => $activeRounds,
            'totalExplorers' => $totalExplorers,
            'lastWinner' => $lastWinner,
        ]);
    }

    private function shorten(string $wallet): string
    {
        return strlen($wallet) > 10 ? substr($wallet, 0, 6) . '…' . substr($wallet, -4) : $wallet;
    }
}
