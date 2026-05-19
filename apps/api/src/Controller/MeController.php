<?php

declare(strict_types=1);

namespace App\Controller;

use App\Entity\User;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;

final class MeController
{
    public function __construct(private readonly Security $security)
    {
    }

    /**
     * GET /api/me
     *
     * Returns the JWT-authenticated user's profile. 401 when no/invalid token
     * (handled by the firewall before this controller runs).
     */
    #[Route('/me', name: 'api_me', methods: ['GET'])]
    public function __invoke(): JsonResponse
    {
        /** @var User|null $user */
        $user = $this->security->getUser();
        if ($user === null) {
            return new JsonResponse(['error' => 'Not authenticated'], 401);
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
}
