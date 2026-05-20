<?php

declare(strict_types=1);

namespace App\Service\Questions;

/**
 * What a resolver hands back when it finishes looking up the truth.
 *
 * `points` is the canonical answer set — one entry for single-winner rounds,
 * two+ when the source data was a true tie that survived our tie-break.
 *
 * `context` is free-form JSON saved into the round's resolution log
 * (winner's actual reading, runners-up, the API call that produced it).
 * Future audit / debugging only — not surfaced in the player UI.
 */
final class ResolutionResult
{
    /**
     * @param list<AnswerPoint> $points
     * @param array<string, mixed> $context
     */
    public function __construct(
        public readonly array $points,
        public readonly array $context = [],
    ) {
        if ($points === []) {
            throw new \InvalidArgumentException('ResolutionResult requires at least one answer point.');
        }
    }
}
