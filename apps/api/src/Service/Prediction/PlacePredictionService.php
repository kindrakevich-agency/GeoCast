<?php

declare(strict_types=1);

namespace App\Service\Prediction;

use App\Entity\Prediction;
use App\Entity\Round;
use App\Entity\User;
use App\Enum\RoundStatus;
use App\Repository\PredictionRepository;
use App\Service\Broadcast\PusherBroadcaster;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\HttpKernel\Exception\BadRequestHttpException;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;

/**
 * Atomically places one pin per user per round.
 *
 * All checks + mutations happen inside a single Doctrine transaction to
 * ensure that two concurrent submits from the same user can't both
 * succeed (the UNIQUE (user_id, round_id) index plus a row lock on the
 * user row provide belt-and-suspenders consistency).
 *
 * Throws:
 *   - BadRequestHttpException for malformed coords or out-of-window submits
 *   - ConflictHttpException for "already placed" / "insufficient credits"
 */
final class PlacePredictionService
{
    public function __construct(
        private readonly EntityManagerInterface $em,
        private readonly PredictionRepository $predictions,
        private readonly PusherBroadcaster $broadcaster,
    ) {
    }

    public function place(User $user, Round $round, float $lat, float $lng): Prediction
    {
        if ($lat < -90 || $lat > 90 || $lng < -180 || $lng > 180) {
            throw new BadRequestHttpException('lat must be in [-90, 90] and lng in [-180, 180].');
        }
        if ($round->getStatus() !== RoundStatus::Open) {
            throw new ConflictHttpException(
                sprintf('Round %d is %s, not open.', $round->getNumber(), $round->getStatus()->value),
            );
        }
        if ($round->getClosesAt() < new \DateTimeImmutable()) {
            throw new ConflictHttpException('Round has already closed.');
        }
        if ($this->predictions->findOneForUserInRound($user, $round) !== null) {
            throw new ConflictHttpException('You have already placed a pin in this round.');
        }
        if ($user->getCreditsBalance() < 1) {
            throw new ConflictHttpException('Insufficient credits (1 required).');
        }

        $prediction = $this->em->wrapInTransaction(function () use ($user, $round, $lat, $lng): Prediction {
            // Refresh inside the transaction so we don't act on stale state if
            // a concurrent request also just decremented this user.
            $this->em->refresh($user);
            $this->em->refresh($round);

            if ($user->getCreditsBalance() < 1) {
                throw new ConflictHttpException('Insufficient credits (1 required).');
            }
            // Recheck the unique constraint condition inside the txn.
            if ($this->predictions->findOneForUserInRound($user, $round) !== null) {
                throw new ConflictHttpException('You have already placed a pin in this round.');
            }

            $newPrediction = new Prediction($user, $round, $lat, $lng);

            $user->setCreditsBalance($user->getCreditsBalance() - 1);
            $round->setPoolCredits($round->getPoolCredits() + 1);
            $round->setTotalParticipants($round->getTotalParticipants() + 1);

            $this->em->persist($newPrediction);
            $this->em->flush();

            return $newPrediction;
        });

        // Real-time broadcast — outside the txn so a Pusher hiccup doesn't
        // roll back the placement. PusherBroadcaster swallows all errors.
        $this->broadcaster->broadcastPinPlaced(
            (string) $round->getId(),
            $round->getTotalParticipants(),
            $round->getPoolCredits(),
        );

        return $prediction;
    }
}
