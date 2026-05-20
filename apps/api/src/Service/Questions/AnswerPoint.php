<?php

declare(strict_types=1);

namespace App\Service\Questions;

/**
 * One geographic point that counts as a "correct answer" for a round.
 *
 * Most rounds have exactly one of these (the canonical answer). Multi-winner
 * rounds have two or more — e.g. if Madrid and Athens tie at exactly the
 * same max temperature, both pins are correct and the player scores against
 * the closer of the two.
 *
 * `name` is informational only (e.g. "Madrid"), used in UI tooltips and
 * audit logs. Distance math relies on (lat, lng) only.
 */
final class AnswerPoint
{
    public function __construct(
        public readonly float $lat,
        public readonly float $lng,
        public readonly string $name = '',
    ) {
    }

    /** @return array{lat: float, lng: float, name: string} */
    public function toArray(): array
    {
        return ['lat' => $this->lat, 'lng' => $this->lng, 'name' => $this->name];
    }
}
