<?php

declare(strict_types=1);

namespace App\Controller\Auth;

use App\Entity\User;
use App\Service\Siwe\SiweVerificationException;
use App\Service\Siwe\SiweVerifier;
use App\Service\User\UserProvisioner;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpKernel\Exception\BadRequestHttpException;
use Symfony\Component\HttpKernel\Exception\UnauthorizedHttpException;
use Symfony\Component\Routing\Attribute\Route;

final class VerifyController
{
    public function __construct(
        private readonly SiweVerifier $verifier,
        private readonly UserProvisioner $provisioner,
        private readonly JWTTokenManagerInterface $jwt,
    ) {
    }

    /**
     * POST /api/auth/verify
     *
     * Body: { "message": "<SIWE message>", "signature": "0x…" }
     * Returns: { "token": "<JWT>", "user": { ... } }
     *
     * Consumes the previously-issued nonce, verifies the signature
     * recovers the claimed address, finds-or-creates the User row, and
     * returns a JWT scoped to that user's wallet. 401 on any verification
     * failure (bad signature, expired nonce, address mismatch, etc.).
     */
    #[Route('/auth/verify', name: 'api_auth_verify', methods: ['POST'])]
    public function __invoke(Request $request): JsonResponse
    {
        $body = $this->decodeJson($request);

        $message = isset($body['message']) && \is_string($body['message']) ? $body['message'] : null;
        $signature = isset($body['signature']) && \is_string($body['signature']) ? $body['signature'] : null;

        if (!$message || !$signature) {
            throw new BadRequestHttpException('Body must contain "message" (string) and "signature" (0x-prefixed hex).');
        }

        try {
            $parsed = $this->verifier->verify($message, $signature);
        } catch (SiweVerificationException $e) {
            throw new UnauthorizedHttpException('SIWE', $e->getMessage(), $e);
        }

        $user = $this->provisioner->findOrCreate($parsed->address);
        $token = $this->jwt->create($user);

        return new JsonResponse([
            'token' => $token,
            'user' => $this->serializeUser($user),
        ]);
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

    /** @return array<string, mixed> */
    private function serializeUser(User $user): array
    {
        return [
            'id' => (string) $user->getId(),
            'walletAddress' => $user->getWalletAddress(),
            'creditsBalance' => $user->getCreditsBalance(),
            'gamesPlayed' => $user->getGamesPlayed(),
            'totalScore' => $user->getTotalScore(),
            'isAdmin' => $user->isAdmin(),
            'createdAt' => $user->getCreatedAt()->format(\DateTimeInterface::ATOM),
        ];
    }
}
