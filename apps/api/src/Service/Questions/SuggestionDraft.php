<?php

declare(strict_types=1);

namespace App\Service\Questions;

/**
 * Immutable proposal from a resolver — "here's a question I think is
 * answerable, you (admin) can publish it as a real round."
 *
 * The suggest() side of a ResolverInterface returns one of these (or null
 * if no candidate today). Crons store them in round_suggestions where
 * admin can pick and publish.
 */
final class SuggestionDraft
{
    /**
     * @param array<string, mixed> $resolverParams params that resolve()
     *        will receive verbatim — e.g. the target date string
     * @param array<string, mixed> $preview opaque JSON-able context
     *        shown in the admin UI ("Madrid forecast: 34°C", etc.)
     */
    public function __construct(
        public readonly string $resolverCode,
        public readonly array $resolverParams,
        public readonly string $question,
        public readonly \DateTimeImmutable $opensAt,
        public readonly \DateTimeImmutable $closesAt,
        public readonly \DateTimeImmutable $resolvesAt,
        public readonly array $preview = [],
    ) {
    }
}
