<?php

declare(strict_types=1);

namespace App\Controller;

use App\Entity\User;
use App\Repository\RoundRepository;
use App\Service\Prediction\PlacePredictionService;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpKernel\Exception\BadRequestHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Uid\Ulid;

final class PredictionsController
{
    public function __construct(
        private readonly Security $security,
        private readonly RoundRepository $rounds,
        private readonly PlacePredictionService $placer,
    ) {
    }

    /**
     * POST /api/rounds/{id}/predictions
     *
     * Body: { "lat": number, "lng": number }
     * JWT-required (the catch-all `api` firewall handles auth before this
     * controller fires; an anonymous request returns 401 from the firewall).
     *
     * Returns {prediction, balance, pool} on success.
     */
    #[Route('/rounds/{id}/predictions', name: 'api_predictions_place', methods: ['POST'])]
    public function place(string $id, Request $request): JsonResponse
    {
        if (!Ulid::isValid($id)) {
            throw new NotFoundHttpException(sprintf('Round "%s" not found.', $id));
        }
        $round = $this->rounds->find(Ulid::fromString($id));
        if ($round === null) {
            throw new NotFoundHttpException(sprintf('Round "%s" not found.', $id));
        }

        /** @var User $user */
        $user = $this->security->getUser();

        $body = $this->decodeJson($request);
        $lat = isset($body['lat']) && (\is_int($body['lat']) || \is_float($body['lat'])) ? (float) $body['lat'] : null;
        $lng = isset($body['lng']) && (\is_int($body['lng']) || \is_float($body['lng'])) ? (float) $body['lng'] : null;
        if ($lat === null || $lng === null) {
            throw new BadRequestHttpException('Body must contain numeric "lat" and "lng".');
        }

        $prediction = $this->placer->place($user, $round, $lat, $lng);

        return new JsonResponse([
            'prediction' => [
                'id' => (string) $prediction->getId(),
                'roundId' => (string) $round->getId(),
                'lat' => $prediction->getLat(),
                'lng' => $prediction->getLng(),
                'creditsStaked' => $prediction->getCreditsStaked(),
                'placedAt' => $prediction->getPlacedAt()->format(\DateTimeInterface::ATOM),
            ],
            'balance' => $user->getCreditsBalance(),
            'pool' => $round->getPoolCredits(),
            'participants' => $round->getTotalParticipants(),
        ], 201);
    }

    /** @return array<string, mixed> */
    private function decodeJson(Request $request): array
    {
        $raw = $request->getContent();
        if ($raw === '') {
            throw new BadRequestHttpException('Request body must be JSON.');
        }
        try {
            $decoded = json_decode($raw, true, flags: JSON_THROW_ON_ERROR);
        } catch (\JsonException $e) {
            throw new BadRequestHttpException('Invalid JSON: '.$e->getMessage());
        }
        if (!\is_array($decoded)) {
            throw new BadRequestHttpException('Request body must be a JSON object.');
        }

        return $decoded;
    }
}
