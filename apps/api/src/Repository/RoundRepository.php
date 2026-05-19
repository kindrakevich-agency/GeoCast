<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\Round;
use App\Enum\RoundStatus;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<Round>
 */
final class RoundRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, Round::class);
    }

    /**
     * The one currently-open round, or null if between rounds.
     */
    public function findOpen(): ?Round
    {
        return $this->createQueryBuilder('r')
            ->where('r.status = :status')
            ->setParameter('status', RoundStatus::Open)
            ->orderBy('r.closesAt', 'ASC')
            ->setMaxResults(1)
            ->getQuery()
            ->getOneOrNullResult();
    }
}
