<?php

declare(strict_types=1);

namespace App\Service\Questions;

use Symfony\Component\DependencyInjection\Attribute\AutoconfigureTag;

/**
 * Pluggable question resolver. Each implementation knows two things:
 *
 *   1. How to PROPOSE a candidate daily question — what to ask, when to
 *      open/close/resolve, what parameters its resolve() will need later.
 *   2. How to RESOLVE the question at resolves_at time — fetch the truth
 *      from an external API, return the winning coordinates.
 *
 * Implementations are auto-discovered via the `app.question_resolver` tag
 * (autoconfigure does this), collected by ResolverRegistry, and looked up
 * by `code()` from the round's auto_resolver_code column.
 */
#[AutoconfigureTag('app.question_resolver')]
interface ResolverInterface
{
    /**
     * Stable identifier for this resolver. Stored in the round row, used
     * as the registry key. Should never change once shipped — past rounds
     * reference it. Naming convention: "source.short-question".
     */
    public function code(): string;

    /**
     * Propose a candidate question for the given moment. Return null when
     * this resolver has nothing useful to suggest today (e.g. the data
     * source is down, or no forecast is dramatic enough to be interesting).
     */
    public function suggest(\DateTimeImmutable $now): ?SuggestionDraft;

    /**
     * Look up the truth and return the winning answer points.
     *
     * @param array<string, mixed> $params the same params that suggest() put
     *        into SuggestionDraft::$resolverParams
     * @throws \RuntimeException when the truth cannot be determined yet
     *         (admin should see this and either retry or resolve manually)
     */
    public function resolve(array $params, \DateTimeImmutable $resolvesAt): ResolutionResult;
}
