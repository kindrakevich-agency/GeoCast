<?php

declare(strict_types=1);

namespace App\Controller;

use App\Entity\Round;
use App\Repository\RoundRepository;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;

final class RoundsController
{
    public function __construct(private readonly RoundRepository $rounds)
    {
    }

    /**
     * GET /api/rounds/current
     *
     * Returns the currently-open round (status = "open" with the soonest
     * `closesAt`), or null if there isn't one. JSON shape mirrors the
     * frontend's `MockRound` so the frontend can swap demoRound → API
     * with no transform.
     */
    #[Route('/rounds/current', name: 'api_rounds_current', methods: ['GET'])]
    public function current(): JsonResponse
    {
        $round = $this->rounds->findOpen();
        if ($round === null) {
            // JsonResponse(null) emits "{}" — we want literal "null" so the
            // frontend can do `if (round === null)` instead of an object check.
            return JsonResponse::fromJsonString('null');
        }

        return new JsonResponse($this->serialize($round));
    }

    /** @return array<string, mixed> */
    private function serialize(Round $round): array
    {
        $answer = ($round->getAnswerLat() !== null && $round->getAnswerLng() !== null)
            ? ['lat' => $round->getAnswerLat(), 'lng' => $round->getAnswerLng()]
            : null;

        return [
            'id' => (string) $round->getId(),
            'number' => $round->getNumber(),
            'question' => $round->getQuestion(),
            'description' => $round->getDescription(),
            'opensAt' => $round->getOpensAt()->format(\DateTimeInterface::ATOM),
            'closesAt' => $round->getClosesAt()->format(\DateTimeInterface::ATOM),
            'poolCredits' => $round->getPoolCredits(),
            'totalParticipants' => $round->getTotalParticipants(),
            'status' => $round->getStatus()->value,
            'answer' => $answer,
        ];
    }
}
