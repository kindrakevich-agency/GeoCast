<?php

declare(strict_types=1);

namespace App\Controller;

use App\Entity\User;
use App\Service\Leaderboard\LeaderboardZSetWriter;
use Doctrine\ORM\EntityManagerInterface;
use Predis\Client as RedisClient;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpKernel\Exception\BadRequestHttpException;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Uid\Ulid;

/**
 * Reads top 100 from the Redis ZSET written by ResolveRoundService, then
 * batch-hydrates user rows for the public-facing fields.
 *
 * Public endpoint, but the firewall still parses a JWT when one is sent
 * so we can flag the caller's own row with `isMe: true`.
 */
final class LeaderboardController
{
    private const TOP_N = 100;
    /** @var list<string> */
    private const PERIODS = ['today', 'week', 'all'];

    public function __construct(
        private readonly RedisClient $redis,
        private readonly LeaderboardZSetWriter $zsets,
        private readonly EntityManagerInterface $em,
        private readonly Security $security,
    ) {
    }

    /**
     * GET /api/leaderboard?period=today|week|all
     */
    #[Route('/leaderboard', name: 'api_leaderboard', methods: ['GET'])]
    public function __invoke(Request $request): JsonResponse
    {
        $period = (string) $request->query->get('period', 'all');
        if (!\in_array($period, self::PERIODS, true)) {
            throw new BadRequestHttpException('period must be one of: '.implode(', ', self::PERIODS));
        }

        $key = $this->zsets->keyFor($period);

        // ZREVRANGE returns [userId => score] when WITHSCORES — Predis
        // gives this back as an associative array.
        /** @var array<string, string> $raw */
        $raw = $this->redis->zrevrange($key, 0, self::TOP_N - 1, ['WITHSCORES' => true]);

        if ($raw === []) {
            return new JsonResponse([
                'period' => $period,
                'rows' => [],
                'me' => $this->serializeMe(),
            ]);
        }

        $userIds = array_keys($raw);
        $byUlid = $this->fetchUsers($userIds);

        /** @var User|null $authed */
        $authed = $this->security->getUser() instanceof User ? $this->security->getUser() : null;
        $myUlid = $authed ? (string) $authed->getId() : null;

        $rows = [];
        $rank = 1;
        foreach ($raw as $userId => $score) {
            $user = $byUlid[$userId] ?? null;
            if ($user === null) {
                // ZSET has a user id that no longer exists in the DB.
                // Skip silently and let the rank counter continue.
                continue;
            }
            $rows[] = [
                'rank' => $rank,
                'userId' => $userId,
                'wallet' => $user['wallet_address'],
                'gamesPlayed' => (int) $user['games_played'],
                'totalCredits' => (int) $user['credits_balance'],
                'totalScore' => (float) $score,
                'isMe' => $userId === $myUlid,
            ];
            $rank++;
        }

        // If authed and the caller isn't in the top N, surface their own
        // rank + score separately so the frontend can sticky-pin a "you"
        // row at the bottom.
        $me = $this->serializeMe();
        if ($authed !== null && $myUlid !== null && !array_filter($rows, fn ($r) => $r['isMe'])) {
            $myRank = $this->redis->zrevrank($key, $myUlid);
            $myScore = $this->redis->zscore($key, $myUlid);
            if ($myRank !== null && $myScore !== null) {
                $me = [
                    ...($me ?? []),
                    'rank' => (int) $myRank + 1,
                    'totalScore' => (float) $myScore,
                ];
            }
        }

        return new JsonResponse([
            'period' => $period,
            'rows' => $rows,
            'me' => $me,
        ]);
    }

    /**
     * Batch-fetch user rows for a list of ULID strings.
     *
     * @param  list<string>                                       $userIds
     * @return array<string, array{wallet_address: string, credits_balance: int, games_played: int}>  keyed by ULID
     */
    private function fetchUsers(array $userIds): array
    {
        if ($userIds === []) {
            return [];
        }

        $hexes = [];
        foreach ($userIds as $id) {
            if (!Ulid::isValid($id)) {
                continue;
            }
            $hexes[] = bin2hex(Ulid::fromString($id)->toBinary());
        }
        if ($hexes === []) {
            return [];
        }

        $placeholders = implode(',', array_map(static fn ($i) => 'UNHEX(?)', $hexes));
        $sql = "SELECT HEX(id) AS id_hex, wallet_address, credits_balance, games_played
                FROM users WHERE id IN ($placeholders)";

        $stmt = $this->em->getConnection()->prepare($sql);
        foreach ($hexes as $i => $hex) {
            $stmt->bindValue($i + 1, $hex);
        }
        $rows = $stmt->executeQuery()->fetchAllAssociative();

        $out = [];
        foreach ($rows as $r) {
            $ulid = (string) Ulid::fromBinary(hex2bin($r['id_hex']));
            $out[$ulid] = [
                'wallet_address' => $r['wallet_address'],
                'credits_balance' => (int) $r['credits_balance'],
                'games_played' => (int) $r['games_played'],
            ];
        }

        return $out;
    }

    /** @return array<string, mixed>|null */
    private function serializeMe(): ?array
    {
        $user = $this->security->getUser();
        if (!$user instanceof User) {
            return null;
        }

        return [
            'userId' => (string) $user->getId(),
            'wallet' => $user->getWalletAddress(),
            'gamesPlayed' => $user->getGamesPlayed(),
            'totalCredits' => $user->getCreditsBalance(),
            'totalScore' => $user->getTotalScore(),
        ];
    }
}
