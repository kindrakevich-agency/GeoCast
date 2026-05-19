<?php

declare(strict_types=1);

namespace App\Controller;

use App\Entity\Prediction;
use App\Entity\User;
use App\Enum\RoundStatus;
use App\Repository\PredictionRepository;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;

final class MeController
{
    public function __construct(
        private readonly Security $security,
        private readonly PredictionRepository $predictions,
    ) {
    }

    #[Route('/me', name: 'api_me', methods: ['GET'])]
    public function profile(): JsonResponse
    {
        $user = $this->requireUser();
        if ($user instanceof JsonResponse) {
            return $user;
        }

        return new JsonResponse([
            'id' => (string) $user->getId(),
            'walletAddress' => $user->getWalletAddress(),
            'creditsBalance' => $user->getCreditsBalance(),
            'gamesPlayed' => $user->getGamesPlayed(),
            'totalScore' => $user->getTotalScore(),
            'isAdmin' => $user->isAdmin(),
            'createdAt' => $user->getCreatedAt()->format(\DateTimeInterface::ATOM),
        ]);
    }

    /**
     * GET /api/me/predictions?page=1&perPage=20
     *
     * Paginated history with the round joined — newest first. Each row carries
     * enough context to render a timeline card without N+1 round lookups.
     */
    #[Route('/me/predictions', name: 'api_me_predictions', methods: ['GET'])]
    public function history(Request $request): JsonResponse
    {
        $user = $this->requireUser();
        if ($user instanceof JsonResponse) {
            return $user;
        }

        $page = max(1, $request->query->getInt('page', 1));
        $perPage = max(1, min(100, $request->query->getInt('perPage', 20)));

        $result = $this->predictions->findPagedForUser($user, $page, $perPage);

        return new JsonResponse([
            'items' => array_map(static fn(Prediction $p) => self::serializePrediction($p), $result['items']),
            'total' => $result['total'],
            'page' => $page,
            'perPage' => $perPage,
        ]);
    }

    /**
     * GET /api/me/career-pins
     *
     * Flat list of every resolved pin this user has dropped — used by the
     * "career heatmap" overlay on the profile page. Only resolved predictions
     * are returned (in-flight pins would leak the current round's player
     * positions to themselves before resolution).
     */
    #[Route('/me/career-pins', name: 'api_me_career_pins', methods: ['GET'])]
    public function careerPins(): JsonResponse
    {
        $user = $this->requireUser();
        if ($user instanceof JsonResponse) {
            return $user;
        }

        return new JsonResponse($this->predictions->findResolvedPinsForUser($user));
    }

    private function requireUser(): User|JsonResponse
    {
        $user = $this->security->getUser();
        if (!$user instanceof User) {
            return new JsonResponse(['error' => 'Not authenticated'], 401);
        }
        return $user;
    }

    /**
     * @return array<string, mixed>
     */
    private static function serializePrediction(Prediction $p): array
    {
        $round = $p->getRound();
        $resolved = $round->getStatus() === RoundStatus::Resolved;

        return [
            'id' => (string) $p->getId(),
            'placedAt' => $p->getPlacedAt()->format(\DateTimeInterface::ATOM),
            'myPin' => ['lat' => $p->getLat(), 'lng' => $p->getLng()],
            'distanceKm' => $p->getDistanceKm(),
            'rank' => $p->getRank(),
            'payout' => $p->getPayout(),
            'creditsStaked' => $p->getCreditsStaked(),
            'round' => [
                'id' => (string) $round->getId(),
                'number' => $round->getNumber(),
                'question' => $round->getQuestion(),
                'status' => $round->getStatus()->value,
                'closesAt' => $round->getClosesAt()->format(\DateTimeInterface::ATOM),
                'resolvedAt' => $round->getResolvedAt()?->format(\DateTimeInterface::ATOM),
                'answer' => $resolved && $round->getAnswerLat() !== null && $round->getAnswerLng() !== null
                    ? ['lat' => $round->getAnswerLat(), 'lng' => $round->getAnswerLng()]
                    : null,
                'totalParticipants' => $round->getTotalParticipants(),
                'poolCredits' => $round->getPoolCredits(),
            ],
        ];
    }
}
