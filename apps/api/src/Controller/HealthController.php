<?php

declare(strict_types=1);

namespace App\Controller;

use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;

final class HealthController
{
    // NOTE: nginx mounts this Symfony app at /api/* via fastcgi_param
    // SCRIPT_FILENAME=apps/api/public/index.php with SCRIPT_NAME=/api/index.php.
    // Symfony's BasePath = /api so routes register as relative paths.
    #[Route('/health', name: 'api_health', methods: ['GET'])]
    public function __invoke(): JsonResponse
    {
        return new JsonResponse([
            'status' => 'ok',
            'service' => 'geocast-api',
            'time' => (new \DateTimeImmutable())->format(\DateTimeInterface::ATOM),
        ]);
    }
}
