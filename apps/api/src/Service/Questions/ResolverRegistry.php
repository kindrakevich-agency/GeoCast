<?php

declare(strict_types=1);

namespace App\Service\Questions;

use Symfony\Component\DependencyInjection\Attribute\AutowireIterator;

/**
 * Code → resolver index. Populated automatically from any service tagged
 * `app.question_resolver` (autoconfigure handles the tagging via the
 * attribute on ResolverInterface).
 */
final class ResolverRegistry
{
    /** @var array<string, ResolverInterface> */
    private array $byCode = [];

    /**
     * @param iterable<ResolverInterface> $resolvers
     */
    public function __construct(
        #[AutowireIterator('app.question_resolver')]
        iterable $resolvers,
    ) {
        foreach ($resolvers as $r) {
            $code = $r->code();
            if (isset($this->byCode[$code])) {
                throw new \LogicException(sprintf(
                    'Duplicate resolver code "%s" — registered by both %s and %s.',
                    $code,
                    $this->byCode[$code]::class,
                    $r::class,
                ));
            }
            $this->byCode[$code] = $r;
        }
    }

    public function get(string $code): ResolverInterface
    {
        if (!isset($this->byCode[$code])) {
            throw new \InvalidArgumentException(sprintf('Unknown resolver code "%s".', $code));
        }
        return $this->byCode[$code];
    }

    public function has(string $code): bool
    {
        return isset($this->byCode[$code]);
    }

    /** @return iterable<ResolverInterface> */
    public function all(): iterable
    {
        return array_values($this->byCode);
    }
}
