<?php

declare(strict_types=1);

namespace App\Controller\Auth;

use App\Service\Siwe\SiweNonceService;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpKernel\Exception\BadRequestHttpException;
use Symfony\Component\Routing\Attribute\Route;

final class NonceController
{
    public function __construct(private readonly SiweNonceService $nonces)
    {
    }

    /**
     * POST /api/auth/nonce
     *
     * Body: { "address": "0x…" }   (40 hex chars after 0x)
     * Returns: { "nonce": "..." }
     *
     * Caller next signs a SIWE message containing this nonce and submits
     * it to /api/auth/verify. The nonce is one-shot and TTL'd to 5 min.
     */
    #[Route('/auth/nonce', name: 'api_auth_nonce', methods: ['POST'])]
    public function __invoke(Request $request): JsonResponse
    {
        $body = $this->decodeJson($request);

        $address = isset($body['address']) && \is_string($body['address'])
            ? trim($body['address'])
            : null;

        if (!$address || !preg_match('/^0x[a-fA-F0-9]{40}$/', $address)) {
            throw new BadRequestHttpException('Field "address" must be a 0x-prefixed 40-hex-char Ethereum address.');
        }

        $nonce = $this->nonces->issue($address);

        return new JsonResponse([
            'nonce' => $nonce,
            'address' => strtolower($address),
            'expiresIn' => 300,
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
}
