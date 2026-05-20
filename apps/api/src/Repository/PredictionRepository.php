<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\Prediction;
use App\Entity\Round;
use App\Entity\User;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<Prediction>
 */
final class PredictionRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, Prediction::class);
    }

    public function findOneForUserInRound(User $user, Round $round): ?Prediction
    {
        return $this->findOneBy(['user' => $user, 'round' => $round]);
    }

    /**
     * @return Prediction[] sorted by distance ascending (best first)
     */
    public function findRankedForRound(Round $round): array
    {
        return $this->createQueryBuilder('p')
            ->where('p.round = :round')
            ->setParameter('round', $round)
            ->orderBy('p.distanceKm', 'ASC')
            ->addOrderBy('p.placedAt', 'ASC')
            ->getQuery()
            ->getResult();
    }

    /**
     * Paginated history with the round joined — newest first. Used by
     * GET /api/me/predictions to power the profile timeline.
     *
     * Filters via IDENTITY(p.user) rather than `p.user = :user` to avoid a
     * Doctrine quirk where binding a User entity to a DQL parameter doesn't
     * always unwrap to the foreign key cleanly with ULID types — the
     * findOneBy() form Just Works, but the QueryBuilder form silently
     * matches zero rows. Binding the ULID directly bypasses the issue.
     *
     * @return array{items: Prediction[], total: int}
     */
    public function findPagedForUser(User $user, int $page, int $perPage): array
    {
        $page = max(1, $page);
        $perPage = max(1, min(100, $perPage));
        $userId = $user->getId();

        $items = $this->createQueryBuilder('p')
            ->select('p', 'r')
            ->innerJoin('p.round', 'r')
            ->where('IDENTITY(p.user) = :userId')
            ->setParameter('userId', $userId, 'ulid')
            ->orderBy('p.placedAt', 'DESC')
            ->setFirstResult(($page - 1) * $perPage)
            ->setMaxResults($perPage)
            ->getQuery()
            ->getResult();

        $total = (int) $this->createQueryBuilder('p')
            ->select('COUNT(p.id)')
            ->where('IDENTITY(p.user) = :userId')
            ->setParameter('userId', $userId, 'ulid')
            ->getQuery()
            ->getSingleScalarResult();

        return ['items' => $items, 'total' => $total];
    }

    /**
     * Career heatmap data — every pin the user has ever dropped, regardless
     * of round status. distanceKm is null for predictions on rounds that
     * haven't been resolved yet; the frontend renders those as plain points
     * without contributing to the "best" highlight.
     *
     * Same IDENTITY()-based binding as findPagedForUser — see the note there.
     *
     * @return list<array{lng: float, lat: float, roundNumber: int, distanceKm: float|null}>
     */
    public function findResolvedPinsForUser(User $user): array
    {
        $rows = $this->createQueryBuilder('p')
            ->select('p.lng AS lng', 'p.lat AS lat', 'r.number AS roundNumber', 'p.distanceKm AS distanceKm')
            ->innerJoin('p.round', 'r')
            ->where('IDENTITY(p.user) = :userId')
            ->setParameter('userId', $user->getId(), 'ulid')
            ->orderBy('p.placedAt', 'DESC')
            ->getQuery()
            ->getArrayResult();

        return array_map(static fn(array $r) => [
            'lng' => (float) $r['lng'],
            'lat' => (float) $r['lat'],
            'roundNumber' => (int) $r['roundNumber'],
            'distanceKm' => $r['distanceKm'] !== null ? (float) $r['distanceKm'] : null,
        ], $rows);
    }
}
