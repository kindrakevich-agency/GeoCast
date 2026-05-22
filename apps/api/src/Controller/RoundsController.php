<?php

declare(strict_types=1);

namespace App\Controller;

use App\Entity\Round;
use App\Entity\User;
use App\Repository\PredictionRepository;
use App\Repository\RoundRepository;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Symfony\Component\Routing\Attribute\Route;

final class RoundsController
{
    public function __construct(
        private readonly RoundRepository $rounds,
        private readonly PredictionRepository $predictions,
        private readonly Security $security,
    ) {
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

    /**
     * GET /api/rounds/upcoming
     *
     * The soonest-opening scheduled round. Lets /play render a "next round
     * opens in Xh Ym" countdown when no round is currently open, instead
     * of redirecting players to home — important for the continuous-rounds
     * model where there's always something queued.
     */
    #[Route('/rounds/upcoming', name: 'api_rounds_upcoming', methods: ['GET'])]
    public function upcoming(): JsonResponse
    {
        $round = $this->rounds->findNextScheduled();
        if ($round === null) {
            return JsonResponse::fromJsonString('null');
        }
        return new JsonResponse($this->serialize($round));
    }

    /**
     * GET /api/rounds/{id}/pins
     *
     * Anonymized list of {lat, lng} for the round's heatmap. Visibility
     * follows the spec:
     *   - status=resolved or closed → all pins
     *   - status=open + caller authed + has placed a pin → all OTHER pins
     *   - status=open + not placed (or anonymous)              → empty
     *
     * The empty case keeps the map honest before commitment — you can't
     * "see what others picked" to bias your own pin.
     *
     * Sits on the api_public firewall (3-segment? no — wait, it's a
     * 3-segment URL, so it falls under the JWT firewall. access_control
     * gives it PUBLIC_ACCESS so anonymous calls work too, returning empty).
     */
    #[Route('/rounds/{id}/pins', name: 'api_rounds_pins', methods: ['GET'])]
    public function pins(string $id): JsonResponse
    {
        $round = $this->rounds->find($id);
        if ($round === null) {
            throw new NotFoundHttpException('Round not found.');
        }

        $status = $round->getStatus()->value;
        if ($status === 'closed' || $status === 'resolved') {
            return new JsonResponse($this->predictions->findAnonymizedPinsForRound($round));
        }

        // Open: only authed callers who have already placed get to see the
        // anonymized aggregate (minus their own pin).
        if ($status === 'open') {
            $user = $this->security->getUser();
            if (!$user instanceof User) {
                return new JsonResponse([]);
            }
            $own = $this->predictions->findOneForUserInRound($user, $round);
            if ($own === null) {
                return new JsonResponse([]);
            }
            $all = $this->predictions->findAnonymizedPinsForRound($round);
            $ownLat = $own->getLat();
            $ownLng = $own->getLng();
            $others = array_values(array_filter(
                $all,
                static fn(array $p) => $p['lat'] !== $ownLat || $p['lng'] !== $ownLng,
            ));
            return new JsonResponse($others);
        }

        return new JsonResponse([]);
    }

    /**
     * GET /api/rounds/{id}/my-prediction
     *
     * Returns the JWT'd user's prediction on this round, or null if they
     * haven't placed one yet. Lets the round page rehydrate the user's
     * pin across page reloads — the active-round screen's `myPin` state
     * is otherwise local-only and forgets the placement on refresh.
     *
     * Authed: yes (3-segment URL falls outside the `^/rounds/[^/]+$`
     * public-firewall pattern and lands on the JWT-protected `api`
     * firewall; access_control's catch-all `^/, ROLE_USER` enforces auth).
     */
    #[Route('/rounds/{id}/my-prediction', name: 'api_rounds_my_prediction', methods: ['GET'])]
    public function myPrediction(string $id): JsonResponse
    {
        $user = $this->security->getUser();
        if (!$user instanceof User) {
            return new JsonResponse(['error' => 'Not authenticated'], 401);
        }

        $round = $this->rounds->find($id);
        if ($round === null) {
            throw new NotFoundHttpException('Round not found.');
        }

        $prediction = $this->predictions->findOneForUserInRound($user, $round);
        if ($prediction === null) {
            return JsonResponse::fromJsonString('null');
        }

        return new JsonResponse([
            'id' => (string) $prediction->getId(),
            'roundId' => (string) $round->getId(),
            'lat' => $prediction->getLat(),
            'lng' => $prediction->getLng(),
            'creditsStaked' => $prediction->getCreditsStaked(),
            'distanceKm' => $prediction->getDistanceKm(),
            'rank' => $prediction->getRank(),
            'payout' => $prediction->getPayout(),
            'placedAt' => $prediction->getPlacedAt()->format(\DateTimeInterface::ATOM),
        ]);
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
            'answerPoints' => $round->getAnswerPoints(),
        ];
    }
}
