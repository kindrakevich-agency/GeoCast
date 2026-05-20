<?php

declare(strict_types=1);

namespace App\Controller;

use App\Entity\User;
use App\Service\Onchain\SettlementBuilder;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;

/**
 * GET /api/rounds/{id}/claim-proof
 *
 * Returns the authenticated caller's Merkle proof for a resolved round,
 * or null when there's nothing to claim (caller didn't participate,
 * round not yet settled, or already claimed via tx).
 *
 * Auth-gated: needs to know which wallet the caller is. Frontend's
 * /me page polls this for each of the user's recent rounds and exposes
 * a Claim button when a non-null result lands.
 */
final class ClaimProofController
{
    public function __construct(
        private readonly Security $security,
        private readonly SettlementBuilder $settler,
    ) {
    }

    #[Route('/rounds/{id}/claim-proof', name: 'api_rounds_claim_proof', methods: ['GET'])]
    public function __invoke(int $id): JsonResponse
    {
        $user = $this->security->getUser();
        if (!$user instanceof User) {
            return new JsonResponse(['error' => 'Not authenticated'], 401);
        }

        $proof = $this->settler->getProof($id, $user->getWalletAddress());
        if ($proof === null) {
            return JsonResponse::fromJsonString('null');
        }

        return new JsonResponse([
            'roundId' => $id,
            'amount' => (string) $proof['amountMicros'],   // numeric-string for big ints
            'amountUsdc' => $proof['amountMicros'] / 1_000_000,
            'proof' => $proof['proof'],
            'merkleRoot' => $proof['merkleRoot'],
            'distanceKm' => $proof['distanceKm'],
            'rank' => $proof['rank'],
        ]);
    }
}
