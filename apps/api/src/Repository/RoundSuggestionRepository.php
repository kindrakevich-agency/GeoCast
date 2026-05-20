<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\RoundSuggestion;
use App\Enum\SuggestionStatus;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<RoundSuggestion>
 */
final class RoundSuggestionRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, RoundSuggestion::class);
    }

    /**
     * Pending suggestions newest-first — what the admin UI lists.
     *
     * @return RoundSuggestion[]
     */
    public function findPending(int $limit = 50): array
    {
        return $this->createQueryBuilder('s')
            ->where('s.status = :status')
            ->setParameter('status', SuggestionStatus::Pending)
            ->orderBy('s.createdAt', 'DESC')
            ->setMaxResults($limit)
            ->getQuery()
            ->getResult();
    }

    public function countPending(): int
    {
        return (int) $this->createQueryBuilder('s')
            ->select('COUNT(s.id)')
            ->where('s.status = :status')
            ->setParameter('status', SuggestionStatus::Pending)
            ->getQuery()
            ->getSingleScalarResult();
    }

    /**
     * Pending suggestions whose proposed_opens_at has passed — they're
     * stale and admin missed them.
     *
     * @return RoundSuggestion[]
     */
    public function findStale(\DateTimeImmutable $now): array
    {
        return $this->createQueryBuilder('s')
            ->where('s.status = :status')
            ->andWhere('s.proposedOpensAt < :now')
            ->setParameter('status', SuggestionStatus::Pending)
            ->setParameter('now', $now)
            ->getQuery()
            ->getResult();
    }
}
