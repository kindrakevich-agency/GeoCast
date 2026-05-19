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
}
