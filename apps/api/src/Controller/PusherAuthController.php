<?php

declare(strict_types=1);

namespace App\Controller;

use App\Entity\User;
use App\Service\Broadcast\PusherBroadcaster;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Exception\BadRequestHttpException;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Symfony\Component\Routing\Attribute\Route;

/**
 * Authorizes Pusher private + presence channel subscriptions.
 *
 * Pusher's JS client POSTs `socket_id` + `channel_name` to a server-side
 * endpoint when joining a private-* or presence-* channel. Our endpoint
 * verifies the caller via JWT (already gated by the firewall) and signs
 * the channel name with the Pusher app secret — Pusher then trusts the
 * client's subscription.
 *
 * Presence channel payload includes the caller's wallet + ULID so the
 * frontend can render "247 explorers playing" + show their cursors.
 */
final class PusherAuthController
{
    public function __construct(
        private readonly PusherBroadcaster $broadcaster,
        private readonly Security $security,
    ) {
    }

    /**
     * POST /api/pusher/auth
     *
     * Form-encoded (per Pusher convention): socket_id, channel_name
     * Returns: { auth: "<key>:<sig>" } (plus channel_data for presence channels)
     */
    #[Route('/pusher/auth', name: 'api_pusher_auth', methods: ['POST'])]
    public function __invoke(Request $request): Response
    {
        if (!$this->broadcaster->isEnabled()) {
            throw new HttpException(503, 'Real-time broadcasts are not configured.');
        }

        $socketId = $request->request->get('socket_id') ?? $request->query->get('socket_id');
        $channel  = $request->request->get('channel_name') ?? $request->query->get('channel_name');

        if (!\is_string($socketId) || !\is_string($channel) || $socketId === '' || $channel === '') {
            throw new BadRequestHttpException('socket_id and channel_name are required.');
        }

        /** @var User $user */
        $user = $this->security->getUser();
        $presence = [
            'user_id' => (string) $user->getId(),
            'user_info' => [
                'wallet' => $user->getWalletAddress(),
                'isAdmin' => $user->isAdmin(),
            ],
        ];

        $authBody = $this->broadcaster->authorizeChannel($socketId, $channel, $presence);

        // Pusher's JS client expects the body as raw JSON (the PHP server's
        // socket_auth/presence_auth methods return a JSON string ready to
        // pass through unchanged).
        return new Response($authBody, 200, ['Content-Type' => 'application/json']);
    }
}
