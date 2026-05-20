<?php

declare(strict_types=1);

namespace App\Controller\Admin;

use App\Entity\Round;
use App\Repository\RoundRepository;
use App\Service\Onchain\SettlementBuilder;
use App\Service\Round\ResolveRoundService;
use App\Service\Round\RoundService;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpKernel\Exception\BadRequestHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Uid\Ulid;

/**
 * Admin round CRUD + lifecycle. Gated by ROLE_ADMIN via security.yaml
 * access_control (^/admin → ROLE_ADMIN); the controller itself trusts
 * the firewall and doesn't re-check.
 */
final class AdminRoundsController
{
    public function __construct(
        private readonly RoundService $rounds,
        private readonly ResolveRoundService $resolver,
        private readonly RoundRepository $repo,
        private readonly SettlementBuilder $settler,
    ) {
    }

    /**
     * GET /api/admin/rounds
     *
     * Lists every round, newest first — drives the admin dashboard.
     */
    #[Route('/admin/rounds', name: 'api_admin_rounds_list', methods: ['GET'])]
    public function list(): JsonResponse
    {
        $rounds = $this->repo->createQueryBuilder('r')
            ->orderBy('r.number', 'DESC')
            ->getQuery()
            ->getResult();

        return new JsonResponse(array_map(fn(Round $r) => $this->serialize($r), $rounds));
    }

    /**
     * POST /api/admin/rounds
     *
     * Body: { question, description?, opensAt (ISO), closesAt (ISO) }
     * Returns the created round (status=scheduled).
     */
    #[Route('/admin/rounds', name: 'api_admin_rounds_create', methods: ['POST'])]
    public function create(Request $request): JsonResponse
    {
        $body = $this->decodeJson($request);

        $question = isset($body['question']) && \is_string($body['question']) ? trim($body['question']) : null;
        if (!$question || \strlen($question) > 280) {
            throw new BadRequestHttpException('"question" must be a non-empty string ≤ 280 chars.');
        }

        $opensAt  = $this->parseDate($body['opensAt'] ?? null, 'opensAt');
        $closesAt = $this->parseDate($body['closesAt'] ?? null, 'closesAt');
        if ($closesAt <= $opensAt) {
            throw new BadRequestHttpException('"closesAt" must be after "opensAt".');
        }

        $description = isset($body['description']) && \is_string($body['description']) ? trim($body['description']) : null;

        $round = $this->rounds->create($question, $opensAt, $closesAt, $description ?: null);

        return new JsonResponse($this->serialize($round), 201);
    }

    /**
     * POST /api/admin/rounds/{id}/open
     */
    #[Route('/admin/rounds/{id}/open', name: 'api_admin_rounds_open', methods: ['POST'])]
    public function open(string $id): JsonResponse
    {
        $round = $this->loadRound($id);
        $round = $this->rounds->open($round);

        return new JsonResponse($this->serialize($round));
    }

    /**
     * POST /api/admin/rounds/{id}/settle
     *
     * Body: { answerLat, answerLng }
     * Returns: { merkleRoot, rakeMicros, totalPayoutMicros, leafCount, dustMicros, roundNumber }
     *
     * Pure off-chain settler — computes the Merkle root for an on-chain
     * round from the Revealed events already in onchain_events. Does NOT
     * touch any DB tables outside settlement_proofs. The admin frontend
     * then takes the returned merkleRoot and signs
     * GeoCastPool.resolve(roundNumber, lat*1e6, lng*1e6, merkleRoot)
     * via their wallet to post it on-chain.
     */
    #[Route('/admin/rounds/{id}/settle', name: 'api_admin_rounds_settle', methods: ['POST'])]
    public function settle(string $id, Request $request): JsonResponse
    {
        $round = $this->loadRound($id);

        $body = $this->decodeJson($request);
        $lat = isset($body['answerLat']) && \is_numeric($body['answerLat']) ? (float) $body['answerLat'] : null;
        $lng = isset($body['answerLng']) && \is_numeric($body['answerLng']) ? (float) $body['answerLng'] : null;
        if ($lat === null || $lng === null) {
            throw new BadRequestHttpException('Body must contain numeric "answerLat" and "answerLng".');
        }

        try {
            $result = $this->settler->settle($round->getNumber(), $lat, $lng);
        } catch (\RuntimeException $e) {
            throw new BadRequestHttpException($e->getMessage());
        }

        return new JsonResponse([
            ...$result,
            'roundNumber' => $round->getNumber(),
        ]);
    }

    /**
     * POST /api/admin/rounds/{id}/resolve
     *
     * Body: { answerLat, answerLng }
     * Returns the resolved round + the ranked rows.
     */
    #[Route('/admin/rounds/{id}/resolve', name: 'api_admin_rounds_resolve', methods: ['POST'])]
    public function resolve(string $id, Request $request): JsonResponse
    {
        $round = $this->loadRound($id);

        $body = $this->decodeJson($request);
        $lat = isset($body['answerLat']) && \is_numeric($body['answerLat']) ? (float) $body['answerLat'] : null;
        $lng = isset($body['answerLng']) && \is_numeric($body['answerLng']) ? (float) $body['answerLng'] : null;
        if ($lat === null || $lng === null) {
            throw new BadRequestHttpException('Body must contain numeric "answerLat" and "answerLng".');
        }

        $rows = $this->resolver->resolve($round, $lat, $lng);

        return new JsonResponse([
            'round' => $this->serialize($round),
            'rankings' => $rows,
        ]);
    }

    private function loadRound(string $id): Round
    {
        if (!Ulid::isValid($id)) {
            throw new NotFoundHttpException(sprintf('Round "%s" not found.', $id));
        }
        $round = $this->repo->find(Ulid::fromString($id));
        if ($round === null) {
            throw new NotFoundHttpException(sprintf('Round "%s" not found.', $id));
        }

        return $round;
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
            'resolvesAt' => $round->getResolvesAt()?->format(\DateTimeInterface::ATOM),
            'resolvedAt' => $round->getResolvedAt()?->format(\DateTimeInterface::ATOM),
            'poolCredits' => $round->getPoolCredits(),
            'totalParticipants' => $round->getTotalParticipants(),
            'status' => $round->getStatus()->value,
            'answer' => $answer,
            'answerPoints' => $round->getAnswerPoints(),
            'autoResolverCode' => $round->getAutoResolverCode(),
            'autoResolverParams' => $round->getAutoResolverParams(),
        ];
    }

    private function parseDate(mixed $raw, string $field): \DateTimeImmutable
    {
        if (!\is_string($raw) || $raw === '') {
            throw new BadRequestHttpException("\"$field\" must be an ISO datetime string.");
        }
        try {
            return new \DateTimeImmutable($raw);
        } catch (\Exception $e) {
            throw new BadRequestHttpException("Invalid \"$field\" datetime: {$e->getMessage()}");
        }
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
