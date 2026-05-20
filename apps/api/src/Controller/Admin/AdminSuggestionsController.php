<?php

declare(strict_types=1);

namespace App\Controller\Admin;

use App\Entity\RoundSuggestion;
use App\Enum\SuggestionStatus;
use App\Repository\RoundSuggestionRepository;
use App\Service\Round\RoundService;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Uid\Ulid;

/**
 * Admin endpoints for the question-suggestion queue.
 *
 *   GET    /api/admin/suggestions               → pending suggestions
 *   POST   /api/admin/suggestions/{id}/accept   → publish as a real Round
 *   POST   /api/admin/suggestions/{id}/reject   → dismiss
 *
 * Routes are firewall-gated by ROLE_ADMIN through security.yaml's
 * `^/admin` access_control rule.
 */
final class AdminSuggestionsController
{
    public function __construct(
        private readonly RoundSuggestionRepository $suggestions,
        private readonly RoundService $rounds,
        private readonly EntityManagerInterface $em,
    ) {
    }

    #[Route('/admin/suggestions', name: 'api_admin_suggestions_list', methods: ['GET'])]
    public function list(): JsonResponse
    {
        $pending = $this->suggestions->findPending();
        return new JsonResponse(array_map(fn ($s) => $this->serialize($s), $pending));
    }

    #[Route('/admin/suggestions/{id}/accept', name: 'api_admin_suggestions_accept', methods: ['POST'])]
    public function accept(string $id): JsonResponse
    {
        $suggestion = $this->load($id);
        if ($suggestion->getStatus() !== SuggestionStatus::Pending) {
            throw new ConflictHttpException(sprintf(
                'Suggestion is %s — only pending suggestions can be accepted.',
                $suggestion->getStatus()->value,
            ));
        }

        $round = $this->rounds->createWithAutoResolver(
            $suggestion->getProposedQuestion(),
            $suggestion->getProposedOpensAt(),
            $suggestion->getProposedClosesAt(),
            $suggestion->getProposedResolvesAt(),
            $suggestion->getResolverCode(),
            $suggestion->getResolverParams(),
        );

        $suggestion->setStatus(SuggestionStatus::Accepted);
        $suggestion->setUsedForRoundId($round->getId());
        $this->em->flush();

        return new JsonResponse([
            'suggestion' => $this->serialize($suggestion),
            'round' => [
                'id' => (string) $round->getId(),
                'number' => $round->getNumber(),
                'question' => $round->getQuestion(),
                'opensAt' => $round->getOpensAt()->format(\DateTimeInterface::ATOM),
                'closesAt' => $round->getClosesAt()->format(\DateTimeInterface::ATOM),
                'resolvesAt' => $round->getResolvesAt()?->format(\DateTimeInterface::ATOM),
                'status' => $round->getStatus()->value,
                'autoResolverCode' => $round->getAutoResolverCode(),
            ],
        ]);
    }

    #[Route('/admin/suggestions/{id}/reject', name: 'api_admin_suggestions_reject', methods: ['POST'])]
    public function reject(string $id): JsonResponse
    {
        $suggestion = $this->load($id);
        if ($suggestion->getStatus() !== SuggestionStatus::Pending) {
            throw new ConflictHttpException(sprintf(
                'Suggestion is %s — only pending suggestions can be rejected.',
                $suggestion->getStatus()->value,
            ));
        }
        $suggestion->setStatus(SuggestionStatus::Rejected);
        $this->em->flush();

        return new JsonResponse($this->serialize($suggestion));
    }

    private function load(string $id): RoundSuggestion
    {
        if (!Ulid::isValid($id)) {
            throw new NotFoundHttpException(sprintf('Suggestion "%s" not found.', $id));
        }
        $s = $this->suggestions->find(Ulid::fromString($id));
        if ($s === null) {
            throw new NotFoundHttpException(sprintf('Suggestion "%s" not found.', $id));
        }
        return $s;
    }

    /** @return array<string, mixed> */
    private function serialize(RoundSuggestion $s): array
    {
        return [
            'id' => (string) $s->getId(),
            'resolverCode' => $s->getResolverCode(),
            'resolverParams' => $s->getResolverParams(),
            'question' => $s->getProposedQuestion(),
            'opensAt' => $s->getProposedOpensAt()->format(\DateTimeInterface::ATOM),
            'closesAt' => $s->getProposedClosesAt()->format(\DateTimeInterface::ATOM),
            'resolvesAt' => $s->getProposedResolvesAt()->format(\DateTimeInterface::ATOM),
            'status' => $s->getStatus()->value,
            'preview' => $s->getPreviewJson(),
            'createdAt' => $s->getCreatedAt()->format(\DateTimeInterface::ATOM),
            'usedForRoundId' => $s->getUsedForRoundId() ? (string) $s->getUsedForRoundId() : null,
        ];
    }
}
