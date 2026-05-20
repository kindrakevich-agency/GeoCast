<?php

declare(strict_types=1);

namespace App\Service\Round;

use App\Entity\Round;
use App\Enum\RoundStatus;
use App\Repository\RoundRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;

/**
 * Round lifecycle operations driven by admin endpoints.
 *
 * Each round number is the result of `MAX(number) + 1` issued inside the
 * create transaction — cheap and correct for the volume we'll ever see
 * (one round per day max).
 */
final class RoundService
{
    public function __construct(
        private readonly EntityManagerInterface $em,
        private readonly RoundRepository $rounds,
    ) {
    }

    public function create(
        string $question,
        \DateTimeImmutable $opensAt,
        \DateTimeImmutable $closesAt,
        ?string $description = null,
    ): Round {
        return $this->createInternal($question, $opensAt, $closesAt, null, $description, null, null);
    }

    /**
     * Same as create(), but wires an auto-resolver into the new round.
     * Used when an admin accepts a RoundSuggestion.
     *
     * @param array<string, mixed> $autoResolverParams
     */
    public function createWithAutoResolver(
        string $question,
        \DateTimeImmutable $opensAt,
        \DateTimeImmutable $closesAt,
        \DateTimeImmutable $resolvesAt,
        string $autoResolverCode,
        array $autoResolverParams,
        ?string $description = null,
    ): Round {
        return $this->createInternal(
            $question,
            $opensAt,
            $closesAt,
            $resolvesAt,
            $description,
            $autoResolverCode,
            $autoResolverParams,
        );
    }

    /**
     * @param array<string, mixed>|null $autoResolverParams
     */
    private function createInternal(
        string $question,
        \DateTimeImmutable $opensAt,
        \DateTimeImmutable $closesAt,
        ?\DateTimeImmutable $resolvesAt,
        ?string $description,
        ?string $autoResolverCode,
        ?array $autoResolverParams,
    ): Round {
        return $this->em->wrapInTransaction(function () use (
            $question, $opensAt, $closesAt, $resolvesAt, $description, $autoResolverCode, $autoResolverParams
        ): Round {
            // DQL is stricter than SQL — `MAX(x) + 1` doesn't parse. Pull MAX, add in PHP.
            $max = $this->rounds->createQueryBuilder('r')
                ->select('MAX(r.number)')
                ->getQuery()
                ->getSingleScalarResult();
            $next = ((int) $max) + 1;

            $round = new Round($next, $question, $opensAt, $closesAt);
            if ($description !== null) {
                $round->setDescription($description);
            }
            if ($resolvesAt !== null) {
                $round->setResolvesAt($resolvesAt);
            }
            if ($autoResolverCode !== null) {
                $round->setAutoResolverCode($autoResolverCode);
                $round->setAutoResolverParams($autoResolverParams);
            }
            $this->em->persist($round);
            $this->em->flush();

            return $round;
        });
    }

    public function open(Round $round): Round
    {
        if ($round->getStatus() !== RoundStatus::Scheduled) {
            throw new ConflictHttpException(
                sprintf('Round #%d is %s, can only open a scheduled round.', $round->getNumber(), $round->getStatus()->value),
            );
        }
        $round->setStatus(RoundStatus::Open);
        $this->em->flush();

        return $round;
    }
}
