<?php

declare(strict_types=1);

namespace App\Service\Broadcast;

use Pusher\Pusher;
use Psr\Log\LoggerInterface;

/**
 * Lightweight wrapper over the Pusher PHP client.
 *
 * Becomes a silent no-op when PUSHER_APP_ID is empty — that way the API
 * works end-to-end on a fresh server without Pusher creds; the frontend
 * just won't see real-time events until creds are wired into .env.local.
 *
 * All broadcast methods catch every Throwable so a Pusher hiccup never
 * fails the underlying request. The DB write has already committed by
 * the time we get here; losing a single real-time event is acceptable.
 */
final class PusherBroadcaster
{
    private readonly ?Pusher $client;

    public function __construct(
        ?LoggerInterface $logger,
        string $appId = '',
        string $key = '',
        string $secret = '',
        string $cluster = 'eu',
    ) {
        $this->logger = $logger;

        if ($appId === '' || $key === '' || $secret === '') {
            $this->client = null;

            return;
        }

        $this->client = new Pusher($key, $secret, $appId, [
            'cluster' => $cluster,
            'useTLS' => true,
        ]);
    }

    private readonly ?LoggerInterface $logger;

    /**
     * Fired after each successful pin placement.
     *
     * Channel: round-{id}    Event: pin-placed
     * Payload: { count, balance? }
     */
    public function broadcastPinPlaced(string $roundId, int $count, int $pool): void
    {
        $this->trigger("round-$roundId", 'pin-placed', [
            'count' => $count,
            'pool' => $pool,
        ]);
    }

    /**
     * Fired once after a round resolves.
     *
     * Channel: round-{id}    Event: round-resolved
     * Payload: { answer: {lat,lng}, rankings: [...] }
     *
     * The frontend listens on this to play the resolution choreography
     * (answer pin drop, camera flyTo, leaderboard slide-in, confetti).
     */
    public function broadcastRoundResolved(string $roundId, float $answerLat, float $answerLng, array $rankings): void
    {
        $this->trigger("round-$roundId", 'round-resolved', [
            'answer' => ['lat' => $answerLat, 'lng' => $answerLng],
            'rankings' => $rankings,
        ]);
    }

    /**
     * Fired after a round resolves so any client subscribed to the
     * leaderboard channel can refetch.
     *
     * Channel: leaderboard    Event: leaderboard-updated
     */
    public function broadcastLeaderboardUpdated(): void
    {
        $this->trigger('leaderboard', 'leaderboard-updated', ['updatedAt' => (new \DateTimeImmutable())->format(\DateTimeInterface::ATOM)]);
    }

    /**
     * Auth for private + presence channels. Used by /api/pusher/auth.
     *
     * @param array{user_id: string, user_info?: array<string, mixed>}|null $presenceData
     */
    public function authorizeChannel(string $socketId, string $channelName, ?array $presenceData = null): string
    {
        if ($this->client === null) {
            throw new \RuntimeException('Pusher credentials are not configured.');
        }

        if (str_starts_with($channelName, 'presence-')) {
            $data = $presenceData ?? ['user_id' => 'anonymous'];

            return $this->client->authorizePresenceChannel($channelName, $socketId, $data['user_id'], $data['user_info'] ?? null);
        }

        return $this->client->authorizeChannel($channelName, $socketId);
    }

    public function isEnabled(): bool
    {
        return $this->client !== null;
    }

    /** @param array<string, mixed> $payload */
    private function trigger(string $channel, string $event, array $payload): void
    {
        if ($this->client === null) {
            return; // no-op when Pusher isn't configured
        }
        try {
            $this->client->trigger($channel, $event, $payload);
        } catch (\Throwable $e) {
            $this->logger?->warning('Pusher broadcast failed', [
                'channel' => $channel,
                'event' => $event,
                'exception' => $e,
            ]);
        }
    }
}
